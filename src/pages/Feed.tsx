import { useMemo, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buildMixedFeed, feedKindLabel, type FeedItem } from '../data/feed'
import { resolveTopicFilter } from '../data/subscriptions'
import { getTopic } from '../data/topics'
import { useExtraIdeas } from '../hooks/useExtraIdeas'
import { useDraftReview } from '../hooks/useDraftReview'
import { useNewsItems } from '../hooks/useNews'
import { useScriptures } from '../hooks/useScriptures'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { useUserNewsItems } from '../hooks/useUserNews'
import {
  getFeedCursor,
  getFeedCursorItemId,
  getFeedReshuffle,
  setFeedCursor,
  stabilizeFeedOrder,
} from '../lib/daySession'
import { hideFromPool, markSeen } from '../lib/feedRotation'
import { IdeaCard } from '../components/IdeaCard'
import {
  BookFeedCard,
  NewsFeedCard,
  ResourceFeedCard,
  ScriptureFeedCard,
} from '../components/FeedCards'
import {
  GravityGameFeedCard,
  MathGameFeedCard,
  MemoryGameFeedCard,
  ReactionGameFeedCard,
  SpotGameFeedCard,
} from '../components/FeedGames'
import './Feed.css'

/** Matches CodePen comment-card fly-off duration */
const DECK_MS = 600

type NavProps = {
  index: number
  total: number
  onNext: () => void
  onPrev: () => void
  onHide: () => void
}

function renderFeedCard(item: FeedItem, nav: NavProps): ReactNode {
  switch (item.kind) {
    case 'idea':
      return <IdeaCard idea={item.idea} {...nav} />
    case 'news':
      return <NewsFeedCard news={item.news} {...nav} />
    case 'scripture':
      return <ScriptureFeedCard scripture={item.scripture} {...nav} />
    case 'resource':
      return <ResourceFeedCard resource={item.resource} {...nav} />
    case 'book':
      return (
        <BookFeedCard
          id={item.id}
          title={item.title}
          author={item.author}
          why={item.why}
          url={item.url}
          topicId={item.topicId}
          ctaLabel={item.ctaLabel}
          kindLabel={item.kindLabel}
          pages={item.pages}
          category={item.category}
          accent={item.accent}
          surface={item.surface}
          {...nav}
        />
      )
    case 'game':
      if (item.gameId === 'reaction') {
        return <ReactionGameFeedCard title={item.title} blurb={item.blurb} {...nav} />
      }
      if (item.gameId === 'spot') {
        return <SpotGameFeedCard title={item.title} blurb={item.blurb} {...nav} />
      }
      if (item.gameId === 'memory') {
        return <MemoryGameFeedCard title={item.title} blurb={item.blurb} {...nav} />
      }
      if (item.gameId === 'math') {
        return <MathGameFeedCard title={item.title} blurb={item.blurb} {...nav} />
      }
      return <GravityGameFeedCard title={item.title} blurb={item.blurb} {...nav} />
    default:
      return null
  }
}

