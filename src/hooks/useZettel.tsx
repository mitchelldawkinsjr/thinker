import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Thought } from '../data/thoughts'
import {
  linkedNoteIds,
  mergeZettelExport,
  neighborsOf,
  newLinkId,
  newZettelId,
  normalizeTags,
  orphanNotes,
  parseZettelExport,
  shortTitle,
  tagIndex,
  thoughtToZettel,
  type ZettelExport,
  type ZettelLink,
  type ZettelLinkKind,
  type ZettelNote,
} from '../data/zettel'
import { useThoughts } from './useThoughts'

const NOTES_KEY = 'thinker-zettel-notes-v1'
const LINKS_KEY = 'thinker-zettel-links-v1'
const MIGRATED_KEY = 'thinker-zettel-migrated-v1'

type ZettelContextValue = {
  notes: ZettelNote[]
  links: ZettelLink[]
  getNote: (id: string) => ZettelNote | undefined
  neighbors: (id: string) => { outbound: ZettelLink[]; inbound: ZettelLink[] }
  linkedIds: (id: string) => string[]
  orphans: ZettelNote[]
  tags: { tag: string; count: number; noteIds: string[] }[]
  createNote: (input?: {
    title?: string
    body?: string
    topicId?: string
    tags?: string[]
  }) => ZettelNote
  updateNote: (
    id: string,
    patch: Partial<Pick<ZettelNote, 'title' | 'body' | 'topicId' | 'tags'>>,
  ) => void
  removeNote: (id: string) => void
  addLink: (from: string, to: string, kind?: ZettelLinkKind) => ZettelLink | null
  removeLink: (id: string) => void
  exportBox: () => ZettelExport
  importBox: (raw: unknown) => { ok: true; addedNotes: number; addedLinks: number } | { ok: false; error: string }
  /** Upsert a zettel from a Thought + optional derived/source edges */
  syncFromThought: (thought: Thought) => ZettelNote
  /** Upsert a slip for a kept idea card; link from seed zettels when present */
  upsertFromIdea: (
    idea: {
      id: string
      title: string
      body: string
      topicId?: string
      takeaway?: string
      hook?: string
      seedThoughtIds?: string[]
    },
  ) => ZettelNote
}

const ZettelContext = createContext<ZettelContextValue | null>(null)

function loadNotes(): ZettelNote[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isNote).map((n) => ({ ...n, tags: normalizeTags(n.tags) }))
  } catch {
    return []
  }
}

function loadLinks(): ZettelLink[] {
  try {
    const raw = localStorage.getItem(LINKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isLink)
  } catch {
    return []
  }
}

function isNote(x: unknown): x is ZettelNote {
  if (!x || typeof x !== 'object') return false
  const n = x as Record<string, unknown>
  return (
    typeof n.id === 'string' &&
    typeof n.title === 'string' &&
    typeof n.body === 'string' &&
    typeof n.createdAt === 'string' &&
    typeof n.updatedAt === 'string'
  )
}

function isLink(x: unknown): x is ZettelLink {
  if (!x || typeof x !== 'object') return false
  const l = x as Record<string, unknown>
  return (
    typeof l.id === 'string' &&
    typeof l.from === 'string' &&
    typeof l.to === 'string' &&
    typeof l.kind === 'string'
  )
}

function migrateFromThoughts(thoughts: Thought[]): {
  notes: ZettelNote[]
  links: ZettelLink[]
} {
  const notes: ZettelNote[] = []
  const links: ZettelLink[] = []
  const byThought = new Map<string, ZettelNote>()

  for (const t of thoughts) {
    const z = thoughtToZettel(t)
    notes.push(z)
    byThought.set(t.id, z)
  }

  for (const t of thoughts) {
    const from = byThought.get(t.id)
    if (!from) continue
    if (t.promotedIdeaId) {
      // Link note → any other note that was derived into the same idea id
      for (const other of notes) {
        if (other.id === from.id) continue
        if (other.sourceIdeaId === t.promotedIdeaId) {
          links.push({
            id: newLinkId(),
            from: from.id,
            to: other.id,
            kind: 'derived',
          })
        }
      }
    }
    // Parent idea: soft source edge if another zettel shares that idea id
    if (t.parent.kind === 'idea') {
      const parentZ = notes.find((n) => n.sourceIdeaId === t.parent.id && n.id !== from.id)
      if (parentZ) {
        links.push({
          id: newLinkId(),
          from: from.id,
          to: parentZ.id,
          kind: 'source',
        })
      }
    }
  }

  return { notes, links }
}

