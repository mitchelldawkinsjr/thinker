import type { Idea } from './types'

export type PhilosophersFile = {
  updatedAt: string
  source?: string
  batchSize?: number
  catalogSize?: number
  items: Idea[]
}

/** Bundled fallback — replaced by `npm run ingest:philosophers` */
export const philosophersSeed: PhilosophersFile = {
  updatedAt: '2026-07-27T00:00:00.000Z',
  source: 'https://philosophersapi.com/api/philosophers',
  items: [],
}

export function getSeedPhilosophers(): Idea[] {
  return philosophersSeed.items
}
