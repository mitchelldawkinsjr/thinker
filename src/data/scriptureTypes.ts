import type { TopicId } from './types'

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
}

export type ScriptureFile = {
  updatedAt: string
  translation: string
  items: ScriptureItem[]
}
