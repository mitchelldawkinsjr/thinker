import type { Idea } from '../data/types'
import type { Thought } from '../data/thoughts'
import { tokens, scoreText } from './exploreFast'
import type { ExploreContext } from './ollama'

/** A retrievable unit of the user's personal library. */
export type KeptDoc = {
  id: string
  kind: 'idea' | 'thought' | 'scripture'
  title: string
  /** Full text used for retrieval + the LLM snippet */
  text: string
  source?: string
  topicId?: string
}

const SNIPPET_CHARS = 280

function ideaText(idea: Idea): string {
  return [idea.body, idea.lesson, idea.takeaway, idea.example]
    .filter(Boolean)
    .join(' ')
}

/**
 * Flatten everything the user keeps — kept idea cards, listening notes,
 * scripture takeaways — into docs for retrieval.
 */
export function buildKeptDocs(opts: {
  keptIds: Iterable<string>
  ideaPool: Idea[]
  thoughts: Thought[]
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

  return docs
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
    .map((d) => ({
      d,
      score:
        scoreText(d.title, qTokens) * 2 +
        scoreText(d.text, qTokens) +
        (ctx.topicId && d.topicId === ctx.topicId ? 2 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.d)
}

/** Compact THOUGHTS block for the system prompt. */
export function formatKeptBlock(docs: KeptDoc[]): string {
  return docs
    .map((d) => {
      const snippet =
        d.text.length > SNIPPET_CHARS
          ? `${d.text.slice(0, SNIPPET_CHARS - 1).trimEnd()}…`
          : d.text
      const label =
        d.kind === 'scripture' ? 'scripture' : d.kind === 'thought' ? 'thought' : 'kept idea'
      return `- [${label}] ${d.title}: ${snippet}`
    })
    .join('\n')
}
