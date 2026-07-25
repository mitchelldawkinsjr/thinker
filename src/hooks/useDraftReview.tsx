import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Idea } from '../data/types'
import { useKept } from './useKept'
import { useThoughts } from './useThoughts'

const DECISIONS_KEY = 'thinker-draft-decisions-v1'

type DraftDecisions = {
  /** Approved into personal pool (and eligible for promote export) */
  approved: Record<string, Idea>
  /** Never show again / never enter pool */
  denied: string[]
}

type DraftReviewContextValue = {
  approved: Record<string, Idea>
  denied: Set<string>
  pendingCount: number
  isPending: (id: string) => boolean
  approve: (idea: Idea) => void
  deny: (id: string) => void
  exportApproved: () => { exportedAt: string; items: Idea[] }
}

const DraftReviewContext = createContext<DraftReviewContextValue | null>(null)

function loadDecisions(): DraftDecisions {
  try {
    const raw = localStorage.getItem(DECISIONS_KEY)
    if (!raw) return { approved: {}, denied: [] }
    const parsed = JSON.parse(raw) as Partial<DraftDecisions>
    const approved =
      parsed.approved && typeof parsed.approved === 'object' ? parsed.approved : {}
    const denied = Array.isArray(parsed.denied)
      ? parsed.denied.filter((x): x is string => typeof x === 'string')
      : []
    return { approved, denied }
  } catch {
    return { approved: {}, denied: [] }
  }
}

function stripReviewFlag(idea: Idea): Idea {
  const { draftReview: _drop, ...rest } = idea as Idea & { draftReview?: boolean }
  return rest
}

export function DraftReviewProvider({
  children,
  draftIds,
}: {
  children: ReactNode
  /** Ids currently in the published draft queue */
  draftIds: string[]
}) {
  const [decisions, setDecisions] = useState(loadDecisions)
  const { addMyIdea, removeMyIdea } = useThoughts()
  const { kept, toggle: toggleKept } = useKept()

  useEffect(() => {
    localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions))
  }, [decisions])

  const denied = useMemo(() => new Set(decisions.denied), [decisions.denied])

  const pendingCount = useMemo(() => {
    return draftIds.filter(
      (id) => !denied.has(id) && !decisions.approved[id],
    ).length
  }, [draftIds, denied, decisions.approved])

  const isPending = useCallback(
    (id: string) => !denied.has(id) && !decisions.approved[id] && draftIds.includes(id),
    [denied, decisions.approved, draftIds],
  )

  const approve = useCallback(
    (idea: Idea) => {
      const clean = stripReviewFlag(idea)
      const withMeta: Idea = {
        ...clean,
        ingestedAt: clean.ingestedAt ?? new Date().toISOString(),
      }
      addMyIdea(withMeta)
      if (!kept.has(idea.id)) toggleKept(idea.id)
      setDecisions((prev) => ({
        approved: { ...prev.approved, [idea.id]: withMeta },
        denied: prev.denied.filter((d) => d !== idea.id),
      }))
    },
    [addMyIdea, kept, toggleKept],
  )

  const deny = useCallback(
    (id: string) => {
      removeMyIdea(id)
      setDecisions((prev) => {
        const approved = { ...prev.approved }
        delete approved[id]
        const deniedNext = prev.denied.includes(id) ? prev.denied : [...prev.denied, id]
        return { approved, denied: deniedNext }
      })
    },
    [removeMyIdea],
  )

  const exportApproved = useCallback(() => {
    return {
      exportedAt: new Date().toISOString(),
      items: Object.values(decisions.approved),
    }
  }, [decisions.approved])

  const value = useMemo(
    () => ({
      approved: decisions.approved,
      denied,
      pendingCount,
      isPending,
      approve,
      deny,
      exportApproved,
    }),
    [decisions.approved, denied, pendingCount, isPending, approve, deny, exportApproved],
  )

  return (
    <DraftReviewContext.Provider value={value}>{children}</DraftReviewContext.Provider>
  )
}

export function useDraftReview() {
  const ctx = useContext(DraftReviewContext)
  if (!ctx) throw new Error('useDraftReview must be used within DraftReviewProvider')
  return ctx
}
