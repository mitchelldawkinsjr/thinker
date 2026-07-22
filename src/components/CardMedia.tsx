import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { detectMediaKind, type MediaKind } from '../lib/mediaUrl'
import './CardMedia.css'

export function ExternalLinkIcon() {
  return (
    <svg
      className="card-media-ext-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M14 4h6v6M20 4l-9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Outbound link CTA with the shared external-page icon. */
export function ExternalCta({
  href,
  children,
  className = 'idea-btn next',
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <a
      className={`${className} idea-btn--ext`.trim()}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <ExternalLinkIcon />
    </a>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function InlineAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onTime = () => {
      if (!scrubbing) setCurrent(el.currentTime)
    }
    const onMeta = () => setDuration(el.duration || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      setCurrent(0)
    }

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('durationchange', onMeta)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('durationchange', onMeta)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.pause()
    }
  }, [src, scrubbing])

  const toggle = async () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      try {
        await el.play()
      } catch {
        /* blocked / failed — stay paused */
      }
    } else {
      el.pause()
    }
  }

  const seek = (ratio: number) => {
    const el = audioRef.current
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return
    const next = Math.max(0, Math.min(1, ratio)) * el.duration
    el.currentTime = next
    setCurrent(next)
  }

  const skipBy = (delta: number) => {
    const el = audioRef.current
    if (!el) return
    const max = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : Number.POSITIVE_INFINITY
    const next = Math.max(0, Math.min(max, el.currentTime + delta))
    el.currentTime = next
    setCurrent(next)
  }

  return (
    <div className="card-audio">
      <audio ref={audioRef} preload="none" src={src} />
      <div className="card-audio-transport">
        <button
          type="button"
          className="card-audio-skip"
          onClick={() => skipBy(-10)}
          aria-label="Rewind 10 seconds"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M8.5 7.5v9L3.5 12l5-4.5zM15.5 7.5v9L10.5 12l5-4.5z"
              fill="currentColor"
            />
          </svg>
          <span>10</span>
        </button>
        <button
          type="button"
          className={`card-audio-play ${playing ? 'is-playing' : ''}`}
          onClick={() => void toggle()}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="5" y="4" width="5" height="16" rx="1.2" />
              <rect x="14" y="4" width="5" height="16" rx="1.2" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M7.5 4.8v14.4L19.2 12 7.5 4.8z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="card-audio-skip"
          onClick={() => skipBy(10)}
          aria-label="Forward 10 seconds"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M8.5 7.5v9L13.5 12l-5-4.5zM15.5 7.5v9L20.5 12l-5-4.5z"
              fill="currentColor"
            />
          </svg>
          <span>10</span>
        </button>
      </div>

      <div className="card-audio-main">
        <div className="card-audio-meta">
          <span className="card-audio-kicker">Listen</span>
          <span className="card-audio-time" aria-live="off">
            {formatTime(current)}
            <span className="card-audio-time-sep">/</span>
            {duration > 0 ? formatTime(duration) : '–:––'}
          </span>
        </div>
        <input
          className="card-audio-seek"
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(progress * 10)}
          aria-label="Seek"
          style={{ '--seek-progress': `${progress}%` } as CSSProperties}
          onPointerDown={() => setScrubbing(true)}
          onPointerUp={(e) => {
            setScrubbing(false)
            seek(Number(e.currentTarget.value) / 1000)
          }}
          onChange={(e) => {
            const ratio = Number(e.target.value) / 1000
            if (duration > 0) setCurrent(ratio * duration)
            if (!scrubbing) seek(ratio)
          }}
        />
      </div>

      <a className="card-audio-open" href={src} target="_blank" rel="noreferrer" title="Open file">
        <ExternalLinkIcon />
        <span className="visually-hidden">Open file</span>
      </a>
    </div>
  )
}

type SourceMediaParts = {
  kind: MediaKind | null
  /** Inline player (audio) — render above the action row */
  media: ReactNode
  /** Footer CTA — link, play-video, or null when audio owns the slot */
  cta: ReactNode
}

/** Split a source URL into optional inline media + a footer CTA. */
export function sourceMediaParts(
  url: string,
  fallbackLabel: string,
  ctaClassName = 'idea-btn next',
): SourceMediaParts {
  const kind = detectMediaKind(url)
  if (kind === 'audio') {
    return {
      kind,
      media: <InlineAudioPlayer src={url} />,
      cta: null,
    }
  }
  if (kind === 'video') {
    return {
      kind,
      media: null,
      cta: <VideoPlayCta url={url} className={ctaClassName} />,
    }
  }
  return {
    kind: null,
    media: null,
    cta: (
      <ExternalCta href={url} className={ctaClassName}>
        {fallbackLabel}
      </ExternalCta>
    ),
  }
}

/** Convenience for idea cards / simple CTAs that stay in the action row (video + links). */
export function SourceMediaCta({
  url,
  fallbackLabel,
  className,
}: {
  url: string
  fallbackLabel: string
  className?: string
}) {
  const { media, cta } = sourceMediaParts(url, fallbackLabel, className ?? 'idea-btn next')
  if (media) {
    return <>{media}</>
  }
  return <>{cta}</>
}

function VideoPlayCta({ url, className }: { url: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={className ?? 'idea-btn next'}
        onClick={() => setOpen(true)}
      >
        Play video →
      </button>
      {open && <VideoLightbox url={url} onClose={() => setOpen(false)} />}
    </>
  )
}

function VideoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const titleId = useId()
  const videoRef = useRef<HTMLVideoElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      const v = videoRef.current
      if (v) {
        v.pause()
        v.removeAttribute('src')
        v.load()
      }
    }
  }, [onClose])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    void v.play().catch(() => {
      /* autoplay may be blocked — controls remain */
    })
  }, [url])

  return createPortal(
    <div
      className="video-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="video-lightbox-panel">
        <div className="video-lightbox-bar">
          <span id={titleId} className="video-lightbox-title">
            Video
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            className="video-lightbox-close"
            onClick={onClose}
            aria-label="Close video"
          >
            ✕
          </button>
        </div>
        <video
          ref={videoRef}
          className="video-lightbox-player"
          controls
          playsInline
          preload="metadata"
          src={url}
        />
        <a className="video-lightbox-open" href={url} target="_blank" rel="noreferrer">
          Open file <ExternalLinkIcon />
        </a>
      </div>
    </div>,
    document.body,
  )
}
