import { useCallback, useEffect, useRef, useState } from 'react'
import type { NewsItem } from '../data/newsTypes'
import { activeNews } from '../data/newsTypes'
import { USER_NEWS_CACHE_KEY, type CustomFeed } from '../data/subscriptions'
import { fetchFeedViaProxy, parseFeedToNewsItems } from '../lib/parseFeed'

const REFRESH_MS = 6 * 60 * 60 * 1000

type UserNewsCache = {
  updatedAt: string
  byFeedId: Record<string, { fetchedAt: string; items: NewsItem[] }>
}

function loadCache(): UserNewsCache {
  try {
    const raw = localStorage.getItem(USER_NEWS_CACHE_KEY)
    if (!raw) return { updatedAt: '', byFeedId: {} }
    const data = JSON.parse(raw) as UserNewsCache
    if (!data || typeof data !== 'object') return { updatedAt: '', byFeedId: {} }
    return {
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
      byFeedId: data.byFeedId && typeof data.byFeedId === 'object' ? data.byFeedId : {},
    }
  } catch {
    return { updatedAt: '', byFeedId: {} }
  }
}

function saveCache(cache: UserNewsCache) {
  try {
    localStorage.setItem(USER_NEWS_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore quota
  }
}

export function clearUserNewsForFeed(feedId: string) {
  const cache = loadCache()
  delete cache.byFeedId[feedId]
  cache.updatedAt = new Date().toISOString()
  saveCache(cache)
}

function isStale(fetchedAt: string, now = Date.now()): boolean {
  const t = Date.parse(fetchedAt)
  if (Number.isNaN(t)) return true
  return now - t > REFRESH_MS
}

async function fetchOneFeed(feed: CustomFeed): Promise<NewsItem[]> {
  const body = await fetchFeedViaProxy(feed.url)
  return parseFeedToNewsItems(body, feed.url, {
    name: feed.name,
    topicIds: feed.topicIds,
    limit: feed.limit,
    feedId: `user-${feed.id}`,
  })
}

/**
 * Load + periodically refresh items for enabled custom RSS subscriptions.
 */
export function useUserNewsItems(feeds: CustomFeed[]) {
  const [items, setItems] = useState<NewsItem[]>(() => {
    const cache = loadCache()
    const enabled = new Set(feeds.filter((f) => f.enabled).map((f) => f.id))
    const all: NewsItem[] = []
    for (const [id, entry] of Object.entries(cache.byFeedId)) {
      if (!enabled.has(id)) continue
      all.push(...activeNews(entry.items))
    }
    return all
  })
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const feedsKey = JSON.stringify(feeds.map((f) => [f.id, f.url, f.enabled, f.limit, f.name]))
  const inFlight = useRef(false)

  const refresh = useCallback(
    async (force = false) => {
      const enabled = feeds.filter((f) => f.enabled)
      if (enabled.length === 0) {
        setItems([])
        return
      }
      if (inFlight.current) return
      inFlight.current = true
      setRefreshing(true)
      setError(null)
      try {
        const cache = loadCache()
        const now = Date.now()
        for (const feed of enabled) {
          const existing = cache.byFeedId[feed.id]
          if (!force && existing && !isStale(existing.fetchedAt, now)) continue
          try {
            const next = await fetchOneFeed(feed)
            cache.byFeedId[feed.id] = {
              fetchedAt: new Date().toISOString(),
              items: next,
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to refresh a feed')
          }
        }
        // Drop cache for removed / disabled feeds
        const keep = new Set(enabled.map((f) => f.id))
        for (const id of Object.keys(cache.byFeedId)) {
          if (!keep.has(id)) delete cache.byFeedId[id]
        }
        cache.updatedAt = new Date().toISOString()
        saveCache(cache)

        const all: NewsItem[] = []
        for (const feed of enabled) {
          const entry = cache.byFeedId[feed.id]
          if (entry) all.push(...activeNews(entry.items))
        }
        setItems(all)
      } finally {
        inFlight.current = false
        setRefreshing(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- feedsKey captures feed identity
    [feedsKey],
  )

  useEffect(() => {
    void refresh(false)
  }, [refresh])

  return { items, refreshing, error, refresh }
}

/** Validate a feed URL by fetching + parsing; returns items or throws. */
export async function previewCustomFeed(feed: {
  name: string
  url: string
  topicIds: CustomFeed['topicIds']
  limit: number
}): Promise<NewsItem[]> {
  const body = await fetchFeedViaProxy(feed.url)
  const items = await parseFeedToNewsItems(body, feed.url, {
    name: feed.name,
    topicIds: feed.topicIds,
    limit: feed.limit,
  })
  if (items.length === 0) throw new Error('No items found in this feed')
  return items
}
