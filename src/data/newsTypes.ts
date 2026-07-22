import type { TopicId } from './types'

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
}

export type NewsFile = {
  updatedAt: string
  items: NewsItem[]
}

/** Days a news card stays in the live feed (matches ingest) */
export const NEWS_TTL_DAYS_POLITICS = 3
export const NEWS_TTL_DAYS_DEFAULT = 10

export function isNewsActive(item: NewsItem, now = Date.now()): boolean {
  const exp = Date.parse(item.expiresAt)
  if (Number.isNaN(exp)) return true
  return exp > now
}

export function activeNews(items: NewsItem[], now = Date.now()): NewsItem[] {
  return items.filter((i) => isNewsActive(i, now))
}
