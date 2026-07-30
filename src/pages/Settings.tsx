import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { curatedNewsFeeds, effectiveCuratedFeedTopics } from '../data/newsFeeds'
import {
  clampFeedWeight,
  clampKindWeight,
  CUSTOM_FEED_WEIGHT_DEFAULT,
  CUSTOM_FEED_WEIGHT_MAX,
  CUSTOM_FEED_WEIGHT_MIN,
  DEFAULT_KIND_WEIGHTS,
  isHttpsUrl,
  KIND_LABELS,
  KIND_WEIGHT_LABELS,
  MAX_CUSTOM_FEEDS,
  MAX_CUSTOM_SITES,
  type ContentKindKey,
  type KindWeightKey,
} from '../data/subscriptions'
import {
  formatTopicSummary,
  TopicAssignLightbox,
} from '../components/TopicAssignLightbox'
import { MAX_CUSTOM_TOPICS } from '../data/userTopics'
import type { Topic, TopicId } from '../data/types'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { useTopics } from '../hooks/useTopics'
import { clearUserNewsForFeed, previewCustomFeed } from '../hooks/useUserNews'
import {
  fetchGithubQueueStatus,
  loadQueueSecret,
  saveQueueSecret,
} from '../lib/githubQueue'
import './Settings.css'

