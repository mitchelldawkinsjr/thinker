import { useMemo, useState, useEffect, useCallback, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buildMixedFeed, feedKindLabel, type FeedItem } from '../data/feed'
import { resolveTopicFilter } from '../data/subscriptions'
import { getTopic } from '../data/topics'
import { useBookIdeas } from '../hooks/useBookIdeas'
import { useNewsItems } from '../hooks/useNews'
import { useScriptures } from '../hooks/useScriptures'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { useUserNewsItems } from '../hooks/useUserNews'
import {
  getFeedCursor,
  getFeedCursorItemId,
  setFeedCursor,
  stabilizeFeedOrder,
} from '../lib/daySession'
import { hideFromPool, markSeen } from '../lib/feedRotation'
import { resolvePlayableUrl } from '../lib/mediaUrl'
import { IdeaCard } from '../components/IdeaCard'
import {
  BookFeedCard,
  GravityGameFeedCard,
  MathGameFeedCard,
  MemoryGameFeedCard,
  NewsFeedCard,
  ReactionGameFeedCard,
  ResourceFeedCard,
  ScriptureFeedCard,
  SpotGameFeedCard,
} from '../components/FeedCards'
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
          title={item.title}
          author={item.author}
          why={item.why}
          url={item.url}
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
  const [reshuffle, setReshuffle] = useState(0)
  /** Bumps when a card is permanently removed so the mix rebuilds */
  const [hideTick, setHideTick] = useState(0)
  const { subscriptions } = useSubscriptions()
  const { items: curatedNews, updatedAt } = useNewsItems()
  const { items: userNews } = useUserNewsItems(subscriptions.customFeeds)
  const { items: scriptures } = useScriptures()
  const { items: bookIdeas, updatedAt: bookIdeasUpdatedAt } = useBookIdeas()

  const news = useMemo(() => {
    const byId = new Map<string, (typeof curatedNews)[number]>()
    for (const n of [...curatedNews, ...userNews]) byId.set(n.id, n)
    // Local test: /feed?demo=youtube&media=video → Play video lightbox
    if (params.get('demo') === 'youtube') {
      byId.set('demo-youtube', {
        id: 'demo-youtube',
        hook: 'KevOnStage Studios (demo)',
        title: 'YouTube lightbox test',
        lesson: 'Tap Play video to open the embed lightbox.',
        source: 'KevOnStage Studios',
        sourceUrl: 'https://www.youtube.com/watch?v=cybid3gX8xI',
        publishedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        topicIds: ['current-events'],
      })
    }
    return [...byId.values()]
  }, [curatedNews, userNews, params])

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
      extraIdeas: bookIdeas,
      subscriptions,
    })
    // Freeze today’s order so remounts / async loads / markSeen don’t reshuffle mid-session
    return stabilizeFeedOrder(mixed, topicKey, reshuffle)
    // hideTick re-runs build after permanent dismiss
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional refresh keys
  }, [resolvedTopic, news, scriptures, reshuffle, bookIdeas, subscriptions, hideTick, topicKey])

  const [index, setIndex] = useState(() => getFeedCursor(topicKey))
  /** Direction for card enter animation: next → fly off left, prev → fly off right */
  const [slideDir, setSlideDir] = useState<'next' | 'prev' | null>(null)
  /** Outgoing card kept mounted for the CodePen-style stack fly-off */
  const [leaving, setLeaving] = useState<{
    item: FeedItem
    dir: 'next' | 'prev'
    fromIndex: number
  } | null>(null)

  // Topic change: restore today’s cursor for that topic
  useEffect(() => {
    setSlideDir(null)
    setLeaving(null)
    setIndex(getFeedCursor(topicKey))
  }, [topicKey])

  // Prefer saved card id over raw index when the mix changes (async content, remount)
  useEffect(() => {
    if (items.length === 0) return
    const savedId = getFeedCursorItemId(topicKey)
    if (savedId) {
      const at = items.findIndex((it) => it.id === savedId)
      if (at >= 0) {
        setIndex(at)
        return
      }
    }
    setIndex((i) => Math.min(i, items.length - 1))
  }, [items, topicKey, hideTick])

  // Persist card position + id for today only (device localStorage)
  useEffect(() => {
    const id = items[index]?.id
    setFeedCursor(topicKey, index, id)
  }, [topicKey, index, items])

  // Jump to first direct audio/video news card for local testing (?media=audio|video)
  const mediaWant = params.get('media')
  useEffect(() => {
    if (mediaWant !== 'audio' && mediaWant !== 'video') return
    if (items.length === 0) return
    const i = items.findIndex((it) => {
      if (it.kind !== 'news') return false
      return resolvePlayableUrl(it.news.sourceUrl, it.news.angles).kind === mediaWant
    })
    if (i >= 0) setIndex(i)
  }, [items, mediaWant])

  // Jump to a brain game for local testing (?game=reaction|spot|memory|math|gravity)
  const gameWant = params.get('game')
  useEffect(() => {
    if (!gameWant || items.length === 0) return
    const i = items.findIndex(
      (it) => it.kind === 'game' && it.gameId === gameWant,
    )
    if (i >= 0) setIndex(i)
  }, [items, gameWant])

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
    setHideTick((t) => t + 1)
  }, [item?.id])

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'j') next()
      if (e.key === 'ArrowLeft' || e.key === 'k') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

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
            : 'Total mix — ideas, book summaries, politics/news, scripture, free sites, Gutenberg. Unseen cards rise; news expires so it doesn’t go stale.'}{' '}
          <Link to="/settings">Customize</Link>
        </p>
        <div className="feed-mix">
          <span>{counts.idea} ideas</span>
          <span>{counts.news} news</span>
          <span>{counts.scripture} scripture</span>
          <span>{counts.resource} sites</span>
          <span>{counts.book} books</span>
          {counts.game > 0 && <span>{counts.game} brain games</span>}
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
