import type { TopicId } from './types'

export type ContentKindKey =
  | 'ideas'
  | 'bookIdeas'
  | 'news'
  | 'scripture'
  | 'resources'
  | 'books'
  | 'zobokoBooks'
  | 'games'

/** Kinds that participate in weightedInterleave. */
export type KindWeightKey =
  | 'ideas'
  | 'bookIdeas'
  | 'news'
  | 'scripture'
  | 'resources'
  | 'books'
  | 'zobokoBooks'
  | 'games'

export type KindWeights = Record<KindWeightKey, number>

export type CustomSite = {
  id: string
  name: string
  url: string
  blurb?: string
  topicHints?: TopicId[]
}

/** How often a custom RSS feed / content kind appears (1 = rare, 5 = frequent). */
export const CUSTOM_FEED_WEIGHT_MIN = 1
export const CUSTOM_FEED_WEIGHT_MAX = 5
export const CUSTOM_FEED_WEIGHT_DEFAULT = 3

/** Default mix cadence for content kinds */
export const DEFAULT_KIND_WEIGHTS: KindWeights = {
  ideas: 2,
  bookIdeas: 1,
  news: 2,
  scripture: 1,
  resources: 1,
  books: 1,
  zobokoBooks: 1,
  games: 1,
}

export const KIND_WEIGHT_LABELS: {
  key: KindWeightKey
  label: string
  hint: string
}[] = [
  {
    key: 'ideas',
    label: 'Ideas',
    hint: 'Catalog + philosophers / quotes / Black History + your approved drafts',
  },
  { key: 'bookIdeas', label: 'Book summaries', hint: '5- and 20-minute book summary cards' },
  { key: 'news', label: 'News', hint: 'Curated outlets and your RSS feeds' },
  { key: 'scripture', label: 'Scripture', hint: 'Daily promise + evergreen rotation' },
  { key: 'resources', label: 'Free sites', hint: 'Curated learning sites' },
  { key: 'books', label: 'Gutenberg', hint: 'Public-domain Project Gutenberg picks' },
  { key: 'zobokoBooks', label: 'Zoboko', hint: 'Curated personal-growth / theory deep links' },
  { key: 'games', label: 'Quick games', hint: 'Reaction, memory, math, gravity' },
]
export type CustomFeed = {
  id: string
  name: string
  url: string
  topicIds: TopicId[]
  limit: number
  /** Relative presence in My feed — 1 sparse … 5 dense (default 3). */
  weight: number
  enabled: boolean
}

export function clampFeedWeight(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return CUSTOM_FEED_WEIGHT_DEFAULT
  return Math.min(
    CUSTOM_FEED_WEIGHT_MAX,
    Math.max(CUSTOM_FEED_WEIGHT_MIN, Math.round(n)),
  )
}

export function clampKindWeight(n: unknown, fallback = 1): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return fallback
  return Math.min(
    CUSTOM_FEED_WEIGHT_MAX,
    Math.max(CUSTOM_FEED_WEIGHT_MIN, Math.round(n)),
  )
}

export function normalizeKindWeights(raw: unknown): KindWeights {
  const src =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = { ...DEFAULT_KIND_WEIGHTS }
  for (const key of Object.keys(DEFAULT_KIND_WEIGHTS) as KindWeightKey[]) {
    if (key in src) out[key] = clampKindWeight(src[key], DEFAULT_KIND_WEIGHTS[key])
  }
  return out
}

/**
 * How many items a custom feed may contribute to the mix.
 * Weight 3 ≈ configured limit; 1 ≈ ⅓; 5 ≈ ~1.7× (capped at 20).
 */
export function itemCapForFeedWeight(limit: number, weight: unknown): number {
  const w = clampFeedWeight(weight)
  const base = typeof limit === 'number' && limit > 0 ? Math.min(20, Math.floor(limit)) : 8
  const scaled = Math.round((base * w) / CUSTOM_FEED_WEIGHT_DEFAULT)
  return Math.min(20, Math.max(1, scaled))
}

export type SubscriptionKinds = Record<ContentKindKey, boolean>

export type Subscriptions = {
  kinds: SubscriptionKinds
  /** Relative mix cadence per kind (1 sparse … 5 dense). */
  kindWeights: KindWeights
  /** Empty = all topics */
  topics: TopicId[]
  disabledFeedIds: string[]
  /**
   * Per curated feed id → topic overrides (Settings).
   * Missing key = use catalog defaults from newsFeeds.
   */
  feedTopicOverrides: Record<string, TopicId[]>
  customSites: CustomSite[]
  customFeeds: CustomFeed[]
  /**
   * Topics that should NOT show a Think prompt on news cards.
   * Defaults to sports topics (same as the old hard-coded skip).
   */
  thinkPromptOff: TopicId[]
}

