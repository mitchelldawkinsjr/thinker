import type { TopicId } from './types'
import { decodeHtmlEntities } from '../lib/htmlEntities'

export type NewsAngle = {
  label: string
  url: string
}

export type NewsItem = {
  id: string
  hook: string
  title: string
  lesson: string
  /** Optional override; otherwise derived from title + topics at render */
  challenge?: string
  source: string
  sourceUrl: string
  /** Optional thumbnail from RSS/Atom (e.g. Reddit media:thumbnail) */
  imageUrl?: string
  publishedAt: string
  expiresAt: string
  topicIds: TopicId[]
  angles?: NewsAngle[]
  /** Stable curated feed id from ingest; missing on legacy/seed items */
  feedId?: string
}

export type NewsFile = {
  updatedAt: string
  items: NewsItem[]
}

/**
 * Days a news card stays in the live feed (matches ingest).
 * Ingest runs daily; these windows survive a missed run.
 */
export const NEWS_TTL_DAYS_POLITICS = 8
export const NEWS_TTL_DAYS_DEFAULT = 14

/**
 * When every item from a feed is past expiresAt (stale snapshot, missed ingest),
 * still show the newest few so the deck is not only evergreen ideas.
 */
export const NEWS_STALE_FALLBACK_DAYS = 120
export const NEWS_STALE_FALLBACK_CAP = 4

/** Decode leftover HTML entities from RSS into readable text. */
export function decodeNewsItem(item: NewsItem): NewsItem {
  return {
    ...item,
    hook: decodeHtmlEntities(item.hook),
    title: decodeHtmlEntities(item.title),
    lesson: decodeHtmlEntities(item.lesson),
    challenge: item.challenge ? decodeHtmlEntities(item.challenge) : item.challenge,
    source: decodeHtmlEntities(item.source),
  }
}

export function isNewsActive(item: NewsItem, now = Date.now()): boolean {
  const exp = Date.parse(item.expiresAt)
  if (Number.isNaN(exp)) return true
  return exp > now
}

export function activeNews(items: NewsItem[], now = Date.now()): NewsItem[] {
  return items.filter((i) => isNewsActive(i, now)).map(decodeNewsItem)
}

function newsFeedKey(item: NewsItem): string {
  return item.feedId || item.source || item.id
}

/**
 * Unexpired cards, plus a short fallback of the newest items per feed when that
 * feed would otherwise contribute nothing.
 */
export function newsForFeed(items: NewsItem[], now = Date.now()): NewsItem[] {
  const staleMs = NEWS_STALE_FALLBACK_DAYS * 24 * 60 * 60 * 1000
  const byFeed = new Map<string, NewsItem[]>()
  for (const item of items) {
    const key = newsFeedKey(item)
    const list = byFeed.get(key) ?? []
    list.push(item)
    byFeed.set(key, list)
  }

  const out: NewsItem[] = []
  for (const list of byFeed.values()) {
    const active = list.filter((item) => isNewsActive(item, now))
    if (active.length > 0) {
      out.push(...active)
      continue
    }
    const stale = list
      .filter((item) => {
        const published = Date.parse(item.publishedAt)
        return !Number.isNaN(published) && now - published <= staleMs
      })
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .slice(0, NEWS_STALE_FALLBACK_CAP)
    out.push(...stale)
  }
  return out.map(decodeNewsItem)
}
