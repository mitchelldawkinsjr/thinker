import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useKept } from '../hooks/useKept'
import { useThoughts } from '../hooks/useThoughts'
import { useDraftReview } from '../hooks/useDraftReview'
import { getIdea } from '../data/ideas'
import { getTopic } from '../data/topics'
import { formatAudioTime, isListeningThought, type Thought } from '../data/thoughts'
import {
  shareAllKept,
  shareStatusLabel,
  shareThought,
  type ShareResult,
} from '../lib/exportThought'
import { useExtraIdeas } from '../hooks/useExtraIdeas'
import { IdeaCard } from '../components/IdeaCard'
import { CardFlip, CardNoteBack } from '../components/CardFlip'
import { sourceMediaParts } from '../components/CardMedia'
import './Kept.css'

function useShareBusy() {
  const [status, setStatus] = useState<{ id: string; result: ShareResult } | null>(null)

  async function runShare(id: string, action: () => Promise<ShareResult>) {
    const result = await action()
    if (result === 'cancelled') return
    setStatus({ id, result })
    window.setTimeout(() => {
      setStatus((cur) => (cur?.id === id ? null : cur))
    }, 1400)
  }

  function labelFor(id: string, idle = 'Share') {
    if (status?.id !== id) return idle
    return shareStatusLabel(status.result, idle)
  }

  return { runShare, labelFor }
}

/** Non-listening keep note (scripture, site, book, idea Keep, news Keep) */
function KeptNoteRow({ thought }: { thought: Thought }) {
  const { promote, remove, updateNote } = useThoughts()
  const { runShare, labelFor } = useShareBusy()
  const [flipped, setFlipped] = useState(false)
  const isScripture = thought.parent.kind === 'scripture'
  const topic = getTopic(thought.parent.topicId)
  const accent = isScripture ? '#e8c47c' : (topic?.accent ?? '#ff5a45')
  const surface = isScripture ? '#241c14' : (topic?.color ?? '#1a2332')
  const kindLabel =
    thought.parent.kind === 'scripture'
      ? 'Scripture'
      : thought.parent.kind === 'resource'
        ? 'Site'
        : thought.parent.kind === 'book'
          ? 'Book'
          : thought.parent.kind === 'news'
            ? 'News'
            : 'Idea'
  const detail = isScripture
    ? `${thought.parent.reference ?? 'Scripture'}${
        thought.parent.translation ? ` · ${thought.parent.translation}` : ''
      }`
    : thought.parent.source

  return (
    <li className="kept-moment-item">
      <CardFlip
        flipped={flipped}
        className="card-flip--fluid"
        front={
          <div className="kept-moment">
            <div className="kept-moment-meta">
              <span className="kept-moment-time">
                {isScripture ? (thought.parent.reference ?? 'Scripture') : kindLabel}
              </span>
              <span className="kept-moment-parent">
                {thought.parent.title}
                {isScripture && thought.parent.translation
                  ? ` · ${thought.parent.translation}`
                  : null}
              </span>
            </div>
            {isScripture && thought.parent.verseText ? (
              <blockquote className="kept-moment-verse">“{thought.parent.verseText}”</blockquote>
            ) : null}
            <p className="kept-moment-note">
              {thought.note.trim() ||
                'No note yet — promote to turn this into an idea card, or export for draft:ideas.'}
            </p>
            <div className="kept-moment-actions">
              <button type="button" className="btn btn-primary" onClick={() => promote(thought.id)}>
                Promote to idea
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setFlipped(true)}>
                {thought.note.trim() ? 'Edit note' : 'Add note'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void runShare(thought.id, () => shareThought(thought))}
              >
                {labelFor(thought.id)}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => remove(thought.id)}>
                Remove
              </button>
            </div>
          </div>
        }
        back={
          <CardNoteBack
            accent={accent}
            surface={surface}
            kicker={`${kindLabel} note`}
            title={thought.parent.title}
            detail={detail}
            active={flipped}
            initialNote={thought.note}
            allowPromote
            onCancel={() => setFlipped(false)}
            onSave={(note, promoteIt) => {
              if (promoteIt) promote(thought.id, note)
              else updateNote(thought.id, note)
            }}
          />
        }
      />
    </li>
  )
}

