import type { ScriptureItem } from '../data/scriptureTypes'
import { getSeedScriptures, scriptureSeed } from '../data/scriptureSeed'
import { useContentJson } from './useContentJson'

/**
 * Load scriptures from /content/scriptures.json (bolls.life ingest),
 * fall back to bundled WEB seed.
 */
export function useScriptures() {
  return useContentJson<ScriptureItem>({
    url: '/content/scriptures.json',
    seedItems: getSeedScriptures(),
    seedUpdatedAt: scriptureSeed.updatedAt,
  })
}
