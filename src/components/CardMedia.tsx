import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { detectMediaKind, youtubeEmbedUrl, type MediaKind } from '../lib/mediaUrl'
import { formatAudioTime } from '../lib/formatTime'
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


export type AudioTrackMeta = {
  title?: string
  artist?: string
}

function applyMediaSession(meta: AudioTrackMeta | undefined) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  const title = meta?.title?.trim() || 'Audio'
  const artist = meta?.artist?.trim() || 'Thinker'
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: 'Thinker',
    })
  } catch {
    // Older WebViews may reject MediaMetadata
  }
}

/** A saved clip stamp shown on the player (marker + chip) */
export type AudioMoment = {
  id: string
  startSec: number
  note?: string
}

function InlineAudioPlayer({
  src,
  title,
  artist,
  startAt,
  moments,
  onCaptureMoment,
}: {
  src: string
  title?: string
  artist?: string
  /** Seek here once metadata is ready (replay a saved moment) */
  startAt?: number
  /** Saved clip stamps — rendered as markers on the seek bar + tappable chips */
  moments?: AudioMoment[]
  /** Pause and hand the current timestamp to the card (flips to the note side) */
  onCaptureMoment?: (startSec: number) => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const initialAt =
    typeof startAt === 'number' && Number.isFinite(startAt) && startAt > 0 ? startAt : 0
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(initialAt)
  const [duration, setDuration] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const scrubbingRef = useRef(false)
  const startApplied = useRef(false)
  const startAtRef = useRef(startAt)
  /** Chip tapped before metadata was ready — seek once duration is known */
  const pendingSeekRef = useRef<number | null>(null)
  const trackMetaRef = useRef({ title, artist })
  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0

  scrubbingRef.current = scrubbing
  startAtRef.current = startAt
  trackMetaRef.current = { title, artist }

  const clampStart = (el: HTMLAudioElement, at: number) => {
    if (Number.isFinite(el.duration) && el.duration > 0) {
      return Math.min(at, Math.max(0, el.duration - 0.05))
    }
    return at
  }

  /** Seek to startAt when the element will accept it. Returns true once close enough. */
  const applyStart = (force = false) => {
    const el = audioRef.current
    const at = startAtRef.current
    if (!el) return false
    if (typeof at !== 'number' || !Number.isFinite(at) || at <= 0) {
      startApplied.current = true
      return true
    }
    if (!force && startApplied.current) return true

    const next = clampStart(el, at)
    try {
      el.currentTime = next
    } catch {
      return false
    }
    // Optimistic UI — real lock only when the element actually landed near the stamp
    setCurrent(next)
    const landed = Math.abs(el.currentTime - next) < 0.75
    if (landed) startApplied.current = true
    return landed
  }

  useEffect(() => {
    startApplied.current = false
    setCurrent(initialAt)
    // Re-seek when the target timestamp changes (same audio src)
    applyStart(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, startAt, initialAt])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onTime = () => {
      if (!scrubbingRef.current) setCurrent(el.currentTime)
    }
    const onMeta = () => {
      setDuration(el.duration || 0)
      applyStart()
      if (pendingSeekRef.current != null && Number.isFinite(el.duration) && el.duration > 0) {
        try {
          el.currentTime = clampStart(el, pendingSeekRef.current)
          setCurrent(el.currentTime)
        } catch {
          /* ignore */
        }
        pendingSeekRef.current = null
      }
    }
    const onPlay = () => {
      // Last chance: some engines reset currentTime to 0 when play() starts
      const at = startAtRef.current
      if (
        typeof at === 'number' &&
        at > 0 &&
        !startApplied.current &&
        Math.abs(el.currentTime - at) > 0.75
      ) {
        applyStart(true)
      }
      setPlaying(true)
      applyMediaSession(trackMetaRef.current)
    }
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      setCurrent(0)
      startApplied.current = false
    }

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('loadeddata', onMeta)
    el.addEventListener('canplay', onMeta)
    el.addEventListener('durationchange', onMeta)
    el.addEventListener('seeked', onTime)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    applyStart()
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('loadeddata', onMeta)
      el.removeEventListener('canplay', onMeta)
      el.removeEventListener('durationchange', onMeta)
      el.removeEventListener('seeked', onTime)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.pause()
    }
    // Intentionally only rebind when src changes — scrubbing/meta use refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

    const skipLock = (delta: number) => {
      const el = audioRef.current
      if (!el) return
      const max =
        Number.isFinite(el.duration) && el.duration > 0 ? el.duration : Number.POSITIVE_INFINITY
      const next = Math.max(0, Math.min(max, el.currentTime + delta))
      el.currentTime = next
      setCurrent(next)
      startApplied.current = true
    }

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        void playFromStart()
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause()
      })
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        skipLock(-(details.seekOffset || 10))
      })
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        skipLock(details.seekOffset || 10)
      })
    } catch {
      // ignore unsupported handlers
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('seekbackward', null)
        navigator.mediaSession.setActionHandler('seekforward', null)
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  const playFromStart = async () => {
    const el = audioRef.current
    if (!el) return
    applyMediaSession(trackMetaRef.current)

    const at = startAtRef.current
    // Seek whenever we're still near 0 but the moment isn't — browsers often
    // "accept" an early seek then reset currentTime when play() starts.
    const needsSeek =
      typeof at === 'number' &&
      Number.isFinite(at) &&
      at > 0 &&
      (Math.abs(el.currentTime - at) > 0.75 && el.currentTime < 1.25)

    if (needsSeek) {
      startApplied.current = false
      applyStart(true)
      await new Promise<void>((resolve) => {
        let done = false
        const finish = () => {
          if (done) return
          done = true
          el.removeEventListener('seeked', finish)
          window.clearTimeout(fallback)
          resolve()
        }
        const fallback = window.setTimeout(finish, 400)
        el.addEventListener('seeked', finish)
        applyStart(true)
      })
      const landed = clampStart(el, at)
      if (Math.abs(el.currentTime - landed) > 0.75) {
        try {
          el.currentTime = landed
        } catch {
          /* ignore */
        }
      }
      startApplied.current = true
      setCurrent(el.currentTime > 0 ? el.currentTime : landed)
    }

    try {
      await el.play()
      // If play reset us to the beginning, snap back once more
      if (
        typeof at === 'number' &&
        at > 1 &&
        el.currentTime < 1.25 &&
        Math.abs(el.currentTime - at) > 0.75
      ) {
        try {
          el.currentTime = clampStart(el, at)
          setCurrent(el.currentTime)
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* blocked / failed — stay paused */
    }
  }

  const toggle = async () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      await playFromStart()
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

  const captureMoment = () => {
    if (!onCaptureMoment) return
    const el = audioRef.current
    const at = el ? el.currentTime : current
    el?.pause()
    onCaptureMoment(at)
  }

  /** Jump to a saved clip stamp and play from there */
  const playMoment = async (sec: number) => {
    const el = audioRef.current
    if (!el) return
    // Take over from the startAt machinery — the user picked a spot explicitly
    startApplied.current = true
    if (Number.isFinite(el.duration) && el.duration > 0) {
      try {
        el.currentTime = clampStart(el, Math.max(0, sec))
      } catch {
        /* ignore */
      }
      setCurrent(el.currentTime)
    } else {
      pendingSeekRef.current = Math.max(0, sec)
      setCurrent(sec)
    }
    applyMediaSession(trackMetaRef.current)
    try {
      await el.play()
    } catch {
      /* blocked / failed — stay paused */
    }
  }

  const sortedMoments = moments && moments.length > 0
    ? [...moments].sort((a, b) => a.startSec - b.startSec)
    : null

  return (
    <div className="card-audio">
      <audio
        ref={audioRef}
        preload={typeof startAt === 'number' || sortedMoments ? 'metadata' : 'none'}
        src={src}
      />
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
            {formatAudioTime(current)}
            <span className="card-audio-time-sep">/</span>
            {duration > 0 ? formatAudioTime(duration) : '–:––'}
          </span>
        </div>
        <div className="card-audio-seek-wrap">
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
          {duration > 0 &&
            sortedMoments?.map((m) => (
              <span
                key={m.id}
                className="card-audio-marker"
                style={{ left: `${Math.min(100, (m.startSec / duration) * 100)}%` }}
                aria-hidden
              />
            ))}
        </div>
        {sortedMoments && (
          <div className="card-audio-stamps" role="group" aria-label="Saved clip stamps">
            {sortedMoments.map((m) => (
              <button
                key={m.id}
                type="button"
                className="card-audio-stamp"
                onClick={() => void playMoment(m.startSec)}
                title={m.note?.trim() || `Play from ${formatAudioTime(m.startSec)}`}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M7.5 4.8v14.4L19.2 12 7.5 4.8z" />
                </svg>
                {formatAudioTime(m.startSec)}
              </button>
            ))}
          </div>
        )}
      </div>

      {onCaptureMoment ? (
        <button
          type="button"
          className="card-audio-moment-trigger"
          onClick={captureMoment}
          aria-label="Save listening moment"
          title="Save moment"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}

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

export type AudioPlayerOptions = AudioTrackMeta & {
  startAt?: number
  /** Saved clip stamps for this audio — markers + tappable chips on the player */
  moments?: AudioMoment[]
  /** Pause + report the current timestamp so the card can flip to its note side */
  onCaptureMoment?: (startSec: number) => void
}

/** Split a source URL into optional inline media + a footer CTA. */
export function sourceMediaParts(
  url: string,
  fallbackLabel: string,
  ctaClassName = 'idea-btn next',
  track?: AudioPlayerOptions,
): SourceMediaParts {
  const kind = detectMediaKind(url)
  if (kind === 'audio') {
    return {
      kind,
      media: (
        <InlineAudioPlayer
          key={`${url}|${track?.startAt ?? 0}`}
          src={url}
          title={track?.title}
          artist={track?.artist}
          startAt={track?.startAt}
          moments={track?.moments}
          onCaptureMoment={track?.onCaptureMoment}
        />
      ),
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

/** Clickable image that opens a full-screen lightbox (keeps a separate source CTA elsewhere). */
export function ImageLightboxTrigger({
  src,
  alt = '',
  className,
}: {
  src: string
  alt?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={className ? `${className} image-lightbox-trigger` : 'image-lightbox-trigger'}
        onClick={() => setOpen(true)}
        aria-label="View image"
      >
        <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" decoding="async" />
      </button>
      {open && <ImageLightbox url={src} onClose={() => setOpen(false)} />}
    </>
  )
}

function useLightboxChrome(onClose: () => void) {
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
    }
  }, [onClose])

  return closeBtnRef
}

function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const titleId = useId()
  const closeBtnRef = useLightboxChrome(onClose)

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
      <div className="video-lightbox-panel video-lightbox-panel--image">
        <div className="video-lightbox-bar">
          <span id={titleId} className="video-lightbox-title">
            Image
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            className="video-lightbox-close"
            onClick={onClose}
            aria-label="Close image"
          >
            ✕
          </button>
        </div>
        <img className="video-lightbox-player video-lightbox-player--image" src={url} alt="" />
        <a className="video-lightbox-open" href={url} target="_blank" rel="noreferrer">
          Open image <ExternalLinkIcon />
        </a>
      </div>
    </div>,
    document.body,
  )
}

function VideoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const titleId = useId()
  const videoRef = useRef<HTMLVideoElement>(null)
  const closeBtnRef = useLightboxChrome(onClose)
  const embedSrc = youtubeEmbedUrl(url)

  useEffect(() => {
    return () => {
      const v = videoRef.current
      if (v) {
        v.pause()
        v.removeAttribute('src')
        v.load()
      }
    }
  }, [])

  useEffect(() => {
    if (embedSrc) return
    const v = videoRef.current
    if (!v) return
    void v.play().catch(() => {
      /* autoplay may be blocked — controls remain */
    })
  }, [url, embedSrc])

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
        {embedSrc ? (
          <iframe
            className="video-lightbox-player video-lightbox-player--embed"
            src={embedSrc}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <video
            ref={videoRef}
            className="video-lightbox-player"
            controls
            playsInline
            preload="metadata"
            src={url}
          />
        )}
        <a className="video-lightbox-open" href={url} target="_blank" rel="noreferrer">
          {embedSrc ? 'Open on YouTube' : 'Open file'} <ExternalLinkIcon />
        </a>
      </div>
    </div>,
    document.body,
  )
}
