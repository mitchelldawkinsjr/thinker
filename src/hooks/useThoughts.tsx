import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Idea } from '../data/types'
import {
  newThoughtId,
  parentFromIdea,
  thoughtToIdea,
  isSeedableThought,
  thoughtsToSeeds,
  type Thought,
  type ThoughtParent,
  type ThoughtSeed,
} from '../data/thoughts'
import { useKept } from './useKept'

const THOUGHTS_KEY = 'thinker-thoughts'
/** Pre-rename storage key ("tidbits") — read once for migration, never written */
const LEGACY_THOUGHTS_KEY = 'thinker-tidbits'
const MY_IDEAS_KEY = 'thinker-my-ideas'

type SaveMomentInput = {
  parent: ThoughtParent
  startSec: number
  note: string
  /** Also promote into the personal idea pool + Keep */
  promote?: boolean
}

type ThoughtsContextValue = {
  thoughts: Thought[]
  myIdeas: Idea[]
  saveMoment: (input: SaveMomentInput) => Thought
  updateNote: (id: string, note: string) => void
  /** Move thought → idea card. Pass `note` when saving + promoting in one step. */
  promote: (id: string, note?: string) => Idea | null
  /** Move idea card → thought again (exclusive — not both at once). */
  demote: (id: string) => void
  remove: (id: string) => void
  addMyIdea: (idea: Idea) => void
  removeMyIdea: (id: string) => void
  /**
   * Lite zettel: link seed thoughts to a kept loop idea (promotedIdeaId),
   * or create a thin note edge when no seeds exist.
   */
  attachLoopIdea: (idea: Idea) => void
  /** Open (unsent, unattached) thoughts as draft seeds — never clears Kept. */
  exportSeeds: () => ThoughtSeed[]
  /** Mark seed ids as queued after a successful idea-loop send. */
  markSeedsSent: (ids: string[]) => void
  /** Return seeds to the inbox (e.g. Reject on a From-loop draft). */
  reopenSeeds: (ids: string[]) => void
  count: number
}

const ThoughtsContext = createContext<ThoughtsContextValue | null>(null)

function loadThoughts(): Thought[] {
  try {
    const raw =
      localStorage.getItem(THOUGHTS_KEY) ?? localStorage.getItem(LEGACY_THOUGHTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isThought)
  } catch {
    return []
  }
}

function loadMyIdeas(): Idea[] {
  try {
    const raw = localStorage.getItem(MY_IDEAS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is Idea => Boolean(x && typeof x === 'object' && 'id' in x))
  } catch {
    return []
  }
}

function isThought(x: unknown): x is Thought {
  if (!x || typeof x !== 'object') return false
  const t = x as Record<string, unknown>
  if (typeof t.id !== 'string' || typeof t.startSec !== 'number' || typeof t.note !== 'string') {
    return false
  }
  if (typeof t.createdAt !== 'string' || !t.parent || typeof t.parent !== 'object') return false
  const p = t.parent as Record<string, unknown>
  return (
    (p.kind === 'idea' ||
      p.kind === 'news' ||
      p.kind === 'scripture' ||
      p.kind === 'resource' ||
      p.kind === 'book') &&
    typeof p.id === 'string' &&
    typeof p.title === 'string' &&
    typeof p.topicId === 'string' &&
    typeof p.source === 'string' &&
    typeof p.sourceType === 'string'
  )
}

