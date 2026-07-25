import type { Idea } from '../data/types'

export type IdeaDraftsFile = {
  updatedAt: string
  source?: string
  items: Idea[]
}

/** Bundled empty queue — live drafts from /content/idea-drafts.json after draft:ideas */
export const ideaDraftsSeed: IdeaDraftsFile = {
  updatedAt: '2026-07-25T00:00:00.000Z',
  source: 'llm-draft-queue',
  items: [],
}

export function getSeedIdeaDrafts(): Idea[] {
  return ideaDraftsSeed.items
}
