/** Built-in catalog topic ids (custom topics use free-form strings). */
export type BuiltInTopicId =
  | 'ai-agents'
  | 'llms-prompting'
  | 'rag-context'
  | 'ai-frontend'
  | 'nba-analytics'
  | 'wnba'
  | 'football-film'
  | 'sports-biz'
  | 'current-events'
  | 'history'
  | 'politics'
  | 'finance'
  | 'mental-models'
  | 'building-products'

/** Topic id — built-in catalog or a user-created custom id. */
export type TopicId = BuiltInTopicId | (string & {})

export interface Topic {
  id: TopicId
  name: string
  tagline: string
  description: string
  color: string
  accent: string
}

export interface Idea {
  id: string
  topicId: TopicId
  title: string
  body: string
  /** Short tension line shown first; falls back to title */
  hook?: string
  /** Deeper lesson shown after expand; falls back to body */
  lesson?: string
  /** One-liner to remember */
  takeaway?: string
  /** Concrete scenario that makes it stick */
  example?: string
  source: string
  sourceType: 'book' | 'article' | 'podcast' | 'research' | 'practice' | 'site'
  /** Project Gutenberg ebook ID — links to gutenberg.org */
  gutenbergId?: number
  /** Direct link to the article, site, or book page */
  sourceUrl?: string
  /** Optional MP3 (or other audio) for inline playback — e.g. 20 Minute Books */
  audioUrl?: string
  /** Written summary / episode page for the audio (when sourceUrl is a different summary) */
  audioPageUrl?: string
  /** Seek here on play — moments promoted from listening */
  audioStartSec?: number
  /** Parent card id when this idea was promoted from a listening thought */
  parentIdeaId?: string
  readMinutes: number
  /** When this card entered the live pool (book-summary ingest) */
  ingestedAt?: string
  /** Drop from live pool after this time (book summaries rotate weekly) */
  expiresAt?: string
  /**
   * Client-only: LLM draft in the feed awaiting approve/deny.
   * Stripped when approved into the personal pool.
   */
  draftReview?: boolean
  /** Persisted: card came from the idea-loop draft Action */
  fromIdeaLoop?: boolean
  /** Persisted: Kept thought ids this card was expanded from */
  seedThoughtIds?: string[]
}

export interface GutenbergBook {
  id: number
  title: string
  authors: string[]
  coverUrl?: string
}
