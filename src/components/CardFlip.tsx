import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import './FeedCards.css'
import './CardFlip.css'

/**
 * 3D flip wrapper: the front face keeps its natural height, the back face
 * fills the same box. The hidden face is made inert so it can't take
 * focus or clicks while rotated away.
 */
export function CardFlip({
  flipped,
  front,
  back,
  className,
}: {
  flipped: boolean
  front: ReactNode
  back: ReactNode
  className?: string
}) {
  return (
    <div className={`card-flip ${flipped ? 'is-flipped' : ''} ${className ?? ''}`.trim()}>
      <div className="card-flip-inner">
        <div className="card-flip-front" inert={flipped}>
          {front}
        </div>
        <div className="card-flip-back" inert={!flipped}>
          {back}
        </div>
      </div>
    </div>
  )
}

/** Note-writing back face, styled like a feed card. */
export function CardNoteBack({
  accent,
  surface,
  kicker,
  title,
  detail,
  placeholder,
  active,
  initialNote,
  allowPromote = true,
  promoteLabel,
  onCancel,
  onSave,
}: {
  accent: string
  surface: string
  /** Small uppercase label, e.g. "Your note" or "Listening moment" */
  kicker: string
  title: string
  /** Context line under the title, e.g. reference or "Moment at 1:23" */
  detail?: string
  placeholder?: string
  /** True while this face is showing — resets and focuses the textarea */
  active: boolean
  /** Pre-fill when editing an existing note */
  initialNote?: string
  /** Hide the promote / update-idea button */
  allowPromote?: boolean
  /** Label for the promote button — e.g. "Save as idea" or "Save & update idea" */
  promoteLabel?: string
  onCancel: () => void
  onSave: (note: string, promote: boolean) => void
}) {
  const noteId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const savingRef = useRef(false)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!active) return
    setNote(initialNote ?? '')
    setSaved(false)
    savingRef.current = false
    // Focus once the flip transition has mostly finished
    const t = window.setTimeout(() => textareaRef.current?.focus(), 380)
    return () => window.clearTimeout(t)
  }, [active, initialNote])

  const commit = (promote: boolean) => {
    // Guard before React re-renders — double-clicks otherwise create duplicate thoughts
    if (savingRef.current || saved) return
    savingRef.current = true
    onSave(note, promote)
    setSaved(true)
    window.setTimeout(() => onCancel(), 700)
  }

  const promoteText = promoteLabel ?? 'Save as idea'

  return (
    <article
      className="feed-card card-note-back"
      style={{ '--card-accent': accent, '--card-surface': surface } as CSSProperties}
    >
      <div className="feed-card-glow" aria-hidden />
      <header className="feed-card-top">
        <span className="feed-card-kind">{kicker}</span>
        <button
          type="button"
          className="card-note-back-flip"
          onClick={onCancel}
          aria-label="Flip card back over"
          title="Flip back"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Flip back
        </button>
      </header>
      <h2 className="feed-card-title card-note-back-title">{title}</h2>
      {detail && <p className="feed-card-author">{detail}</p>}
      <label className="feed-card-note-label" htmlFor={noteId}>
        Your note
      </label>
      <textarea
        ref={textareaRef}
        id={noteId}
        className="feed-card-note-input card-note-back-input"
        placeholder={placeholder ?? 'What stuck? One line is enough.'}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <footer className="feed-card-foot">
        <div className="feed-card-actions card-note-back-actions">
          <button type="button" className="feed-card-note-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`feed-card-note-btn ${allowPromote ? '' : 'primary'}`.trim()}
            onClick={() => commit(false)}
            disabled={saved}
          >
            {saved && !allowPromote ? 'Saved' : 'Save thought'}
          </button>
          {allowPromote && (
            <button
              type="button"
              className="feed-card-note-btn primary"
              onClick={() => commit(true)}
              disabled={saved}
            >
              {saved ? 'Saved' : promoteText}
            </button>
          )}
        </div>
        {allowPromote && !saved && (
          <p className="card-note-back-hint">
            Save thought keeps it on Kept. Save as idea moves it to an idea card — use “Back to
            thought” on the card when you want to edit again.
          </p>
        )}
      </footer>
    </article>
  )
}
