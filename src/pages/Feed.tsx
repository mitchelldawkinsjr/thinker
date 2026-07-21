import { useMemo, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildMixedFeed, feedKindLabel } from '../data/feed'
import { getTopic } from '../data/topics'
import { IdeaCard } from '../components/IdeaCard'
import { AskPanel } from '../components/AskPanel'
import { AskFeedCard, BookFeedCard, ResourceFeedCard } from '../components/FeedCards'
import './Feed.css'

export function Feed() {
  const [params] = useSearchParams()
  const topicFilter = params.get('topic')
  const topic = topicFilter ? getTopic(topicFilter) : undefined
  const [reshuffle, setReshuffle] = useState(0)

  const items = useMemo(
    () => buildMixedFeed(topicFilter),
    [topicFilter, reshuffle],
  )

  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [topicFilter, reshuffle])

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % Math.max(items.length, 1))
  }, [items.length])

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

  const item = items[index]
  const counts = useMemo(() => {
    const c = { idea: 0, resource: 0, book: 0, ask: 0 }
    for (const it of items) c[it.kind]++
    return c
  }, [items])

  return (
    <div className="feed">
      <div className="feed-bg" aria-hidden />
      <header className="feed-head">
        <h1>{topic ? `#${topic.name}` : 'Your feed'}</h1>
        <p>
          {topic
            ? `Mixed ideas, free sites, and Gutenberg for ${topic.name}. Expand a card to go deeper — Ask is optional.`
            : 'Total mix — ideas, free sites, Gutenberg books. Read more on a card when you want depth; Ask when you want a path.'}
        </p>
        <div className="feed-mix">
          <span>{counts.idea} ideas</span>
          <span>{counts.resource} sites</span>
          <span>{counts.book} books</span>
          <span>{counts.ask} asks</span>
          <button type="button" className="feed-reshuffle" onClick={() => setReshuffle((n) => n + 1)}>
            Reshuffle
          </button>
        </div>
      </header>

      <div className="feed-stage">
        {!item && <p className="feed-empty">Nothing in this mix yet.</p>}

        {item?.kind === 'idea' && (
          <IdeaCard
            key={item.id}
            idea={item.idea}
            index={index}
            total={items.length}
            onNext={next}
            onPrev={prev}
          />
        )}

        {item?.kind === 'resource' && (
          <ResourceFeedCard
            key={item.id}
            resource={item.resource}
            index={index}
            total={items.length}
            onNext={next}
            onPrev={prev}
          />
        )}

        {item?.kind === 'book' && (
          <BookFeedCard
            key={item.id}
            title={item.title}
            author={item.author}
            why={item.why}
            url={item.url}
            index={index}
            total={items.length}
            onNext={next}
            onPrev={prev}
          />
        )}

        {item?.kind === 'ask' && (
          <AskFeedCard
            key={item.id}
            prompt={item.prompt}
            index={index}
            total={items.length}
            onNext={next}
            onPrev={prev}
          >
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