export function ZettelProvider({ children }: { children: ReactNode }) {
  const { thoughts } = useThoughts()
  const [notes, setNotes] = useState(loadNotes)
  const [links, setLinks] = useState(loadLinks)
  const [ready, setReady] = useState(false)

  // One-time migration from thoughts → slip box
  useEffect(() => {
    try {
      const done = localStorage.getItem(MIGRATED_KEY)
      if (done) {
        setReady(true)
        return
      }
      if (notes.length === 0 && thoughts.length > 0) {
        const { notes: migrated, links: migratedLinks } = migrateFromThoughts(thoughts)
        setNotes(migrated)
        setLinks(migratedLinks)
      }
      localStorage.setItem(MIGRATED_KEY, '1')
    } catch {
      // private mode
    }
    setReady(true)
  }, [thoughts, notes.length])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  }, [notes, ready])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(LINKS_KEY, JSON.stringify(links))
  }, [links, ready])

  const getNote = useCallback(
    (id: string) => notes.find((n) => n.id === id),
    [notes],
  )

  const neighbors = useCallback(
    (id: string) => neighborsOf(id, links),
    [links],
  )

  const linkedIds = useCallback(
    (id: string) => linkedNoteIds(id, links),
    [links],
  )

  const orphans = useMemo(() => orphanNotes(notes, links), [notes, links])

  const tags = useMemo(() => {
    const idx = tagIndex(notes)
    return [...idx.entries()]
      .map(([tag, noteIds]) => ({ tag, count: noteIds.length, noteIds }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }, [notes])

  const createNote = useCallback(
    (input?: { title?: string; body?: string; topicId?: string; tags?: string[] }) => {
      const now = new Date().toISOString()
      const note: ZettelNote = {
        id: newZettelId(),
        title: shortTitle(input?.title?.trim() || 'Untitled note'),
        body: input?.body?.trim() || '',
        createdAt: now,
        updatedAt: now,
        topicId: input?.topicId as ZettelNote['topicId'],
        tags: normalizeTags(input?.tags),
      }
      setNotes((prev) => [note, ...prev])
      return note
    },
    [],
  )

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<ZettelNote, 'title' | 'body' | 'topicId' | 'tags'>>) => {
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n
          return {
            ...n,
            title:
              patch.title !== undefined ? shortTitle(patch.title || 'Untitled note') : n.title,
            body: patch.body !== undefined ? patch.body : n.body,
            topicId: patch.topicId !== undefined ? patch.topicId : n.topicId,
            tags: patch.tags !== undefined ? normalizeTags(patch.tags) : n.tags,
            updatedAt: new Date().toISOString(),
          }
        }),
      )
    },
    [],
  )

  const removeNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    setLinks((prev) => prev.filter((l) => l.from !== id && l.to !== id))
  }, [])

  const addLink = useCallback(
    (from: string, to: string, kind: ZettelLinkKind = 'related') => {
      if (from === to) return null
      let created: ZettelLink | null = null
      setLinks((prev) => {
        if (prev.some((l) => l.from === from && l.to === to && l.kind === kind)) {
          return prev
        }
        // Also skip exact reverse duplicate for related
        if (
          kind === 'related' &&
          prev.some((l) => l.from === to && l.to === from && l.kind === 'related')
        ) {
          return prev
        }
        created = { id: newLinkId(), from, to, kind }
        return [...prev, created]
      })
      return created
    },
    [],
  )

  const removeLink = useCallback((id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const exportBox = useCallback((): ZettelExport => {
    return {
      exportedAt: new Date().toISOString(),
      source: 'thinker-zettelkasten',
      notes,
      links,
    }
  }, [notes, links])

  const importBox = useCallback(
    (raw: unknown) => {
      const parsed = parseZettelExport(raw)
      if (!parsed) {
        return {
          ok: false as const,
          error: 'Invalid slip-box JSON (need notes + links arrays).',
        }
      }
      const merged = mergeZettelExport({ notes, links }, parsed)
      setNotes(merged.notes)
      setLinks(merged.links)
      return {
        ok: true as const,
        addedNotes: merged.addedNotes,
        addedLinks: merged.addedLinks,
      }
    },
    [notes, links],
  )

  const syncFromThought = useCallback((thought: Thought) => {
    const z = thoughtToZettel(thought)
    setNotes((prev) => {
      const existing = prev.find(
        (n) => n.sourceThoughtId === thought.id || n.id === z.id,
      )
      if (existing) {
        return prev.map((n) =>
          n.id === existing.id
            ? {
                ...n,
                title: z.title,
                body: z.body || n.body,
                updatedAt: new Date().toISOString(),
                sourceIdeaId: z.sourceIdeaId ?? n.sourceIdeaId,
                topicId: z.topicId ?? n.topicId,
              }
            : n,
        )
      }
      return [z, ...prev]
    })
    return z
  }, [])

  const upsertFromIdea = useCallback(
    (idea: {
      id: string
      title: string
      body: string
      topicId?: string
      takeaway?: string
      hook?: string
      seedThoughtIds?: string[]
    }) => {
      const now = new Date().toISOString()
      const body = [idea.takeaway, idea.body, idea.hook].filter(Boolean).join('\n\n')
      const seedIds = idea.seedThoughtIds ?? []

      let result: ZettelNote = {
        id: newZettelId(),
        title: shortTitle(idea.title),
        body: body || idea.title,
        createdAt: now,
        updatedAt: now,
        topicId: idea.topicId as ZettelNote['topicId'],
        sourceIdeaId: idea.id,
      }

      setNotes((prev) => {
        const existing = prev.find((n) => n.sourceIdeaId === idea.id)
        let nextNotes: ZettelNote[]
        if (existing) {
          result = {
            ...existing,
            title: shortTitle(idea.title),
            body: body || existing.body,
            topicId: (idea.topicId as ZettelNote['topicId']) ?? existing.topicId,
            updatedAt: now,
          }
          nextNotes = prev.map((n) => (n.id === existing.id ? result : n))
        } else {
          nextNotes = [result, ...prev]
        }

        const ideaNoteId = result.id
        const seedZettelIds = seedIds
          .map((tid) => nextNotes.find((n) => n.sourceThoughtId === tid)?.id)
          .filter((x): x is string => Boolean(x))

        if (seedZettelIds.length > 0) {
          setLinks((prevLinks) => {
            let next = prevLinks
            for (const fromId of seedZettelIds) {
              if (
                next.some(
                  (l) => l.from === fromId && l.to === ideaNoteId && l.kind === 'derived',
                )
              ) {
                continue
              }
              next = [
                ...next,
                { id: newLinkId(), from: fromId, to: ideaNoteId, kind: 'derived' },
              ]
            }
            return next
          })
        }

        return nextNotes
      })

      return result
    },
    [],
  )

  const value = useMemo(
    () => ({
      notes,
      links,
      getNote,
      neighbors,
      linkedIds,
      orphans,
      tags,
      createNote,
      updateNote,
      removeNote,
      addLink,
      removeLink,
      exportBox,
      importBox,
      syncFromThought,
      upsertFromIdea,
    }),
    [
      notes,
      links,
      getNote,
      neighbors,
      linkedIds,
      orphans,
      tags,
      createNote,
      updateNote,
      removeNote,
      addLink,
      removeLink,
      exportBox,
      importBox,
      syncFromThought,
      upsertFromIdea,
    ],
  )

  return <ZettelContext.Provider value={value}>{children}</ZettelContext.Provider>
}

export function useZettel() {
  const ctx = useContext(ZettelContext)
  if (!ctx) throw new Error('useZettel must be used within ZettelProvider')
  return ctx
}