export function ThoughtsProvider({ children }: { children: ReactNode }) {
  const [thoughts, setThoughts] = useState(loadThoughts)
  const [myIdeas, setMyIdeas] = useState(loadMyIdeas)
  const { toggle: toggleKept, kept } = useKept()

  useEffect(() => {
    localStorage.setItem(THOUGHTS_KEY, JSON.stringify(thoughts))
  }, [thoughts])

  useEffect(() => {
    localStorage.setItem(MY_IDEAS_KEY, JSON.stringify(myIdeas))
  }, [myIdeas])

  const upsertMyIdea = useCallback((idea: Idea) => {
    setMyIdeas((prev) => {
      const next = prev.filter((i) => i.id !== idea.id)
      next.unshift(idea)
      return next
    })
  }, [])

  const keepIfNeeded = useCallback(
    (id: string) => {
      if (!kept.has(id)) toggleKept(id)
    },
    [kept, toggleKept],
  )

  const unkeepIfNeeded = useCallback(
    (id: string) => {
      if (kept.has(id)) toggleKept(id)
    },
    [kept, toggleKept],
  )

  const promote = useCallback(
    (id: string, note?: string): Idea | null => {
      const existing = thoughts.find((t) => t.id === id)
      if (!existing) return null
      const promotedIdeaId = existing.promotedIdeaId ?? `thought-${existing.id}`
      const withId: Thought = {
        ...existing,
        promotedIdeaId,
        ...(note !== undefined ? { note: note.trim() } : {}),
      }
      const idea = thoughtToIdea(withId)
      setThoughts((prev) => prev.map((t) => (t.id === id ? withId : t)))
      upsertMyIdea(idea)
      keepIfNeeded(idea.id)
      // Keep the original source idea too — promote adds a note-card, it doesn't replace
      if (existing.parent.kind === 'idea') keepIfNeeded(existing.parent.id)
      return idea
    },
    [thoughts, upsertMyIdea, keepIfNeeded],
  )

  /** Send a promoted idea back to Thoughts for editing (removes the idea card). */
  const demote = useCallback(
    (id: string) => {
      const existing = thoughts.find((t) => t.id === id)
      if (!existing?.promotedIdeaId) return
      const ideaId = existing.promotedIdeaId
      setThoughts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t
          const { promotedIdeaId: _gone, ...rest } = t
          return rest
        }),
      )
      setMyIdeas((prev) => prev.filter((i) => i.id !== ideaId))
      unkeepIfNeeded(ideaId)
    },
    [thoughts, unkeepIfNeeded],
  )

  const lastSaveRef = useRef<{ key: string; at: number; thought: Thought } | null>(null)

  const saveMoment = useCallback(
    (input: SaveMomentInput): Thought => {
      const startSec = Math.max(0, input.startSec)
      const note = input.note.trim()
      const promote = Boolean(input.promote)
      // Collapse accidental double-fires (double-click / Strict Mode edge cases)
      const dedupeKey = `${input.parent.kind}:${input.parent.id}:${startSec}:${note}:${promote}`
      const now = Date.now()
      const recent = lastSaveRef.current
      if (recent && recent.key === dedupeKey && now - recent.at < 1500) {
        return recent.thought
      }

      const id = newThoughtId()
      let thought: Thought = {
        id,
        startSec,
        note,
        createdAt: new Date().toISOString(),
        parent: input.parent,
      }

      if (promote) {
        thought = { ...thought, promotedIdeaId: `thought-${id}` }
        const idea = thoughtToIdea(thought)
        upsertMyIdea(idea)
        keepIfNeeded(idea.id)
        // Original source idea stays on Kept alongside the new note-card
        if (input.parent.kind === 'idea') keepIfNeeded(input.parent.id)
      }

      lastSaveRef.current = { key: dedupeKey, at: now, thought }
      setThoughts((prev) => [thought, ...prev])
      return thought
    },
    [keepIfNeeded, upsertMyIdea],
  )

  const updateNote = useCallback(
    (id: string, note: string) => {
      const trimmed = note.trim()
      setThoughts((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, note: trimmed } : t))
        const updated = next.find((t) => t.id === id)
        if (updated?.promotedIdeaId) {
          queueMicrotask(() => upsertMyIdea(thoughtToIdea(updated)))
        }
        return next
      })
    },
    [upsertMyIdea],
  )

  const remove = useCallback((id: string) => {
    setThoughts((prev) => {
      const target = prev.find((t) => t.id === id)
      if (target?.promotedIdeaId) {
        const promotedId = target.promotedIdeaId
        queueMicrotask(() => setMyIdeas((ideas) => ideas.filter((i) => i.id !== promotedId)))
      }
      return prev.filter((t) => t.id !== id)
    })
  }, [])

  const addMyIdea = useCallback(
    (idea: Idea) => {
      upsertMyIdea(idea)
    },
    [upsertMyIdea],
  )

  const removeMyIdea = useCallback((id: string) => {
    setMyIdeas((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const attachLoopIdea = useCallback(
    (idea: Idea) => {
      const seedIds = Array.isArray(idea.seedThoughtIds)
        ? idea.seedThoughtIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : []
      const note =
        idea.takeaway?.trim() || idea.hook?.trim() || idea.title.trim() || 'Kept from idea loop'

      setThoughts((prev) => {
        let next = [...prev]
        let linked = 0
        if (seedIds.length > 0) {
          next = next.map((t) => {
            if (!seedIds.includes(t.id)) return t
            linked++
            const { sentAt: _cleared, ...rest } = t
            return { ...rest, promotedIdeaId: idea.id }
          })
        }
        if (linked === 0) {
          const existing = next.find(
            (t) => t.promotedIdeaId === idea.id || (t.parent.kind === 'idea' && t.parent.id === idea.id),
          )
          if (!existing) {
            next.unshift({
              id: newThoughtId(),
              startSec: 0,
              note,
              createdAt: new Date().toISOString(),
              parent: parentFromIdea(idea),
              promotedIdeaId: idea.id,
            })
          } else if (!existing.promotedIdeaId) {
            next = next.map((t) =>
              t.id === existing.id ? { ...t, promotedIdeaId: idea.id } : t,
            )
          }
        }
        return next
      })
    },
    [],
  )

  const exportSeeds = useCallback(
    () => thoughtsToSeeds(thoughts.filter(isSeedableThought)),
    [thoughts],
  )

  const markSeedsSent = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const at = new Date().toISOString()
    setThoughts((prev) =>
      prev.map((t) => (idSet.has(t.id) && isSeedableThought(t) ? { ...t, sentAt: at } : t)),
    )
  }, [])

  const reopenSeeds = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    setThoughts((prev) =>
      prev.map((t) => {
        if (!idSet.has(t.id) || !t.sentAt) return t
        const { sentAt: _gone, ...rest } = t
        return rest
      }),
    )
  }, [])

  const value = useMemo(
    () => ({
      thoughts,
      myIdeas,
      saveMoment,
      updateNote,
      promote,
      demote,
      remove,
      addMyIdea,
      removeMyIdea,
      attachLoopIdea,
      exportSeeds,
      markSeedsSent,
      reopenSeeds,
      count: thoughts.length,
    }),
    [
      thoughts,
      myIdeas,
      saveMoment,
      updateNote,
      promote,
      demote,
      remove,
      addMyIdea,
      removeMyIdea,
      attachLoopIdea,
      exportSeeds,
      markSeedsSent,
      reopenSeeds,
    ],
  )

  return <ThoughtsContext.Provider value={value}>{children}</ThoughtsContext.Provider>
}

export function useThoughts() {
  const ctx = useContext(ThoughtsContext)
  if (!ctx) throw new Error('useThoughts must be used within ThoughtsProvider')
  return ctx
}
