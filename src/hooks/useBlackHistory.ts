import type { Idea } from '../data/types'
import { blackHistorySeed, getSeedBlackHistory } from '../data/blackHistorySeed'
import { useContentJson } from './useContentJson'

/**
 * Load Black History fact cards from /content/black-history.json (API ingest).
 */
export function useBlackHistory() {
  return useContentJson<Idea>({
    url: '/content/black-history.json',
    seedItems: getSeedBlackHistory(),
    seedUpdatedAt: blackHistorySeed.updatedAt,
    merge: (seed, live) => {
      const byId = new Map<string, Idea>()
      for (const idea of [...seed, ...live]) byId.set(idea.id, idea)
      return [...byId.values()]
    },
  })
}
