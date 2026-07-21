import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  exploreQuestion,
  getConfiguredModel,
  listOllamaModels,
  pickFastModel,
  type ExploreResult,
} from '../lib/ollama'
import { buildSlimCatalog, exploreInstant } from '../lib/exploreFast'
import {
  averageAskLatency,
  formatWait,
  loadAskLatencies,
  recordAskLatency,
} from '../lib/askLatency'
import './AskPanel.css'

type Props = {
  ideaTitle?: string
  ideaBody?: string
  topicName?: string
  topicId?: string
  compact?: boolean
  initialQuestion?: string
}

function ResultBlock({
  result,
  heading,
  onFollowUp,
}: {
  result: ExploreResult
  heading: string
  onFollowUp: (q: string) => void
}) {
  return (
    <div className="ask-result">
      <p className="ask-result-label">{heading}</p>
      <p className="ask-answer">{result.answer}</p>
      <p className="ask-meta">
        via {result.model}
        {typeof result.latencyMs === 'number' && (
          <>
            {' '}
            · {formatWait(result.latencyMs)}
          </>
        )}
      </p>

      {result.links.length > 0 && (
        <div className="ask-block">
          <h3>Go here next</h3>
          <ul className="ask-links">
            {result.links.map((l) => (
              <li key={`${result.model}-${l.url}`}>
                <a href={l.url} target="_blank" rel="noreferrer">
                  {l.title}
                </a>
                <span>{l.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.topics.length > 0 && (
        <div className="ask-block">
          <h3>Thinker topics</h3>
          <div className="ask-topics">
            {result.topics.map((id) => (
              <Link key={`${result.model}-${id}`} to={`/topics/${id}`}>
                #{id}
              </Link>
            ))}
          </div>
        </div>
      )}

      {result.digDeeper.length > 0 && (
        <div className="ask-block">
          <h3>Ask next</h3>
          <div className="ask-followups">
            {result.digDeeper.map((q) => (
              <button key={`${result.model}-${q}`} type="button" onClick={() => onFollowUp(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function AskPanel({
  ideaTitle,
  ideaBody,
  topicName,
  topicId,
  compact,
  initialQuestion = '',
}: Props) {
  const [question, setQuestion] = useState(initialQuestion)
  const [instant, setInstant] = useState<ExploreResult | null>(null)
  const [ai, setAi] = useState<ExploreResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refining, setRefining] = useState(false)
  const [model, setModel] = useState(getConfiguredModel())
  const [available, setAvailable] = useState<string[] | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [avgWaitMs, setAvgWaitMs] = useState<number | null>(() =>
    averageAskLatency(loadAskLatencies()),
  )
  const [sampleCount, setSampleCount] = useState(() => loadAskLatencies().length)
  const abortRef = useRef<AbortController | null>(null)
  const llmStartedAt = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    listOllamaModels()
      .then((names) => {
        if (cancelled) return
        setAvailable(names)
        setModel(pickFastModel(names))
      })
      .catch(() => {
        if (!cancelled) setAvailable([])
      })
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [])

  // Live elapsed timer while the LLM is thinking
  useEffect(() => {
    if (!refining || llmStartedAt.current == null) return
    const tick = () => setElapsedMs(Math.round(performance.now() - (llmStartedAt.current ?? 0)))
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [refining])

  async function runExplore(qRaw: string) {
    const q = qRaw.trim()
    if (!q || loading) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    const ctx = {
      question: q,
      ideaTitle,
      ideaBody,
      topicName,
      topicId,
    }

    // 1) Instant path — always first
    const t0 = performance.now()
    const quick = exploreInstant(ctx)
    quick.latencyMs = Math.round(performance.now() - t0)
    setInstant(quick)
    setAi(null)
    setError(null)
    setLoading(false)
    setElapsedMs(0)

    // 2) LLM answer appends below — never replaces instant
    if (available && available.length === 0) return

    llmStartedAt.current = performance.now()
    setRefining(true)
    try {
      const out = await exploreQuestion(ctx, buildSlimCatalog(topicId), {
        model,
        signal: ac.signal,
      })
      if (ac.signal.aborted) return

      const waitMs = out.latencyMs ?? Math.round(performance.now() - (llmStartedAt.current ?? 0))
      out.latencyMs = waitMs
      const samples = recordAskLatency(waitMs)
      setAvgWaitMs(averageAskLatency(samples))
      setSampleCount(samples.length)
      setElapsedMs(waitMs)
      setAi(out)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(
        err instanceof Error
          ? `Instant answer kept. LLM failed: ${err.message}`
          : 'Instant answer kept. LLM unavailable.',
      )
    } finally {
      llmStartedAt.current = null
      if (!ac.signal.aborted) setRefining(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    await runExplore(question)
  }

  function askFollowUp(q: string) {
    setQuestion(q)
    void runExplore(q)
  }

  useEffect(() => {
    if (initialQuestion) setQuestion(initialQuestion)
  }, [initialQuestion])

  const showTimer = refining || (ai != null && elapsedMs > 0)

  return (
    <section className={`ask-panel ${compact ? 'ask-panel--compact' : ''}`}>
      <header className="ask-head">
        <div>
          <p className="ask-kicker">Go deeper</p>
          <h2>{compact ? 'Ask about this idea' : 'Ask Thinker'}</h2>
          <p className="ask-sub">
            Instant catalog paths first — AI answer appends below when ready.
          </p>
        </div>
        <label className="ask-model">
          <span>Model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {(available?.length ? available : [model]).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {available && available.length === 0 && (
        <p className="ask-warn">
          Ollama proxy offline — instant catalog answers still work. For LLM refine, confirm
          Tailscale → VPS <code>llm-runtime</code> and restart <code>npm run dev</code>.
        </p>
      )}

      <form id="ask-form" className="ask-form" onSubmit={onSubmit}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={compact ? 3 : 4}
          placeholder={
            ideaTitle
              ? `What should I read next about “${ideaTitle}”?`
              : 'e.g. Where do I go deeper on veto points in US politics?'
          }
        />
        <div className="ask-form-row">
          <button type="submit" className="btn btn-primary" disabled={loading || !question.trim()}>
            {loading ? 'Thinking…' : 'Explore'}
          </button>
          {(showTimer || avgWaitMs != null) && (
            <p className="ask-wait" aria-live="polite">
              {refining && (
                <span className="ask-wait-live">
                  {formatWait(elapsedMs)}
                  <span className="ask-wait-dot" aria-hidden />
                </span>
              )}
              {!refining && ai && elapsedMs > 0 && (
                <span className="ask-wait-done">last {formatWait(elapsedMs)}</span>
              )}
              {avgWaitMs != null && (
                <span className="ask-wait-avg">
                  avg {formatWait(avgWaitMs)}
                  {sampleCount > 0 && (
                    <span className="ask-wait-n">
                      {' '}
                      · {sampleCount} ask{sampleCount === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
              )}
            </p>
          )}
        </div>
      </form>

      {error && <p className="ask-error">{error}</p>}

      {instant && (
        <ResultBlock result={instant} heading="Instant path" onFollowUp={askFollowUp} />
      )}

      {refining && (
        <p className="ask-refining">
          AI thinking with {model}…
          <span className="ask-refining-time"> {formatWait(elapsedMs)}</span>
        </p>
      )}

      {ai && <ResultBlock result={ai} heading="AI answer" onFollowUp={askFollowUp} />}
    </section>
  )
}
