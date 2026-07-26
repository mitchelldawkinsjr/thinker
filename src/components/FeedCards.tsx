import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { LearningResource } from '../data/resources'
import type { NewsItem } from '../data/newsTypes'
import type { ScriptureItem } from '../data/scriptureTypes'
import type { TopicId } from '../data/types'
import { newsCardCopy } from '../lib/newsChallenge'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { bibleAppPassageUrl } from '../lib/scriptureLinks'
import { ExternalCta, ImageLightboxTrigger, sourceMediaParts } from './CardMedia'
import { CardFlip, CardNoteBack } from './CardFlip'
import { TrashIcon } from './TrashIcon'
import { BookIcon, KeepIcon, NextIcon, PrevIcon } from './ActionIcons'
import { resolvePlayableUrl } from '../lib/mediaUrl'
import { formatAudioTime } from '../lib/formatTime'
import { useThoughts } from '../hooks/useThoughts'
import {
  parentFromBook,
  parentFromNews,
  parentFromResource,
  parentFromScripture,
} from '../data/thoughts'
import './IdeaCard.css'
import './FeedCards.css'

type NavProps = {
  onNext?: () => void
  onPrev?: () => void
  onHide?: () => void
  index?: number
  total?: number
}

export function FeedCardShell({
  accent,
  surface,
  kind,
  title,
  children,
  media,
  cta,
  onNext,
  onPrev,
  onHide,
  index,
  total,
}: {
  accent: string
  surface: string
  kind: string
  title: string
  children: ReactNode
  /** Inline player above the action row (audio) */
  media?: ReactNode
  cta?: ReactNode
  onHide?: () => void
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
      {media}
      {onHide && (
        <div className="feed-card-dismiss">
          <button
            type="button"
            className="feed-card-trash"
            onClick={onHide}
            aria-label="Remove from feed forever"
            title="Never show again"
          >
            <TrashIcon />
          </button>
        </div>
      )}
      <footer className="feed-card-foot">
        <div className="feed-card-actions">
          <div className="feed-card-actions-main">
            {onPrev && (
              <button
                type="button"
                className="idea-btn ghost idea-btn--icon"
                onClick={onPrev}
                aria-label="Previous"
                title="Previous"
              >
                <PrevIcon />
              </button>
            )}
            {cta}
          </div>
          {onNext && (
            <button
              type="button"
              className="idea-btn ghost idea-btn--next idea-btn--icon"
              onClick={onNext}
              aria-label="Next"
              title="Next"
            >
              <NextIcon />
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
  onHide,
  index,
  total,
}: {
  resource: LearningResource
} & NavProps) {
  const { thoughts, saveMoment } = useThoughts()
  const [flipped, setFlipped] = useState(false)
  const parts = sourceMediaParts(resource.url, 'Open site')
  const alreadyKept = thoughts.some(
    (t) => t.parent.kind === 'resource' && t.parent.id === resource.id,
  )

  return (
    <CardFlip
      flipped={flipped}
      front={
        <FeedCardShell
          accent="#38bdf8"
          surface="#15202b"
          kind={`Free site · ${resource.category}`}
          title={resource.name}
          index={index}
          total={total}
          onPrev={onPrev}
          onNext={onNext}
          onHide={onHide}
          media={parts.media}
          cta={
            <>
              {parts.cta}
              <button
                type="button"
                className={`idea-btn keep idea-btn--labeled ${alreadyKept ? 'is-kept' : ''}`}
                onClick={() => setFlipped(true)}
                aria-expanded={flipped}
                aria-pressed={alreadyKept}
                aria-label={alreadyKept ? 'Kept' : 'Keep'}
                title={alreadyKept ? 'Kept' : 'Keep'}
              >
                <KeepIcon />
                <span className="idea-btn-label">{alreadyKept ? 'Kept' : 'Keep'}</span>
              </button>
            </>
          }
        >
          <p className="feed-card-body">{resource.blurb}</p>
          <p className="feed-card-hint">Open the real site — leave the infinite scroll behind.</p>
        </FeedCardShell>
      }
      back={
        <CardNoteBack
          accent="#38bdf8"
          surface="#15202b"
          kicker="Keep · your note"
          title={resource.name}
          detail={resource.category}
          placeholder="What stuck? One line is enough — export seeds into the idea loop later."
          active={flipped}
          onCancel={() => setFlipped(false)}
          onSave={(note, promote) =>
            saveMoment({
              parent: parentFromResource(resource),
              startSec: 0,
              note,
              promote,
            })
          }
        />
      }
    />
  )
}

export function BookFeedCard({
  id,
  title,
  author,
  why,
  url,
  topicId,
  ctaLabel = 'Read on Gutenberg',
  kindLabel = 'Book · free ebook',
  pages,
  category,
  accent = '#d4a574',
  surface = '#2a2218',
  onNext,
  onPrev,
  onHide,
  index,
  total,
}: {
  id: string
  title: string
  author: string
  why: string
  url: string
  topicId?: TopicId
  ctaLabel?: string
  kindLabel?: string
  pages?: number
  category?: string
  accent?: string
  surface?: string
} & NavProps) {
  const { thoughts, saveMoment } = useThoughts()
  const [flipped, setFlipped] = useState(false)
  const parts = sourceMediaParts(url, ctaLabel)
  const alreadyKept = thoughts.some((t) => t.parent.kind === 'book' && t.parent.id === id)
  const metaBits = [
    pages != null ? `${pages} pages` : null,
    category || null,
  ].filter(Boolean)

  return (
    <CardFlip
      flipped={flipped}
      front={
        <FeedCardShell
          accent={accent}
          surface={surface}
          kind={kindLabel}
          title={title}
          index={index}
          total={total}
          onPrev={onPrev}
          onNext={onNext}
          onHide={onHide}
          media={parts.media}
          cta={
            <>
              {parts.cta}
              <button
                type="button"
                className={`idea-btn keep idea-btn--labeled ${alreadyKept ? 'is-kept' : ''}`}
                onClick={() => setFlipped(true)}
                aria-expanded={flipped}
                aria-pressed={alreadyKept}
                aria-label={alreadyKept ? 'Kept' : 'Keep'}
                title={alreadyKept ? 'Kept' : 'Keep'}
              >
                <KeepIcon />
                <span className="idea-btn-label">{alreadyKept ? 'Kept' : 'Keep'}</span>
              </button>
            </>
          }
        >
          <p className="feed-card-author">{author}</p>
          <p className="feed-card-body">{why}</p>
          {metaBits.length > 0 && (
            <p className="feed-card-author" style={{ opacity: 0.75 }}>
              {metaBits.join(' · ')}
            </p>
          )}
        </FeedCardShell>
      }
      back={
        <CardNoteBack
          accent={accent}
          surface={surface}
          kicker="Keep · your note"
          title={title}
          detail={author}
          placeholder="What stuck? One line is enough — export seeds into the idea loop later."
          active={flipped}
          onCancel={() => setFlipped(false)}
          onSave={(note, promote) =>
            saveMoment({
              parent: parentFromBook({ id, title, author, why, url, topicId }),
              startSec: 0,
              note,
              promote,
            })
          }
        />
      }
    />
  )
}

export function NewsFeedCard({
  news,
  onNext,
  onPrev,
  onHide,
  index,
  total,
}: {
  news: NewsItem
} & NavProps) {
  const { subscriptions } = useSubscriptions()
  const topics = news.topicIds.map((t) => `#${t}`).join(' · ')
  const primary = resolvePlayableUrl(news.sourceUrl, news.angles).url
  const { saveMoment, thoughts } = useThoughts()
  const [flipped, setFlipped] = useState(false)
  const [momentAt, setMomentAt] = useState(0)
  const [noteMode, setNoteMode] = useState<'moment' | 'keep'>('keep')

  const alreadyKept = thoughts.some((t) => t.parent.kind === 'news' && t.parent.id === news.id)
  // Every clip stamp saved on this story — markers/chips on the player
  const savedMoments = thoughts
    .filter((t) => t.parent.kind === 'news' && t.parent.id === news.id && t.startSec > 0)
    .map((t) => ({ id: t.id, startSec: t.startSec, note: t.note }))
  const parts = sourceMediaParts(primary, 'Read source', 'idea-btn next', {
    title: news.title || news.hook,
    artist: news.source,
    moments: savedMoments,
    onCaptureMoment: (startSec) => {
      setNoteMode('moment')
      setMomentAt(startSec)
      setFlipped(true)
    },
  })

  const commitMoment = (note: string, promote: boolean) => {
    saveMoment({
      parent: parentFromNews(news, primary),
      startSec: noteMode === 'moment' ? momentAt : 0,
      note,
      promote,
    })
  }
  const isPolitics = news.topicIds.includes('politics')
  const [copied, setCopied] = useState(false)

  const copySourceUrl = async () => {
    const url = news.sourceUrl
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Fallback for older WebViews
      const ta = document.createElement('textarea')
      ta.value = url
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  const extraAngles = (news.angles ?? []).filter(
    (a) => a.url !== primary && a.label !== 'Full story' && a.label !== 'AllSides',
  )

  const allSidesHref = 'https://www.allsides.com/bias-checker'
  const { body, challenge } = newsCardCopy(news, {
    thinkPromptOff: subscriptions.thinkPromptOff,
  })

  const front = (
    <FeedCardShell
      accent="#c084fc"
      surface="#1e1a28"
      kind={`News · ${topics || 'current-events'}`}
      title={news.hook}
      index={index}
      total={total}
      onPrev={onPrev}
      onNext={onNext}
      onHide={onHide}
      media={parts.media}
      cta={
        <>
          {parts.cta}
          <button
            type="button"
            className={`idea-btn keep idea-btn--labeled ${alreadyKept ? 'is-kept' : ''}`}
            onClick={() => {
              setNoteMode('keep')
              setMomentAt(0)
              setFlipped(true)
            }}
            aria-expanded={flipped}
            aria-pressed={alreadyKept}
            aria-label={alreadyKept ? 'Kept' : 'Keep'}
            title={alreadyKept ? 'Kept' : 'Keep'}
          >
            <KeepIcon />
            <span className="idea-btn-label">{alreadyKept ? 'Kept' : 'Keep'}</span>
          </button>
        </>
      }
    >
      <p className="feed-card-author">{news.title}</p>
      {news.imageUrl ? (
        <figure className="feed-card-image">
          <ImageLightboxTrigger src={news.imageUrl} className="feed-card-image-btn" />
        </figure>
      ) : null}
      <p className="feed-card-body">{body}</p>
      {challenge ? (
        <aside className="feed-card-challenge" aria-label="Think about the headline">
          <span className="feed-card-challenge-kicker">Think</span>
          <p className="feed-card-challenge-q">{challenge}</p>
        </aside>
      ) : null}
      <p className="feed-card-hint">
        {news.source}
        {news.publishedAt
          ? ` · ${new Date(news.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
          : ''}
      </p>
      <div className="feed-card-angles">
        <button
          type="button"
          className={`feed-card-angle-btn ${copied ? 'is-copied' : ''}`}
          onClick={() => void copySourceUrl()}
          title="Copy source URL for a bias checker"
        >
          {copied ? 'Copied' : 'Copy URL'}
        </button>
        {isPolitics && (
          <>
            <a href={allSidesHref} target="_blank" rel="noreferrer">
              AllSides
            </a>
            <a href="https://ground.news/" target="_blank" rel="noreferrer">
              Ground News
            </a>
          </>
        )}
        {extraAngles.slice(0, 2).map((a) => (
          <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
            {a.label}
          </a>
        ))}
      </div>
    </FeedCardShell>
  )

  return (
    <CardFlip
      flipped={flipped}
      front={front}
      back={
        <CardNoteBack
          accent="#c084fc"
          surface="#1e1a28"
          kicker={noteMode === 'moment' ? 'Listening moment' : 'Keep · your note'}
          title={news.title || news.hook}
          detail={
            noteMode === 'moment'
              ? `Moment at ${formatAudioTime(momentAt)} · ${news.source}`
              : news.source
          }
          placeholder="What stuck? One line is enough — export seeds into the idea loop later."
          active={flipped}
          onCancel={() => setFlipped(false)}
          onSave={commitMoment}
        />
      }
    />
  )
}

export function ScriptureFeedCard({
  scripture,
  onNext,
  onPrev,
  onHide,
  index,
  total,
}: {
  scripture: ScriptureItem
} & NavProps) {
  const topics = scripture.topicIds.map((t) => `#${t}`).join(' · ')
  const href = bibleAppPassageUrl(scripture)
  const { thoughts, saveMoment } = useThoughts()
  const [flipped, setFlipped] = useState(false)

  const alreadyKept = thoughts.some(
    (t) => t.parent.kind === 'scripture' && t.parent.id === scripture.id,
  )

  const front = (
    <FeedCardShell
      accent="#e8c47c"
      surface="#241c14"
      kind={`Scripture · ${topics || 'wisdom'}`}
      title={scripture.hook}
      index={index}
      total={total}
      onPrev={onPrev}
      onNext={onNext}
      onHide={onHide}
      cta={
        <>
          <ExternalCta href={href} icon={<BookIcon />} aria-label="Bible App">
            Bible App
          </ExternalCta>
          <button
            type="button"
            className={`idea-btn keep idea-btn--labeled ${alreadyKept ? 'is-kept' : ''}`}
            onClick={() => setFlipped(true)}
            aria-expanded={flipped}
            aria-pressed={alreadyKept}
            aria-label={alreadyKept ? 'Kept' : 'Keep'}
            title={alreadyKept ? 'Kept' : 'Keep'}
          >
            <KeepIcon />
            <span className="idea-btn-label">{alreadyKept ? 'Kept' : 'Keep'}</span>
          </button>
        </>
      }
    >
      <p className="feed-card-author">{scripture.reference}</p>
      <blockquote className="feed-card-verse">“{scripture.text}”</blockquote>
      <p className="feed-card-body">{scripture.lesson}</p>
      <p className="feed-card-hint">
        {scripture.translation}
        {scripture.sourceUrl?.includes('/devotionals/promises/') && (
          <>
            {' '}
            ·{' '}
            <a href={scripture.sourceUrl} target="_blank" rel="noreferrer">
              BLB Daily Promise
            </a>
          </>
        )}
        {scripture.sourceUrl?.includes('faiths-checkbook') && (
          <>
            {' '}
            ·{' '}
            <a href={scripture.sourceUrl} target="_blank" rel="noreferrer">
              Faith&apos;s Checkbook
            </a>
          </>
        )}
        {scripture.sourceUrl?.includes('/devotionals/me/') && (
          <>
            {' '}
            ·{' '}
            <a href={scripture.sourceUrl} target="_blank" rel="noreferrer">
              Spurgeon Morning
            </a>
          </>
        )}
        {' '}
        · Keep copies this; the cohort card stays
      </p>
    </FeedCardShell>
  )

  return (
    <CardFlip
      flipped={flipped}
      front={front}
      back={
        <CardNoteBack
          accent="#e8c47c"
          surface="#241c14"
          kicker="Keep · your note"
          title={scripture.hook}
          detail={`${scripture.reference} · ${scripture.translation}`}
          placeholder="What stuck? One line is enough — export seeds into the idea loop later."
          active={flipped}
          onCancel={() => setFlipped(false)}
          onSave={(note, promote) =>
            saveMoment({
              parent: parentFromScripture(scripture),
              startSec: 0,
              note,
              promote,
            })
          }
        />
      }
    />
  )
}
