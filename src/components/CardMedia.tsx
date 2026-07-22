import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
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
      media: (
        <div className="card-media card-media--audio">
          <audio className="card-media-audio" controls preload="none" src={url} />
          <a className="card-media-open" href={url} target="_blank" rel="noreferrer">
            Open file <ExternalLinkIcon />
          </a>
        </div>
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
