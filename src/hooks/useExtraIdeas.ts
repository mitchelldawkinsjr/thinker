import { useMemo } from 'react'
import type { Idea } from '../data/types'
import { useBookIdeas } from './useBookIdeas'
import { useCatalogIdeas } from './useCatalogIdeas'
import { useDraftReview } from './useDraftReview'
import { useIdeaDrafts } from './useIdeaDrafts'
import { usePhilosophers } from './usePhilosophers'
import { useThoughts } from './useThoughts'

/**
 * Book-summary ingest + Philosophers API + promoted catalog drafts +
 * personal ideas + pending LLM drafts (tagged draftReview for in-feed approve/deny).
 */
export function useExtraIdeas(): {
  items: Idea[]
  bookIdeasUpdatedAt: string | null
  catalogUpdatedAt: string | null
  draftsUpdatedAt: string | null
  pendingDraftCount: number
} {
  const { items: bookIdeas, updatedAt: bookIdeasUpdatedAt } = useBookIdeas()
  const { items: philosophers } = usePhilosophers()
  const { items: catalogIdeas, updatedAt: catalogUpdatedAt } = useCatalogIdeas()
  const { items: rawDrafts, updatedAt: draftsUpdatedAt } = useIdeaDrafts()
  const { myIdeas } = useThoughts()
  const { denied, approved, pendingCount } = useDraftReview()

  const items = useMemo(() => {
    const byId = new Map<string, Idea>()

    for (const idea of [...bookIdeas, ...philosophers, ...catalogIdeas, ...myIdeas]) {
      byId.set(idea.id, { ...idea, draftReview: false })
    }

    // Approved drafts already in myIdeas; re-merge in case myIdeas lagged
    for (const idea of Object.values(approved)) {
      byId.set(idea.id, { ...idea, draftReview: false })
    }

    for (const idea of rawDrafts) {
      if (denied.has(idea.id)) continue
      if (approved[idea.id] || byId.has(idea.id)) continue
      byId.set(idea.id, { ...idea, draftReview: true })
    }

    return [...byId.values()]
  }, [bookIdeas, philosophers, catalogIdeas, myIdeas, rawDrafts, denied, approved])

  return {
    items,
    bookIdeasUpdatedAt,
    catalogUpdatedAt,
    draftsUpdatedAt,
    pendingDraftCount: pendingCount,
  }
}
