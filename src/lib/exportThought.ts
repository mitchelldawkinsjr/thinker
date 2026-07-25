import {
  formatAudioTime,
  isListeningThought,
  type Thought,
} from '../data/thoughts'
import { getTopic } from '../data/topics'
import { gutenbergUrl } from '../data/gutenberg'
import type { Idea } from '../data/types'
import { presentIdea } from '../data/presentIdea'

/** Prefer a seekable link when the host supports media fragments (`#t=`). */
export function audioUrlWithTimestamp(url: string, startSec: number): string {
  if (!Number.isFinite(startSec) || startSec <= 0) return url
  try {
    const u = new URL(url)
    u.hash = `t=${Math.floor(startSec)}`
    return u.toString()
  } catch {
    const bare = url.split('#')[0]
    return `${bare}#t=${Math.floor(startSec)}`
  }
}

function ideaSourceUrl(idea: Idea): string | undefined {
  if (idea.sourceUrl) return idea.sourceUrl
  if (idea.gutenbergId) return gutenbergUrl(idea.gutenbergId)
  return undefined
}

function thoughtTitle(thought: Thought): string {
  const note = thought.note.trim()
  if (note) return note.length > 80 ? `${note.slice(0, 77).trimEnd()}…` : note
  if (thought.parent.kind === 'scripture') {
    return thought.parent.reference ?? thought.parent.title
  }
  if (isListeningThought(thought)) {
    return `Moment · ${thought.parent.title} · ${formatAudioTime(thought.startSec)}`
  }
  return `Kept · ${thought.parent.title}`
}

/** Full plain-text thought — MP3 (+ #t=), note, source. Ready for Evernote share. */
export function thoughtToPlainText(thought: Thought): string {
  const title = thoughtTitle(thought)
  const topic = getTopic(thought.parent.topicId)
  const lines: string[] = [title, '']

  const note = thought.note.trim()
  if (note) lines.push(note, '')

  if (thought.parent.kind === 'scripture') {
    if (thought.parent.verseText) {
      lines.push(`“${thought.parent.verseText}”`)
    }
    lines.push(
      [
        thought.parent.reference ?? thought.parent.source,
        thought.parent.translation ? `(${thought.parent.translation})` : null,
      ]
        .filter(Boolean)
        .join(' '),
    )
    lines.push('')
  }

  const listening = isListeningThought(thought)
  const audioUrl = thought.parent.audioUrl?.trim()
  if (listening && audioUrl) {
    lines.push(`Listen at ${formatAudioTime(thought.startSec)}:`)
    lines.push(audioUrlWithTimestamp(audioUrl, thought.startSec))
    if (thought.parent.audioPageUrl && thought.parent.audioPageUrl !== audioUrl) {
      lines.push(`Episode: ${thought.parent.audioPageUrl}`)
    }
    lines.push('')
  } else if (audioUrl) {
    lines.push(`Audio: ${audioUrl}`)
    if (thought.parent.audioPageUrl && thought.parent.audioPageUrl !== audioUrl) {
      lines.push(`Episode: ${thought.parent.audioPageUrl}`)
    }
    lines.push('')
  } else if (listening) {
    lines.push(`Timestamp: ${formatAudioTime(thought.startSec)}`, '')
  }

  lines.push(`Source: ${thought.parent.title}`)
  if (thought.parent.source && thought.parent.source !== thought.parent.title) {
    lines.push(`From: ${thought.parent.source}`)
  }
  if (thought.parent.sourceUrl) lines.push(thought.parent.sourceUrl)
  if (topic?.name) lines.push(`Topic: ${topic.name}`)
  lines.push(`Captured: ${thought.createdAt}`)

  return lines.join('\n').trimEnd() + '\n'
}

/** Full plain-text kept idea card — body, takeaway, audio + seek, links. */
export function ideaToPlainText(idea: Idea): string {
  const { hook, lesson, takeaway, example } = presentIdea(idea)
  const topic = getTopic(idea.topicId)
  const sourceUrl = ideaSourceUrl(idea)
  const lines: string[] = [idea.title, '']

  if (hook && hook !== idea.title) lines.push(hook, '')
  if (lesson) lines.push(lesson, '')
  if (example) {
    lines.push('Example:')
    lines.push(example, '')
  }
  if (takeaway) {
    lines.push(`Takeaway: ${takeaway}`, '')
  }

  const audioUrl = idea.audioUrl?.trim()
  if (audioUrl) {
    if (idea.audioStartSec && idea.audioStartSec > 0) {
      lines.push(`Listen at ${formatAudioTime(idea.audioStartSec)}:`)
      lines.push(audioUrlWithTimestamp(audioUrl, idea.audioStartSec))
    } else {
      lines.push(`Audio: ${audioUrl}`)
    }
    if (idea.audioPageUrl && idea.audioPageUrl !== audioUrl) {
      lines.push(`Episode: ${idea.audioPageUrl}`)
    }
    lines.push('')
  } else if (idea.audioStartSec && idea.audioStartSec > 0) {
    lines.push(`Timestamp: ${formatAudioTime(idea.audioStartSec)}`, '')
  }

  lines.push(`Source: ${idea.source}`)
  if (sourceUrl) lines.push(sourceUrl)
  if (topic?.name) lines.push(`Topic: ${topic.name}`)
  if (idea.ingestedAt) lines.push(`Captured: ${idea.ingestedAt}`)

  return lines.join('\n').trimEnd() + '\n'
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

function canUseWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * Open the system share sheet (phone → Evernote, Messages, etc.).
 * Falls back to clipboard when Web Share isn’t available.
 */
export async function sharePlainText(opts: {
  title: string
  text: string
  filename?: string
}): Promise<ShareResult> {
  const text = opts.text.trimEnd() + '\n'
  const title = opts.title.slice(0, 120)

  if (canUseWebShare()) {
    try {
      const file = new File([text], opts.filename ?? 'thinker-note.txt', {
        type: 'text/plain',
      })
      // Prefer a file share when Evernote (and others) accept it — common on iOS.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] })
        return 'shared'
      }
      await navigator.share({ title, text })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled'
      }
      // Fall through to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export async function shareThought(thought: Thought): Promise<ShareResult> {
  return sharePlainText({
    title: thoughtTitle(thought),
    text: thoughtToPlainText(thought),
    filename: `thinker-thought-${thought.id}.txt`,
  })
}

export async function shareIdea(idea: Idea): Promise<ShareResult> {
  return sharePlainText({
    title: idea.title,
    text: ideaToPlainText(idea),
    filename: `thinker-idea-${idea.id}.txt`,
  })
}

/** One share payload with every open thought + kept idea card. */
export async function shareAllKept(opts: {
  thoughts: Thought[]
  ideas: Idea[]
}): Promise<ShareResult> {
  const parts: string[] = []
  for (const t of opts.thoughts) {
    parts.push(thoughtToPlainText(t).trimEnd())
  }
  for (const idea of opts.ideas) {
    parts.push(ideaToPlainText(idea).trimEnd())
  }
  if (parts.length === 0) return 'failed'

  const day = new Date().toISOString().slice(0, 10)
  const count = opts.thoughts.length + opts.ideas.length
  return sharePlainText({
    title: `Thinker · ${count} kept`,
    text: parts.join('\n\n———\n\n') + '\n',
    filename: `thinker-kept-${day}.txt`,
  })
}

/** Label for share buttons after an attempt. */
export function shareStatusLabel(
  result: ShareResult | null,
  idle = 'Share',
): string {
  if (result === 'shared') return 'Shared'
  if (result === 'copied') return 'Copied'
  if (result === 'failed') return 'Failed'
  return idle
}
