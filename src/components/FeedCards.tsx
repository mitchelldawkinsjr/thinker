import type { CSSProperties, ReactNode } from 'react'
import type { LearningResource } from '../data/resources'
import type { NewsItem } from '../data/newsTypes'
import type { ScriptureItem } from '../data/scriptureTypes'
import './IdeaCard.css'
import './FeedCards.css'

type NavProps = {
  onNext?: () => void
  onPrev?: () => void
  index?: number
  total?: number
}

function FeedCardShell({
  accent,
  surface,
  kind,
  title,
  children,
  cta,
  onNext,
  onPrev,
  index,
  total,
}: {
  accent: string
  surface: string
  kind: string
  title: string
  children: ReactNode
  cta?: ReactNode
} & NavProps) {
  return (
    <article
      className="feed-card"
      style={{ '--card-accent': accent, '--card-surface': surface } as CSSProperties}
    >
      <div className="feed-card-glow" aria-hidden />
      <header className="feed-card-top">
        <span className="feed-card-kind">{kind}</span>
        {typeof index === 'number' && typeof total === 'number' && (
          <span className="feed-card-progress">
            {index + 1} / {total}
          </span>
        )}
      </header>
      <h2 className="feed-card-title">{title}</h2>
      {children}
      <footer className="feed-card-foot">
        <div className="feed-card-actions">
          {onPrev && (
            <button type="button" className="idea-btn ghost" onClick={onPrev} aria-label="Previous">
              ←
            </button>
          )}
          {cta}
          {onNext && (
            <button type="button" className="idea-btn ghost" onClick={onNext}>
              Skip
            </button>
          )}
        </div>
      </footer>
    </article>
  )
}

export function ResourceFeedCard({
  resource,
  onNext,
  onPrev,
  index,
  total,
}: {
  resource: LearningResource
} & NavProps) {
  return (
    <FeedCardShell
      accent="#38bdf8"
      surface="#15202b"
      kind={`Free site · ${resource.category}`}
      title={resource.name}
      index={index}
      total={total}
      onPrev={onPrev}
      onNext={onNext}
      cta={
        <a className="idea-btn next" href={resource.url} target="_blank" rel="noreferrer">
          Open site →
        </a>
      }
    >
      <p className="feed-card-body">{resource.blurb}</p>
      <p className="feed-card-hint">Open the real site — don’t scroll Reddit for this.</p>
    </FeedCardShell>
  )
}

export function BookFeedCard({
  title,
  author,
  why,
  url,
  onNext,
  onPrev,
  index,
  total,
}: {
  title: string
  author: string
  why: string
  url: string
} & NavProps) {
  return (
    <FeedCardShell
      accent="#d4a574"
      surface="#2a2218"
      kind="Gutenberg · free ebook"
      title={title}
      index={index}
      total={total}
      onPrev={onPrev}
      onNext={onNext}
      cta={
        <a className="idea-btn next" href={url} target="_blank" rel="noreferrer">
          Read on Gutenberg →
        </a>
      }
    >
      <p className="feed-card-author">{author}</p>
      <p className="feed-card-body">{why}</p>
    </FeedCardShell>
  )
}

export function AskFeedCard({
  prompt,
  children,
  onNext,
  onPrev,
  index,
  total,
}: {
  prompt: string
  children: ReactNode
} & NavProps) {
  return (
    <div className="ask-feed-wrap">
      <FeedCardShell
        accent="#ff4d3a"
        surface="#1a2332"
        kind="Ask · llm-runtime"
        title="Go deeper"
        index={index}
        total={total}
        onPrev={onPrev}
        cta={
          onNext ? (
            <button type="button" className="idea-btn next" onClick={onNext}>
              Next →
            </button>
          ) : undefined
        }
      >
        <p className="feed-card-body">{prompt}</p>
      </FeedCardShell>
      <div className="ask-feed-panel">{children}</div>
    </div>
  )
}

export function NewsFeedCard({
  news,
  onNext,
  onPrev,
  index,
  total,
}: {
  news: NewsItem
} & NavProps) {
  const topics = news.topicIds.map((t) => `#${t}`).join(' · ')
  const primary = news.angles?.[0]?.url ?? news.sourceUrl

  return (
    <FeedCardShell
      accent="#c084fc"
      surface="#1e1a28"
      kind={`News · ${topics || 'current-events'}`}
      title={news.hook}
      index={index}
      total={total}
      onPrev={onPrev}
      onNext={onNext}
      cta={
        <a className="idea-btn next" href={primary} target="_blank" rel="noreferrer">
          Read source →
        </a>
      }
    >
      <p className="feed-card-author">{news.title}</p>
      <p className="feed-card-body">{news.lesson}</p>
      <p className="feed-card-hint">
        {news.source}
        {news.publishedAt
          ? ` · ${new Date(news.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
          : ''}
      </p>
      {news.angles && news.angles.length > 1 && (
        <div className="feed-card-angles">
          {news.angles.slice(0, 3).map((a) => (
            <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
              {a.label}
            </a>
          ))}
        </div>
      )}
    </FeedCardShell>
  )
}

export function ScriptureFeedCard({
  scripture,
  onNext,
  onPrev,
  index,
  total,
}: {
  scripture: ScriptureItem
} & NavProps) {
  const topics = scripture.topicIds.map((t) => `#${t}`).join(' · ')

  return (
    <FeedCardShell
      accent="#e8c47c"
      surface="#241c14"
      kind={`Scripture · ${topics || 'wisdom'}`}
      title={scripture.hook}
      index={index}
      total={total}
      onPrev={onPrev}
      onNext={onNext}
      cta={
        <a
          className="idea-btn next"
          href={scripture.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open passage →
        </a>
      }
    >
      <p className="feed-card-author">{scripture.reference}</p>
      <blockquote className="feed-card-verse">“{scripture.text}”</blockquote>
      <p className="feed-card-body">{scripture.lesson}</p>
      <p className="feed-card-hint">
        {scripture.translation} · via bolls.life (public domain)
      </p>
    </FeedCardShell>
  )
}