/** All open clip stamps for one audio card: one player, many stamps */
function KeptMomentGroup({ thoughts }: { thoughts: Thought[] }) {
  const { promote, remove, updateNote } = useThoughts()
  const { runShare, labelFor } = useShareBusy()
  const [editing, setEditing] = useState<Thought | null>(null)
  const parent = thoughts[0].parent
  const topic = getTopic(parent.topicId)
  const accent = topic?.accent ?? '#ff5a45'
  const surface = topic?.color ?? '#1a2332'
  const stamps = [...thoughts].sort((a, b) => a.startSec - b.startSec)

  const player = parent.audioUrl
    ? sourceMediaParts(parent.audioUrl, 'Open source', 'idea-btn ghost', {
        title: parent.title,
        artist: parent.source,
        moments: stamps.map((t) => ({ id: t.id, startSec: t.startSec, note: t.note })),
      }).media
    : null

  return (
    <li className="kept-moment-item">
      <CardFlip
        flipped={Boolean(editing)}
        className="card-flip--fluid"
        front={
          <div className="kept-moment">
            <div className="kept-moment-meta">
              <span className="kept-moment-time">
                {stamps.length} clip{stamps.length === 1 ? '' : 's'}
              </span>
              <span className="kept-moment-parent">{parent.title}</span>
            </div>
            {player && (
              <div
                className="kept-moment-player"
                style={{ '--card-accent': accent } as CSSProperties}
              >
                {player}
              </div>
            )}
            <ul className="kept-stamp-list">
              {stamps.map((t) => (
                <li key={t.id} className="kept-stamp">
                  <span className="kept-stamp-time">{formatAudioTime(t.startSec)}</span>
                  <span className={`kept-stamp-note ${t.note.trim() ? '' : 'is-empty'}`.trim()}>
                    {t.note.trim() || 'No note yet'}
                  </span>
                  <div className="kept-stamp-actions">
                    <button
                      type="button"
                      className="kept-stamp-btn"
                      onClick={() => promote(t.id)}
                    >
                      Promote
                    </button>
                    <button
                      type="button"
                      className="kept-stamp-btn"
                      onClick={() => setEditing(t)}
                    >
                      {t.note.trim() ? 'Edit' : 'Add note'}
                    </button>
                    <button
                      type="button"
                      className="kept-stamp-btn"
                      onClick={() => void runShare(t.id, () => shareThought(t))}
                    >
                      {labelFor(t.id)}
                    </button>
                    <button
                      type="button"
                      className="kept-stamp-btn"
                      onClick={() => remove(t.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        }
        back={
          <CardNoteBack
            accent={accent}
            surface={surface}
            kicker="Listening moment"
            title={parent.title}
            detail={
              editing
                ? `Moment at ${formatAudioTime(editing.startSec)} · ${parent.source}`
                : parent.source
            }
            active={Boolean(editing)}
            initialNote={editing?.note ?? ''}
            allowPromote
            onCancel={() => setEditing(null)}
            onSave={(note, promoteIt) => {
              if (!editing) return
              if (promoteIt) promote(editing.id, note)
              else updateNote(editing.id, note)
            }}
          />
        }
      />
    </li>
  )
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function Kept() {
  const { kept } = useKept()
  const { thoughts, exportSeeds } = useThoughts()
  const { exportApproved, pendingCount, approved } = useDraftReview()
  const approvedCount = Object.keys(approved).length
  const { items: extraIdeas } = useExtraIdeas()
  const { runShare, labelFor } = useShareBusy()
  const ideas = [...kept]
    .map((id) => getIdea(id, extraIdeas))
    .filter((i): i is NonNullable<typeof i> => Boolean(i))

  // Promoted thoughts live only as idea cards until sent back
  const openThoughts = thoughts.filter((t) => !t.promotedIdeaId)
  const empty = ideas.length === 0 && thoughts.length === 0 && approvedCount === 0
  const scriptureThoughts = openThoughts.filter((t) => t.parent.kind === 'scripture')
  const listeningThoughts = openThoughts.filter((t) => isListeningThought(t))
  const cardNotes = openThoughts.filter(
    (t) => t.parent.kind !== 'scripture' && !isListeningThought(t),
  )
  const scriptureNotes = scriptureThoughts.length
  const listeningNotes = listeningThoughts.length
  const keepNotes = cardNotes.length
  const canShareAll = openThoughts.length > 0 || ideas.length > 0

  // One panel per audio card, holding every clip stamp saved on it
  const listeningGroups = [
    ...listeningThoughts
      .reduce((map, t) => {
        const group = map.get(t.parent.id)
        if (group) group.push(t)
        else map.set(t.parent.id, [t])
        return map
      }, new Map<string, Thought[]>())
      .values(),
  ]

  return (
    <div className="kept">
      <header className="kept-head">
        <h1>Kept ideas</h1>
        <p>
          {empty
            ? 'Keep anything from the feed with a note — share to Evernote, or export seeds for draft:ideas.'
            : [
                ideas.length > 0
                  ? `${ideas.length} idea${ideas.length === 1 ? '' : 's'}`
                  : null,
                openThoughts.length > 0
                  ? `${openThoughts.length} thought${openThoughts.length === 1 ? '' : 's'}`
                  : null,
                approvedCount > 0
                  ? `${approvedCount} approved draft${approvedCount === 1 ? '' : 's'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') + ' saved on this device.'}
        </p>
        {(canShareAll || thoughts.length > 0 || approvedCount > 0) && (
          <div className="kept-tools">
            {canShareAll && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  void runShare('all', () =>
                    shareAllKept({ thoughts: openThoughts, ideas }),
                  )
                }
              >
                {labelFor('all', 'Share all')}
              </button>
            )}
            {thoughts.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  downloadJson(
                    `thinker-thought-seeds-${new Date().toISOString().slice(0, 10)}.json`,
                    { exportedAt: new Date().toISOString(), seeds: exportSeeds() },
                  )
                }
              >
                Export seeds for draft:ideas
              </button>
            )}
            {approvedCount > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  downloadJson(
                    `thinker-approved-drafts-${new Date().toISOString().slice(0, 10)}.json`,
                    exportApproved(),
                  )
                }
              >
                Export approved drafts for promote
              </button>
            )}
          </div>
        )}
        {pendingCount > 0 && (
          <p className="kept-pending">
            {pendingCount} LLM draft{pendingCount === 1 ? '' : 's'} waiting in the{' '}
            <Link to="/feed">feed</Link> for Approve / Deny.
          </p>
        )}
      </header>

      {empty ? (
        <div className="kept-empty">
          <p>Nothing kept yet.</p>
          <Link to="/feed" className="btn btn-primary">
            Open feed
          </Link>
        </div>
      ) : (
        <>
          {openThoughts.length > 0 && (
            <section className="kept-moments">
              <h2>Thoughts</h2>
              <p className="kept-moments-lead">
                Edit here, then promote to an idea card. To change a promoted one, send it back
                with “Back to thought” on the card. Only one form at a time.
                {listeningNotes + scriptureNotes + keepNotes > 0 && (
                  <>
                    {' '}
                    (
                    {[
                      keepNotes > 0 ? `${keepNotes} kept` : null,
                      listeningNotes > 0 ? `${listeningNotes} listening` : null,
                      scriptureNotes > 0 ? `${scriptureNotes} scripture` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    )
                  </>
                )}
              </p>
              <ul className="kept-moment-list">
                {cardNotes.map((t) => (
                  <KeptNoteRow key={t.id} thought={t} />
                ))}
                {listeningGroups.map((group) => (
                  <KeptMomentGroup key={group[0].parent.id} thoughts={group} />
                ))}
                {scriptureThoughts.map((t) => (
                  <KeptNoteRow key={t.id} thought={t} />
                ))}
              </ul>
            </section>
          )}

          {ideas.length > 0 && (
            <section className="kept-ideas">
              {openThoughts.length > 0 && <h2>Kept cards</h2>}
              <div className="kept-grid">
                {ideas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} compact />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