/** News-friendly defaults shown first when tagging an RSS feed */
const SUGGESTED_FEED_TOPIC_IDS: TopicId[] = [
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
    setKindWeight,
    resetKindWeights,
    toggleTopic,
    setThinkPrompt,
    setFeedMuted,
    setCuratedFeedTopics,
    addCustomSite,
    updateCustomSite,
    removeCustomSite,
    addCustomFeed,
    updateCustomFeed,
    removeCustomFeed,
    resetSubscriptions,
  } = useSubscriptions()

  const {
    topics,
    allTopics,
    isHidden,
    isCustom,
    updateTopic,
    setTopicHidden,
    addTopic,
    removeTopic,
    resetTopics,
  } = useTopics()

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

  const [topicName, setTopicName] = useState('')
  const [topicTagline, setTopicTagline] = useState('')
  const [topicDescription, setTopicDescription] = useState('')
  const [topicError, setTopicError] = useState<string | null>(null)
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null)

  const [queueSecret, setQueueSecret] = useState(() => loadQueueSecret())
  const [queueConfigured, setQueueConfigured] = useState(false)
  const [queueRepo, setQueueRepo] = useState<string | undefined>()

  type TopicEditTarget =
    | { kind: 'curated'; id: string; name: string }
    | { kind: 'customFeed'; id: string; name: string; url: string }
    | { kind: 'customSite'; id: string; name: string; url: string }
    | { kind: 'draftFeed' }
    | { kind: 'draftSite' }

  const [topicEdit, setTopicEdit] = useState<TopicEditTarget | null>(null)
  const [sourceQuery, setSourceQuery] = useState('')

  useEffect(() => {
    void fetchGithubQueueStatus().then((s) => {
      setQueueConfigured(s.configured)
      setQueueRepo(s.repo)
    })
  }, [])

  const muted = useMemo(
    () => new Set(subscriptions.disabledFeedIds),
    [subscriptions.disabledFeedIds],
  )
  const followed = useMemo(() => new Set(subscriptions.topics), [subscriptions.topics])

  const curatedFeedMatches = useMemo(() => {
    const q = sourceQuery.trim().toLowerCase()
    if (!q) return curatedNewsFeeds
    return curatedNewsFeeds.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        f.topicIds.some((id) => id.toLowerCase().includes(q)),
    )
  }, [sourceQuery])

  const siteTopicGroups = useMemo(() => {
    const catalog: Topic[] = []
    const yours: Topic[] = []
    for (const t of topics) {
      if (isCustom(t.id)) yours.push(t)
      else catalog.push(t)
    }
    return [
      { label: 'Catalog', topics: catalog },
      { label: 'Yours', topics: yours },
    ]
  }, [topics, isCustom])

  const feedTopicGroups = useMemo(() => {
    const yours = topics.filter((t) => isCustom(t.id))
    const suggested = SUGGESTED_FEED_TOPIC_IDS.map((id) =>
      topics.find((t) => t.id === id),
    ).filter((t): t is Topic => Boolean(t))
    const suggestedIds = new Set(suggested.map((t) => t.id))
    const more = topics.filter((t) => !isCustom(t.id) && !suggestedIds.has(t.id))
    return [
      { label: 'Suggested', topics: suggested },
      { label: 'Yours', topics: yours },
      { label: 'More', topics: more },
    ]
  }, [topics, isCustom])

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

  function toggleExistingFeedTopic(feedId: string, topicId: TopicId) {
    const feed = subscriptions.customFeeds.find((f) => f.id === feedId)
    if (!feed) return
    const has = feed.topicIds.includes(topicId)
    const next = has
      ? feed.topicIds.filter((t) => t !== topicId)
      : [...feed.topicIds, topicId]
    updateCustomFeed(feedId, {
      topicIds: next.length ? next : (['current-events'] as TopicId[]),
    })
  }

  function toggleCuratedFeedTopic(feedId: string, topicId: TopicId) {
    const current =
      effectiveCuratedFeedTopics(feedId, subscriptions.feedTopicOverrides) ??
      (['current-events'] as TopicId[])
    const has = current.includes(topicId)
    const next = has ? current.filter((t) => t !== topicId) : [...current, topicId]
    setCuratedFeedTopics(
      feedId,
      next.length ? next : (['current-events'] as TopicId[]),
    )
  }

  function toggleExistingSiteTopic(siteId: string, topicId: TopicId) {
    const site = subscriptions.customSites.find((s) => s.id === siteId)
    if (!site) return
    const current = site.topicHints ?? []
    const has = current.includes(topicId)
    const next = has ? current.filter((t) => t !== topicId) : [...current, topicId]
    updateCustomSite(siteId, { topicHints: next })
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
        weight: CUSTOM_FEED_WEIGHT_DEFAULT,
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

  const editingCustomFeed =
    topicEdit?.kind === 'customFeed'
      ? subscriptions.customFeeds.find((f) => f.id === topicEdit.id)
      : undefined
  const editingCustomSite =
    topicEdit?.kind === 'customSite'
      ? subscriptions.customSites.find((s) => s.id === topicEdit.id)
      : undefined

  function onAddTopic(e: FormEvent) {
    e.preventDefault()
    setTopicError(null)
    const customCount = allTopics.filter((t) => isCustom(t.id)).length
    if (customCount >= MAX_CUSTOM_TOPICS) {
      setTopicError(`Limit is ${MAX_CUSTOM_TOPICS} custom topics`)
      return
    }
    const created = addTopic({
      name: topicName,
      tagline: topicTagline,
      description: topicDescription,
    })
    if (!created) {
      setTopicError('Name is required')
      return
    }
    setTopicName('')
    setTopicTagline('')
    setTopicDescription('')
    setEditingTopicId(created.id)
  }

  return (
    <div className="settings-page">
      <header className="settings-head">
        <p className="settings-kicker">Your mix</p>
        <h1>What should Thinker put in your feed?</h1>
        <p>
          Turn content types on or off, dial mix weights, follow or edit topics, mute news
          sources, and add your own sites or RSS feeds. Preferences stay on this device.{' '}
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

      <section className="settings-section" aria-labelledby="weights-heading">
        <h2 id="weights-heading">Feed mix weights</h2>
        <p className="settings-lead">
          Higher weight = denser early in the feed. Turn a type off above to hide it entirely.
          Per-RSS weights still live under My RSS feeds.
        </p>
        <ul className="settings-kind-weights">
          {KIND_WEIGHT_LABELS.map(({ key, label, hint }) => {
            const enabled = subscriptions.kinds[key]
            const w = clampKindWeight(
              subscriptions.kindWeights?.[key],
              DEFAULT_KIND_WEIGHTS[key],
            )
            return (
              <li key={key} className={!enabled ? 'is-off' : undefined}>
                <label className="settings-weight">
                  <span className="settings-weight-label">
                    <strong>{label}</strong> <em>{w}</em>
                    <small>
                      {kindWeightHint(w)}
                      {!enabled ? ' · off' : ''}
                    </small>
                    <span className="settings-weight-hint">{hint}</span>
                  </span>
                  <input
                    type="range"
                    min={CUSTOM_FEED_WEIGHT_MIN}
                    max={CUSTOM_FEED_WEIGHT_MAX}
                    step={1}
                    value={w}
                    disabled={!enabled}
                    aria-label={`${label} weight`}
                    onChange={(e) =>
                      setKindWeight(key as KindWeightKey, Number(e.target.value))
                    }
                  />
                </label>
              </li>
            )
          })}
        </ul>
        <button type="button" className="settings-ghost" onClick={resetKindWeights}>
          Reset mix weights
        </button>
      </section>

      <section className="settings-section" aria-labelledby="topics-heading">
        <h2 id="topics-heading">Topics</h2>
        <p className="settings-lead">
          Follow a subset to narrow the feed. Leave all off to keep every visible topic. Edit names
          and copy below, hide catalog topics, or add your own.
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

        <h3 className="settings-subhead">Think prompts on news</h3>
        <p className="settings-lead">
          For topics that get a Think question on news cards, turn prompts on or off. Sports topics
          start off; everything else starts on.
        </p>
        <ul className="settings-toggles">
          {topics.map((t) => {
            const on = !subscriptions.thinkPromptOff.includes(t.id)
            return (
              <li key={`think-${t.id}`}>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setThinkPrompt(t.id, e.target.checked)}
                  />
                  <span>
                    <strong>{t.name}</strong>
                    <small>{on ? 'Think question on news' : 'No Think question'}</small>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        <h3 className="settings-subhead">Edit topics</h3>
        <ul className="settings-topic-editor">
          {allTopics.map((t) => {
            const open = editingTopicId === t.id
            const hidden = isHidden(t.id)
            const custom = isCustom(t.id)
            return (
              <li key={t.id} className={hidden ? 'is-hidden' : undefined}>
                <div className="settings-topic-row">
                  <button
                    type="button"
                    className="settings-topic-swatch"
                    style={{ background: t.color, borderColor: t.accent }}
                    aria-hidden
                    tabIndex={-1}
                  />
                  <div className="settings-topic-meta">
                    <strong>{t.name}</strong>
                    <small>
                      {t.tagline}
                      {custom ? ' · custom' : ''}
                      {hidden ? ' · hidden' : ''}
                    </small>
                  </div>
                  <div className="settings-topic-actions">
                    <button
                      type="button"
                      className="settings-ghost"
                      onClick={() => setEditingTopicId(open ? null : t.id)}
                      aria-expanded={open}
                    >
                      {open ? 'Close' : 'Edit'}
                    </button>
                    {custom ? (
                      <button
                        type="button"
                        className="settings-danger"
                        onClick={() => removeTopic(t.id)}
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="settings-ghost"
                        onClick={() => setTopicHidden(t.id, !hidden)}
                      >
                        {hidden ? 'Show' : 'Hide'}
                      </button>
                    )}
                  </div>
                </div>
                {open && (
                  <div className="settings-topic-fields">
                    <label>
                      Name
                      <input
                        value={t.name}
                        onChange={(e) => updateTopic(t.id, { name: e.target.value })}
                      />
                    </label>
                    <label>
                      Tagline
                      <input
                        value={t.tagline}
                        onChange={(e) => updateTopic(t.id, { tagline: e.target.value })}
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        rows={3}
                        value={t.description}
                        onChange={(e) => updateTopic(t.id, { description: e.target.value })}
                      />
                    </label>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <h3 className="settings-subhead">Add a topic</h3>
        <form className="settings-form" onSubmit={onAddTopic}>
          <label>
            Name
            <input
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              placeholder="Decision-making"
              required
            />
          </label>
          <label>
            Tagline
            <input
              value={topicTagline}
              onChange={(e) => setTopicTagline(e.target.value)}
              placeholder="Optional short line"
            />
          </label>
          <label>
            Description
            <textarea
              rows={2}
              value={topicDescription}
              onChange={(e) => setTopicDescription(e.target.value)}
              placeholder="Optional — what belongs in this topic"
            />
          </label>
          {topicError && <p className="settings-error">{topicError}</p>}
          <button type="submit" className="settings-primary">
            Add topic
          </button>
        </form>
        <button type="button" className="settings-ghost" onClick={resetTopics}>
          Reset topic edits
        </button>
      </section>

      <section className="settings-section" aria-labelledby="news-heading">
        <h2 id="news-heading">News sources</h2>
        <p className="settings-lead">
          Find a source, then open it to set topics. Mute without turning all news off. Needs the
          News content type enabled.
        </p>
        <label className="settings-source-search">
          <span className="settings-field-label">Find a source</span>
          <input
            type="search"
            value={sourceQuery}
            onChange={(e) => setSourceQuery(e.target.value)}
            placeholder="Name or topic…"
            autoComplete="off"
          />
        </label>
        {!sourceQuery.trim() ? (
          <p className="settings-pending">
            {curatedNewsFeeds.length} outlets — type to find one, then tap it to change topics.
          </p>
        ) : curatedFeedMatches.length === 0 ? (
          <p className="settings-pending">No sources match “{sourceQuery.trim()}”.</p>
        ) : (
          <ul className="settings-list settings-list-feeds settings-list-compact">
            {curatedFeedMatches.map((f) => {
              const on = !muted.has(f.id)
              const selected =
                effectiveCuratedFeedTopics(f.id, subscriptions.feedTopicOverrides) ??
                f.topicIds
              return (
                <li key={f.id}>
                  <div className="settings-source-row">
                    <label
                      className="settings-toggle settings-toggle-inline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => setFeedMuted(f.id, !e.target.checked)}
                      />
                      <span className="settings-sr-only">Enabled</span>
                    </label>
                    <button
                      type="button"
                      className="settings-source-open"
                      onClick={() =>
                        setTopicEdit({ kind: 'curated', id: f.id, name: f.name })
                      }
                    >
                      <span className="settings-source-name">{f.name}</span>
                      <span className="settings-source-topics">
                        {formatTopicSummary(selected, topics)}
                      </span>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="settings-section" aria-labelledby="sites-heading">
        <h2 id="sites-heading">My sites</h2>
        <p className="settings-lead">
          Add free learning sites. They show up as Free site cards and on{' '}
          <Link to="/resources">Sites</Link>.
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
          <button
            type="button"
            className="settings-source-topics-btn"
            onClick={() => setTopicEdit({ kind: 'draftSite' })}
          >
            <span className="settings-field-label">
              Topics <span className="settings-optional">(optional)</span>
            </span>
            <span className="settings-source-topics">
              {formatTopicSummary(siteTopics, topics)}
            </span>
          </button>
          {siteError && <p className="settings-error">{siteError}</p>}
          <button type="submit" className="settings-primary">
            Add site
          </button>
        </form>
        {subscriptions.customSites.length > 0 && (
          <ul className="settings-list settings-list-compact">
            {subscriptions.customSites.map((s) => (
              <li key={s.id}>
                <div className="settings-source-row">
                  <button
                    type="button"
                    className="settings-source-open"
                    onClick={() =>
                      setTopicEdit({
                        kind: 'customSite',
                        id: s.id,
                        name: s.name,
                        url: s.url,
                      })
                    }
                  >
                    <span className="settings-source-name">{s.name}</span>
                    <span className="settings-source-topics">
                      {formatTopicSummary(s.topicHints ?? [], topics)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="settings-danger"
                    onClick={() => removeCustomSite(s.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section" aria-labelledby="feeds-heading">
        <h2 id="feeds-heading">My RSS feeds</h2>
        <p className="settings-lead">
          Paste an RSS, Atom, or JSON Feed URL. Items become news cards in your feed (https only).
          Use weight to control how often each feed shows up in My feed.
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
          <button
            type="button"
            className="settings-source-topics-btn"
            onClick={() => setTopicEdit({ kind: 'draftFeed' })}
          >
            <span className="settings-field-label">Topics</span>
            <span className="settings-source-topics">
              {formatTopicSummary(feedTopics, topics)}
            </span>
          </button>
          {feedError && <p className="settings-error">{feedError}</p>}
          {feedOk && <p className="settings-ok">{feedOk}</p>}
          <button type="submit" className="settings-primary" disabled={feedBusy}>
            {feedBusy ? 'Checking feed…' : 'Add feed'}
          </button>
        </form>
        {subscriptions.customFeeds.length > 0 && (
          <ul className="settings-list settings-list-feeds settings-list-compact">
            {subscriptions.customFeeds.map((f) => (
              <li key={f.id}>
                <div className="settings-source-row">
                  <label
                    className="settings-toggle settings-toggle-inline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={(e) => updateCustomFeed(f.id, { enabled: e.target.checked })}
                    />
                    <span className="settings-sr-only">Enabled</span>
                  </label>
                  <button
                    type="button"
                    className="settings-source-open"
                    onClick={() =>
                      setTopicEdit({
                        kind: 'customFeed',
                        id: f.id,
                        name: f.name,
                        url: f.url,
                      })
                    }
                  >
                    <span className="settings-source-name">{f.name}</span>
                    <span className="settings-source-topics">
                      {formatTopicSummary(f.topicIds, topics)}
                      {' · '}
                      w{clampFeedWeight(f.weight)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="settings-danger"
                    onClick={() => onRemoveFeed(f.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section" aria-labelledby="idea-loop-heading">
        <h2 id="idea-loop-heading">Idea loop</h2>
        <p className="settings-lead">
          Kept can open a GitHub PR that queues seeds or approved drafts. The server holds the
          GitHub token; this device only stores the matching gate secret (same value as{' '}
          <code>QUEUE_SECRET</code> on the VPS).
          {queueConfigured
            ? ` Server ready${queueRepo ? ` for ${queueRepo}` : ''}.`
            : ' Server not configured yet — set GITHUB_TOKEN + QUEUE_SECRET on the VPS.'}
        </p>
        <div className="settings-form">
          <label>
            Gate secret
            <input
              type="password"
              autoComplete="off"
              value={queueSecret}
              placeholder="Matches QUEUE_SECRET on the server"
              onChange={(e) => {
                const v = e.target.value
                setQueueSecret(v)
                saveQueueSecret(v)
              }}
            />
          </label>
        </div>
        <p className="settings-lead">
          Then use <strong>Send to idea loop</strong> on Kept. Merge the PR to advance drafting /
          promote.
        </p>
      </section>

      <section className="settings-section settings-danger-zone">
        <button type="button" className="settings-reset" onClick={resetSubscriptions}>
          Reset all preferences
        </button>
      </section>

      {topicEdit?.kind === 'curated' && (
        <TopicAssignLightbox
          title={topicEdit.name}
          detail="Choose which topic filters this outlet appears under."
          topics={topics}
          groups={feedTopicGroups}
          selected={
            effectiveCuratedFeedTopics(topicEdit.id, subscriptions.feedTopicOverrides) ??
            curatedNewsFeeds.find((f) => f.id === topicEdit.id)?.topicIds ??
            []
          }
          onToggle={(id) => toggleCuratedFeedTopic(topicEdit.id, id)}
          hint="Overrides the catalog default for this outlet on this device."
          onClose={() => setTopicEdit(null)}
        />
      )}

      {topicEdit?.kind === 'customFeed' && editingCustomFeed && (
        <TopicAssignLightbox
          title={editingCustomFeed.name}
          detail={editingCustomFeed.url}
          topics={topics}
          groups={feedTopicGroups}
          selected={editingCustomFeed.topicIds}
          onToggle={(id) => toggleExistingFeedTopic(editingCustomFeed.id, id)}
          onClose={() => setTopicEdit(null)}
          footer={
            <label className="settings-weight settings-weight--lightbox">
              <span className="settings-weight-label">
                Weight <em>{clampFeedWeight(editingCustomFeed.weight)}</em>
                <span className="settings-optional">
                  {weightHint(clampFeedWeight(editingCustomFeed.weight))}
                </span>
              </span>
              <input
                type="range"
                min={CUSTOM_FEED_WEIGHT_MIN}
                max={CUSTOM_FEED_WEIGHT_MAX}
                step={1}
                value={clampFeedWeight(editingCustomFeed.weight)}
                disabled={!editingCustomFeed.enabled}
                aria-label={`Weight for ${editingCustomFeed.name}`}
                onChange={(e) =>
                  updateCustomFeed(editingCustomFeed.id, { weight: Number(e.target.value) })
                }
              />
            </label>
          }
        />
      )}

      {topicEdit?.kind === 'customSite' && editingCustomSite && (
        <TopicAssignLightbox
          title={editingCustomSite.name}
          detail={editingCustomSite.url}
          topics={topics}
          groups={siteTopicGroups}
          selected={editingCustomSite.topicHints ?? []}
          onToggle={(id) => toggleExistingSiteTopic(editingCustomSite.id, id)}
          optional
          onClose={() => setTopicEdit(null)}
        />
      )}

      {topicEdit?.kind === 'draftFeed' && (
        <TopicAssignLightbox
          title="Feed topics"
          detail="Suggested news topics first — your custom topics appear under Yours."
          topics={topics}
          groups={feedTopicGroups}
          selected={feedTopics}
          onToggle={toggleFeedTopic}
          onClose={() => setTopicEdit(null)}
        />
      )}

      {topicEdit?.kind === 'draftSite' && (
        <TopicAssignLightbox
          title="Site topics"
          detail="Tag so the site shows in the right mix."
          topics={topics}
          groups={siteTopicGroups}
          selected={siteTopics}
          onToggle={toggleSiteTopic}
          optional
          onClose={() => setTopicEdit(null)}
        />
      )}
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

function weightHint(w: number): string {
  if (w <= 1) return 'rare'
  if (w === 2) return 'light'
  if (w === 3) return 'balanced'
  if (w === 4) return 'often'
  return 'frequent'
}

function kindWeightHint(w: number): string {
  return weightHint(w)
}
