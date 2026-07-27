import type { Idea } from './types'

export type ZenQuotesFile = {
  updatedAt: string
  source?: string
  attribution?: string
  items: Idea[]
}

/** Bundled fallback — replaced by `npm run ingest:zenquotes` */
export const zenquotesSeed: ZenQuotesFile = {
  updatedAt: '2026-07-27T00:00:00.000Z',
  source: 'https://zenquotes.io/api/quotes',
  attribution: 'https://zenquotes.io/',
  items: [],
}

export function getSeedZenQuotes(): Idea[] {
  return zenquotesSeed.items
}
