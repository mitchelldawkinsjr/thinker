import { ideas, getIdeasByTopic } from './ideas'
import { learningResources, type LearningResource } from './resources'
import {
  curatedGutenbergMeta,
  gutenbergShelves,
  gutenbergUrl,
} from './gutenberg'
import type { Idea, TopicId } from './types'

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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Round-robin merge so no single source dominates the swipe stack */
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
  const list = topicFilter ? getIdeasByTopic(topicFilter) : ideas
  return list.map((idea) => ({
    kind: 'idea' as const,
    id: `idea-${idea.id}`,
    idea,
  }))
}

function askItems(topicFilter?: string): FeedItem[] {
  const pool = topicFilter ? getIdeasByTopic(topicFilter) : ideas
  const samples = shuffle(pool).slice(0, Math.min(8, Math.ceil(pool.length / 6)))

  return samples.map((idea, i) => ({
    kind: 'ask' as const,
    id: `ask-${idea.id}-${i}`,
    prompt: `What should I read next to go deeper on “${idea.title}”?`,
    topicId: idea.topicId,
    ideaTitle: idea.title,
    ideaBody: idea.body,
  }))
}

/**
 * Total mix: ideas + free sites + Gutenberg books + ask prompts,
 * interleaved so the feed never feels like one silo.
 */
export function buildMixedFeed(topicFilter?: string | null): FeedItem[] {
  const topic = topicFilter || undefined

  const ideasQ = shuffle(ideaItems(topic))
  const resourcesQ = shuffle(resourceItems(topic))
  const booksQ = shuffle(bookItems(topic))
  const asksQ = shuffle(askItems(topic))

  return interleave([ideasQ, resourcesQ, booksQ, asksQ, ideasQ])
}

const LABELS = {
  idea: 'Idea',
  resource: 'Free site',
  book: 'Gutenberg',
  ask: 'Ask LLM',
} as const

export const feedKindLabel = (kind: FeedItem['kind']) => LABELS[kind]
