import { useContentJson } from './useContentJson'
import { getSeedIdeaDrafts, ideaDraftsSeed } from '../data/ideaDraftsSeed'
import type { Idea } from '../data/types'

/**
 * LLM drafts awaiting in-feed approve/deny — from /content/idea-drafts.json.
 */
export function useIdeaDrafts() {
  return useContentJson<Idea>({
    url: '/content/idea-drafts.json',
    seedItems: getSeedIdeaDrafts(),
    seedUpdatedAt: ideaDraftsSeed.updatedAt,
  })
}
