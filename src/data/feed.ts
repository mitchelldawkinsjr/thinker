import { mergeIdeas } from './ideas'
import { browseableResources, type LearningResource } from './resources'
import {
  curatedGutenbergMeta,
  gutenbergShelves,
  gutenbergUrl,
} from './gutenberg'
import type { Idea, TopicId } from './types'
import type { NewsItem } from './newsTypes'
import type { ScriptureItem } from './scriptureTypes'
import { daySeed, filterHidden, seededShuffle, sortByFreshness } from '../lib/feedRotation'
import {
  activeEvergreenScriptures,
  isDailyScripture,
} from '../lib/scriptureRotation'
import {
  clampFeedWeight,
  CUSTOM_FEED_WEIGHT_DEFAULT,
  itemCapForFeedWeight,
  matchesTopicFilter,
  type CustomFeed,
  type CustomSite,
  type Subscriptions,
} from './subscriptions'
import { curatedNewsFeeds } from './newsFeeds'

export type FeedItem =
  | { kind: 'idea'; id: string; idea: Idea }
  | {
      kind: 'resource'
      id: string
      resource: LearningResource
    }
  | {
      kind: 'book'
      id: string
      bookId: number
      title: string
      author: string
      why: string
      url: string
      topicId?: TopicId
    }
  | {
      kind: 'news'
      id: string
      news: NewsItem
    }
  | {
      kind: 'scripture'
      id: string
      scripture: ScriptureItem
    }
  | {
      kind: 'game'
      id: string
      gameId: 'reaction' | 'spot' | 'memory' | 'math' | 'gravity'
      title: string
      blurb: string
    }

export type TopicFilter = string | string[] | undefined

/**
 * Spread weight slots across the cycle instead of clumping
 * (e.g. weight 2 → [A,B,C,A,B] not [A,A,B,B,C]).
 */
function buildWeightPattern(weights: number[]): number[] {
  const active = weights
    .map((w, i) => ({ i, w: Math.max(0, Math.floor(w)) }))
    .filter((x) => x.w > 0)
  if (active.length === 0) return []

  const remaining = new Map(active.map((a) => [a.i, a.w]))
  const pattern: number[] = []
  let left = active.reduce((s, a) => s + a.w, 0)
  while (left > 0) {
    for (const { i } of active) {
      const rem = remaining.get(i) ?? 0
      if (rem <= 0) continue
      pattern.push(i)
      remaining.set(i, rem - 1)
      left--
    }
  }
  return pattern
}

/**
 * Round-robin by weight without duplicating items.
 * weight 2 ≈ two pulls per cycle vs weight 1 — each card still appears once.
 * Prefer skipping a queue when it would repeat the previous kind and another
 * queue still has cards (stops scripture/news doubles when the mix thins out).
 */
function weightedInterleave<T extends { id: string; kind?: string }>(
  queues: { items: T[]; weight: number }[],
): T[] {
  const qs = queues.map((q) => ({
    items: [...q.items],
    weight: Math.max(1, Math.floor(q.weight)),
  }))
  const pattern = buildWeightPattern(qs.map((q) => q.weight))

  const out: T[] = []
  const used = new Set<string>()
  let lastKind: string | undefined
  let added = true
  while (added) {
    added = false
    for (let pi = 0; pi < pattern.length; pi++) {
      const qi = pattern[pi]
      const q = qs[qi]
      const pick = (): T | undefined => {
        while (q.items.length) {
          const next = q.items.shift()!
          if (used.has(next.id)) continue
          return next
        }
        return undefined
      }

      let next = pick()
      if (!next) continue

      // Prefer not placing the same kind twice in a row when another queue still has cards
      if (lastKind && next.kind === lastKind) {
        for (let aj = 0; aj < qs.length; aj++) {
          if (aj === qi) continue
          const altQ = qs[aj]
          const altIdx = altQ.items.findIndex(
            (it) => !used.has(it.id) && it.kind !== lastKind,
          )
          if (altIdx < 0) continue
          const [alt] = altQ.items.splice(altIdx, 1)
          q.items.unshift(next)
          next = alt
          break
        }
      }

      used.add(next.id)
      out.push(next)
      lastKind = next.kind
      added = true
    }
  }
  return out
}

function bookItems(topicFilter?: TopicFilter): FeedItem[] {
  const seen = new Set<number>()
  const items: FeedItem[] = []

  for (const shelf of gutenbergShelves) {
    if (!matchesTopicFilter(shelf.topicIds, topicFilter)) continue
    for (const bookId of shelf.bookIds) {
      if (seen.has(bookId)) continue
      seen.add(bookId)
      const meta = curatedGutenbergMeta[bookId]
      if (!meta) continue
      items.push({
        kind: 'book',
        id: `book-${bookId}`,
        bookId,
        title: meta.title,
        author: meta.author,
        why: meta.why,
        url: gutenbergUrl(bookId),
        topicId: shelf.topicIds[0],
      })
    }
  }
  return items
}

