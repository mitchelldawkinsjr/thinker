import type { Idea } from '../data/types'
import type { Thought } from '../data/thoughts'
import type { ZettelLink, ZettelNote } from '../data/zettel'
import { linkedNoteIds } from '../data/zettel'
import { tokens, scoreText } from './exploreFast'
import type { ExploreContext } from './ollama'

/** A retrievable unit of the user's personal library. */
export type KeptDoc = {
  id: string
  kind: 'idea' | 'thought' | 'scripture' | 'zettel'
  title: string
  /** Full text used for retrieval + the LLM snippet */
  text: string
  source?: string
  topicId?: string
  /** True when this doc was pulled in via a link from a scored hit */
  viaLink?: boolean
  linkKind?: string
}

const SNIPPET_CHARS = 280
/** Soft budget for the THOUGHTS block sent to the model */
const CONTEXT_CHAR_BUDGET = 3200
const PRIMARY_LIMIT = 5
const NEIGHBOR_LIMIT = 8

function ideaText(idea: Idea): string {
  return [idea.body, idea.lesson, idea.takeaway, idea.example]
    .filter(Boolean)
    .join(' ')
}

/**
 * Flatten kept ideas, thoughts, and slip-box notes into docs for retrieval.
 */
export function buildKeptDocs(opts: {
  keptIds: Iterable<string>
  ideaPool: Idea[]
  thoughts: Thought[]
  zettelNotes?: ZettelNote[]
}): KeptDoc[] {
  const docs: KeptDoc[] = []
  const byId = new Map(opts.ideaPool.map((i) => [i.id, i]))
  // Promoted thoughts also live in the kept set as ideas — skip the duplicate.
  const promotedIds = new Set(
    opts.thoughts.map((t) => t.promotedIdeaId).filter(Boolean),
  )

  for (const t of opts.thoughts) {
    const isScripture = t.parent.kind === 'scripture'
    const parts = [
      t.note,
      isScripture && t.parent.verseText ? `"${t.parent.verseText}"` : null,
      t.parent.body,
    ].filter(Boolean) as string[]
    if (parts.length === 0) continue
    docs.push({
      id: t.id,
      kind: isScripture ? 'scripture' : 'thought',
      title: isScripture
        ? (t.parent.reference ?? t.parent.title)
        : t.parent.title,
      text: parts.join(' — '),
      source: t.parent.source,
      topicId: t.parent.topicId,
    })
  }

  for (const id of opts.keptIds) {
    if (promotedIds.has(id)) continue
    const idea = byId.get(id)
    if (!idea) continue
    docs.push({
      id: idea.id,
      kind: 'idea',
      title: idea.title,
      text: ideaText(idea),
      source: idea.source,
      topicId: idea.topicId,
    })
  }

  for (const z of opts.zettelNotes ?? []) {
    const tagLine = (z.tags ?? []).map((t) => `#${t}`).join(' ')
    const text = [z.title, z.body, tagLine].filter(Boolean).join(' — ')
    if (!text.trim()) continue
    docs.push({
      id: z.id,
      kind: 'zettel',
      title: z.title,
      text: [z.body.trim() || z.title, tagLine].filter(Boolean).join(' '),
      topicId: z.topicId,
    })
  }

  return docs
}

function scoreDoc(d: KeptDoc, qTokens: string[], ctx: ExploreContext): number {
  return (
    scoreText(d.title, qTokens) * 2.5 +
    scoreText(d.text, qTokens) +
    (d.kind === 'zettel' ? 0.5 : 0) +
    (ctx.topicId && d.topicId === ctx.topicId ? 2 : 0)
  )
}

/** Keyword-score the user's kept docs against the question. */
export function retrieveKeptDocs(
  docs: KeptDoc[],
  ctx: ExploreContext,
  limit = 6,
): KeptDoc[] {
  const blob = [ctx.question, ctx.ideaTitle, ctx.topicName]
    .filter(Boolean)
    .join(' ')
  const qTokens = tokens(blob)
  if (qTokens.length === 0) return []

  return docs
    .map((d) => ({ d, score: scoreDoc(d, qTokens, ctx) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.d)
}

/**
 * Score slip-box + kept docs, then expand with 1-hop linked zettel neighbors
 * so Ask gets connected ZK context without dumping the whole box.
 */
export function retrieveZettelContext(
  docs: KeptDoc[],
  links: ZettelLink[],
  ctx: ExploreContext,
): KeptDoc[] {
  const blob = [ctx.question, ctx.ideaTitle, ctx.topicName, ctx.ideaBody]
    .filter(Boolean)
    .join(' ')
  const qTokens = tokens(blob)
  if (qTokens.length === 0) return []

  const byId = new Map(docs.map((d) => [d.id, d]))
  const scored = docs
    .map((d) => ({ d, score: scoreDoc(d, qTokens, ctx) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  const primary = scored.slice(0, PRIMARY_LIMIT).map((x) => x.d)
  const seen = new Set(primary.map((d) => d.id))
  const neighbors: KeptDoc[] = []

  for (const hit of primary) {
    if (hit.kind !== 'zettel') continue
    for (const nid of linkedNoteIds(hit.id, links)) {
      if (seen.has(nid)) continue
      const doc = byId.get(nid)
      if (!doc || doc.kind !== 'zettel') continue
      seen.add(nid)
      const edge = links.find(
        (l) =>
          (l.from === hit.id && l.to === nid) || (l.to === hit.id && l.from === nid),
      )
      neighbors.push({
        ...doc,
        viaLink: true,
        linkKind: edge?.kind,
      })
      if (neighbors.length >= NEIGHBOR_LIMIT) break
    }
    if (neighbors.length >= NEIGHBOR_LIMIT) break
  }

  // Prefer neighbors that still weakly match the question, then the rest
  neighbors.sort((a, b) => scoreDoc(b, qTokens, ctx) - scoreDoc(a, qTokens, ctx))

  return [...primary, ...neighbors]
}

function snippet(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

function kindLabel(d: KeptDoc): string {
  if (d.kind === 'scripture') return 'scripture'
  if (d.kind === 'thought') return 'thought'
  if (d.kind === 'zettel') {
    if (d.viaLink) return d.linkKind ? `slip·${d.linkKind}` : 'slip·linked'
    return 'slip'
  }
  return 'kept idea'
}

/**
 * Compact THOUGHTS / slip-box block for the system prompt.
 * Primary hits get longer snippets; linked neighbors get shorter ones.
 * Stops when CONTEXT_CHAR_BUDGET is reached.
 */
export function formatKeptBlock(docs: KeptDoc[]): string {
  if (docs.length === 0) return ''
  const lines: string[] = []
  let used = 0

  for (const d of docs) {
    const max = d.viaLink ? 160 : SNIPPET_CHARS
    const body = snippet(d.text, max)
    const line = `- [${kindLabel(d)}] ${d.title}: ${body}`
    if (used + line.length > CONTEXT_CHAR_BUDGET && lines.length > 0) break
    lines.push(line)
    used += line.length + 1
  }

  return lines.join('\n')
}
