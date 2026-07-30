import { lazy, Suspense, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Idea } from '../data/types'
import { presentIdea } from '../data/presentIdea'
import { getTopic } from '../data/topics'
import { gutenbergUrl } from '../data/gutenberg'
import { parentFromIdea, type Thought } from '../data/thoughts'
import { useKept } from '../hooks/useKept'
import { useDraftReview } from '../hooks/useDraftReview'
import { useKeepStack } from '../hooks/useKeepStack'
import { useThoughts } from '../hooks/useThoughts'
import { ExternalCta, ExternalLinkIcon, sourceMediaParts } from './CardMedia'
import { CardFlip, CardNoteBack } from './CardFlip'
import { TrashIcon } from './TrashIcon'
import {
  AskIcon,
  BookIcon,
  CheckIcon,
  KeepIcon,
  NextIcon,
  NoteIcon,
  PrevIcon,
  ShareIcon,
  UndoIcon,
} from './ActionIcons'
import { formatAudioTime } from '../lib/formatTime'
import { shareIdea, shareStatusLabel, type ShareResult } from '../lib/exportThought'
import './IdeaCard.css'

const AskPanel = lazy(() =>
  import('./AskPanel').then((m) => ({ default: m.AskPanel })),
)

type Props = {
  idea: Idea
  compact?: boolean
  onNext?: () => void
  onPrev?: () => void
  onHide?: () => void
  index?: number
  total?: number
}

function resolveSourceUrl(idea: Idea): string | undefined {
  if (idea.sourceUrl) return idea.sourceUrl
  if (idea.gutenbergId) return gutenbergUrl(idea.gutenbergId)
  return undefined
}