export function Feed() {
  const [params] = useSearchParams()
  const topicFilter = params.get('topic')
  const topicKey = topicFilter
  const topic = topicFilter ? getTopic(topicFilter) : undefined
  const [reshuffle, setReshuffle] = useState(() => getFeedReshuffle(topicKey))
  /** Bumps when a card is permanently removed so the mix rebuilds */
  const [hideTick, setHideTick] = useState(0)
  const { subscriptions } = useSubscriptions()
  const { items: curatedNews, updatedAt } = useNewsItems()
  const { items: userNews } = useUserNewsItems(subscriptions.customFeeds)
  const { items: scriptures } = useScriptures()
  const {
    items: extraIdeas,
    bookIdeasUpdatedAt,
    catalogUpdatedAt,
    pendingDraftCount,
  } = useExtraIdeas()
  const { queueNotice, clearQueueNotice } = useDraftReview()

  const news = useMemo(() => {
    const byId = new Map<string, (typeof curatedNews)[number]>()
    for (const n of [...curatedNews, ...userNews]) byId.set(n.id, n)
    return [...byId.values()]
  }, [curatedNews, userNews])

  const resolvedTopic = useMemo(
    () => resolveTopicFilter(topicFilter, subscriptions),
    [topicFilter, subscriptions],
  )

  const items = useMemo(() => {
    const mixed = buildMixedFeed({
      topicFilter: resolvedTopic,
      news,
      scriptures,
      reshuffleKey: reshuffle,
      extraIdeas,
      subscriptions,
    })
    // Freeze today’s order so remounts / async loads / markSeen don’t reshuffle mid-session
    return stabilizeFeedOrder(mixed, topicKey, reshuffle)
    // hideTick re-runs build after permanent dismiss
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional refresh keys
  }, [resolvedTopic, news, scriptures, reshuffle, extraIdeas, subscriptions, hideTick, topicKey])

  const [index, setIndex] = useState(() => getFeedCursor(topicKey))
  /** Direction for card enter animation: next → fly off left, prev → fly off right */
  const [slideDir, setSlideDir] = useState<'next' | 'prev' | null>(null)
  /** Outgoing card kept mounted for the CodePen-style stack fly-off */
  const [leaving, setLeaving] = useState<{
    item: FeedItem
    dir: 'next' | 'prev'
    fromIndex: number
  } | null>(null)
  const indexRef = useRef(index)
  indexRef.current = index
  /**
   * When restore jumps index to the saved card, the persist effect in the same
   * paint still sees the stale index — write the saved id/position instead.
   */
  const restorePersistRef = useRef<{ index: number; itemId: string } | null>(null)

  // Topic change: restore today’s cursor + reshuffle for that topic
  useEffect(() => {
    setSlideDir(null)
    setLeaving(null)
    setReshuffle(getFeedReshuffle(topicKey))
    setIndex(getFeedCursor(topicKey))
  }, [topicKey])

  // Prefer saved card id over raw index when the mix changes (async content, remount)
  useEffect(() => {
    if (items.length === 0) return
    const savedId = getFeedCursorItemId(topicKey)
    if (savedId) {
      const at = items.findIndex((it) => it.id === savedId)
      if (at >= 0) {
        if (at !== indexRef.current) {
          restorePersistRef.current = { index: at, itemId: savedId }
          setIndex(at)
        }
        return
      }
      // Saved card not in this (possibly seed-sized) mix yet — keep index, don’t clamp
      // onto a different card. Persist effect will wait until the id reappears.
      return
    }
    setIndex((i) => Math.min(i, items.length - 1))
  }, [items, topicKey, hideTick])

  // Persist card position + id for today only (device localStorage).
  // Skip while the saved card is missing from a compressed seed feed so we
  // don’t overwrite itemId with whatever sits at the same numeric index.
  useEffect(() => {
    if (items.length === 0) return
    const pending = restorePersistRef.current
    if (pending) {
      restorePersistRef.current = null
      setFeedCursor(topicKey, pending.index, pending.itemId)
      return
    }
    const savedId = getFeedCursorItemId(topicKey)
    if (savedId && !items.some((it) => it.id === savedId)) return
    setFeedCursor(topicKey, index, items[index]?.id)
  }, [topicKey, index, items])

  const item = items[index]

  useEffect(() => {
    if (item?.id) markSeen(item.id)
  }, [item?.id])

  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(() => setLeaving(null), DECK_MS)
    return () => window.clearTimeout(t)
  }, [leaving])

  const hideCurrent = useCallback(() => {
    if (!item?.id) return
    setSlideDir(null)
    setLeaving(null)
    hideFromPool(item.id)
    // Drop saved id so resume doesn’t wait forever for a permanently removed card
    setFeedCursor(topicKey, index, null)
    setHideTick((t) => t + 1)
  }, [item?.id, topicKey, index])

  const reshuffleFeed = useCallback(() => {
    setSlideDir(null)
    setLeaving(null)
    setReshuffle((n) => n + 1)
    setIndex(0)
    setFeedCursor(topicKey, 0, null)
  }, [topicKey])

  const next = useCallback(() => {
    if (items.length === 0 || leaving) return
    if (index + 1 >= items.length) return
    const current = items[index]
    if (current) setLeaving({ item: current, dir: 'next', fromIndex: index })
    setSlideDir('next')
    setIndex(index + 1)
  }, [index, items, leaving])

  const prev = useCallback(() => {
    if (items.length === 0 || leaving || index <= 0) return
    const current = items[index]
    if (current) setLeaving({ item: current, dir: 'prev', fromIndex: index })
    setSlideDir('prev')
    setIndex(index - 1)
  }, [index, items, leaving])

  const counts = useMemo(() => {
    const c = { idea: 0, resource: 0, book: 0, news: 0, scripture: 0, game: 0 }
    for (const it of items) c[it.kind]++
    return c
  }, [items])

  const nav: NavProps = {
    index,
    total: items.length,
    onNext: next,
    onPrev: prev,
    onHide: hideCurrent,
  }

  const frozenNav: NavProps = {
    index: leaving?.fromIndex ?? index,
    total: items.length,
    onNext: () => {},
    onPrev: () => {},
    onHide: () => {},
  }

  return (
    <div className="feed">
      <div className="feed-bg" aria-hidden />
      <header className="feed-head">
        <h1>{topic ? `#${topic.name}` : 'Your feed'}</h1>
        <p>
          {topic
            ? `Mixed ideas, book summaries, news, scripture, and sources for ${topic.name}.`
            : 'Total mix — ideas, book summaries, news, scripture, free sites, books. Unseen cards rise; recently seen stay buried across days. News expires so it doesn’t go stale.'}{' '}
          <Link to="/settings">Customize</Link>
        </p>
        <div className="feed-mix">
          <span>{counts.idea} ideas</span>
          {pendingDraftCount > 0 && (
            <span className="feed-mix-review">
              {pendingDraftCount} from the loop
            </span>
          )}
          <span>{counts.news} news</span>
          <span>{counts.scripture} scripture</span>
          <span>{counts.resource} sites</span>
          <span>{counts.book} books</span>
          {counts.game > 0 && <span>{counts.game} quick games</span>}
          <button type="button" className="feed-reshuffle" onClick={reshuffleFeed}>
            Reshuffle
          </button>
        </div>
        {queueNotice && (
          <p className="feed-queue-notice" role="status">
            {queueNotice}{' '}
            <button type="button" className="feed-queue-notice-dismiss" onClick={clearQueueNotice}>
              Dismiss
            </button>
          </p>
        )}
        {(updatedAt || bookIdeasUpdatedAt || catalogUpdatedAt) && (
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
            {(updatedAt || bookIdeasUpdatedAt) && catalogUpdatedAt ? ' · ' : null}
            {catalogUpdatedAt && (
              <>
                Ideas{' '}
                {new Date(catalogUpdatedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </>
            )}
          </p>
        )}
      </header>

      <div
        className="feed-stage feed-deck"
        data-slide={slideDir ?? undefined}
        data-animating={leaving ? 'true' : undefined}
      >
        {!item && !leaving && <p className="feed-empty">Nothing in this mix yet.</p>}

        {leaving && (
          <div
            className={`feed-deck-sheet is-out is-${leaving.dir}`}
            key={`out-${leaving.item.id}`}
            aria-hidden
          >
            {renderFeedCard(leaving.item, frozenNav)}
          </div>
        )}

        {item && (
          <div
            className={`feed-deck-sheet is-current${slideDir ? ' is-enter' : ''}`}
            key={item.id}
            data-enter={slideDir ?? undefined}
          >
            {renderFeedCard(item, nav)}
          </div>
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
