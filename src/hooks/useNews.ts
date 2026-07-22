import type { NewsItem } from '../data/newsTypes'
import { activeNews } from '../data/newsTypes'
import { getSeedActiveNews, newsSeed } from '../data/newsSeed'
import { useContentJson } from './useContentJson'

/**
 * Load live news from /content/news.json (written by ingest),
 * merge with bundled politics/current-events seed so lessons never vanish.
 */
export function useNewsItems() {
  return useContentJson<NewsItem>({
    url: '/content/news.json',
    seedItems: getSeedActiveNews(),
    seedUpdatedAt: newsSeed.updatedAt,
    merge: (seed, live) => {
      const byId = new Map<string, NewsItem>()
      for (const n of [...seed, ...activeNews(live)]) byId.set(n.id, n)
      return [...byId.values()].sort(
        (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
      )
    },
  })
}
