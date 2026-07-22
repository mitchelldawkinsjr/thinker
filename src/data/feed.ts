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
      gameId: 'reaction' | 'spot' | 'memory' | 'math'
      title: string
      blurb: string
    }

/**
 * Round-robin by weight without duplicating items.
 * weight 2 ≈ two pulls per cycle vs weight 1 — each card still appears once.
 */
function weightedInterleave<T extends { id: string }>(
  queues: { items: T[]; weight: number }[],
): T[] {
  const qs = queues.map((q) => ({
    items: [...q.items],
    weight: Math.max(1, Math.floor(q.weight)),
  }))
  const pattern: number[] = []
  qs.forEach((q, i) => {
    for (let w = 0; w < q.weight; w++) pattern.push(i)
  })

  const out: T[] = []
  const used = new Set<string>()
  let added = true
  while (added) {
    added = false
    for (const qi of pattern) {
      const q = qs[qi]
      while (q.items.length) {
        const next = q.items.shift()!
        if (used.has(next.id)) continue
        used.add(next.id)
        out.push(next)
        added = true
        break
      }
    }
  }
  return out
}

function bookItems(topicFilter?: string): FeedItem[] {
  const seen = new Set<number>()
  const items: FeedItem[] = []

  for (const shelf of gutenbergShelves) {
    if (topicFilter && !shelf.topicIds.includes(topicFilter as TopicId)) continue
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

function resourceItems(topicFilter?: string): FeedItem[] {
  return browseableResources()
    .filter((r) => {
      if (!topicFilter) return true
      return r.topicHints?.includes(topicFilter)
    })
    .map((resource) => ({
      kind: 'resource' as const,
      id: `res-${resource.id}`,
      resource,
    }))
}

function ideaItems(topicFilter?: string, extraIdeas: Idea[] = []): FeedItem[] {
  const catalog = mergeIdeas(extraIdeas)
  const list = topicFilter
    ? catalog.filter((i) => i.topicId === topicFilter)
    : catalog
  return list.map((idea) => ({
    kind: 'idea' as const,
    id: `idea-${idea.id}`,
    idea,
  }))
}

function newsItems(news: NewsItem[], topicFilter?: string): FeedItem[] {
  return news
    .filter((n) => {
      if (!topicFilter) return true
      return n.topicIds.includes(topicFilter as TopicId)
    })
    .map((n) => ({
      kind: 'news' as const,
      id: `news-${n.id}`,
      news: n,
    }))
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
 * Curated passages stay; BLB Daily Promises collapse to today's doy
 * (or the nearest earlier day still in the pool).
 */
function filterDailyPromises(scriptures: ScriptureItem[]): ScriptureItem[] {
  const curated: ScriptureItem[] = []
  const byDoy = new Map<number, ScriptureItem>()

  for (const s of scriptures) {
    const m = BLB_ID_RE.exec(s.id)
    if (!m) {
      curated.push(s)
      continue
    }
    byDoy.set(Number(m[1]), s)
  }

  if (byDoy.size === 0) return curated

  const doys = recentDoys(BLB_LOOKBACK_DAYS)
  for (let i = doys.length - 1; i >= 0; i--) {
    const hit = byDoy.get(doys[i])
    if (hit) return [...curated, hit]
  }
  return curated
}

function scriptureItems(
  scriptures: ScriptureItem[],
  topicFilter?: string,
): FeedItem[] {
  return filterDailyPromises(scriptures)
    .filter((s) => {
      if (!topicFilter) return true
      return s.topicIds.includes(topicFilter as TopicId)
    })
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
      blurb: 'Solve as many as you can in ten seconds. Tap the right answer — speed counts.',
    },
  ]
}

/** Kind cadence weights — higher = denser early in the feed, still one card each */
const FEED_WEIGHTS = {
  ideas: 2,
  news: 2,
  scripture: 2,
  resources: 1,
  books: 1,
  games: 1,
} as const

/**
 * Total mix: ideas (+ book summaries) + news + scripture + sites + Gutenberg,
 * freshness-weighted so cards don't go stale. Each card id appears at most once.
 */
export function buildMixedFeed(
  topicFilter?: string | null,
  news: NewsItem[] = [],
  scriptures: ScriptureItem[] = [],
  reshuffleKey = 0,
  extraIdeas: Idea[] = [],
): FeedItem[] {
  const topic = topicFilter || undefined
  const seed = daySeed(`r${reshuffleKey}:${topic ?? 'all'}`)

  const ideasQ = sortByFreshness(
    seededShuffle(ideaItems(topic, extraIdeas), seed),
  )
  const newsQ = sortByFreshness(seededShuffle(newsItems(news, topic), seed ^ 1))
  const scriptureQ = sortByFreshness(
    seededShuffle(scriptureItems(scriptures, topic), seed ^ 5),
  )
  const resourcesQ = sortByFreshness(seededShuffle(resourceItems(topic), seed ^ 2))
  const booksQ = sortByFreshness(seededShuffle(bookItems(topic), seed ^ 3))
  const gamesQ = sortByFreshness(seededShuffle(gameItems(), seed ^ 7))

  return filterHidden(
    weightedInterleave([
      { items: ideasQ, weight: FEED_WEIGHTS.ideas },
      { items: newsQ, weight: FEED_WEIGHTS.news },
      { items: scriptureQ, weight: FEED_WEIGHTS.scripture },
      { items: resourcesQ, weight: FEED_WEIGHTS.resources },
      { items: booksQ, weight: FEED_WEIGHTS.books },
      { items: gamesQ, weight: FEED_WEIGHTS.games },
    ]),
  )
}

const LABELS = {
  idea: 'Idea',
  resource: 'Free site',
  book: 'Gutenberg',
  news: 'News · Politics',
  scripture: 'Scripture',
  game: 'Brain game',
} as const

export const feedKindLabel = (kind: FeedItem['kind']) => LABELS[kind]
