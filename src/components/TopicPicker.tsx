import type { Topic, TopicId } from '../data/types'

type TopicPickerProps = {
  topics: Topic[]
  selected: TopicId[]
  onToggle: (id: TopicId) => void
  /** Optional grouped layout for denser forms */
  groups?: { label: string; topics: Topic[] }[]
  label?: string
  hint?: string
  optional?: boolean
}

/**
 * Compact multi-select chips for assigning topics to sites / RSS feeds.
 * Prefer `groups` when you want Catalog / Yours / Suggested sections.
 */
export function TopicPicker({
  topics,
  selected,
  onToggle,
  groups,
  label = 'Topics',
  hint,
  optional,
}: TopicPickerProps) {
  const sections =
    groups && groups.length > 0
      ? groups.filter((g) => g.topics.length > 0)
      : [{ label: '', topics }]

  if (sections.every((s) => s.topics.length === 0)) {
    return (
      <div className="topic-picker">
        <p className="settings-field-label">
          {label}
          {optional ? <span className="settings-optional"> (optional)</span> : null}
        </p>
        <p className="topic-picker-empty">No topics yet — add one under Topics above.</p>
      </div>
    )
  }

  return (
    <div className="topic-picker">
      <p className="settings-field-label">
        {label}
        {optional ? <span className="settings-optional"> (optional)</span> : null}
      </p>
      {hint ? <p className="topic-picker-hint">{hint}</p> : null}
      {sections.map((section) => (
        <div key={section.label || 'all'} className="topic-picker-group">
          {section.label ? (
            <span className="topic-picker-group-label">{section.label}</span>
          ) : null}
          <div
            className="settings-chips settings-chips-sm"
            role="group"
            aria-label={section.label || label}
          >
            {section.topics.map((t) => {
              const on = selected.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  className={on ? 'is-on' : ''}
                  aria-pressed={on}
                  title={t.tagline}
                  onClick={() => onToggle(t.id)}
                >
                  <span
                    className="topic-picker-dot"
                    style={{ background: t.accent }}
                    aria-hidden
                  />
                  {t.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {selected.length > 0 ? (
        <p className="topic-picker-selected">
          {selected.length} selected
        </p>
      ) : null}
    </div>
  )
}
