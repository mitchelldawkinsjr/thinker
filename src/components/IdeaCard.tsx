import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Idea } from '../data/types'
import { presentIdea } from '../data/ideaDepth'
import { getTopic } from '../data/topics'
import { gutenbergUrl } from '../data/gutenberg'
import { useStash } from '../hooks/useStash'
import { AskPanel } from './AskPanel'
import './IdeaCard.css'

type Props = {
  idea: Idea
  compact?: boolean
  onNext?: () => void
  onPrev?: () => void
  index?: number
  total?: number
  /** When true, start with Ask panel open (still dismissible) */
  askOpenByDefault?: boolean
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
  index,
  total,
  askOpenByDefault = false,
}: Props) {
  const topic = getTopic(idea.topicId)
  const { stashed, toggle } = useStash()
  const saved = stashed.has(idea.id)
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
              className={`idea-btn stash ${saved ? 'is-saved' : ''}`}
              onClick={() => toggle(idea.id)}
              aria-pressed={saved}
            >
              {saved ? 'Stashed' : 'Stash'}
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
              <button type="button" className="idea-btn next" onClick={onNext}>
                Next →
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
