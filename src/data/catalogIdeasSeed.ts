import type { Idea } from './types'

/** Days a promoted LLM draft stays in the live feed pool */
export const CATALOG_IDEA_TTL_DAYS = 21

export type CatalogIdeasFile = {
  updatedAt: string
  source?: string
  ttlDays?: number
  items: Idea[]
}

/** Bundled fallback — live pool from /content/ideas.json after promote */
export const catalogIdeasSeed: CatalogIdeasFile = {
  updatedAt: '2026-07-24T00:00:00.000Z',
  source: 'llm-draft-promote',
  ttlDays: CATALOG_IDEA_TTL_DAYS,
  items: [],
}

export function isCatalogIdeaActive(item: Idea, now = Date.now()): boolean {
  if (!item.expiresAt) return true
  const exp = Date.parse(item.expiresAt)
  if (Number.isNaN(exp)) return true
  return exp > now
}

export function activeCatalogIdeas(items: Idea[], now = Date.now()): Idea[] {
  return items.filter((i) => isCatalogIdeaActive(i, now))
}

export function getSeedCatalogIdeas(): Idea[] {
  return activeCatalogIdeas(catalogIdeasSeed.items)
}
