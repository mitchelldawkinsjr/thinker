import type { TopicId } from './types'

export type ContentKindKey =
  | 'ideas'
  | 'bookIdeas'
  | 'news'
  | 'scripture'
  | 'resources'
  | 'books'
  | 'games'

export type CustomSite = {
  id: string
  name: string
  url: string
  blurb?: string
  topicHints?: TopicId[]
}

export type CustomFeed = {
  id: string
  name: string
  url: string
  topicIds: TopicId[]
  limit: number
  enabled: boolean
}

export type SubscriptionKinds = Record<ContentKindKey, boolean>

export type Subscriptions = {
  kinds: SubscriptionKinds
  /** Empty = all topics */
  topics: TopicId[]
  disabledFeedIds: string[]
  customSites: CustomSite[]
  customFeeds: CustomFeed[]
}

export const STORAGE_KEY = 'thinker-subscriptions-v1'
export const USER_NEWS_CACHE_KEY = 'thinker-user-news-v1'
export const MAX_CUSTOM_SITES = 30
export const MAX_CUSTOM_FEEDS = 20

export const DEFAULT_KINDS: SubscriptionKinds = {
  ideas: true,
  bookIdeas: true,
  news: true,
  scripture: true,
  resources: true,
  books: true,
  games: true,
}

export const DEFAULT_SUBSCRIPTIONS: Subscriptions = {
  kinds: { ...DEFAULT_KINDS },
  topics: [],
  disabledFeedIds: [],
  customSites: [],
  customFeeds: [],
}

export const KIND_LABELS: { key: ContentKindKey; label: string; hint: string }[] = [
  { key: 'ideas', label: 'Ideas', hint: 'Microlearning cards from the catalog' },
  { key: 'bookIdeas', label: 'Book summaries', hint: '5- and 20-minute book summary cards (text + audio)' },
  { key: 'news', label: 'News', hint: 'Curated RSS lessons and your custom feeds' },
  { key: 'scripture', label: 'Scripture', hint: 'Daily promises and curated passages' },
  { key: 'resources', label: 'Free sites', hint: 'Curated learning sites and your additions' },
  { key: 'books', label: 'Gutenberg', hint: 'Public-domain books in the mix' },
  { key: 'games', label: 'Brain games', hint: 'Quick reaction, memory, math, and gravity games' },
]

function isTopicId(v: unknown): v is TopicId {
  return typeof v === 'string' && v.length > 0
}

function normalizeCustomSite(raw: unknown): CustomSite | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.url !== 'string') {
    return null
  }
  return {
    id: o.id,
    name: o.name,
    url: o.url,
    blurb: typeof o.blurb === 'string' ? o.blurb : undefined,
    topicHints: Array.isArray(o.topicHints)
      ? o.topicHints.filter(isTopicId)
      : undefined,
  }
}

function normalizeCustomFeed(raw: unknown): CustomFeed | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.url !== 'string') {
    return null
  }
  return {
    id: o.id,
    name: o.name,
    url: o.url,
    topicIds: Array.isArray(o.topicIds) ? o.topicIds.filter(isTopicId) : ['current-events'],
    limit: typeof o.limit === 'number' && o.limit > 0 ? Math.min(20, Math.floor(o.limit)) : 8,
    enabled: o.enabled !== false,
  }
}

/** Parse stored JSON into a full Subscriptions object with defaults. */
export function normalizeSubscriptions(raw: unknown): Subscriptions {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SUBSCRIPTIONS)
  const o = raw as Record<string, unknown>
  const kindsIn = o.kinds && typeof o.kinds === 'object' ? (o.kinds as Record<string, unknown>) : {}
  const kinds = { ...DEFAULT_KINDS }
  for (const key of Object.keys(DEFAULT_KINDS) as ContentKindKey[]) {
    if (typeof kindsIn[key] === 'boolean') kinds[key] = kindsIn[key]
  }
  return {
    kinds,
    topics: Array.isArray(o.topics) ? o.topics.filter(isTopicId) : [],
    disabledFeedIds: Array.isArray(o.disabledFeedIds)
      ? o.disabledFeedIds.filter((x): x is string => typeof x === 'string')
      : [],
    customSites: Array.isArray(o.customSites)
      ? o.customSites.map(normalizeCustomSite).filter((x): x is CustomSite => x !== null)
      : [],
    customFeeds: Array.isArray(o.customFeeds)
      ? o.customFeeds.map(normalizeCustomFeed).filter((x): x is CustomFeed => x !== null)
      : [],
  }
}

export function loadSubscriptions(): Subscriptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_SUBSCRIPTIONS)
    return normalizeSubscriptions(JSON.parse(raw))
  } catch {
    return structuredClone(DEFAULT_SUBSCRIPTIONS)
  }
}

export function saveSubscriptions(subs: Subscriptions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subs))
  } catch {
    // ignore quota
  }
}

/**
 * URL `?topic=` wins. Otherwise followed topics (multi). Empty followed = all.
 */
export function resolveTopicFilter(
  urlTopic: string | null | undefined,
  subs: Subscriptions,
): string | string[] | undefined {
  if (urlTopic) return urlTopic
  if (subs.topics.length > 0) return subs.topics
  return undefined
}

/** Match an item's topic id(s) against a single or multi topic filter. */
export function matchesTopicFilter(
  itemTopics: string[] | undefined,
  filter: string | string[] | undefined,
): boolean {
  if (!filter || (Array.isArray(filter) && filter.length === 0)) return true
  const topics = itemTopics ?? []
  if (typeof filter === 'string') return topics.includes(filter)
  return filter.some((t) => topics.includes(t))
}

export function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}
