import type { Idea, TopicId } from './types'
import type { ScriptureItem } from './scriptureTypes'
import type { LearningResource } from './resources'
import type { NewsItem } from './newsTypes'
import { formatAudioTime } from '../lib/formatTime'

export { formatAudioTime } from '../lib/formatTime'

/** Enough parent context to promote without a live catalog lookup. */
export type ThoughtParentKind = 'idea' | 'news' | 'scripture' | 'resource' | 'book'

export type ThoughtParent = {
  kind: ThoughtParentKind
  id: string
  title: string
  topicId: TopicId
  source: string
  sourceType: Idea['sourceType']
  sourceUrl?: string
  audioUrl?: string
  audioPageUrl?: string
  body?: string
  /** Scripture-only context for Kept + promote */
  reference?: string
  verseText?: string
  translation?: string
}

export type Thought = {
  id: string
  startSec: number
  note: string
  createdAt: string
  parent: ThoughtParent
  /** Idea id in the personal pool after promote */
  promotedIdeaId?: string
}

/** Seed shape for `npm run draft:ideas -- --seeds …` */
export type ThoughtSeed = {
  topicId: TopicId
  note: string
  title?: string
  source?: string
  parentTitle?: string
  startSec?: number
  thoughtId?: string
  /** How this seed was captured */
  kind?: 'listening' | 'scripture' | 'kept'
  reference?: string
}

export function newThoughtId(): string {
  return `th-${crypto.randomUUID().slice(0, 10)}`
}

/** True when this thought is a stamped audio clip (not a plain Keep note). */
export function isListeningThought(thought: Thought): boolean {
  return thought.parent.kind !== 'scripture' && thought.startSec > 0
}

/** Truncate for card titles without chopping mid-word harshly. */
function shortTitle(text: string, max = 72): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

/**
 * Turn a saved moment / keep note into a feed-ready Idea card.
 * Always keeps the parent context (title, body, links, audio) and layers
 * the user's note on top — promote never replaces the original source.
 */
export function thoughtToIdea(thought: Thought): Idea {
  const note = thought.note.trim()
  const ideaId = thought.promotedIdeaId ?? `thought-${thought.id}`
  const parentBody = thought.parent.body?.trim() || undefined

  if (thought.parent.kind === 'scripture') {
    const ref = thought.parent.reference ?? thought.parent.source
    const verse = thought.parent.verseText
      ? `“${thought.parent.verseText}” — ${ref}`
      : undefined
    return {
      id: ideaId,
      topicId: thought.parent.topicId,
      title: note ? shortTitle(note) : thought.parent.title,
      // Body carries original passage context; note is the takeaway
      body: [note || null, parentBody || null, verse || null]
        .filter(Boolean)
        .join('\n\n') || `Kept from ${ref}.`,
      hook: note ? `My note · ${ref}` : `From ${ref}`,
      takeaway: note || undefined,
      lesson: parentBody || note || undefined,
      example: verse,
      source: ref,
      sourceType: thought.parent.sourceType,
      sourceUrl: thought.parent.sourceUrl,
      parentIdeaId: thought.parent.id,
      readMinutes: 1,
      ingestedAt: thought.createdAt,
    }
  }

  const listening = isListeningThought(thought)
  const at = formatAudioTime(thought.startSec)
  const fromLine = listening
    ? `From “${thought.parent.title}” · ${at}`
    : `From “${thought.parent.title}”`

  const bodyParts = [
    note || null,
    parentBody && parentBody !== note ? parentBody : null,
  ].filter(Boolean)

  return {
    id: ideaId,
    topicId: thought.parent.topicId,
    title: note
      ? shortTitle(note)
      : listening
        ? `Moment from ${thought.parent.title}`
        : `Kept: ${thought.parent.title}`,
    body:
      bodyParts.join('\n\n') ||
      (listening
        ? `Captured while listening to “${thought.parent.title}” at ${at}.`
        : `Kept from “${thought.parent.title}”.`),
    hook: note ? `My note · ${fromLine}` : fromLine,
    takeaway: note || undefined,
    // Prefer original lesson text so the source idea isn't lost under the note
    lesson: parentBody || note || undefined,
    example: listening
      ? `Clip at ${at} in “${thought.parent.title}”`
      : parentBody && note
        ? `Original: ${shortTitle(thought.parent.title, 48)}`
        : undefined,
    source: thought.parent.source,
    sourceType: thought.parent.sourceType,
    sourceUrl: thought.parent.sourceUrl,
    audioUrl: thought.parent.audioUrl,
    audioPageUrl: thought.parent.audioPageUrl,
    audioStartSec: listening ? thought.startSec : undefined,
    parentIdeaId: thought.parent.id,
    readMinutes: 1,
    ingestedAt: thought.createdAt,
  }
}

export function thoughtsToSeeds(thoughts: Thought[]): ThoughtSeed[] {
  return thoughts.map((t) => {
    const listening = isListeningThought(t)
    return {
      topicId: t.parent.topicId,
      note:
        t.note.trim() ||
        (t.parent.kind === 'scripture'
          ? `${t.parent.reference ?? t.parent.source}: ${t.parent.title}`
          : t.parent.title),
      title: t.note.trim() || undefined,
      source: t.parent.source,
      parentTitle: t.parent.title,
      startSec: listening ? t.startSec : undefined,
      thoughtId: t.id,
      kind:
        t.parent.kind === 'scripture' ? 'scripture' : listening ? 'listening' : 'kept',
      reference: t.parent.reference,
    }
  })
}

export function parentFromIdea(idea: Idea): ThoughtParent {
  return {
    kind: 'idea',
    id: idea.id,
    title: idea.title,
    topicId: idea.topicId,
    source: idea.source,
    sourceType: idea.sourceType,
    sourceUrl: idea.sourceUrl,
    audioUrl: idea.audioUrl,
    audioPageUrl: idea.audioPageUrl,
    body: idea.lesson ?? idea.body,
  }
}

export function parentFromScripture(scripture: ScriptureItem): ThoughtParent {
  return {
    kind: 'scripture',
    id: scripture.id,
    title: scripture.hook,
    topicId: scripture.topicIds[0] ?? 'mental-models',
    source: scripture.reference,
    sourceType: 'practice',
    sourceUrl: scripture.sourceUrl,
    body: scripture.lesson,
    reference: scripture.reference,
    verseText: scripture.text,
    translation: scripture.translation,
  }
}

export function parentFromNews(news: NewsItem, audioUrl?: string): ThoughtParent {
  return {
    kind: 'news',
    id: news.id,
    title: news.title || news.hook,
    topicId: (news.topicIds[0] ?? 'current-events') as TopicId,
    source: news.source,
    sourceType: 'podcast',
    sourceUrl: news.sourceUrl,
    audioUrl,
    body: news.lesson,
  }
}

export function parentFromResource(resource: LearningResource): ThoughtParent {
  return {
    kind: 'resource',
    id: resource.id,
    title: resource.name,
    topicId: (resource.topicHints?.[0] ?? 'mental-models') as TopicId,
    source: resource.name,
    sourceType: 'site',
    sourceUrl: resource.url,
    body: resource.blurb,
  }
}

export function parentFromBook(input: {
  id: string
  title: string
  author: string
  why: string
  url: string
  topicId?: TopicId
}): ThoughtParent {
  return {
    kind: 'book',
    id: input.id,
    title: input.title,
    topicId: input.topicId ?? 'history',
    source: input.author,
    sourceType: 'book',
    sourceUrl: input.url,
    body: input.why,
  }
}
