import type { TopicId } from './types'
import type { Thought, ThoughtParent } from './thoughts'
import { isListeningThought } from './thoughts'

/** Atomic slip-box note (zettel). */
export type ZettelNote = {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
  topicId?: TopicId
  /** Free-form tags for maps-of-content style grouping */
  tags?: string[]
  /** Provenance: originating Thought id */
  sourceThoughtId?: string
  /** Provenance: idea card this note is about / derived from */
  sourceIdeaId?: string
}

export type ZettelLinkKind = 'related' | 'extends' | 'supports' | 'source' | 'derived'

export type ZettelLink = {
  id: string
  from: string
  to: string
  kind: ZettelLinkKind
}

export type ZettelExport = {
  exportedAt: string
  source: 'thinker-zettelkasten'
  notes: ZettelNote[]
  links: ZettelLink[]
}

export function newZettelId(): string {
  return `zk-${crypto.randomUUID().slice(0, 10)}`
}

export function newLinkId(): string {
  return `zl-${crypto.randomUUID().slice(0, 10)}`
}

export function shortTitle(text: string, max = 72): string {
  const t = text.trim()
  if (!t) return 'Untitled note'
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

/** Stable slip id for the original card behind a keep. */
export function parentSourceZettelId(parent: ThoughtParent): string {
  return `zk-src-${parent.kind}-${parent.id}`
}

/** Slip representing the source card a thought was kept from. */
export function parentToSourceZettel(parent: ThoughtParent): ZettelNote {
  const now = new Date().toISOString()
  const bodyParts = [
    parent.body?.trim() || null,
    parent.kind === 'scripture' && parent.verseText
      ? `“${parent.verseText}” — ${parent.reference ?? parent.source}`
      : null,
    parent.source ? `Source · ${parent.source}` : null,
  ].filter(Boolean)

  return {
    id: parentSourceZettelId(parent),
    title: shortTitle(parent.title),
    body: bodyParts.join('\n\n') || parent.title,
    createdAt: now,
    updatedAt: now,
    topicId: parent.topicId,
    sourceIdeaId: parent.kind === 'idea' ? parent.id : undefined,
    tags: ['source'],
  }
}

/** Deterministic slip id for a thought. */
export function thoughtZettelId(thoughtId: string): string {
  return `zk-th-${thoughtId}`
}

/** Build a zettel from an existing Thought (migration / sync). */
export function thoughtToZettel(thought: Thought): ZettelNote {
  const note = thought.note.trim()
  const now = thought.createdAt || new Date().toISOString()
  let title: string
  if (note) title = shortTitle(note)
  else if (thought.parent.kind === 'scripture') {
    title = thought.parent.reference ?? thought.parent.title
  } else if (isListeningThought(thought)) {
    title = shortTitle(`Moment · ${thought.parent.title}`)
  } else {
    title = shortTitle(`Kept · ${thought.parent.title}`)
  }

  const bodyParts = [
    note || null,
    thought.parent.kind === 'scripture' && thought.parent.verseText
      ? `“${thought.parent.verseText}” — ${thought.parent.reference ?? ''}`
      : null,
    !note && thought.parent.body ? thought.parent.body : null,
  ].filter(Boolean)

  return {
    id: thoughtZettelId(thought.id),
    title,
    body: bodyParts.join('\n\n') || thought.parent.title,
    createdAt: now,
    updatedAt: now,
    topicId: thought.parent.topicId,
    sourceThoughtId: thought.id,
    // Promoted card id when present; parent idea is linked via a source slip instead
    sourceIdeaId: thought.promotedIdeaId,
  }
}

function ensureLink(
  links: ZettelLink[],
  from: string,
  to: string,
  kind: ZettelLinkKind,
): ZettelLink[] {
  if (from === to) return links
  if (links.some((l) => l.from === from && l.to === to && l.kind === kind)) return links
  return [...links, { id: newLinkId(), from, to, kind }]
}

/**
 * Upsert a thought slip, its parent source slip, and optional promoted-idea slip.
 * Wires `source` (thought → parent) and `derived` (thought → promoted) links.
 */
export function applyThoughtToStack(
  notes: ZettelNote[],
  links: ZettelLink[],
  thought: Thought,
  promotedIdea?: {
    id: string
    title: string
    body: string
    topicId?: TopicId
    takeaway?: string
    hook?: string
  },
): { notes: ZettelNote[]; links: ZettelLink[]; thoughtNote: ZettelNote } {
  const z = thoughtToZettel(thought)
  const parentTemplate = parentToSourceZettel(thought.parent)
  const now = new Date().toISOString()
  let nextNotes = [...notes]
  let nextLinks = [...links]

  const existingThought = nextNotes.find(
    (n) => n.sourceThoughtId === thought.id || n.id === z.id,
  )
  let thoughtNote: ZettelNote
  if (existingThought) {
    thoughtNote = {
      ...existingThought,
      title: z.title,
      body: z.body || existingThought.body,
      updatedAt: now,
      sourceIdeaId: z.sourceIdeaId ?? existingThought.sourceIdeaId,
      topicId: z.topicId ?? existingThought.topicId,
    }
    nextNotes = nextNotes.map((n) => (n.id === existingThought.id ? thoughtNote : n))
  } else {
    thoughtNote = z
    nextNotes = [z, ...nextNotes]
  }

  const existingParent =
    nextNotes.find((n) => n.id === parentTemplate.id) ||
    (thought.parent.kind === 'idea'
      ? nextNotes.find(
          (n) =>
            n.sourceIdeaId === thought.parent.id &&
            !n.sourceThoughtId &&
            n.id !== thoughtNote.id,
        )
      : undefined)

  let parentId: string
  if (existingParent) {
    parentId = existingParent.id
    if (!existingParent.body?.trim() && parentTemplate.body) {
      nextNotes = nextNotes.map((n) =>
        n.id === existingParent.id
          ? { ...n, body: parentTemplate.body, updatedAt: now }
          : n,
      )
    }
  } else {
    parentId = parentTemplate.id
    nextNotes = [parentTemplate, ...nextNotes]
  }

  nextLinks = ensureLink(nextLinks, thoughtNote.id, parentId, 'source')

  if (promotedIdea && promotedIdea.id !== thought.parent.id) {
    const body = [promotedIdea.takeaway, promotedIdea.body, promotedIdea.hook]
      .filter(Boolean)
      .join('\n\n')
    const existingIdea = nextNotes.find(
      (n) =>
        n.sourceIdeaId === promotedIdea.id &&
        !n.sourceThoughtId &&
        n.id !== thoughtNote.id,
    )
    let ideaNoteId: string
    if (existingIdea) {
      ideaNoteId = existingIdea.id
      nextNotes = nextNotes.map((n) =>
        n.id === existingIdea.id
          ? {
              ...n,
              title: shortTitle(promotedIdea.title),
              body: body || n.body,
              topicId: (promotedIdea.topicId as ZettelNote['topicId']) ?? n.topicId,
              updatedAt: now,
            }
          : n,
      )
    } else {
      const ideaNote: ZettelNote = {
        id: newZettelId(),
        title: shortTitle(promotedIdea.title),
        body: body || promotedIdea.title,
        createdAt: now,
        updatedAt: now,
        topicId: promotedIdea.topicId as ZettelNote['topicId'],
        sourceIdeaId: promotedIdea.id,
      }
      nextNotes = [ideaNote, ...nextNotes]
      ideaNoteId = ideaNote.id
    }
    nextLinks = ensureLink(nextLinks, thoughtNote.id, ideaNoteId, 'derived')
  }

  return { notes: nextNotes, links: nextLinks, thoughtNote }
}

export function neighborsOf(
  noteId: string,
  links: ZettelLink[],
): { outbound: ZettelLink[]; inbound: ZettelLink[] } {
  return {
    outbound: links.filter((l) => l.from === noteId),
    inbound: links.filter((l) => l.to === noteId),
  }
}

export function linkedNoteIds(noteId: string, links: ZettelLink[]): string[] {
  const ids = new Set<string>()
  for (const l of links) {
    if (l.from === noteId) ids.add(l.to)
    if (l.to === noteId) ids.add(l.from)
  }
  return [...ids]
}

/** Split link search into #tag filters and plain terms (AND). */
export function parseNoteSearchQuery(query: string): { tags: string[]; terms: string[] } {
  const tags: string[] = []
  const terms: string[] = []
  for (const raw of query.trim().toLowerCase().split(/\s+/)) {
    if (!raw) continue
    if (raw.startsWith('#')) {
      const tag = raw.replace(/^#+/, '').trim()
      if (tag) tags.push(tag)
    } else {
      terms.push(raw)
    }
  }
  return { tags, terms }
}

/**
 * Ranked note search for linking. Lean: AND tokens, #tag filters,
 * title > tag > body scoring, recency tie-break. Skips excluded / already-linked.
 */
export function searchNotesForLink(
  notes: ZettelNote[],
  query: string,
  opts: {
    excludeId?: string
    alreadyLinkedIds?: Iterable<string>
    limit?: number
  } = {},
): ZettelNote[] {
  const q = query.trim()
  if (!q) return []

  const { tags, terms } = parseNoteSearchQuery(q)
  if (tags.length === 0 && terms.length === 0) return []

  const skip = new Set<string>(opts.alreadyLinkedIds ?? [])
  if (opts.excludeId) skip.add(opts.excludeId)
  const limit = opts.limit ?? 8

  const scored: { note: ZettelNote; score: number }[] = []
  for (const n of notes) {
    if (skip.has(n.id)) continue
    const score = scoreNoteForSearch(n, terms, tags)
    if (score === null) continue
    scored.push({ note: n, score })
  }

  scored.sort(
    (a, b) =>
      b.score - a.score || b.note.updatedAt.localeCompare(a.note.updatedAt),
  )
  return scored.slice(0, limit).map((s) => s.note)
}

function scoreNoteForSearch(
  note: ZettelNote,
  terms: string[],
  tagFilters: string[],
): number | null {
  const title = note.title.toLowerCase()
  const body = note.body.toLowerCase()
  const noteTags = note.tags ?? []

  for (const tag of tagFilters) {
    if (!noteTags.some((t) => t === tag || t.includes(tag))) return null
  }

  let score = tagFilters.length * 20

  for (const term of terms) {
    let hit = false
    if (title === term) {
      score += 100
      hit = true
    } else if (title.startsWith(term)) {
      score += 60
      hit = true
    } else if (title.includes(term)) {
      score += 40
      hit = true
    }
    if (noteTags.some((t) => t === term || t.includes(term))) {
      score += 30
      hit = true
    }
    if (body.includes(term)) {
      score += 10
      hit = true
    }
    if (!hit) return null
  }

  // Soft demote empty untitled stubs
  if (title === 'untitled note' && !body.trim()) score -= 15

  return score
}

/** Normalize tag input: lowercase, strip #, dedupe. */
export function normalizeTags(raw: string[] | string | undefined): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,#\s]+/)
      : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of list) {
    const tag = t.trim().replace(/^#/, '').toLowerCase()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
  }
  return out
}

/** Notes with zero inbound or outbound links. */
export function orphanNotes(notes: ZettelNote[], links: ZettelLink[]): ZettelNote[] {
  const linked = new Set<string>()
  for (const l of links) {
    linked.add(l.from)
    linked.add(l.to)
  }
  return notes.filter((n) => !linked.has(n.id))
}

/** Tag → note ids (MOC index). */
export function tagIndex(notes: ZettelNote[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const n of notes) {
    for (const tag of n.tags ?? []) {
      const list = map.get(tag) ?? []
      list.push(n.id)
      map.set(tag, list)
    }
  }
  return map
}

export function parseZettelExport(raw: unknown): ZettelExport | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.notes) || !Array.isArray(o.links)) return null
  const notes = o.notes.filter(isExportNote)
  const links = o.links.filter(isExportLink)
  return {
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : new Date().toISOString(),
    source: 'thinker-zettelkasten',
    notes,
    links,
  }
}

