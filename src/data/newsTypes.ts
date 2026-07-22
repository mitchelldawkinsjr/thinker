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

/** Days a news card stays in the live feed (matches ingest) */
export const NEWS_TTL_DAYS_POLITICS = 3
export const NEWS_TTL_DAYS_DEFAULT = 10

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