export function customSitesToResources(sites: CustomSite[]): LearningResource[] {
  return sites.map((s) => ({
    id: `user-${s.id}`,
    name: s.name,
    url: s.url,
    blurb: s.blurb || 'Added from Settings.',
    category: 'learning' as const,
    topicHints: s.topicHints,
  }))
}

function resourceItems(
  topicFilter?: TopicFilter,
  customSites: CustomSite[] = [],
): FeedItem[] {
  const curated = browseableResources()
  const custom = customSitesToResources(customSites)
  return [...curated, ...custom]
    .filter((r) => matchesTopicFilter(r.topicHints, topicFilter))
    .map((resource) => ({
      kind: 'resource' as const,
      id: `res-${resource.id}`,
      resource,
    }))
}

function ideaItems(topicFilter?: TopicFilter, extraIdeas: Idea[] = []): FeedItem[] {
  const catalog = mergeIdeas(extraIdeas)
  const list = catalog.filter((i) => matchesTopicFilter([i.topicId], topicFilter))
  return list.map((idea) => ({
    kind: 'idea' as const,
    id: `idea-${idea.id}`,
    idea,
  }))
}

function resolveNewsFeedId(n: NewsItem): string | undefined {
  if (n.feedId) return n.feedId
  return curatedNewsFeeds.find((f) => f.name === n.source)?.id
}

/** Default weight for curated outlets when mixing against custom RSS. */
const CURATED_NEWS_WEIGHT = CUSTOM_FEED_WEIGHT_DEFAULT

function newsItems(
  news: NewsItem[],
  topicFilter?: TopicFilter,
  disabledFeedIds: string[] = [],
  customFeeds: CustomFeed[] = [],
  seed = 0,
): FeedItem[] {
  const muted = new Set(disabledFeedIds)
  const weightByFeedId = new Map<string, number>()
  const capByFeedId = new Map<string, number>()
  for (const f of customFeeds) {
    if (!f.enabled) continue
    const fid = `user-${f.id}`
    weightByFeedId.set(fid, clampFeedWeight(f.weight))
    capByFeedId.set(fid, itemCapForFeedWeight(f.limit, f.weight))
  }

  const filtered = news.filter((n) => {
    const feedId = resolveNewsFeedId(n)
    if (feedId && muted.has(feedId)) return false
    return matchesTopicFilter(n.topicIds, topicFilter)
  })

  const byFeed = new Map<string, FeedItem[]>()
  const taken = new Map<string, number>()
  for (const n of filtered) {
    const feedId = resolveNewsFeedId(n) ?? '_unknown'
    const cap = capByFeedId.get(feedId)
    if (cap !== undefined) {
      const nTaken = taken.get(feedId) ?? 0
      if (nTaken >= cap) continue
      taken.set(feedId, nTaken + 1)
    }
    const list = byFeed.get(feedId) ?? []
    list.push({
      kind: 'news' as const,
      id: `news-${n.id}`,
      news: n,
    })
    byFeed.set(feedId, list)
  }

  const queues = [...byFeed.entries()].map(([feedId, items], idx) => ({
    items: sortByFreshness(seededShuffle(items, seed ^ (idx * 17 + 3))),
    weight: weightByFeedId.get(feedId) ?? CURATED_NEWS_WEIGHT,
  }))

  if (queues.length === 0) return []
  if (queues.length === 1) return queues[0].items
  // Preserve source mix — don’t flat-shuffle after this
  return weightedInterleave(queues)
}

function dayOfYear(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0)
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((now - start) / 86400000)
}

/** Recent doys ending at today (handles year wrap). Oldest → today. */
function recentDoys(windowDays: number, from = new Date()) {
  const out: number[] = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - i)
    out.push(dayOfYear(d))
  }
  return out
}

const BLB_ID_RE = /^blb-promise-doy-(\d+)$/
/** Lookback if today's promise isn't in the ingested window yet */
const BLB_LOOKBACK_DAYS = 21

/**
 * Evergreen → active 5-day cohort (then rest until the cycle returns).
 * Daily promises → today's doy only (or nearest earlier still in the pool).
 */
function filterScripturesForFeed(scriptures: ScriptureItem[]): ScriptureItem[] {
  const evergreen: ScriptureItem[] = []
  const byDoy = new Map<number, ScriptureItem>()

  for (const s of scriptures) {
    if (isDailyScripture(s)) {
      const m = BLB_ID_RE.exec(s.id)
      if (m) byDoy.set(Number(m[1]), s)
      continue
    }
    evergreen.push(s)
  }

  const active = activeEvergreenScriptures(evergreen)

  if (byDoy.size === 0) return active

  const doys = recentDoys(BLB_LOOKBACK_DAYS)
  for (let i = doys.length - 1; i >= 0; i--) {
    const hit = byDoy.get(doys[i])
    if (hit) return [...active, hit]
  }
  return active
}

