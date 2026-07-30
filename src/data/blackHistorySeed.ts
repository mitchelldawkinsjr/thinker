import type { Idea } from './types'

export type BlackHistoryFile = {
  updatedAt: string
  source?: string
  attribution?: string
  page?: number
  pageSize?: number
  catalogSize?: number
  items: Idea[]
}

/** Bundled fallback — replaced by `npm run ingest:black-history` */
export const blackHistorySeed: BlackHistoryFile = {
  updatedAt: '2026-07-30T00:00:00.000Z',
  source: 'https://rest.blackhistoryapi.io/v2/fact/all',
  attribution: 'https://www.blackhistoryapi.com/',
  items: [],
}

export function getSeedBlackHistory(): Idea[] {
  return blackHistorySeed.items
}
