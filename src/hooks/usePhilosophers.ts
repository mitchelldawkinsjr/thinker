import type { Idea } from '../data/types'
import { getSeedPhilosophers, philosophersSeed } from '../data/philosophersSeed'
import { useContentJson } from './useContentJson'

/**
 * Load philosopher idea cards from /content/philosophers.json (API ingest).
 */
export function usePhilosophers() {
  return useContentJson<Idea>({
    url: '/content/philosophers.json',
    seedItems: getSeedPhilosophers(),
    seedUpdatedAt: philosophersSeed.updatedAt,
    merge: (seed, live) => {
      const byId = new Map<string, Idea>()
      for (const idea of [...seed, ...live]) byId.set(idea.id, idea)
      return [...byId.values()]
    },
  })
}
