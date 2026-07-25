import type { Idea } from '../data/types'
import {
  catalogIdeasSeed,
  getSeedCatalogIdeas,
  isCatalogIdeaActive,
} from '../data/catalogIdeasSeed'
import { useContentJson } from './useContentJson'

/**
 * Load rotating catalog ideas from /content/ideas.json (LLM draft → promote),
 * merge with bundled seed; drop expired items.
 */
export function useCatalogIdeas() {
  return useContentJson<Idea>({
    url: '/content/ideas.json',
    seedItems: getSeedCatalogIdeas(),
    seedUpdatedAt: catalogIdeasSeed.updatedAt,
    merge: (seed, live) => {
      const byId = new Map<string, Idea>()
      for (const idea of [...seed, ...live]) {
        if (!isCatalogIdeaActive(idea)) continue
        byId.set(idea.id, idea)
      }
      return [...byId.values()]
    },
  })
}