export function IdeaCard({
  idea,
  compact,
  onNext,
  onPrev,
  onHide,
  index,
  total,
}: Props) {
  const topic = getTopic(idea.topicId)
  const { kept, toggle } = useKept()
  const { saveMoment, updateNote, promote, demote, thoughts } = useThoughts()
  const { keepToStack } = useKeepStack()
  const { approve, deny, isPending } = useDraftReview()
  const reviewing = Boolean(idea.draftReview) && isPending(idea.id)
  const saved = kept.has(idea.id)
  const sourceHref = resolveSourceUrl(idea)

  const [flipped, setFlipped] = useState(false)
  const [momentAt, setMomentAt] = useState(0)
  /** Listening stamp vs plain Keep-with-note */
  const [noteMode, setNoteMode] = useState<'moment' | 'keep'>('keep')

  // Plain Keep note for this card (not a listening stamp) — newest first in thoughts
  const keepThought = thoughts.find(
    (t) => t.parent.kind === 'idea' && t.parent.id === idea.id && t.startSec === 0,
  )
  /** This card was promoted from a thought — can send it back to edit */
  const sourceThought = thoughts.find((t) => t.promotedIdeaId === idea.id)

  const captureMoment = (startSec: number) => {
    setNoteMode('moment')
    setMomentAt(startSec)
    setFlipped(true)
  }

  const openKeepNote = () => {
    setNoteMode('keep')
    setMomentAt(0)
    setFlipped(true)
  }

  const onKeepClick = () => {
    // Compact lists (Kept / topic): Kept toggles off; Add note is separate
    if (compact && saved) {
      toggle(idea.id)
      return
    }
    openKeepNote()
  }

  // Every clip stamp saved on this card — shown as markers/chips on the player
  const savedMoments = thoughts
    .filter((t) => t.parent.kind === 'idea' && t.parent.id === idea.id && t.startSec > 0)
    .map((t) => ({ id: t.id, startSec: t.startSec, note: t.note }))

  const audioParts = idea.audioUrl
    ? sourceMediaParts(idea.audioUrl, 'Listen', 'idea-btn ghost idea-btn--link', {
        title: idea.title,
        artist: idea.source.replace(/\s*\+\s*audio\s*$/i, '').trim(),
        startAt: idea.audioStartSec,
        moments: savedMoments,
        onCaptureMoment: captureMoment,
      })
    : null
  const sourceParts = sourceHref
    ? sourceMediaParts(sourceHref, 'Source', 'idea-btn ghost idea-btn--link', {
        title: idea.title,
        artist: idea.source,
        startAt: idea.audioStartSec,
        moments: idea.audioUrl ? undefined : savedMoments,
        onCaptureMoment: idea.audioUrl ? undefined : captureMoment,
      })
    : null
  // Which player the moment came from decides the audio url stored with it.
  const momentParent = idea.audioUrl
    ? parentFromIdea(idea)
    : parentFromIdea({ ...idea, audioUrl: sourceHref })

  const commitNote = (note: string, promoteIt: boolean) => {
    const trimmed = note.trim()
    let thought: Thought
    if (noteMode === 'keep' && keepThought) {
      updateNote(keepThought.id, note)
      if (promoteIt && !keepThought.promotedIdeaId) {
        const ideaCard = promote(keepThought.id, trimmed)
        thought = {
          ...keepThought,
          note: trimmed,
          promotedIdeaId: ideaCard?.id ?? `thought-${keepThought.id}`,
        }
      } else {
        thought = { ...keepThought, note: trimmed }
      }
    } else {
      thought = saveMoment({
        parent: noteMode === 'moment' ? momentParent : parentFromIdea(idea),
        startSec: noteMode === 'moment' ? momentAt : 0,
        note,
        promote: promoteIt,
      })
    }
    // Always keep the source card — Save as idea adds a second card, it doesn't replace this one
    if (!saved) toggle(idea.id)
    // Compact Kept edits stay put; feed Keep lands on the new stack
    keepToStack(thought, { land: !compact })
  }
  // Prefer dedicated audioUrl for the player; keep sourceUrl as the page CTA when present.
  const media = audioParts?.media ?? sourceParts?.media
  const sourceCta = sourceParts?.cta
  const { hook, lesson, takeaway, example, hasMore } = presentIdea(idea)

  const [expanded, setExpanded] = useState(compact ? true : false)
  const [askOpen, setAskOpen] = useState(false)
  const [shareResult, setShareResult] = useState<ShareResult | null>(null)

  const onShare = async () => {
    const result = await shareIdea(idea)
    if (result === 'cancelled') return
    setShareResult(result)
    window.setTimeout(() => setShareResult(null), 1400)
  }

  const showHookAsTitle = hook !== idea.title

  const front = (
      <article
        className={`idea-card ${compact ? 'idea-card--compact' : ''} ${expanded ? 'is-expanded' : ''} ${reviewing ? 'idea-card--review' : ''}`}
        style={
          {
            '--card-accent': topic?.accent ?? '#ff5a45',
            '--card-surface': topic?.color ?? '#1a2332',
          } as CSSProperties
        }
      >
        <div className="idea-card-glow" aria-hidden />
        <header className="idea-card-top">
          <Link to={`/topics/${idea.topicId}`} className="idea-topic">
            #{topic?.name ?? idea.topicId}
          </Link>
          <div className="idea-card-top-right">
            {reviewing && <span className="idea-review-badge">From loop</span>}
            {!compact && typeof index === 'number' && typeof total === 'number' && (
              <span className="idea-progress">
                {index + 1} / {total}
              </span>
            )}
          </div>
        </header>

        {showHookAsTitle ? (
          <>
            <p className="idea-hook">{hook}</p>
            <h2 className="idea-title idea-title--sub">{idea.title}</h2>
          </>
        ) : (
          <h2 className="idea-title">{idea.title}</h2>
        )}

        <div className="idea-body-wrap">
          <p className="idea-body">{lesson}</p>

          {expanded && example && (
            <div className="idea-example">
              <span>Example</span>
              <p>{example}</p>
            </div>
          )}

          {expanded && takeaway && (
            <p className="idea-takeaway">
              <span>Takeaway</span>
              {takeaway}
            </p>
          )}

          {hasMore && !compact && (
            <button
              type="button"
              className="idea-expand"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>

        {reviewing && !compact && (
          <div className="idea-review-bar">
            <p className="idea-review-copy">
              New from the idea loop — Keep to attach your note and continue, or Reject to drop it.
            </p>
            <div className="idea-review-actions">
              <button type="button" className="idea-btn ghost" onClick={() => deny(idea)}>
                Reject
              </button>
              <button type="button" className="idea-btn keep" onClick={() => approve(idea)}>
                Keep
              </button>
            </div>
          </div>
        )}

        {onHide && (
          <div className="idea-dismiss">
            <button
              type="button"
              className="idea-trash"
              onClick={onHide}
              aria-label="Remove from feed forever"
              title="Never show again"
            >
              <TrashIcon />
            </button>
          </div>
        )}

        <footer className="idea-foot">
          <div className="idea-meta">
            {sourceHref ? (
              <a
                className="idea-source idea-source--link"
                href={sourceHref}
                target="_blank"
                rel="noreferrer"
              >
                {idea.audioPageUrl
                  ? idea.source.replace(/\s*\+\s*audio\s*$/i, '').trim()
                  : idea.source}
                {idea.gutenbergId ? (
                  <>
                    {' '}
                    Gutenberg <ExternalLinkIcon />
                  </>
                ) : (
                  <>
                    {' '}
                    <ExternalLinkIcon />
                  </>
                )}
              </a>
            ) : (
              <span className="idea-source">{idea.source}</span>
            )}
            {idea.audioPageUrl ? (
              <>
                <span className="idea-sep">·</span>
                <a
                  className="idea-source idea-source--link"
                  href={idea.audioPageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  20 Minute Books <ExternalLinkIcon />
                </a>
              </>
            ) : null}
            <span className="idea-sep">·</span>
            <span>{idea.readMinutes} min</span>
            <span className="idea-sep">·</span>
            <span className="idea-type">{idea.sourceType}</span>
          </div>

          {media}

          <div className="idea-actions">
            <div className="idea-actions-main">
              {!compact && onPrev && (
                <button
                  type="button"
                  className="idea-btn ghost idea-btn--icon"
                  onClick={onPrev}
                  aria-label="Previous idea"
                  title="Previous"
                >
                  <PrevIcon />
                </button>
              )}
              {sourceCta}
              {idea.audioPageUrl ? (
                <ExternalCta
                  href={idea.audioPageUrl}
                  className="idea-btn ghost idea-btn--link"
                  icon={<BookIcon />}
                  aria-label="20 Minute Books"
                >
                  20 min
                </ExternalCta>
              ) : null}
              {!reviewing && (
                <button
                  type="button"
                  className={`idea-btn keep idea-btn--labeled ${saved ? 'is-kept' : ''}`}
                  onClick={onKeepClick}
                  aria-pressed={saved}
                  aria-expanded={!compact && flipped}
                  aria-label={saved ? 'Kept' : 'Keep'}
                  title={saved ? 'Kept' : 'Keep'}
                >
                  <KeepIcon />
                  <span className="idea-btn-label">{saved ? 'Kept' : 'Keep'}</span>
                </button>
              )}
              {sourceThought && !reviewing && (
                <button
                  type="button"
                  className="idea-btn ghost idea-btn--labeled"
                  onClick={() => demote(sourceThought.id)}
                  title="Send back to Thoughts to edit, then promote again"
                  aria-label="Back to thought"
                >
                  <UndoIcon />
                  <span className="idea-btn-label">Back</span>
                </button>
              )}
              {compact && saved && !reviewing && !sourceThought && (
                <button
                  type="button"
                  className="idea-btn ghost idea-btn--labeled"
                  onClick={openKeepNote}
                  aria-expanded={flipped}
                  aria-label={keepThought?.note.trim() ? 'Edit note' : 'Add note'}
                  title={keepThought?.note.trim() ? 'Edit note' : 'Add note'}
                >
                  <NoteIcon />
                  <span className="idea-btn-label">
                    {keepThought?.note.trim() ? 'Edit' : 'Note'}
                  </span>
                </button>
              )}
              {(compact || saved) && !reviewing && (
                <button
                  type="button"
                  className="idea-btn ghost idea-btn--labeled"
                  onClick={() => void onShare()}
                  aria-label={shareStatusLabel(shareResult)}
                  title={shareStatusLabel(shareResult)}
                >
                  {shareResult === 'shared' || shareResult === 'copied' ? (
                    <CheckIcon />
                  ) : (
                    <ShareIcon />
                  )}
                  <span className="idea-btn-label">{shareStatusLabel(shareResult)}</span>
                </button>
              )}
              {!compact && (
                <button
                  type="button"
                  className={`idea-btn ghost idea-btn--labeled ${askOpen ? 'is-active' : ''}`}
                  onClick={() => setAskOpen((v) => !v)}
                  aria-expanded={askOpen}
                  aria-label={askOpen ? 'Hide ask' : 'Ask'}
                  title={askOpen ? 'Hide ask' : 'Ask'}
                >
                  <AskIcon />
                  <span className="idea-btn-label">{askOpen ? 'Hide' : 'Ask'}</span>
                </button>
              )}
            </div>
            {!compact && onNext && (
              <button
                type="button"
                className="idea-btn ghost idea-btn--next idea-btn--icon"
                onClick={onNext}
                aria-label="Next idea"
                title="Next"
              >
                <NextIcon />
              </button>
            )}
          </div>
        </footer>
      </article>
  )

  return (
    <div className="idea-stack">
      <CardFlip
        flipped={flipped}
        className={compact ? 'card-flip--fluid' : ''}
        front={front}
        back={
          <CardNoteBack
            accent={topic?.accent ?? '#ff5a45'}
            surface={topic?.color ?? '#1a2332'}
            kicker={noteMode === 'moment' ? 'Listening moment' : 'Keep · your note'}
            title={idea.title}
            detail={
              noteMode === 'moment'
                ? `Moment at ${formatAudioTime(momentAt)} · ${idea.source}`
                : idea.source
            }
            placeholder="What stuck? One line is enough — export seeds into the idea loop later."
            active={flipped}
            initialNote={noteMode === 'keep' ? (keepThought?.note ?? '') : ''}
            allowPromote={noteMode === 'moment' || !keepThought?.promotedIdeaId}
            onCancel={() => setFlipped(false)}
            onSave={commitNote}
          />
        }
      />

      {askOpen && !compact && (
        <Suspense fallback={null}>
          <AskPanel
            compact
            ideaTitle={idea.title}
            ideaBody={lesson}
            topicId={idea.topicId}
            topicName={topic?.name}
            initialQuestion={`What should I read next to go deeper on “${idea.title}”?`}
          />
        </Suspense>
      )}
    </div>
  )
}
