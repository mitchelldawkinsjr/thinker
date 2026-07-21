import { ideas, getIdeasByTopic } from './ideas'
import { learningResources, type LearningResource } from './resources'
import {
  curatedGutenbergMeta,
  gutenbergShelves,
  gutenbergUrl,
} from './gutenberg'
import type { Idea, TopicId } from './types'
import type { NewsItem } from './newsTypes'
import { daySeed, seededShuffle, sortByFreshness } from '../lib/feedRotation'

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
      kind: 'ask'
      id: string
      prompt: string
      topicId?: TopicId
      ideaTitle?: string
      ideaBody?: string
    }
  | {
      kind: 'news'
      id: string
      news: NewsItem
    }

function interleave<T>(queues: T[][]): T[] {
  const qs = queues.map((q) => [...q])
  const out: T[] = []
  let added = true
  while (added) {
    added = false
    for (const q of qs) {
      const next = q.shift()
      if (next !== undefined) {
        out.push(next)
        added = true
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
  return learningResources
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

function ideaItems(topicFilter?: string): FeedItem[] {
  let list = topicFilter ? getIdeasByTopic(topicFilter) : ideas
  // Boost politics + current-events into the default mix
  if (!topicFilter) {
    const boost = ideas.filter(
      (i) => i.topicId === 'politics' || i.topicId === 'current-events',
    )
    list = [...list, ...boost]
  }
  return list.map((idea) => ({
    kind: 'idea' as const,
    id: `idea-${idea.id}`,
    idea,
  }))
}

function askItems(topicFilter?: string): FeedItem[] {
  const pool = topicFilter ? getIdeasByTopic(topicFilter) : ideas
  const politicsPool = pool.filter(
    (i) => i.topicId === 'politics' || i.topicId === 'current-events',
  )
  const base = politicsPool.length ? [...pool, ...politicsPool] : pool
  const samples = seededShuffle(base, daySeed('ask')).slice(
    0,
    Math.min(10, Math.ceil(base.length / 5)),
  )

  return samples.map((idea, i) => ({
    kind: 'ask' as const,
    id: `ask-${idea.id}-${i}`,
    prompt: `What should I read next to go deeper on “${idea.title}”?`,
    topicId: idea.topicId,
    ideaTitle: idea.title,
    ideaBody: idea.body,
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

/**
 * Total mix: ideas + news/politics + sites + Gutenberg + ask,
 * freshness-weighted so cards don't go stale.
 */
export function buildMixedFeed(
  topicFilter?: string | null,
  news: NewsItem[] = [],
  reshuffleKey = 0,
): FeedItem[] {
  const topic = topicFilter || undefined
  const seed = daySeed(`r${reshuffleKey}:${topic ?? 'all'}`)

  const ideasQ = sortByFreshness(seededShuffle(ideaItems(topic), seed))
  const newsQ = sortByFreshness(seededShuffle(newsItems(news, topic), seed ^ 1))
  const resourcesQ = sortByFreshness(seededShuffle(resourceItems(topic), seed ^ 2))
  const booksQ = sortByFreshness(seededShuffle(bookItems(topic), seed ^ 3))
  const asksQ = sortByFreshness(seededShuffle(askItems(topic), seed ^ 4))

  // Weight: ideas, news (politics/current), ideas again, resources, books, asks
  return interleave([ideasQ, newsQ, resourcesQ, newsQ, booksQ, asksQ, ideasQ])
}

const LABELS = {
  idea: 'Idea',
  resource: 'Free site',
  book: 'Gutenberg',
  ask: 'Ask LLM',
  news: 'News · Politics',
} as const

export const feedKindLabel = (kind: FeedItem['kind']) => LABELS[kind]
