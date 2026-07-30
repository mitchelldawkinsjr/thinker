import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Topic, TopicId } from '../data/types'
import { TopicPicker } from './TopicPicker'
import './TopicAssignLightbox.css'

type TopicAssignLightboxProps = {
  title: string
  detail?: string
  topics: Topic[]
  selected: TopicId[]
  onToggle: (id: TopicId) => void
  groups?: { label: string; topics: Topic[] }[]
  hint?: string
  optional?: boolean
  onClose: () => void
  /** Extra controls under the picker (weight, mute, etc.) */
  footer?: ReactNode
}

/**
 * Lightbox to assign topics to a source — keeps Settings lists compact.
 */
export function TopicAssignLightbox({
  title,
  detail,
  topics,
  selected,
  onToggle,
  groups,
  hint,
  optional,
  onClose,
  footer,
}: TopicAssignLightboxProps) {
  const titleId = useId()
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

  return createPortal(
    <div
      className="topic-assign-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="topic-assign-panel">
        <header className="topic-assign-bar">
          <div className="topic-assign-heading">
            <h2 id={titleId}>{title}</h2>
            {detail ? <p className="topic-assign-detail">{detail}</p> : null}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="topic-assign-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="topic-assign-body">
          <TopicPicker
            topics={topics}
            groups={groups}
            selected={selected}
            onToggle={onToggle}
            label="Topics"
            hint={hint}
            optional={optional}
          />
          {footer}
        </div>

        <footer className="topic-assign-footer">
          <button type="button" className="settings-primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

/** Short label for selected topics on a compact source row. */
export function formatTopicSummary(selected: TopicId[], topics: Topic[]): string {
  if (selected.length === 0) return 'Set topics'
  const names = selected.map((id) => topics.find((t) => t.id === id)?.name ?? id)
  if (names.length <= 2) return names.join(' · ')
  return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`
}
