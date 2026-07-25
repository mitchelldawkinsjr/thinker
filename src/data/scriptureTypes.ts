import type { TopicId } from './types'

export type ScripturePool = 'evergreen' | 'daily'

export type ScriptureItem = {
  id: string
  /** e.g. Proverbs 3:5–6 */
  reference: string
  text: string
  translation: string
  hook: string
  lesson: string
  topicIds: TopicId[]
  sourceUrl: string
  bookId: number
  chapter: number
  verseStart: number
  verseEnd: number
  /**
   * `daily` = one card (today’s promise).
   * `evergreen` = cohort-rotated (5-day windows). Omitted → inferred from id.
   */
  pool?: ScripturePool
}

export type ScriptureFile = {
  updatedAt: string
  translation: string
  items: ScriptureItem[]
  /** Ingest metadata */
  evergreenWindowDays?: number
  evergreenSetSize?: number
  blbWindowDays?: number
  source?: string
}
