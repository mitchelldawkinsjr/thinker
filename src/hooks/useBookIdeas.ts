import type { Idea } from '../data/types'
import { bookIdeasSeed, getSeedBookIdeas } from '../data/bookIdeasSeed'
import { useContentJson } from './useContentJson'

/**
 * Load book-summary ideas from /content/book-ideas.json (ingest),
 * merge with bundled seed.
 */
export function useBookIdeas() {
  return useContentJson<Idea>({
    url: '/content/book-ideas.json',
    seedItems: getSeedBookIdeas(),
    seedUpdatedAt: bookIdeasSeed.updatedAt,
    merge: (seed, live) => {
      const byId = new Map<string, Idea>()
      for (const idea of [...seed, ...live]) byId.set(idea.id, idea)
      return [...byId.values()]
    },
  })
}
