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

/** Days a news card stays in the live feed */
export const NEWS_TTL_DAYS = 14

export function isNewsActive(item: NewsItem, now = Date.now()): boolean {
  const exp = Date.parse(item.expiresAt)
  if (Number.isNaN(exp)) return true
  return exp > now
}

export function activeNews(items: NewsItem[], now = Date.now()): NewsItem[] {
  return items.filter((i) => isNewsActive(i, now))
}
