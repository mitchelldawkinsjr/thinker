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

/** Politics / hard news — short pool lifetime (matches ingest) */
export const NEWS_TTL_DAYS_POLITICS = 3
/** Culture, sports, faith, general current-events */
export const NEWS_TTL_DAYS_DEFAULT = 10
/** @deprecated Prefer NEWS_TTL_DAYS_POLITICS / NEWS_TTL_DAYS_DEFAULT */
export const NEWS_TTL_DAYS = NEWS_TTL_DAYS_DEFAULT

export function isNewsActive(item: NewsItem, now = Date.now()): boolean {
  const exp = Date.parse(item.expiresAt)
  if (Number.isNaN(exp)) return true
  return exp > now
}

export function activeNews(items: NewsItem[], now = Date.now()): NewsItem[] {
  return items.filter((i) => isNewsActive(i, now))
}
