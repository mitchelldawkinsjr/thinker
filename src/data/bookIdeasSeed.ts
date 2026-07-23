import type { Idea } from './types'

/** Days a book-summary idea stays in the live feed pool */
export const BOOK_IDEA_TTL_DAYS = 7

export type RetiredBookIdea = {
  id: string
  retiredAt: string
  title?: string
}

export type BookIdeasFile = {
  updatedAt: string
  source?: string
  ttlDays?: number
  items: Idea[]
  /** Recently rotated-out ids — ingest skips these so the pool stays fresh */
  retired?: RetiredBookIdea[]
}

/** Bundled fallback — replaced/merged by `npm run ingest:book-ideas` */
export const bookIdeasSeed: BookIdeasFile = {
  updatedAt: '2026-07-21T00:00:00.000Z',
  source: 'https://5minutebooksummary.com + https://www.20minutebooks.com/rss/',
  ttlDays: BOOK_IDEA_TTL_DAYS,
  items: [],
  retired: [],
}

export function isBookIdeaActive(item: Idea, now = Date.now()): boolean {
  if (!item.expiresAt) return true
  const exp = Date.parse(item.expiresAt)
  if (Number.isNaN(exp)) return true
  return exp > now
}

export function activeBookIdeas(items: Idea[], now = Date.now()): Idea[] {
  return items.filter((i) => isBookIdeaActive(i, now))
}

export function getSeedBookIdeas(): Idea[] {
  return activeBookIdeas(bookIdeasSeed.items)
}
