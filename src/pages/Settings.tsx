import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { curatedNewsFeeds } from '../data/newsFeeds'
import {
  isHttpsUrl,
  KIND_LABELS,
  MAX_CUSTOM_FEEDS,
  MAX_CUSTOM_SITES,
  type ContentKindKey,
} from '../data/subscriptions'
import { topics } from '../data/topics'
import type { TopicId } from '../data/types'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { clearUserNewsForFeed, previewCustomFeed } from '../hooks/useUserNews'
import './Settings.css'

const NEWS_TOPIC_OPTIONS: TopicId[] = [
  'current-events',
  'politics',
  'finance',
  'mental-models',
  'nba-analytics',
  'football-film',
  'sports-biz',
]

export function Settings() {
  const {
    subscriptions,
    setKind,
    toggleTopic,
    setFeedMuted,
    addCustomSite,
    removeCustomSite,
    addCustomFeed,
    updateCustomFeed,
    removeCustomFeed,
    resetSubscriptions,
  } = useSubscriptions()

  const [siteName, setSiteName] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [siteBlurb, setSiteBlurb] = useState('')
  const [siteTopics, setSiteTopics] = useState<TopicId[]>([])
  const [siteError, setSiteError] = useState<string | null>(null)

  const [feedName, setFeedName] = useState('')
  const [feedUrl, setFeedUrl] = useState('')
  const [feedTopics, setFeedTopics] = useState<TopicId[]>(['current-events'])
  const [feedBusy, setFeedBusy] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [feedOk, setFeedOk] = useState<string | null>(null)

  const muted = useMemo(
    () => new Set(subscriptions.disabledFeedIds),
    [subscriptions.disabledFeedIds],
  )
  const followed = useMemo(() => new Set(subscriptions.topics), [subscriptions.topics])

  function toggleSiteTopic(id: TopicId) {
    setSiteTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  function toggleFeedTopic(id: TopicId) {
    setFeedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  function onAddSite(e: FormEvent) {
    e.preventDefault()
    setSiteError(null)
    const name = siteName.trim()
    const url = siteUrl.trim()
    if (!name) {
      setSiteError('Name is required')
      return
    }
    if (!isHttpsUrl(url)) {
      setSiteError('URL must be https://')
      return
    }
    if (subscriptions.customSites.length >= MAX_CUSTOM_SITES) {
      setSiteError(`Limit is ${MAX_CUSTOM_SITES} sites`)
      return
    }
    const id = addCustomSite({
      name,
      url,
      blurb: siteBlurb.trim() || undefined,
      topicHints: siteTopics.length ? siteTopics : undefined,
    })
    if (!id) {
      setSiteError('Could not add site')
      return
    }
    setSiteName('')
    setSiteUrl('')
    setSiteBlurb('')
    setSiteTopics([])
  }

  async function onAddFeed(e: FormEvent) {
    e.preventDefault()
    setFeedError(null)
    setFeedOk(null)
    const name = feedName.trim() || hostnameLabel(feedUrl)
    const url = feedUrl.trim()
    if (!isHttpsUrl(url)) {
      setFeedError('URL must be https://')
      return
    }
    if (subscriptions.customFeeds.length >= MAX_CUSTOM_FEEDS) {
      setFeedError(`Limit is ${MAX_CUSTOM_FEEDS} feeds`)
      return
    }
    setFeedBusy(true)
    try {
      const topicsForFeed = feedTopics.length ? feedTopics : (['current-events'] as TopicId[])
      await previewCustomFeed({
        name,
        url,
        topicIds: topicsForFeed,
        limit: 8,
      })
      const id = addCustomFeed({
        name,
        url,
        topicIds: topicsForFeed,
        limit: 8,
        enabled: true,
      })
      if (!id) throw new Error('Could not save feed')
      setFeedOk(`Added “${name}” — items will show in your feed.`)
      setFeedName('')
      setFeedUrl('')
      setFeedTopics(['current-events'])
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : 'Could not add feed')
    } finally {
      setFeedBusy(false)
    }
  }

  function onRemoveFeed(id: string) {
    removeCustomFeed(id)
    clearUserNewsForFeed(id)
  }

  return (
    <div className="settings-page">
      <header className="settings-head">
        <p className="settings-kicker">Your mix</p>
        <h1>What should Thinker put in your feed?</h1>
        <p>
          Turn content types on or off, follow topics, mute news sources, and add your own
          sites or RSS feeds. Preferences stay on this device.{' '}
          <Link to="/feed">Back to feed</Link>
        </p>
      </header>

      <section className="settings-section" aria-labelledby="kinds-heading">
        <h2 id="kinds-heading">Content types</h2>
        <p className="settings-lead">Choose which kinds of cards appear in the mix.</p>
        <ul className="settings-toggles">
          {KIND_LABELS.map(({ key, label, hint }) => (
            <li key={key}>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={subscriptions.kinds[key as ContentKindKey]}
                  onChange={(e) => setKind(key as ContentKindKey, e.target.checked)}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section" aria-labelledby="topics-heading">
        <h2 id="topics-heading">Topics</h2>
        <p className="settings-lead">
          Follow a subset to narrow the feed. Leave all off to keep every topic. A{' '}
          <code>?topic=</code> URL still wins when you open a topic page.
        </p>
        <div className="settings-chips" role="group" aria-label="Follow topics">
          {topics.map((t) => {
            const on = followed.has(t.id)
            return (
              <button
                key={t.id}
                type="button"
                className={on ? 'is-on' : ''}
                aria-pressed={on}
                onClick={() => toggleTopic(t.id)}
              >
                {t.name}
              </button>
            )
          })}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="news-heading">
        <h2 id="news-heading">News sources</h2>
        <p className="settings-lead">
          Mute curated outlets without turning all news off. Needs the News content type enabled.
        </p>
        <ul className="settings-toggles settings-toggles-dense">
          {curatedNewsFeeds.map((f) => {
            const on = !muted.has(f.id)
            return (
              <li key={f.id}>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setFeedMuted(f.id, !e.target.checked)}
                  />
                  <span>
                    <strong>{f.name}</strong>
                    <small>{f.topicIds.join(' · ')}</small>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="settings-section" aria-labelledby="sites-heading">
        <h2 id="sites-heading">My sites</h2>
        <p className="settings-lead">
          Add free learning sites. They show up as Free site cards and on{' '}
          <Link to="/resources">Resources</Link>.
        </p>
        <form className="settings-form" onSubmit={onAddSite}>
          <label>
            Name
            <input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Farnam Street"
              required
            />
          </label>
          <label>
            URL
            <input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              required
            />
          </label>
          <label>
            Blurb <span className="settings-optional">(optional)</span>
            <input
              value={siteBlurb}
              onChange={(e) => setSiteBlurb(e.target.value)}
              placeholder="Why this belongs in your mix"
            />
          </label>
          <div>
            <p className="settings-field-label">Topics (optional)</p>
            <div className="settings-chips settings-chips-sm">
              {topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={siteTopics.includes(t.id) ? 'is-on' : ''}
                  aria-pressed={siteTopics.includes(t.id)}
                  onClick={() => toggleSiteTopic(t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          {siteError && <p className="settings-error">{siteError}</p>}
          <button type="submit" className="settings-primary">
            Add site
          </button>
        </form>
        {subscriptions.customSites.length > 0 && (
          <ul className="settings-list">
            {subscriptions.customSites.map((s) => (
              <li key={s.id}>
                <div>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.name}
                  </a>
                  <small>{s.url}</small>
                </div>
                <button type="button" className="settings-danger" onClick={() => removeCustomSite(s.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section" aria-labelledby="feeds-heading">
        <h2 id="feeds-heading">My RSS feeds</h2>
        <p className="settings-lead">
          Paste an RSS, Atom, or JSON Feed URL. Items become news cards in your feed (https only).
        </p>
        <form className="settings-form" onSubmit={onAddFeed}>
          <label>
            Name <span className="settings-optional">(optional)</span>
            <input
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
              placeholder="Defaults from the hostname"
            />
          </label>
          <label>
            Feed URL
            <input
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://…/rss.xml"
              inputMode="url"
              required
            />
          </label>
          <div>
            <p className="settings-field-label">Topics</p>
            <div className="settings-chips settings-chips-sm">
              {NEWS_TOPIC_OPTIONS.map((id) => {
                const t = topics.find((x) => x.id === id)
                if (!t) return null
                return (
                  <button
                    key={id}
                    type="button"
                    className={feedTopics.includes(id) ? 'is-on' : ''}
                    aria-pressed={feedTopics.includes(id)}
                    onClick={() => toggleFeedTopic(id)}
                  >
                    {t.name}
                  </button>
                )
              })}
            </div>
          </div>
          {feedError && <p className="settings-error">{feedError}</p>}
          {feedOk && <p className="settings-ok">{feedOk}</p>}
          <button type="submit" className="settings-primary" disabled={feedBusy}>
            {feedBusy ? 'Checking feed…' : 'Add feed'}
          </button>
        </form>
        {subscriptions.customFeeds.length > 0 && (
          <ul className="settings-list">
            {subscriptions.customFeeds.map((f) => (
              <li key={f.id}>
                <label className="settings-toggle settings-toggle-inline">
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={(e) => updateCustomFeed(f.id, { enabled: e.target.checked })}
                  />
                  <span>
                    <strong>{f.name}</strong>
                    <small>{f.url}</small>
                  </span>
                </label>
                <button type="button" className="settings-danger" onClick={() => onRemoveFeed(f.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section settings-danger-zone">
        <button type="button" className="settings-reset" onClick={resetSubscriptions}>
          Reset all preferences
        </button>
      </section>
    </div>
  )
}

function hostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Custom feed'
  }
}
