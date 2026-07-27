import { useEffect, useMemo, useRef, useState } from 'react'
import { getTopic, catalogTopics } from '../data/topics'
import type { ZettelLinkKind, ZettelNote } from '../data/zettel'
import { normalizeTags, searchNotesForLink } from '../data/zettel'
import { useZettel } from '../hooks/useZettel'
import './ZettelEditor.css'

const LINK_KINDS: { id: ZettelLinkKind; label: string }[] = [
  { id: 'related', label: 'Related' },
  { id: 'extends', label: 'Extends' },
  { id: 'supports', label: 'Supports' },
  { id: 'source', label: 'Source' },
  { id: 'derived', label: 'Derived' },
]

export function ZettelEditor({
  noteId,
  onClose,
  onSaved,
}: {
  noteId: string | null
  onClose: () => void
  onSaved?: (id: string) => void
}) {
  const {
    getNote,
    createNote,
    updateNote,
    removeNote,
    addLink,
    removeLink,
    neighbors,
    notes,
  } = useZettel()

  const existing = noteId ? getNote(noteId) : null
  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const [topicId, setTopicId] = useState(existing?.topicId ?? '')
  const [tagsText, setTagsText] = useState((existing?.tags ?? []).join(', '))
  const [linkQuery, setLinkQuery] = useState('')
  const [linkKind, setLinkKind] = useState<ZettelLinkKind>('related')
  const [activeId, setActiveId] = useState<string | null>(noteId)
  const createdRef = useRef(false)
  /** Set when this mount created the note — used to discard empty drafts on Close. */
  const createdThisSessionRef = useRef(false)

  useEffect(() => {
    if (!noteId) {
      if (createdRef.current) return
      createdRef.current = true
      createdThisSessionRef.current = true
      const created = createNote({ title: 'Untitled note', body: '' })
      setActiveId(created.id)
      setTitle(created.title)
      setBody(created.body)
      setTopicId('')
      setTagsText('')
      // Defer onSaved until the draft has real content — avoids orphan selection in the stack.
      return
    }
    const n = getNote(noteId)
    if (!n) return
    setActiveId(n.id)
    setTitle(n.title)
    setBody(n.body)
    setTopicId(n.topicId ?? '')
    setTagsText((n.tags ?? []).join(', '))
  }, [noteId]) // eslint-disable-line react-hooks/exhaustive-deps -- mount/create once per noteId

  const id = activeId
  const { outbound, inbound } = id ? neighbors(id) : { outbound: [], inbound: [] }

  const isPristineDraft = () => {
    if (!createdThisSessionRef.current) return false
    const titleOk = !title.trim() || title.trim() === 'Untitled note'
    return (
      titleOk &&
      !body.trim() &&
      !tagsText.trim() &&
      !topicId &&
      outbound.length === 0
    )
  }

  const discardPristineDraft = () => {
    if (!id || !isPristineDraft()) return false
    removeNote(id)
    return true
  }

  const handleClose = () => {
    discardPristineDraft()
    onClose()
  }

  const alreadyLinkedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const l of outbound) ids.add(l.to)
    for (const l of inbound) ids.add(l.from)
    return ids
  }, [outbound, inbound])

  const suggestions = useMemo(() => {
    if (!id || !linkQuery.trim()) return []
    return searchNotesForLink(notes, linkQuery, {
      excludeId: id,
      alreadyLinkedIds,
      limit: 8,
    })
  }, [notes, id, linkQuery, alreadyLinkedIds])

  const save = () => {
    if (!id) return
    const nextTitle = title.trim() || 'Untitled note'
    updateNote(id, {
      title: nextTitle,
      body,
      topicId: (topicId || undefined) as ZettelNote['topicId'],
      tags: normalizeTags(tagsText),
    })
    const stillPristine =
      createdThisSessionRef.current &&
      nextTitle === 'Untitled note' &&
      !body.trim() &&
      !tagsText.trim() &&
      !topicId
    if (!stillPristine) onSaved?.(id)
  }

  const handleLink = (toId: string) => {
    if (!id) return
    addLink(id, toId, linkKind)
    setLinkQuery('')
    onSaved?.(id)
  }

  if (!id) return null

  return (
    <div className="zettel-editor">
      <header className="zettel-editor-head">
        <h2>{existing ? 'Edit note' : 'New note'}</h2>
        <button type="button" className="btn btn-ghost" onClick={handleClose}>
          Close
        </button>
      </header>

      <label className="zettel-editor-field">
        <span>Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          placeholder="One clear claim"
        />
      </label>

      <label className="zettel-editor-field">
        <span>Note</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={save}
          rows={8}
          placeholder="Atomic idea — one thought, your words. Link related notes below."
        />
      </label>

      <label className="zettel-editor-field">
        <span>Tags (optional)</span>
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          onBlur={save}
          placeholder="agency, feedback-loops, film"
        />
      </label>

      <label className="zettel-editor-field">
        <span>Topic (optional)</span>
        <select
          value={topicId}
          onChange={(e) => {
            const nextTopic = e.target.value
            setTopicId(nextTopic)
            updateNote(id, {
              title: title.trim() || 'Untitled note',
              body,
              topicId: (nextTopic || undefined) as ZettelNote['topicId'],
              tags: normalizeTags(tagsText),
            })
            onSaved?.(id)
          }}
        >
          <option value="">None</option>
          {catalogTopics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <section className="zettel-editor-links">
        <h3>Links out</h3>
        <div className="zettel-editor-link-row">
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
            placeholder="Search notes… title words or #tag"
          />
        </div>
        {linkQuery.trim() && (
          <ul className="zettel-editor-suggest">
            {suggestions.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => handleLink(n.id)}>
                  <strong>{n.title}</strong>
                  <span>
                    {(n.tags?.length ?? 0) > 0
                      ? `${(n.tags ?? []).map((t) => `#${t}`).join(' ')} · `
                      : ''}
                    {n.body.trim().slice(0, 80) || 'Empty'}
                  </span>
                </button>
              </li>
            ))}
            {suggestions.length === 0 && <li className="zettel-editor-suggest-empty">No matches</li>}
          </ul>
        )}
        <ul className="zettel-editor-edge-list">
          {outbound.length === 0 && (
            <li className="zettel-editor-suggest-empty">No outbound links yet</li>
          )}
          {outbound.map((l) => {
            const n = getNote(l.to)
            if (!n) return null
            return (
              <li key={l.id}>
                <span>
                  → {l.kind}: {n.title}
                </span>
                <button type="button" className="btn btn-ghost" onClick={() => removeLink(l.id)}>
                  Unlink
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="zettel-editor-links">
        <h3>Backlinks</h3>
        <ul className="zettel-editor-edge-list">
          {inbound.length === 0 && (
            <li className="zettel-editor-suggest-empty">Nothing links here yet</li>
          )}
          {inbound.map((l) => {
            const n = getNote(l.from)
            if (!n) return null
            return (
              <li key={l.id}>
                <span>
                  ← {l.kind}: {n.title}
                </span>
                <button type="button" className="btn btn-ghost" onClick={() => removeLink(l.id)}>
                  Unlink
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="zettel-editor-actions">
        <button type="button" className="btn btn-primary" onClick={save}>
          Save
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            removeNote(id)
            onClose()
          }}
        >
          Delete
        </button>
      </div>

      {topicId && getTopic(topicId) && (
        <p className="zettel-editor-hint">Topic color: {getTopic(topicId)?.name}</p>
      )}
    </div>
  )
}