/** Sports topics historically skipped Think prompts — default Off set. */
export const DEFAULT_THINK_PROMPT_OFF: TopicId[] = [
  'nba-analytics',
  'wnba',
  'football-film',
  'sports-biz',
]

export const STORAGE_KEY = 'thinker-subscriptions-v1'
export const USER_NEWS_CACHE_KEY = 'thinker-user-news-v2'
export const MAX_CUSTOM_SITES = 30
export const MAX_CUSTOM_FEEDS = 20

export const DEFAULT_KINDS: SubscriptionKinds = {
  ideas: true,
  bookIdeas: true,
  news: true,
  scripture: true,
  resources: true,
  books: true,
  zobokoBooks: true,
  games: true,
}

export const DEFAULT_SUBSCRIPTIONS: Subscriptions = {
  kinds: { ...DEFAULT_KINDS },
  kindWeights: { ...DEFAULT_KIND_WEIGHTS },
  topics: [],
  disabledFeedIds: [],
  feedTopicOverrides: {},
  customSites: [],
  customFeeds: [],
  thinkPromptOff: [...DEFAULT_THINK_PROMPT_OFF],
}

function normalizeFeedTopicOverrides(raw: unknown): Record<string, TopicId[]> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, TopicId[]> = {}
  for (const [feedId, topics] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof feedId !== 'string' || !feedId.trim()) continue
    if (!Array.isArray(topics)) continue
    const ids = topics.filter(isTopicId)
    if (ids.length > 0) out[feedId] = ids
  }
  return out
}

export const KIND_LABELS: { key: ContentKindKey; label: string; hint: string }[] = [
  { key: 'ideas', label: 'Ideas', hint: 'Bite-sized idea cards from the catalog' },
  { key: 'bookIdeas', label: 'Book summaries', hint: '5- and 20-minute book summary cards (text + audio)' },
  { key: 'news', label: 'News', hint: 'Curated RSS lessons and your custom feeds' },
  { key: 'scripture', label: 'Scripture', hint: 'Daily promise + a 5-day rotating evergreen set' },
  { key: 'resources', label: 'Free sites', hint: 'Curated learning sites and your additions' },
  { key: 'books', label: 'Gutenberg books', hint: 'Public-domain Project Gutenberg in the mix' },
  {
    key: 'zobokoBooks',
    label: 'Zoboko books',
    hint: 'Curated philosophy / psych / politics / business / physics deep links',
  },
  { key: 'games', label: 'Quick games', hint: 'Reaction, memory, math, and gravity games' },
]

function isTopicId(v: unknown): v is TopicId {
  return typeof v === 'string' && v.trim().length > 0
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
    weight: clampFeedWeight(o.weight),
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
    kindWeights: normalizeKindWeights(o.kindWeights),
    topics: Array.isArray(o.topics) ? o.topics.filter(isTopicId) : [],
    disabledFeedIds: Array.isArray(o.disabledFeedIds)
      ? o.disabledFeedIds.filter((x): x is string => typeof x === 'string')
      : [],
    feedTopicOverrides: normalizeFeedTopicOverrides(o.feedTopicOverrides),
    customSites: Array.isArray(o.customSites)
      ? o.customSites.map(normalizeCustomSite).filter((x): x is CustomSite => x !== null)
      : [],
    customFeeds: Array.isArray(o.customFeeds)
      ? o.customFeeds.map(normalizeCustomFeed).filter((x): x is CustomFeed => x !== null)
      : [],
    thinkPromptOff: Array.isArray(o.thinkPromptOff)
      ? o.thinkPromptOff.filter(isTopicId)
      : [...DEFAULT_THINK_PROMPT_OFF],
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

/** True when a news card’s topics should show a Think prompt. */
export function thinkPromptEnabledFor(
  topicIds: TopicId[] | string[] | undefined,
  thinkPromptOff: TopicId[] | undefined,
): boolean {
  const off = new Set(thinkPromptOff ?? DEFAULT_THINK_PROMPT_OFF)
  const ids = topicIds ?? []
  if (ids.length === 0) return !off.has('current-events')
  return ids.some((id) => !off.has(id as TopicId))
}
