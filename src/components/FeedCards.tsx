import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LearningResource } from '../data/resources'
import type { NewsItem } from '../data/newsTypes'
import type { ScriptureItem } from '../data/scriptureTypes'
import { newsCardCopy } from '../lib/newsChallenge'
import {
  getGameHighScore,
  recordGameScore,
} from '../lib/gameScores'
import {
  preferredPassageUrl,
  probeScriptura,
  warmScripturaProbe,
} from '../lib/scriptureLinks'
import './IdeaCard.css'
import './FeedCards.css'

type NavProps = {
  onNext?: () => void
  onPrev?: () => void
  onHide?: () => void
  index?: number
  total?: number
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3h6m-8 4h10m-9 0v11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7M10 11v5m4-5v5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
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
  onHide,
  index,
  total,
}: {
  accent: string
  surface: string
  kind: string
  title: string
  children: ReactNode
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
          {onPrev && (
            <button type="button" className="idea-btn ghost" onClick={onPrev} aria-label="Previous">
              ←
            </button>
          )}
          {cta}
          {onNext && (
            <button type="button" className="idea-btn ghost" onClick={onNext} aria-label="Next">
              →
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
      onHide={onHide}
      cta={
        <a className="idea-btn next" href={resource.url} target="_blank" rel="noreferrer">
          Open site →
        </a>
      }
    >
      <p className="feed-card-body">{resource.blurb}</p>
      <p className="feed-card-hint">Open the real site — leave the infinite scroll behind.</p>
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
  onHide,
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
      onHide={onHide}
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
  const topics = news.topicIds.map((t) => `#${t}`).join(' · ')
  const primary = news.angles?.[0]?.url ?? news.sourceUrl
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
  const { body, challenge } = newsCardCopy(news)

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
      onHide={onHide}
      cta={
        <a className="idea-btn next" href={primary} target="_blank" rel="noreferrer">
          Read source →
        </a>
      }
    >
      <p className="feed-card-author">{news.title}</p>
      <p className="feed-card-body">{body}</p>
      <aside className="feed-card-challenge" aria-label="Challenge the headline">
        <span className="feed-card-challenge-kicker">Think</span>
        <p className="feed-card-challenge-q">{challenge}</p>
      </aside>
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
  const [open, setOpen] = useState(() => preferredPassageUrl(scripture))

  useEffect(() => {
    warmScripturaProbe()
    void probeScriptura().then(() => setOpen(preferredPassageUrl(scripture)))
  }, [scripture])

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
      onHide={onHide}
      cta={
        <a className="idea-btn next" href={open.href} target="_blank" rel="noreferrer">
          {open.via === 'scriptura' ? 'Open in Scriptura →' : 'Open passage →'}
        </a>
      }
    >
      <p className="feed-card-author">{scripture.reference}</p>
      <blockquote className="feed-card-verse">“{scripture.text}”</blockquote>
      <p className="feed-card-body">{scripture.lesson}</p>
      <p className="feed-card-hint">
        {scripture.translation}
        {scripture.sourceUrl?.includes('blueletterbible.org') && (
          <>
            {' '}
            ·{' '}
            <a href={scripture.sourceUrl} target="_blank" rel="noreferrer">
              BLB Daily Promise
            </a>
          </>
        )}
        {open.via === 'scriptura' ? (
          <>
            {' '}
            · via{' '}
            <a href={open.href} target="_blank" rel="noreferrer">
              Scriptura
            </a>
            {' · '}
            <a href={open.fallbackHref} target="_blank" rel="noreferrer">
              bolls.life fallback
            </a>
          </>
        ) : (
          <>
            {' '}
            · Scriptura offline · via{' '}
            <a href={open.href} target="_blank" rel="noreferrer">
              bolls.life
            </a>
          </>
        )}
      </p>
    </FeedCardShell>
  )
}

const ROUND_MS = 10_000
const TARGET_SIZE = 56

type Phase = 'ready' | 'playing' | 'done'

function randomTargetPos(arena: HTMLElement) {
  const maxX = Math.max(0, arena.clientWidth - TARGET_SIZE)
  const maxY = Math.max(0, arena.clientHeight - TARGET_SIZE)
  return {
    x: Math.floor(Math.random() * (maxX + 1)),
    y: Math.floor(Math.random() * (maxY + 1)),
  }
}

export function ReactionGameFeedCard({
  title,
  blurb,
  onNext,
  onPrev,
  onHide,
  index,
  total,
}: {
  title: string
  blurb: string
} & NavProps) {
  const arenaRef = useRef<HTMLDivElement>(null)
  const endAtRef = useRef(0)
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => getGameHighScore('reaction'))
  const [secsLeft, setSecsLeft] = useState(10)
  const [pos, setPos] = useState({ x: 24, y: 24 })
  const [isNewBest, setIsNewBest] = useState(false)

  const placeTarget = useCallback(() => {
    const arena = arenaRef.current
    if (!arena) return
    setPos(randomTargetPos(arena))
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return
    let finished = false
    const tick = () => {
      const left = Math.max(0, endAtRef.current - Date.now())
      setSecsLeft(Math.ceil(left / 1000))
      if (left > 0 || finished) return
      finished = true

      const finalScore = scoreRef.current
      const prevBest = getGameHighScore('reaction')
      const nextBest = recordGameScore('reaction', finalScore)
      setBest(nextBest)
      setIsNewBest(finalScore > prevBest)
      setPhase('done')
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [phase])

  const start = () => {
    scoreRef.current = 0
    setScore(0)
    setIsNewBest(false)
    setSecsLeft(10)
    endAtRef.current = Date.now() + ROUND_MS
    setPhase('playing')
    requestAnimationFrame(() => placeTarget())
  }

  const onHit = (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (phase !== 'playing') return
    scoreRef.current += 1
    setScore(scoreRef.current)
    placeTarget()
  }

  const challenge =
    best > 0
      ? `Beat your high score of ${best}.`
      : 'Set a high score — it sticks on this device.'

  return (
    <FeedCardShell
      accent="#34d399"
      surface="#14241c"
      kind="Brain game · speed"
      title={title}
      index={index}
      total={total}
      onPrev={onPrev}
      onNext={onNext}
      onHide={onHide}
      cta={
        phase === 'playing' ? undefined : (
          <button type="button" className="idea-btn next" onClick={start}>
            {phase === 'done' ? 'Play again' : 'Start · 10s'}
          </button>
        )
      }
    >
      <p className="feed-card-body feed-card-body-tight">{blurb}</p>
      <aside className="feed-card-challenge" aria-label="High score challenge">
        <span className="feed-card-challenge-kicker">Challenge</span>
        <p className="feed-card-challenge-q">{challenge}</p>
      </aside>

      <div className="reaction-hud" aria-live="polite">
        <span>
          Score <strong>{score}</strong>
        </span>
        <span>
          Best <strong>{best}</strong>
        </span>
        <span>
          Time{' '}
          <strong>
            {phase === 'playing' ? secsLeft : phase === 'ready' ? 10 : 0}s
          </strong>
        </span>
      </div>

      <div
        ref={arenaRef}
        className={`reaction-arena ${phase === 'playing' ? 'is-live' : ''}`}
        aria-label="Reaction game arena"
      >
        {phase === 'ready' && (
          <p className="reaction-arena-msg">Hit Start, then tap the box each time it moves.</p>
        )}
        {phase === 'done' && (
          <p className="reaction-arena-msg">
            {isNewBest
              ? `New high score — ${score}!`
              : `Round over — ${score} click${score === 1 ? '' : 's'}.`}
          </p>
        )}
        {phase === 'playing' && (
          <button
            type="button"
            className="reaction-target"
            style={{ left: pos.x, top: pos.y, width: TARGET_SIZE, height: TARGET_SIZE }}
            onPointerDown={onHit}
            aria-label="Tap target"
          />
        )}
      </div>
    </FeedCardShell>
  )
}

const SPOT_COLS = 4
const SPOT_ROWS = 4
const SPOT_CELLS = SPOT_COLS * SPOT_ROWS

type SpotRound = {
  base: string
  odd: string
  oddIndex: number
}

function makeSpotRound(score: number): SpotRound {
  const hue = Math.floor(Math.random() * 360)
  // Gets harder as you score — smaller lightness gap
  const delta = Math.max(5, 16 - Math.floor(score / 2))
  const sat = 48 + (score % 5) * 2
  const baseL = 42
  const base = `hsl(${hue} ${sat}% ${baseL}%)`
  const odd = `hsl(${hue} ${sat}% ${baseL + delta}%)`
  return {
    base,
    odd,
    oddIndex: Math.floor(Math.random() * SPOT_CELLS),
  }
}

export function SpotGameFeedCard({
  title,
  blurb,
  onNext,
  onPrev,
  onHide,
  index,
  total,
}: {
  title: string
  blurb: string
} & NavProps) {
  const endAtRef = useRef(0)
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => getGameHighScore('spot'))
  const [secsLeft, setSecsLeft] = useState(10)
  const [round, setRound] = useState<SpotRound>(() => makeSpotRound(0))
  const [missFlash, setMissFlash] = useState(false)
  const [isNewBest, setIsNewBest] = useState(false)

  useEffect(() => {
    if (phase !== 'playing') return
    let finished = false
    const tick = () => {
      const left = Math.max(0, endAtRef.current - Date.now())
      setSecsLeft(Math.ceil(left / 1000))
      if (left > 0 || finished) return
      finished = true

      const finalScore = scoreRef.current
      const prevBest = getGameHighScore('spot')
      const nextBest = recordGameScore('spot', finalScore)
      setBest(nextBest)
      setIsNewBest(finalScore > prevBest)
      setPhase('done')
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [phase])

  const start = () => {
    scoreRef.current = 0
    setScore(0)
    setIsNewBest(false)
    setMissFlash(false)
    setSecsLeft(10)
    setRound(makeSpotRound(0))
    endAtRef.current = Date.now() + ROUND_MS
    setPhase('playing')
  }

  const onTile = (i: number) => {
    if (phase !== 'playing') return
    if (i === round.oddIndex) {
      scoreRef.current += 1
      setScore(scoreRef.current)
      setMissFlash(false)
      setRound(makeSpotRound(scoreRef.current))
      return
    }
    setMissFlash(true)
    window.setTimeout(() => setMissFlash(false), 180)
  }

  const challenge =
    best > 0
      ? `Beat your high score of ${best}.`
      : 'Set a high score — it sticks on this device.'

  return (
    <FeedCardShell
      accent="#60a5fa"
      surface="#152033"
      kind="Brain game · perception"
      title={title}
      index={index}
      total={total}
      onPrev={onPrev}
      onNext={onNext}
      onHide={onHide}
      cta={
        phase === 'playing' ? undefined : (
          <button type="button" className="idea-btn next" onClick={start}>
            {phase === 'done' ? 'Play again' : 'Start · 10s'}
          </button>
        )
      }
    >
      <p className="feed-card-body feed-card-body-tight">{blurb}</p>
      <aside className="feed-card-challenge" aria-label="High score challenge">
        <span className="feed-card-challenge-kicker">Challenge</span>
        <p className="feed-card-challenge-q">{challenge}</p>
      </aside>

      <div className="reaction-hud" aria-live="polite">
        <span>
          Score <strong>{score}</strong>
        </span>
        <span>
          Best <strong>{best}</strong>
        </span>
        <span>
          Time{' '}
          <strong>
            {phase === 'playing' ? secsLeft : phase === 'ready' ? 10 : 0}s
          </strong>
        </span>
      </div>

      <div
        className={`spot-arena ${phase === 'playing' ? 'is-live' : ''} ${missFlash ? 'is-miss' : ''}`}
        aria-label="Spot the odd tile"
      >
        {phase === 'ready' && (
          <p className="reaction-arena-msg">Hit Start, then tap the tile that doesn’t match.</p>
        )}
        {phase === 'done' && (
          <p className="reaction-arena-msg">
            {isNewBest
              ? `New high score — ${score}!`
              : `Round over — ${score} find${score === 1 ? '' : 's'}.`}
          </p>
        )}
        {phase === 'playing' && (
          <div className="spot-grid" style={{ gridTemplateColumns: `repeat(${SPOT_COLS}, 1fr)` }}>
            {Array.from({ length: SPOT_CELLS }, (_, i) => (
              <button
                key={`${score}-${i}-${round.oddIndex}`}
                type="button"
                className="spot-tile"
                style={{ background: i === round.oddIndex ? round.odd : round.base }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  onTile(i)
                }}
                aria-label={`Tile ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </FeedCardShell>
  )
}

const MEMORY_PADS = [
  { id: 0, base: '#db2777', lit: '#f9a8d4' },
  { id: 1, base: '#0284c7', lit: '#7dd3fc' },
  { id: 2, base: '#65a30d', lit: '#bef264' },
  { id: 3, base: '#d97706', lit: '#fcd34d' },
] as const

type MemoryPhase = 'ready' | 'watch' | 'input' | 'done'

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function randomPad() {
  return Math.floor(Math.random() * MEMORY_PADS.length)
}

export function MemoryGameFeedCard({
  title,
  blurb,
  onNext,
  onPrev,
  onHide,
  index,
  total,
}: {
  title: string
  blurb: string
} & NavProps) {
  const runIdRef = useRef(0)
  const seqRef = useRef<number[]>([])
  const inputIdxRef = useRef(0)
  const scoreRef = useRef(0)
  const phaseRef = useRef<MemoryPhase>('ready')
  const [phase, setPhase] = useState<MemoryPhase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => getGameHighScore('memory'))
  const [lit, setLit] = useState(-1)
  const [steps, setSteps] = useState(0)
  const [matched, setMatched] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)

  const go = useCallback((next: MemoryPhase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  useEffect(() => {
    return () => {
      runIdRef.current += 1
    }
  }, [])

  const finish = useCallback(
    (finalScore: number) => {
      const prevBest = getGameHighScore('memory')
      const nextBest = recordGameScore('memory', finalScore)
      setBest(nextBest)
      setIsNewBest(finalScore > prevBest)
      setLit(-1)
      go('done')
    },
    [go],
  )

  const playSequence = useCallback(
    async (seq: number[], runId: number) => {
      go('watch')
      setSteps(seq.length)
      setMatched(0)
      setLit(-1)
      await sleep(400)
      for (let i = 0; i < seq.length; i++) {
        if (runIdRef.current !== runId) return
        setLit(seq[i]!)
        await sleep(480)
        if (runIdRef.current !== runId) return
        setLit(-1)
        // Gap between flashes; slightly longer after the last so it registers
        await sleep(i === seq.length - 1 ? 280 : 180)
      }
      if (runIdRef.current !== runId) return
      inputIdxRef.current = 0
      go('input')
    },
    [go],
  )

  const start = () => {
    const runId = ++runIdRef.current
    scoreRef.current = 0
    setScore(0)
    setIsNewBest(false)
    setLit(-1)
    setMatched(0)
    const seq = [randomPad()]
    seqRef.current = seq
    inputIdxRef.current = 0
    setSteps(seq.length)
    void playSequence(seq, runId)
  }

  const onPad = (pad: number) => {
    // Ref check — avoids stale React state rejecting the last matching tap
    if (phaseRef.current !== 'input') return

    const expected = seqRef.current[inputIdxRef.current]
    if (expected === undefined) return

    setLit(pad)
    window.setTimeout(() => {
      if (phaseRef.current === 'input') setLit(-1)
    }, 140)

    if (pad !== expected) {
      finish(scoreRef.current)
      return
    }

    const nextIdx = inputIdxRef.current + 1
    inputIdxRef.current = nextIdx
    setMatched(nextIdx)

    // Still more pads to match in this shown sequence
    if (nextIdx < seqRef.current.length) return

    // Full sequence matched — lock input before growing/replaying
    const completed = seqRef.current.length
    scoreRef.current = completed
    setScore(completed)
    go('watch')
    setLit(-1)
    setMatched(0)

    const runId = runIdRef.current
    seqRef.current = [...seqRef.current, randomPad()]
    void playSequence(seqRef.current, runId)
  }

  const challenge =
    best > 0
      ? `Beat your high score of ${best}.`
      : 'Set a high score — it sticks on this device.'

  const status =
    phase === 'watch'
      ? `Watch ${steps}…`
      : phase === 'input'
        ? `Your turn · ${matched}/${steps}`
        : phase === 'done'
          ? isNewBest
            ? `New high score — ${score}!`
            : `Chain broke at ${score}.`
          : 'Ready'

  return (
    <FeedCardShell
      accent="#c084fc"
      surface="#1c1528"
      kind="Brain game · memory"
      title={title}
      index={index}
      total={total}
      onPrev={onPrev}
      onNext={onNext}
      onHide={onHide}
      cta={
        phase === 'watch' || phase === 'input' ? undefined : (
          <button type="button" className="idea-btn next" onClick={start}>
            {phase === 'done' ? 'Play again' : 'Start'}
          </button>
        )
      }
    >
      <p className="feed-card-body feed-card-body-tight">{blurb}</p>
      <aside className="feed-card-challenge" aria-label="High score challenge">
        <span className="feed-card-challenge-kicker">Challenge</span>
        <p className="feed-card-challenge-q">{challenge}</p>
      </aside>

      <div className="reaction-hud" aria-live="polite">
        <span>
          Chain <strong>{score}</strong>
        </span>
        <span>
          Best <strong>{best}</strong>
        </span>
        <span>
          <strong>{status}</strong>
        </span>
      </div>

      <div
        className={`memory-arena ${phase === 'watch' || phase === 'input' ? 'is-live' : ''}`}
        aria-label="Memory sequence pads"
      >
        {phase === 'ready' && (
          <p className="reaction-arena-msg">Hit Start, watch the sequence, then tap every pad that lit — in order.</p>
        )}
        {phase === 'done' && (
          <p className="reaction-arena-msg">
            {isNewBest
              ? `New high score — chain of ${score}!`
              : `You reached a chain of ${score}.`}
          </p>
        )}
        {(phase === 'watch' || phase === 'input') && (
          <div className="memory-grid" role="group" aria-label={status}>
            {MEMORY_PADS.map((pad) => (
              <button
                key={pad.id}
                type="button"
                className={`memory-pad ${lit === pad.id ? 'is-lit' : ''} ${phase === 'watch' ? 'is-locked' : ''}`}
                style={
                  {
                    '--pad-base': pad.base,
                    '--pad-lit': pad.lit,
                  } as CSSProperties
                }
                disabled={phase !== 'input'}
                onClick={() => onPad(pad.id)}
                aria-label={`Pad ${pad.id + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </FeedCardShell>
  )
}

type MathPrompt = {
  label: string
  answer: number
  choices: number[]
}

function shuffleNums(arr: number[]) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeMathPrompt(score: number): MathPrompt {
  const tier = Math.min(3, Math.floor(score / 4))
  let a: number
  let b: number
  let op: '+' | '−' | '×'
  let answer: number

  if (tier === 0) {
    a = 2 + Math.floor(Math.random() * 9)
    b = 2 + Math.floor(Math.random() * 9)
    op = Math.random() < 0.55 ? '+' : '−'
    if (op === '−' && b > a) [a, b] = [b, a]
    answer = op === '+' ? a + b : a - b
  } else if (tier === 1) {
    a = 3 + Math.floor(Math.random() * 10)
    b = 2 + Math.floor(Math.random() * 9)
    op = Math.random() < 0.45 ? '+' : Math.random() < 0.5 ? '−' : '×'
    if (op === '−' && b > a) [a, b] = [b, a]
    if (op === '×') {
      a = 2 + Math.floor(Math.random() * 9)
      b = 2 + Math.floor(Math.random() * 8)
    }
    answer = op === '+' ? a + b : op === '−' ? a - b : a * b
  } else {
    a = 4 + Math.floor(Math.random() * 12)
    b = 3 + Math.floor(Math.random() * 9)
    op = Math.random() < 0.35 ? '+' : Math.random() < 0.5 ? '−' : '×'
    if (op === '−' && b > a) [a, b] = [b, a]
    if (op === '×') {
      a = 3 + Math.floor(Math.random() * 9)
      b = 3 + Math.floor(Math.random() * 8)
    }
    answer = op === '+' ? a + b : op === '−' ? a - b : a * b
  }

  const wrong = new Set<number>()
  while (wrong.size < 2) {
    const delta = (Math.floor(Math.random() * 5) + 1) * (Math.random() < 0.5 ? -1 : 1)
    const candidate = answer + delta
    if (candidate !== answer && candidate >= 0) wrong.add(candidate)
  }
  return {
    label: `${a} ${op} ${b}`,
    answer,
    choices: shuffleNums([answer, ...wrong]),
  }
}

export function MathGameFeedCard({
  title,
  blurb,
  onNext,
  onPrev,
  onHide,
  index,
  total,
}: {
  title: string
  blurb: string
} & NavProps) {
  const endAtRef = useRef(0)
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => getGameHighScore('math'))
  const [secsLeft, setSecsLeft] = useState(10)
  const [prompt, setPrompt] = useState<MathPrompt>(() => makeMathPrompt(0))
  const [missFlash, setMissFlash] = useState(false)
  const [isNewBest, setIsNewBest] = useState(false)

  useEffect(() => {
    if (phase !== 'playing') return
    let finished = false
    const tick = () => {
      const left = Math.max(0, endAtRef.current - Date.now())
      setSecsLeft(Math.ceil(left / 1000))
      if (left > 0 || finished) return
      finished = true

      const finalScore = scoreRef.current
      const prevBest = getGameHighScore('math')
      const nextBest = recordGameScore('math', finalScore)
      setBest(nextBest)
      setIsNewBest(finalScore > prevBest)
      setPhase('done')
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [phase])

  const start = () => {
    scoreRef.current = 0
    setScore(0)
    setIsNewBest(false)
    setMissFlash(false)
    setSecsLeft(10)
    setPrompt(makeMathPrompt(0))
    endAtRef.current = Date.now() + ROUND_MS
    setPhase('playing')
  }

  const onChoice = (n: number) => {
    if (phase !== 'playing') return
    if (n === prompt.answer) {
      scoreRef.current += 1
      setScore(scoreRef.current)
      setMissFlash(false)
      setPrompt(makeMathPrompt(scoreRef.current))
      return
    }
    setMissFlash(true)
    window.setTimeout(() => setMissFlash(false), 180)
  }

  const challenge =
    best > 0
      ? `Beat your high score of ${best}.`
      : 'Set a high score — it sticks on this device.'

  return (
    <FeedCardShell
      accent="#f59e0b"
      surface="#241a0f"
      kind="Brain game · math"
      title={title}
      index={index}
      total={total}
      onPrev={onPrev}
      onNext={onNext}
      onHide={onHide}
      cta={
        phase === 'playing' ? undefined : (
          <button type="button" className="idea-btn next" onClick={start}>
            {phase === 'done' ? 'Play again' : 'Start · 10s'}
          </button>
        )
      }
    >
      <p className="feed-card-body feed-card-body-tight">{blurb}</p>
      <aside className="feed-card-challenge" aria-label="High score challenge">
        <span className="feed-card-challenge-kicker">Challenge</span>
        <p className="feed-card-challenge-q">{challenge}</p>
      </aside>

      <div className="reaction-hud" aria-live="polite">
        <span>
          Score <strong>{score}</strong>
        </span>
        <span>
          Best <strong>{best}</strong>
        </span>
        <span>
          Time{' '}
          <strong>
            {phase === 'playing' ? secsLeft : phase === 'ready' ? 10 : 0}s
          </strong>
        </span>
      </div>

      <div
        className={`math-arena ${phase === 'playing' ? 'is-live' : ''} ${missFlash ? 'is-miss' : ''}`}
        aria-label="Quick math arena"
      >
        {phase === 'ready' && (
          <p className="reaction-arena-msg">Hit Start, then tap the correct answer as fast as you can.</p>
        )}
        {phase === 'done' && (
          <p className="reaction-arena-msg">
            {isNewBest
              ? `New high score — ${score}!`
              : `Round over — ${score} correct.`}
          </p>
        )}
        {phase === 'playing' && (
          <>
            <p className="math-prompt" aria-live="polite">
              {prompt.label}
            </p>
            <div className="math-choices">
              {prompt.choices.map((n) => (
                <button
                  key={`${prompt.label}-${n}`}
                  type="button"
                  className="math-choice"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    onChoice(n)
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </FeedCardShell>
  )
}