function isExportNote(x: unknown): x is ZettelNote {
  if (!x || typeof x !== 'object') return false
  const n = x as Record<string, unknown>
  if (
    typeof n.id !== 'string' ||
    typeof n.title !== 'string' ||
    typeof n.body !== 'string' ||
    typeof n.createdAt !== 'string' ||
    typeof n.updatedAt !== 'string'
  ) {
    return false
  }
  return true
}

function isExportLink(x: unknown): x is ZettelLink {
  if (!x || typeof x !== 'object') return false
  const l = x as Record<string, unknown>
  return (
    typeof l.id === 'string' &&
    typeof l.from === 'string' &&
    typeof l.to === 'string' &&
    typeof l.kind === 'string'
  )
}

/** Merge imported notes/links into existing (imported wins on same id). */
export function mergeZettelExport(
  current: { notes: ZettelNote[]; links: ZettelLink[] },
  incoming: ZettelExport,
): { notes: ZettelNote[]; links: ZettelLink[]; addedNotes: number; addedLinks: number } {
  const byId = new Map(current.notes.map((n) => [n.id, n]))
  let addedNotes = 0
  for (const n of incoming.notes) {
    if (!byId.has(n.id)) addedNotes++
    byId.set(n.id, { ...n, tags: normalizeTags(n.tags) })
  }

  const linkKey = (l: ZettelLink) => `${l.from}|${l.to}|${l.kind}`
  const byLinkId = new Map(current.links.map((l) => [l.id, l]))
  const keys = new Set(current.links.map(linkKey))
  let addedLinks = 0
  for (const l of incoming.links) {
    const key = linkKey(l)
    if (!byLinkId.has(l.id) && !keys.has(key)) addedLinks++
    byLinkId.set(l.id, l)
    keys.add(key)
  }

  return {
    notes: [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    links: [...byLinkId.values()],
    addedNotes,
    addedLinks,
  }
}