function scriptureItems(
  scriptures: ScriptureItem[],
  topicFilter?: TopicFilter,
): FeedItem[] {
  return filterScripturesForFeed(scriptures)
    .filter((s) => matchesTopicFilter(s.topicIds, topicFilter))
    .map((s) => ({
      kind: 'scripture' as const,
      id: `scripture-${s.id}`,
      scripture: s,
    }))
}

function gameItems(): FeedItem[] {
  return [
    {
      kind: 'game',
      id: 'game-reaction',
      gameId: 'reaction',
      title: 'Click rush',
      blurb: 'Tap the box as it jumps. Ten seconds — how many can you land?',
    },
    {
      kind: 'game',
      id: 'game-spot',
      gameId: 'spot',
      title: 'Spot it',
      blurb: 'One tile is a shade off. Find it before the clock runs out.',
    },
    {
      kind: 'game',
      id: 'game-memory',
      gameId: 'memory',
      title: 'Sequence',
      blurb: 'Watch the pads light up, then repeat the chain. Grow your memory one step at a time.',
    },
    {
      kind: 'game',
      id: 'game-math',
      gameId: 'math',
      title: 'Quick math',
      blurb: 'Head math on the clock — mix of +, −, ×, and ÷. Tap the right answer fast.',
    },
    {
      kind: 'game',
      id: 'game-gravity',
      gameId: 'gravity',
      title: 'Gravity drop',
      blurb:
        'Dial gravity preference, then catch falling orbs. Higher g is faster — and worth more points.',
    },
  ]
}

/** Kind cadence weights — higher = denser early in the feed, still one card each. */
export const DEFAULT_FEED_WEIGHTS = {
  ideas: 2,
  news: 2,
  scripture: 1,
  resources: 1,
  books: 1,
  games: 1,
} as const

export type BuildMixedFeedOptions = {
  topicFilter?: TopicFilter
  news?: NewsItem[]
  scriptures?: ScriptureItem[]
  reshuffleKey?: number
  extraIdeas?: Idea[]
  subscriptions?: Subscriptions
}

/**
 * Total mix: ideas (+ book summaries) + news + scripture + sites + Gutenberg,
 * freshness-weighted so cards don't go stale. Each card id appears at most once.
 */
export function buildMixedFeed(options: BuildMixedFeedOptions): FeedItem[] {
  const opts = options
  const subs = opts.subscriptions
  const kinds = subs?.kinds
  const weights = subs?.kindWeights ?? DEFAULT_FEED_WEIGHTS
  const topic = opts.topicFilter
  const seed = daySeed(`r${opts.reshuffleKey ?? 0}:${JSON.stringify(topic ?? 'all')}`)

  const ideasExtra = kinds && !kinds.bookIdeas ? [] : (opts.extraIdeas ?? [])
  const ideasQ =
    !kinds || kinds.ideas
      ? sortByFreshness(seededShuffle(ideaItems(topic, ideasExtra), seed))
      : []
  const newsQ =
    !kinds || kinds.news
      ? newsItems(
          opts.news ?? [],
          topic,
          subs?.disabledFeedIds ?? [],
          subs?.customFeeds ?? [],
          seed ^ 1,
        )
      : []
  const scriptureQ =
    !kinds || kinds.scripture
      ? sortByFreshness(
          seededShuffle(scriptureItems(opts.scriptures ?? [], topic), seed ^ 5),
        )
      : []
  const resourcesQ =
    !kinds || kinds.resources
      ? sortByFreshness(
          seededShuffle(resourceItems(topic, subs?.customSites ?? []), seed ^ 2),
        )
      : []
  const booksQ =
    !kinds || kinds.books
      ? sortByFreshness(seededShuffle(bookItems(topic), seed ^ 3))
      : []
  const gamesQ =
    !kinds || kinds.games
      ? sortByFreshness(seededShuffle(gameItems(), seed ^ 7))
      : []

  return filterHidden(
    weightedInterleave([
      { items: ideasQ, weight: weights.ideas },
      { items: newsQ, weight: weights.news },
      { items: scriptureQ, weight: weights.scripture },
      { items: resourcesQ, weight: weights.resources },
      { items: booksQ, weight: weights.books },
      { items: gamesQ, weight: weights.games },
    ]),
  )
}

const LABELS = {
  idea: 'Idea',
  resource: 'Free site',
  book: 'Book',
  news: 'News',
  scripture: 'Scripture',
  game: 'Quick game',
} as const

export const feedKindLabel = (kind: FeedItem['kind']) => LABELS[kind]
