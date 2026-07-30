import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { getTopic } from '../data/topics'
import type { ZettelLink, ZettelLinkKind, ZettelNote } from '../data/zettel'
import { searchNotesForLink } from '../data/zettel'
import { useZettel } from '../hooks/useZettel'
import './ZettelStack.css'

type StackItem = {
  note: ZettelNote
  /** How this card relates to the active note */
  relation?: 'self' | 'out' | 'in'
  kind?: ZettelLink['kind']
}

const LINK_KINDS: { id: ZettelLinkKind; label: string }[] = [
  { id: 'related', label: 'Related' },
  { id: 'extends', label: 'Extends' },
  { id: 'supports', label: 'Supports' },
  { id: 'source', label: 'Source' },
  { id: 'derived', label: 'Derived' },
]

/**
 * CSS card stack for a slip-box note and its links.
 * Clicking a linked chip / stacked face shuffles that card to the front.
 */
export function ZettelStack({
  rootId,
  onEdit,
  onBuilt,
  startConnecting = false,
}: {
  rootId: string
  onEdit?: (id: string) => void
  /** Called after Build on creates a new linked note */
  onBuilt?: (id: string) => void
  /** Open the connect panel on mount / when stack lands from Keep */
  startConnecting?: boolean
}) {
  const { getNote, neighbors, linkedIds, notes, addLink, createNote } = useZettel()
  const [activeId, setActiveId] = useState(rootId)
  const [shuffling, setShuffling] = useState(false)
  const [outgoingId, setOutgoingId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(startConnecting)
  const [linkQuery, setLinkQuery] = useState('')
  const [linkKind, setLinkKind] = useState<ZettelLinkKind>('related')
  const shuffleTimer = useRef<number | null>(null)

  useEffect(() => {
    setActiveId(rootId)
  }, [rootId])

  useEffect(() => {
    if (startConnecting) setConnecting(true)
  }, [startConnecting, rootId])

  useEffect(() => {
    return () => {
      if (shuffleTimer.current) window.clearTimeout(shuffleTimer.current)
    }
  }, [])

  const active = getNote(activeId)
  const { outbound, inbound } = neighbors(activeId)

  const alreadyLinkedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const l of outbound) ids.add(l.to)
    for (const l of inbound) ids.add(l.from)
    return ids
  }, [outbound, inbound])

  const suggestions = useMemo(() => {
    if (!connecting || !linkQuery.trim()) return []
    return searchNotesForLink(notes, linkQuery, {
      excludeId: activeId,
      alreadyLinkedIds,
      limit: 8,
    })
  }, [connecting, notes, linkQuery, activeId, alreadyLinkedIds])

  const stack: StackItem[] = useMemo(() => {
    if (!active) return []
    const items: StackItem[] = [{ note: active, relation: 'self' }]
    const seen = new Set([active.id])

    // Source cards sit directly under your note — the keep metaphor
    const orderedOut = [
      ...outbound.filter((l) => l.kind === 'source'),
      ...outbound.filter((l) => l.kind !== 'source'),
    ]
    for (const l of orderedOut) {
      const n = getNote(l.to)
      if (!n || seen.has(n.id)) continue
      seen.add(n.id)
      items.push({ note: n, relation: 'out', kind: l.kind })
    }
    for (const l of inbound) {
      const n = getNote(l.from)
      if (!n || seen.has(n.id)) continue
      seen.add(n.id)
      items.push({ note: n, relation: 'in', kind: l.kind })
    }

    // Cap visible stack depth for CSS readability
    return items.slice(0, 6)
  }, [active, outbound, inbound, getNote])

  const goTo = (nextId: string) => {
    if (nextId === activeId || shuffling) return
    if (!getNote(nextId)) return
    setShuffling(true)
    setOutgoingId(activeId)
    if (shuffleTimer.current) window.clearTimeout(shuffleTimer.current)
    shuffleTimer.current = window.setTimeout(() => {
      setActiveId(nextId)
      setOutgoingId(null)
      setShuffling(false)
    }, 420)
  }

  const handleConnect = (toId: string) => {
    addLink(activeId, toId, linkKind)
    setLinkQuery('')
    setConnecting(false)
  }

  const handleBuildOn = () => {
    if (!active) return
    const created = createNote({
      title: 'Building on…',
      body: '',
      topicId: active.topicId,
    })
    addLink(created.id, active.id, 'extends')
    setActiveId(created.id)
    onBuilt?.(created.id)
    onEdit?.(created.id)
  }

  if (!active) {
    return <p className="zettel-stack-empty">Note not found.</p>
  }

  const topic = active.topicId ? getTopic(active.topicId) : undefined
  const linkCount = linkedIds(activeId).length
  const hasSourceBehind = stack.some((item) => item.kind === 'source' || item.relation === 'out')

  return (
    <div
      className={`zettel-stack ${shuffling ? 'is-shuffling' : ''}`}
      style={
        {
          '--zk-accent': topic?.accent ?? '#ff5a45',
          '--zk-surface': topic?.color ?? '#1a2332',
        } as CSSProperties
      }
    >
      <div className="zettel-stack-stage" aria-live="polite">
        {stack.map((item, i) => {
          const isFront = item.note.id === activeId
          const isLeaving = outgoingId === item.note.id
          const depth = isFront ? 0 : Math.min(i, 4)
          const bodyText = item.note.body.trim()
          const titleText = item.note.title.trim()
          const bodyDuplicatesTitle = Boolean(bodyText) && bodyText === titleText
          const frontBody = !bodyText
            ? 'Empty note — edit to add your claim.'
            : bodyDuplicatesTitle
              ? null
              : bodyText
          const backPreview =
            !bodyText || bodyDuplicatesTitle ? null : bodyText.slice(0, 120)
          return (
            <article
              key={item.note.id}
              className={[
                'zettel-stack-card',
                isFront ? 'is-front' : 'is-back',
                isLeaving ? 'is-leaving' : '',
                item.relation === 'in' ? 'is-backlink' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                {
                  '--zk-depth': depth,
                  '--zk-rot': `${(depth % 2 === 0 ? 1 : -1) * depth * 1.4}deg`,
                  '--zk-y': `${depth * 10}px`,
                  '--zk-x': `${depth * 6}px`,
                  '--zk-card-accent':
                    (item.note.topicId && getTopic(item.note.topicId)?.accent) ||
                    topic?.accent ||
                    '#ff5a45',
                  '--zk-card-surface':
                    (item.note.topicId && getTopic(item.note.topicId)?.color) ||
                    topic?.color ||
                    '#1a2332',
                } as CSSProperties
              }
              onClick={() => {
                if (!isFront) goTo(item.note.id)
              }}
              role={isFront ? 'article' : 'button'}
              tabIndex={isFront ? undefined : 0}
              onKeyDown={(e) => {
                if (!isFront && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  goTo(item.note.id)
                }
              }}
              aria-label={isFront ? undefined : `Open linked note: ${item.note.title}`}
            >
              <header className="zettel-stack-card-top">
                <span className="zettel-stack-kicker">
                  {item.relation === 'self'
                    ? linkCount > 0
                      ? `${linkCount} linked`
                      : 'Your note'
                    : item.relation === 'in'
                      ? `← ${item.kind ?? 'backlink'}`
                      : item.kind === 'source'
                        ? '→ source'
                        : `→ ${item.kind ?? 'link'}`}
                </span>
                {item.note.topicId && (
                  <span className="zettel-stack-topic">
                    #{getTopic(item.note.topicId)?.name ?? item.note.topicId}
                  </span>
                )}
              </header>
              <h3 className="zettel-stack-title">{item.note.title}</h3>
              {isFront && (item.note.tags?.length ?? 0) > 0 && (
                <p className="zettel-stack-tags">
                  {(item.note.tags ?? []).map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </p>
              )}
              {isFront && frontBody !== null && (
                <p className="zettel-stack-body">{frontBody}</p>
              )}
              {!isFront && backPreview !== null && (
                <p className="zettel-stack-preview">
                  {backPreview}
                  {bodyText.length > 120 ? '…' : ''}
                </p>
              )}
            </article>
          )
        })}
      </div>

      {(outbound.length > 0 || inbound.length > 0) && (
        <div className="zettel-stack-graph">
          {outbound.length > 0 && (
            <div className="zettel-stack-link-group">
              <p className="zettel-stack-link-label">Links out</p>
              <div className="zettel-stack-links">
                {outbound.map((l) => {
                  const n = getNote(l.to)
                  if (!n) return null
                  return (
                    <button
                      key={l.id}
                      type="button"
                      className="zettel-stack-chip"
                      onClick={() => goTo(n.id)}
                    >
                      → {l.kind}: {n.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {inbound.length > 0 && (
            <div className="zettel-stack-link-group">
              <p className="zettel-stack-link-label">Backlinks</p>
              <div className="zettel-stack-links">
                {inbound.map((l) => {
                  const n = getNote(l.from)
                  if (!n) return null
                  return (
                    <button
                      key={l.id}
                      type="button"
                      className="zettel-stack-chip zettel-stack-chip--back"
                      onClick={() => goTo(n.id)}
                    >
                      ← {l.kind}: {n.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {outbound.length === 0 && inbound.length === 0 && (
        <p className="zettel-stack-orphan-hint">
          Lonely note — Connect it to another thought so Ask can pull neighbors in.
        </p>
      )}

      {hasSourceBehind && linkCount === 1 && (
        <p className="zettel-stack-orphan-hint">
          Stacked on its source. Connect another thought or Build on this to grow the pile.
        </p>
      )}

      {connecting && (
        <div className="zettel-stack-connect">
          <div className="zettel-stack-connect-row">
            <select
              value={linkKind}
              onChange={(e) => setLinkKind(e.target.value as ZettelLinkKind)}
              aria-label="Link kind"
            >
              {LINK_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <input
              value={linkQuery}
              onChange={(e) => setLinkQuery(e.target.value)}
              placeholder="Search notes to connect…"
              autoFocus
            />
            <button type="button" className="btn btn-ghost" onClick={() => setConnecting(false)}>
              Cancel
            </button>
          </div>
          {suggestions.length > 0 && (
            <ul className="zettel-stack-suggest">
              {suggestions.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => handleConnect(n.id)}>
                    {n.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {linkQuery.trim() && suggestions.length === 0 && (
            <p className="zettel-stack-orphan-hint">No matching notes — try another word or tag.</p>
          )}
        </div>
      )}

      <div className="zettel-stack-actions">
        <button type="button" className="btn btn-primary" onClick={() => setConnecting(true)}>
          Connect
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleBuildOn}>
          Build on
        </button>
        {onEdit && (
          <button type="button" className="btn btn-ghost" onClick={() => onEdit(activeId)}>
            Edit note
          </button>
        )}
      </div>
    </div>
  )
}
