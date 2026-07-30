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
import { loadQueueSecret, openIdeaLoopPullRequest } from '../lib/githubQueue'
import { useKept } from './useKept'
import { useThoughts } from './useThoughts'
import { useZettel } from './useZettel'

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
  deny: (idea: Idea) => void
  exportApproved: () => { exportedAt: string; items: Idea[] }
  /** Soft status after Keep auto-queue (null when idle) */
  queueNotice: string | null
  clearQueueNotice: () => void
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
  const [queueNotice, setQueueNotice] = useState<string | null>(null)
  const { addMyIdea, removeMyIdea, attachLoopIdea, reopenSeeds, thoughts } = useThoughts()
  const { syncFromThought, upsertFromIdea } = useZettel()
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

  const clearQueueNotice = useCallback(() => setQueueNotice(null), [])

  const approve = useCallback(
    (idea: Idea) => {
      const clean = stripReviewFlag(idea)
      const withMeta: Idea = {
        ...clean,
        fromIdeaLoop: clean.fromIdeaLoop ?? true,
        ingestedAt: clean.ingestedAt ?? new Date().toISOString(),
      }
      addMyIdea(withMeta)
      attachLoopIdea(withMeta)
      for (const tid of withMeta.seedThoughtIds ?? []) {
        const t = thoughts.find((x) => x.id === tid)
        if (t) syncFromThought({ ...t, promotedIdeaId: withMeta.id })
      }
      upsertFromIdea(withMeta)
      if (!kept.has(idea.id)) toggleKept(idea.id)
      setDecisions((prev) => ({
        approved: { ...prev.approved, [idea.id]: withMeta },
        denied: prev.denied.filter((d) => d !== idea.id),
      }))

      // Auto-continue: queue promote PR (auto-merges server-side when configured)
      void (async () => {
        if (!loadQueueSecret()) {
          setQueueNotice(
            'Kept locally. Set the idea-loop secret in Settings to auto-queue promote — or Retry from Kept.',
          )
          return
        }
        try {
          const stamp = new Date().toISOString().slice(0, 10)
          const result = await openIdeaLoopPullRequest({
            kind: 'promote',
            filename: `thinker-approved-drafts-${stamp}.json`,
            payload: {
              exportedAt: new Date().toISOString(),
              items: [withMeta],
            },
          })
          if (result.mergeError) {
            setQueueNotice(
              `Queued (${result.prUrl ?? 'PR open'}) but auto-merge failed — merge the PR or Retry from Kept.`,
            )
            return
          }
          setQueueNotice('Kept and queued to the live pool — auto-merging.')
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Queue failed'
          setQueueNotice(`${msg} — Kept locally; Retry from Kept when ready.`)
        }
      })()
    },
    [addMyIdea, attachLoopIdea, kept, syncFromThought, thoughts, toggleKept, upsertFromIdea],
  )

  const deny = useCallback(
    (idea: Idea) => {
      const id = idea.id
      removeMyIdea(id)
      const seedIds = Array.isArray(idea.seedThoughtIds)
        ? idea.seedThoughtIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
        : []
      reopenSeeds(seedIds)
      setDecisions((prev) => {
        const approved = { ...prev.approved }
        delete approved[id]
        const deniedNext = prev.denied.includes(id) ? prev.denied : [...prev.denied, id]
        return { approved, denied: deniedNext }
      })
    },
    [removeMyIdea, reopenSeeds],
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
      queueNotice,
      clearQueueNotice,
    }),
    [
      decisions.approved,
      denied,
      pendingCount,
      isPending,
      approve,
      deny,
      exportApproved,
      queueNotice,
      clearQueueNotice,
    ],
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
