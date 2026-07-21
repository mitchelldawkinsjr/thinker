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
            ·{' '}
            {result.latencyMs < 50
              ? `${result.latencyMs}ms`
              : `${(result.latencyMs / 1000).toFixed(1)}s`}
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
  const abortRef = useRef<AbortController | null>(null)

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

    // 2) LLM answer appends below — never replaces instant
    if (available && available.length === 0) return

    setRefining(true)
    try {
      const out = await exploreQuestion(ctx, buildSlimCatalog(topicId), {
        model,
        signal: ac.signal,
      })
      if (!ac.signal.aborted) setAi(out)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(
        err instanceof Error
          ? `Instant answer kept. LLM failed: ${err.message}`
          : 'Instant answer kept. LLM unavailable.',
      )
    } finally {
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
        <button type="submit" className="btn btn-primary" disabled={loading || !question.trim()}>
          {loading ? 'Thinking…' : 'Explore'}
        </button>
      </form>

      {error && <p className="ask-error">{error}</p>}

      {instant && (
        <ResultBlock result={instant} heading="Instant path" onFollowUp={askFollowUp} />
      )}

      {refining && (
        <p className="ask-refining">AI thinking with {model}… will append below.</p>
      )}

      {ai && <ResultBlock result={ai} heading="AI answer" onFollowUp={askFollowUp} />}
    </section>
  )
}
