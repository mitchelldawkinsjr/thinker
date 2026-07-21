export type TopicId =
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
  readMinutes: number
}

export interface GutenbergBook {
  id: number
  title: string
  authors: string[]
  coverUrl?: string
}
