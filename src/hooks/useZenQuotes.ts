import type { Idea } from '../data/types'
import { getSeedZenQuotes, zenquotesSeed } from '../data/zenquotesSeed'
import { useContentJson } from './useContentJson'

/**
 * Load ZenQuotes idea cards from /content/zenquotes.json (API ingest).
 */
export function useZenQuotes() {
  return useContentJson<Idea>({
    url: '/content/zenquotes.json',
    seedItems: getSeedZenQuotes(),
    seedUpdatedAt: zenquotesSeed.updatedAt,
    merge: (seed, live) => {
      const byId = new Map<string, Idea>()
      for (const idea of [...seed, ...live]) byId.set(idea.id, idea)
      return [...byId.values()]
    },
  })
}
