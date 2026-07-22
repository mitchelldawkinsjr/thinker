import { useMemo, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildMixedFeed, feedKindLabel } from '../data/feed'
import { getTopic } from '../data/topics'
import { useBookIdeas } from '../hooks/useBookIdeas'
import { useNewsItems } from '../hooks/useNews'
import { useScriptures } from '../hooks/useScriptures'
import { getFeedCursor, setFeedCursor } from '../lib/daySession'
import { hideFromPool, markSeen } from '../lib/feedRotation'
import { IdeaCard } from '../components/IdeaCard'
import { AskPanel } from '../components/AskPanel'
import {
  AskFeedCard,
  BookFeedCard,
  NewsFeedCard,
  ResourceFeedCard,
  ScriptureFeedCard,
} from '../components/FeedCards'
import './Feed.css'

export function Feed() {
  const [params] = useSearchParams()
  const topicFilter = params.get('topic')
  const topicKey = topicFilter
  const topic = topicFilter ? getTopic(topicFilter) : undefined
  const [reshuffle, setReshuffle] = useState(0)
  /** Bumps after a full loop so freshness re-sorts without changing the daily shuffle seed */
  const [loopTick, setLoopTick] = useState(0)
  /** Bumps when a card is permanently removed so the mix rebuilds */
  const [hideTick, setHideTick] = useState(0)
  const { items: news, updatedAt } = useNewsItems()
  const { items: scriptures } = useScriptures()
  const { items: bookIdeas, updatedAt: bookIdeasUpdatedAt } = useBookIdeas()

  const items = useMemo(
    () => buildMixedFeed(topicFilter, news, scriptures, reshuffle, bookIdeas),
    // loopTick / hideTick re-run build for freshness + permanent dismiss
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional refresh keys
    [topicFilter, news, scriptures, reshuffle, bookIdeas, loopTick, hideTick],
  )

  const [index, setIndex] = useState(() => getFeedCursor(topicKey))

  // Topic change: restore today’s cursor for that topic
  useEffect(() => {
    setIndex(getFeedCursor(topicKey))
  }, [topicKey])

  useEffect(() => {
    if (items.length === 0) {
      setIndex(0)
      return
    }
    setIndex((i) => Math.min(i, items.length - 1))
  }, [items.length, hideTick])

  // Persist card position for today only (device localStorage)
  useEffect(() => {
    setFeedCursor(topicKey, index)
  }, [topicKey, index])

  const item = items[index]

  useEffect(() => {
    if (item?.id) markSeen(item.id)
  }, [item?.id])

  const hideCurrent = useCallback(() => {
    if (!item?.id) return
    hideFromPool(item.id)
    setHideTick((t) => t + 1)
  }, [item?.id])

  const reshuffleFeed = useCallback(() => {
    setReshuffle((n) => n + 1)
    setIndex(0)
    setFeedCursor(topicKey, 0)
  }, [topicKey])

  const next = useCallback(() => {
    if (items.length <= 1) {
      setLoopTick((t) => t + 1)
      setIndex(0)
      return
    }
    if (index + 1 >= items.length) {
      setLoopTick((t) => t + 1)
      setIndex(0)
      return
    }
    setIndex(index + 1)
  }, [index, items.length])

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1))
  }, [items.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'j') next()
      if (e.key === 'ArrowLeft' || e.key === 'k') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  const counts = useMemo(() => {
    const c = { idea: 0, resource: 0, book: 0, ask: 0, news: 0, scripture: 0 }
    for (const it of items) c[it.kind]++
    return c
  }, [items])

  const nav = { index, total: items.length, onNext: next, onPrev: prev, onHide: hideCurrent }

  return (
    <div className="feed">
      <div className="feed-bg" aria-hidden />
      <header className="feed-head">
        <h1>{topic ? `#${topic.name}` : 'Your feed'}</h1>
        <p>
          {topic
            ? `Mixed ideas, book summaries, news, scripture, and sources for ${topic.name}.`
            : 'Total mix — ideas, book summaries, politics/news, scripture, free sites, Gutenberg. Unseen cards rise; news expires so it doesn’t go stale.'}
        </p>
        <div className="feed-mix">
          <span>{counts.idea} ideas</span>
          <span>{counts.news} news</span>
          <span>{counts.scripture} scripture</span>
          <span>{counts.resource} sites</span>
          <span>{counts.book} books</span>
          <span>{counts.ask} asks</span>
          <button type="button" className="feed-reshuffle" onClick={reshuffleFeed}>
            Reshuffle
          </button>
        </div>
        {(updatedAt || bookIdeasUpdatedAt) && (
          <p className="feed-updated">
            {updatedAt && (
              <>
                News updated{' '}
                {new Date(updatedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </>
            )}
            {updatedAt && bookIdeasUpdatedAt ? ' · ' : null}
            {bookIdeasUpdatedAt && (
              <>
                Books{' '}
                {new Date(bookIdeasUpdatedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </>
            )}
          </p>
        )}
      </header>

      <div className="feed-stage">
        {!item && <p className="feed-empty">Nothing in this mix yet.</p>}

        {item?.kind === 'idea' && (
          <IdeaCard key={item.id} idea={item.idea} {...nav} />
        )}

        {item?.kind === 'news' && (
          <NewsFeedCard key={item.id} news={item.news} {...nav} />
        )}

        {item?.kind === 'scripture' && (
          <ScriptureFeedCard key={item.id} scripture={item.scripture} {...nav} />
        )}

        {item?.kind === 'resource' && (
          <ResourceFeedCard key={item.id} resource={item.resource} {...nav} />
        )}

        {item?.kind === 'book' && (
          <BookFeedCard
            key={item.id}
            title={item.title}
            author={item.author}
            why={item.why}
            url={item.url}
            {...nav}
          />
        )}

        {item?.kind === 'ask' && (
          <AskFeedCard key={item.id} prompt={item.prompt} {...nav}>
            <AskPanel
              compact
              initialQuestion={item.prompt}
              ideaTitle={item.ideaTitle}
              ideaBody={item.ideaBody}
              topicId={item.topicId}
              topicName={item.topicId ? getTopic(item.topicId)?.name : undefined}
            />
          </AskFeedCard>
        )}
      </div>

      {item && (
        <p className="feed-now">
          Now: <strong>{feedKindLabel(item.kind)}</strong>
        </p>
      )}
    </div>
  )
}
