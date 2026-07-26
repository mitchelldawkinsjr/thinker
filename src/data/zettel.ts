import type { TopicId } from './types'
import type { Thought } from './thoughts'
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
    id: `zk-th-${thought.id}`,
    title,
    body: bodyParts.join('\n\n') || thought.parent.title,
    createdAt: now,
    updatedAt: now,
    topicId: thought.parent.topicId,
    sourceThoughtId: thought.id,
    sourceIdeaId:
      thought.promotedIdeaId ||
      (thought.parent.kind === 'idea' ? thought.parent.id : undefined),
  }
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

export type KeptIdeaPartition = {
  /** Connected kept-idea groups (≥2) via zettel links */
  clusters: string[][]
  /** Kept idea ids with no linked peer (or no zettel note) */
  singles: string[]
}

const MAX_CLUSTER_SIZE = 8

/**
 * Partition kept idea ids into linked clusters vs singles using zettel
 * notes that carry `sourceIdeaId` and the undirected link graph.
 */
export function partitionKeptIdeas(
  keptIdeaIds: string[],
  notes: ZettelNote[],
  links: ZettelLink[],
  maxClusterSize = MAX_CLUSTER_SIZE,
): KeptIdeaPartition {
  const keptSet = new Set(keptIdeaIds)
  const noteByIdea = new Map<string, string>()
  const ideaByNote = new Map<string, string>()
  const noteById = new Map(notes.map((n) => [n.id, n]))
  for (const n of notes) {
    const ideaId = n.sourceIdeaId
    if (!ideaId || !keptSet.has(ideaId)) continue
    // Prefer most recently updated note if multiple map to same idea
    const prev = noteByIdea.get(ideaId)
    if (!prev) {
      noteByIdea.set(ideaId, n.id)
      ideaByNote.set(n.id, ideaId)
    } else {
      const prevNote = noteById.get(prev)
      if (prevNote && n.updatedAt.localeCompare(prevNote.updatedAt) > 0) {
        ideaByNote.delete(prev)
        noteByIdea.set(ideaId, n.id)
        ideaByNote.set(n.id, ideaId)
      }
    }
  }

  const ideaNotes = new Set(ideaByNote.keys())
  const adj = new Map<string, Set<string>>()
  for (const id of ideaNotes) adj.set(id, new Set())
  for (const l of links) {
    if (!ideaNotes.has(l.from) || !ideaNotes.has(l.to)) continue
    adj.get(l.from)!.add(l.to)
    adj.get(l.to)!.add(l.from)
  }

  const seen = new Set<string>()
  const clusters: string[][] = []
  const singleSet = new Set<string>()
  const clusteredIdeas = new Set<string>()

  for (const noteId of ideaNotes) {
    if (seen.has(noteId)) continue
    const queue = [noteId]
    seen.add(noteId)
    const component: string[] = []
    while (queue.length) {
      const cur = queue.shift()!
      const ideaId = ideaByNote.get(cur)
      if (ideaId) component.push(ideaId)
      for (const next of adj.get(cur) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    const unique = [...new Set(component)]
    if (unique.length >= 2) {
      const capped = unique.slice(0, maxClusterSize)
      clusters.push(capped)
      for (const id of capped) clusteredIdeas.add(id)
      for (const id of unique.slice(maxClusterSize)) singleSet.add(id)
    } else if (unique.length === 1) {
      singleSet.add(unique[0])
    }
  }

  for (const id of keptIdeaIds) {
    if (!clusteredIdeas.has(id)) singleSet.add(id)
  }

  // Stable order: preserve keptIdeaIds order within partitions
  const order = new Map(keptIdeaIds.map((id, i) => [id, i]))
  clusters.sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
  for (const c of clusters) {
    c.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
  }
  const singles = [...singleSet].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))

  return { clusters, singles }
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
