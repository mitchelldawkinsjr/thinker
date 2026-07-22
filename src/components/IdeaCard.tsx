import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Idea } from '../data/types'
import { presentIdea } from '../data/ideaDepth'
import { getTopic } from '../data/topics'
import { gutenbergUrl } from '../data/gutenberg'
import { useKept } from '../hooks/useKept'
import { AskPanel } from './AskPanel'
import './IdeaCard.css'

type Props = {
  idea: Idea
  compact?: boolean
  onNext?: () => void
  onPrev?: () => void
  onHide?: () => void
  index?: number
  total?: number
  /** When true, start with Ask panel open (still dismissible) */
  askOpenByDefault?: boolean
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3h6m-8 4h10m-9 0v11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7M10 11v5m4-5v5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
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
  askOpenByDefault = false,
}: Props) {
  const topic = getTopic(idea.topicId)
  const { kept, toggle } = useKept()
  const saved = kept.has(idea.id)
  const sourceHref = resolveSourceUrl(idea)
  const { hook, lesson, takeaway, example, hasMore } = presentIdea(idea)

  const [expanded, setExpanded] = useState(compact ? true : false)
  const [askOpen, setAskOpen] = useState(askOpenByDefault)

  const showHookAsTitle = hook !== idea.title

  return (
    <div className="idea-stack">
      <article
        className={`idea-card ${compact ? 'idea-card--compact' : ''} ${expanded ? 'is-expanded' : ''}`}
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
          {!compact && typeof index === 'number' && typeof total === 'number' && (
            <span className="idea-progress">
              {index + 1} / {total}
            </span>
          )}
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
                {idea.source}
                {idea.gutenbergId ? ' ↗ Gutenberg' : ' ↗'}
              </a>
            ) : (
              <span className="idea-source">{idea.source}</span>
            )}
            <span className="idea-sep">·</span>
            <span>{idea.readMinutes} min</span>
            <span className="idea-sep">·</span>
            <span className="idea-type">{idea.sourceType}</span>
          </div>

          <div className="idea-actions">
            {!compact && onPrev && (
              <button type="button" className="idea-btn ghost" onClick={onPrev} aria-label="Previous idea">
                ←
              </button>
            )}
            {sourceHref && (
              <a
                className="idea-btn ghost idea-btn--link"
                href={sourceHref}
                target="_blank"
                rel="noreferrer"
              >
                Source
              </a>
            )}
            <button
              type="button"
              className={`idea-btn keep ${saved ? 'is-kept' : ''}`}
              onClick={() => toggle(idea.id)}
              aria-pressed={saved}
            >
              {saved ? 'Kept' : 'Keep'}
            </button>
            {!compact && (
              <button
                type="button"
                className={`idea-btn ghost ${askOpen ? 'is-active' : ''}`}
                onClick={() => setAskOpen((v) => !v)}
                aria-expanded={askOpen}
              >
                {askOpen ? 'Hide ask' : 'Ask'}
              </button>
            )}
            {!compact && onNext && (
              <button type="button" className="idea-btn ghost" onClick={onNext} aria-label="Next idea">
                →
              </button>
            )}
          </div>
        </footer>
      </article>

      {askOpen && !compact && (
        <AskPanel
          compact
          ideaTitle={idea.title}
          ideaBody={lesson}
          topicId={idea.topicId}
          topicName={topic?.name}
          initialQuestion={`What should I read next to go deeper on “${idea.title}”?`}
        />
      )}
    </div>
  )
}
