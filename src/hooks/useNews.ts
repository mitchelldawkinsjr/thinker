import { useCallback, useEffect, useState } from 'react'
import type { NewsFile, NewsItem } from '../data/newsTypes'
import { activeNews } from '../data/newsTypes'
import { getSeedActiveNews, newsSeed } from '../data/newsSeed'

/**
 * Load live news from /content/news.json (written by ingest),
 * merge with bundled politics/current-events seed so lessons never vanish.
 */
export function useNewsItems(): {
  items: NewsItem[]
  updatedAt: string | null
  loading: boolean
} {
  const [items, setItems] = useState<NewsItem[]>(() => getSeedActiveNews())
  const [updatedAt, setUpdatedAt] = useState<string | null>(newsSeed.updatedAt)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/content/news.json?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`news.json ${res.status}`)
      const data = (await res.json()) as NewsFile
      const byId = new Map<string, NewsItem>()
      for (const n of [...getSeedActiveNews(), ...activeNews(data.items ?? [])]) {
        byId.set(n.id, n)
      }
      const merged = [...byId.values()].sort(
        (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
      )
      if (merged.length > 0) {
        setItems(merged)
        setUpdatedAt(data.updatedAt ?? newsSeed.updatedAt)
      }
    } catch {
      // Seed already set — fine offline / before first ingest
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { items, updatedAt, loading }
}
