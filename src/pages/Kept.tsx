import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useKept } from '../hooks/useKept'
import { useThoughts } from '../hooks/useThoughts'
import { useDraftReview } from '../hooks/useDraftReview'
import { useKeepStack } from '../hooks/useKeepStack'
import { getIdea } from '../data/ideas'
import { getTopic } from '../data/topics'
import { formatAudioTime, isListeningThought, isSeedableThought, type Thought } from '../data/thoughts'
import {
  shareAllKept,
  shareStatusLabel,
  shareThought,
  type ShareResult,
} from '../lib/exportThought'
import {
  fetchGithubQueueStatus,
  loadQueueSecret,
  openIdeaLoopPullRequest,
} from '../lib/githubQueue'
import { useExtraIdeas } from '../hooks/useExtraIdeas'
import { useZettel } from '../hooks/useZettel'
import { IdeaCard } from '../components/IdeaCard'
import { CardFlip, CardNoteBack } from '../components/CardFlip'
import { sourceMediaParts } from '../components/CardMedia'
import { ZettelStack } from '../components/ZettelStack'
import { ZettelEditor } from '../components/ZettelEditor'
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
function KeptNoteRow({
  thought,
  onOpenStack,
}: {
  thought: Thought
  onOpenStack: (thought: Thought) => void
}) {
  const { promote, remove, updateNote } = useThoughts()
  const { keepToStack } = useKeepStack()
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
                on {thought.parent.title}
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
                'No note yet — open the stack to connect it, or promote to an idea card.'}
            </p>
            <div className="kept-moment-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onOpenStack(thought)}
              >
                Open stack
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  const idea = promote(thought.id)
                  if (idea) {
                    keepToStack(
                      { ...thought, promotedIdeaId: idea.id },
                      { land: false },
                    )
                    onOpenStack({ ...thought, promotedIdeaId: idea.id })
                  }
                }}
              >
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
              const trimmed = note.trim()
              if (promoteIt) {
                const idea = promote(thought.id, note)
                const next = {
                  ...thought,
                  note: trimmed,
                  promotedIdeaId: idea?.id ?? `thought-${thought.id}`,
                }
                keepToStack(next, { land: false })
                onOpenStack(next)
              } else {
                updateNote(thought.id, note)
                keepToStack({ ...thought, note: trimmed }, { land: false })
              }
            }}
          />
        }
      />
    </li>
  )
}

/** All open clip stamps for one audio card: one player, many stamps */
function KeptMomentGroup({
  thoughts,
  onOpenStack,
}: {
  thoughts: Thought[]
  onOpenStack: (thought: Thought) => void
}) {
  const { promote, remove, updateNote } = useThoughts()
  const { keepToStack } = useKeepStack()
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
                      onClick={() => onOpenStack(t)}
                    >
                      Stack
                    </button>
                    <button
                      type="button"
                      className="kept-stamp-btn"
                      onClick={() => {
                        const idea = promote(t.id)
                        if (idea) {
                          const next = { ...t, promotedIdeaId: idea.id }
                          keepToStack(next, { land: false })
                          onOpenStack(next)
                        }
                      }}
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
              const trimmed = note.trim()
              if (promoteIt) {
                const idea = promote(editing.id, note)
                const next = {
                  ...editing,
                  note: trimmed,
                  promotedIdeaId: idea?.id ?? `thought-${editing.id}`,
                }
                keepToStack(next, { land: false })
                onOpenStack(next)
              } else {
                updateNote(editing.id, note)
                keepToStack({ ...editing, note: trimmed }, { land: false })
              }
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
  const { thoughts, exportSeeds, markSeedsSent, reopenSeeds } = useThoughts()
  const { exportApproved, pendingCount, approved } = useDraftReview()
  const { notes, links, exportBox, importBox, linkedIds, orphans, tags } = useZettel()
  const { keepToStack } = useKeepStack()
  const [searchParams, setSearchParams] = useSearchParams()
  const approvedCount = Object.keys(approved).length
  const { items: extraIdeas } = useExtraIdeas()
  const { runShare, labelFor } = useShareBusy()
  const ideas = [...kept]
    .map((id) => getIdea(id, extraIdeas))
    .filter((i): i is NonNullable<typeof i> => Boolean(i))
  const [toolsOpen, setToolsOpen] = useState(false)

  const [queueReady, setQueueReady] = useState(false)
  const [queueBusy, setQueueBusy] = useState<'seeds' | 'promote' | null>(null)
  const [queueMessage, setQueueMessage] = useState<string | null>(null)
  const [queuePrUrl, setQueuePrUrl] = useState<string | null>(null)
  const [stackRootId, setStackRootId] = useState<string | null>(null)
  const [startConnecting, setStartConnecting] = useState(false)
  const [editingId, setEditingId] = useState<string | null | 'new'>(null)
  const [slipFilter, setSlipFilter] = useState<'all' | 'orphans' | string>('all')
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const landedFromUrl = useRef(false)

  useEffect(() => {
    void fetchGithubQueueStatus().then((s) => setQueueReady(s.configured))
  }, [])

  async function sendToIdeaLoop(kind: 'seeds' | 'promote') {
    setQueueBusy(kind)
    setQueueMessage(null)
    setQueuePrUrl(null)
    try {
      if (!loadQueueSecret()) {
        setQueueMessage('Add the idea-loop gate secret in Settings first.')
        return
      }
      const stamp = new Date().toISOString().slice(0, 10)
      if (kind === 'seeds') {
        const seeds = exportSeeds()
        if (seeds.length === 0) {
          setQueueMessage('No open seeds to send — inbox is empty or already queued.')
          return
        }
        const result = await openIdeaLoopPullRequest({
          kind: 'seeds',
          filename: `thinker-thought-seeds-${stamp}.json`,
          payload: { exportedAt: new Date().toISOString(), seeds },
        })
        setQueuePrUrl(result.prUrl)
        markSeedsSent(
          seeds
            .map((s) => s.thoughtId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        )
        if (result.mergeError) {
          setQueueMessage(
            result.prUrl
              ? `PR opened but auto-merge failed: ${result.mergeError}`
              : `Queued on ${result.branch} but auto-merge failed: ${result.mergeError}`,
          )
        } else {
          setQueueMessage(
            result.prUrl
              ? `Sent ${seeds.length} seed${seeds.length === 1 ? '' : 's'} — PR auto-merging; they’ll return when you Keep a From-loop card.`
              : `Sent ${seeds.length} seed${seeds.length === 1 ? '' : 's'} on ${result.branch} — auto-merging.`,
          )
        }
        return
      }

      const result = await openIdeaLoopPullRequest({
        kind: 'promote',
        filename: `thinker-approved-drafts-${stamp}.json`,
        payload: exportApproved(),
      })
      setQueuePrUrl(result.prUrl)
      if (result.mergeError) {
        setQueueMessage(
          result.prUrl
            ? `PR opened but auto-merge failed: ${result.mergeError}`
            : `Queued on ${result.branch} but auto-merge failed: ${result.mergeError}`,
        )
      } else {
        setQueueMessage(
          result.prUrl
            ? 'PR opened and auto-merging — the next Action runs on main.'
            : `Queued on ${result.branch} and auto-merging.`,
        )
      }
    } catch (err) {
      setQueueMessage(err instanceof Error ? err.message : 'Could not open PR')
    } finally {
      setQueueBusy(null)
    }
  }

  // Inbox = not attached and not queued; in-flight waits for Keep / Reject
  const openThoughts = thoughts.filter(isSeedableThought)
  const inFlightThoughts = thoughts.filter((t) => !t.promotedIdeaId && Boolean(t.sentAt))
  const seedableCount = openThoughts.length
  const empty =
    ideas.length === 0 &&
    thoughts.length === 0 &&
    approvedCount === 0 &&
    notes.length === 0
  const scriptureThoughts = openThoughts.filter((t) => t.parent.kind === 'scripture')
  const listeningThoughts = openThoughts.filter((t) => isListeningThought(t))
  const cardNotes = openThoughts.filter(
    (t) => t.parent.kind !== 'scripture' && !isListeningThought(t),
  )

  // Land from Keep: /kept?stack=…&connect=1
  useEffect(() => {
    const stackParam = searchParams.get('stack')
    if (!stackParam) return
    setStackRootId(stackParam)
    setStartConnecting(searchParams.get('connect') === '1')
    landedFromUrl.current = true
    // Clear query so refresh doesn't keep forcing connect mode
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  // startConnecting is a one-shot cue for ZettelStack
  useEffect(() => {
    if (!startConnecting) return
    const t = window.setTimeout(() => setStartConnecting(false), 800)
    return () => window.clearTimeout(t)
  }, [startConnecting, stackRootId])

  useEffect(() => {
    if (landedFromUrl.current && stackRootId) return
    if (stackRootId && notes.some((n) => n.id === stackRootId)) return
    if (notes.length > 0) setStackRootId(notes[0].id)
    else setStackRootId(null)
  }, [notes, stackRootId])

  const filteredNotes = useMemo(() => {
    if (slipFilter === 'all') return notes
    if (slipFilter === 'orphans') return orphans
    return notes.filter((n) => (n.tags ?? []).includes(slipFilter))
  }, [notes, orphans, slipFilter])

  useEffect(() => {
    if (landedFromUrl.current && stackRootId) return
    if (filteredNotes.length === 0) return
    if (stackRootId && filteredNotes.some((n) => n.id === stackRootId)) return
    setStackRootId(filteredNotes[0].id)
  }, [filteredNotes, stackRootId])

  const openStackForThought = (thought: Thought) => {
    const z = keepToStack(thought, { land: false })
    setStackRootId(z.id)
    setStartConnecting(false)
    landedFromUrl.current = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onImportFile(file: File) {
    setImportMessage(null)
    try {
      const text = await file.text()
      const raw = JSON.parse(text) as unknown
      const result = importBox(raw)
      if (!result.ok) {
        setImportMessage(result.error)
        return
      }
      setImportMessage(
        `Imported — ${result.addedNotes} new note${result.addedNotes === 1 ? '' : 's'}, ${result.addedLinks} new link${result.addedLinks === 1 ? '' : 's'} (existing ids updated).`,
      )
    } catch {
      setImportMessage('Could not read that file as JSON.')
    }
  }
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
        <h1>Kept</h1>
        <p>
          {empty
            ? 'Keep from the feed — your note stacks on the source. Connect more from here.'
            : [
                notes.length > 0
                  ? `${notes.length} in stack${notes.length === 1 ? '' : 's'}`
                  : null,
                links.length > 0
                  ? `${links.length} link${links.length === 1 ? '' : 's'}`
                  : null,
                openThoughts.length > 0
                  ? `${openThoughts.length} inbox`
                  : null,
                ideas.length > 0
                  ? `${ideas.length} idea card${ideas.length === 1 ? '' : 's'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') + ' on this device.'}
        </p>
        <div className="kept-tools">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditingId('new')}
          >
            New note
          </button>
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
          <button
            type="button"
            className="btn btn-ghost"
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen((o) => !o)}
          >
            {toolsOpen ? 'Hide tools' : 'More tools'}
          </button>
        </div>
        {toolsOpen && (
          <div className="kept-tools kept-tools--secondary">
            {notes.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  downloadJson(
                    `thinker-zettelkasten-${new Date().toISOString().slice(0, 10)}.json`,
                    exportBox(),
                  )
                }
              >
                Export slip box
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => importRef.current?.click()}
            >
              Import slip box
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void onImportFile(file)
              }}
            />
            {seedableCount > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={queueBusy !== null || !queueReady}
                  title={
                    queueReady
                      ? 'Open a GitHub PR that queues these seeds (auto-merges)'
                      : 'Server idea-loop not configured yet'
                  }
                  onClick={() => void sendToIdeaLoop('seeds')}
                >
                  {queueBusy === 'seeds' ? 'Opening PR…' : 'Send seeds to idea loop'}
                </button>
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
                  Download seeds JSON
                </button>
              </>
            )}
            {approvedCount > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={queueBusy !== null || !queueReady}
                  title={
                    queueReady
                      ? 'Fallback if Keep in the feed did not auto-queue promote'
                      : 'Server idea-loop not configured yet'
                  }
                  onClick={() => void sendToIdeaLoop('promote')}
                >
                  {queueBusy === 'promote' ? 'Opening PR…' : 'Retry promote queue'}
                </button>
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
                  Download approved JSON
                </button>
              </>
            )}
            {(seedableCount > 0 || approvedCount > 0 || inFlightThoughts.length > 0) && (
              <p className="kept-pending">
                {queueReady ? (
                  <>
                    Send seeds queues the inbox only (Kept bookmarks stay). After Keep on a
                    From-loop card, seeds attach under that idea; Reject returns them here.
                    Gate secret lives in <Link to="/settings">Settings</Link>.
                  </>
                ) : (
                  <>
                    Idea-loop server not configured yet — use Download JSON, or set{' '}
                    <code>GITHUB_TOKEN</code> + <code>QUEUE_SECRET</code> on the VPS (see README).
                  </>
                )}
              </p>
            )}
          </div>
        )}
        {importMessage && (
          <p className="kept-pending" role="status">
            {importMessage}
          </p>
        )}
        {queueMessage && (
          <p className="kept-pending" role="status">
            {queueMessage}
            {queuePrUrl ? (
              <>
                {' '}
                <a href={queuePrUrl} target="_blank" rel="noreferrer">
                  Open PR
                </a>
              </>
            ) : null}
          </p>
        )}
        {inFlightThoughts.length > 0 && (
          <p className="kept-pending" role="status">
            {inFlightThoughts.length} seed{inFlightThoughts.length === 1 ? '' : 's'} in the idea
            loop — Keep a From-loop card to attach, or{' '}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ display: 'inline', padding: '0 0.25em', minHeight: 0 }}
              onClick={() => reopenSeeds(inFlightThoughts.map((t) => t.id))}
            >
              return to inbox
            </button>{' '}
            to edit and resend.
          </p>
        )}
        {pendingCount > 0 && (
          <p className="kept-pending">
            {pendingCount} from the loop waiting in the <Link to="/feed">feed</Link> for Keep /
            Reject.
          </p>
        )}
      </header>

      {editingId !== null && (
        <section className="kept-editor">
          <ZettelEditor
            noteId={editingId === 'new' ? null : editingId}
            onClose={() => setEditingId(null)}
            onSaved={(id) => {
              setStackRootId(id)
              if (editingId === 'new') setEditingId(id)
            }}
          />
        </section>
      )}

      {empty ? (
        <div className="kept-empty">
          <p>Nothing kept yet — open the feed, or write a note.</p>
          <div className="kept-tools">
            <Link to="/feed" className="btn btn-primary">
              Open feed
            </Link>
            <button type="button" className="btn btn-ghost" onClick={() => setEditingId('new')}>
              New note
            </button>
          </div>
        </div>
      ) : (
        <>
          {(notes.length > 0 || editingId !== null) && (
            <section className="kept-stream">
              <h2>Stack</h2>
              <p className="kept-moments-lead">
                Your note on front, source behind. Connect other thoughts or Build on this one.
              </p>

              {notes.length > 0 && (
                <div className="kept-slip-filters">
                  <button
                    type="button"
                    className={slipFilter === 'all' ? 'kept-filter is-active' : 'kept-filter'}
                    onClick={() => setSlipFilter('all')}
                  >
                    All ({notes.length})
                  </button>
                  <button
                    type="button"
                    className={slipFilter === 'orphans' ? 'kept-filter is-active' : 'kept-filter'}
                    onClick={() => setSlipFilter('orphans')}
                  >
                    Orphans ({orphans.length})
                  </button>
                  {tags.map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      className={slipFilter === t.tag ? 'kept-filter is-active' : 'kept-filter'}
                      onClick={() => setSlipFilter(t.tag)}
                    >
                      #{t.tag} ({t.count})
                    </button>
                  ))}
                </div>
              )}

              {stackRootId && notes.some((n) => n.id === stackRootId) ? (
                <ZettelStack
                  rootId={stackRootId}
                  startConnecting={startConnecting}
                  onEdit={(id) => setEditingId(id)}
                  onBuilt={(id) => {
                    setStackRootId(id)
                    setStartConnecting(false)
                  }}
                />
              ) : notes.length > 0 && editingId === null ? (
                <p className="kept-pending">
                  {slipFilter === 'orphans'
                    ? 'No orphans — every note has at least one link.'
                    : slipFilter !== 'all'
                      ? `No notes tagged #${slipFilter}.`
                      : 'No notes yet — tap New note to start.'}
                </p>
              ) : null}

              {filteredNotes.length > 1 && (
                <ul className="kept-zettel-index">
                  {filteredNotes.map((n) => {
                    const nLinks = linkedIds(n.id).length
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          className={
                            n.id === stackRootId
                              ? 'kept-zettel-index-btn is-active'
                              : 'kept-zettel-index-btn'
                          }
                          onClick={() => {
                            setStackRootId(n.id)
                            setStartConnecting(false)
                          }}
                        >
                          <span>
                            {n.title}
                            {(n.tags?.length ?? 0) > 0 && (
                              <span className="kept-zettel-index-tags">
                                {' '}
                                {(n.tags ?? []).map((t) => `#${t}`).join(' ')}
                              </span>
                            )}
                          </span>
                          {nLinks > 0 ? (
                            <span className="kept-zettel-index-meta">{nLinks}</span>
                          ) : (
                            <span className="kept-zettel-index-meta kept-zettel-index-meta--orphan">
                              orphan
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

          {openThoughts.length > 0 && (
            <section className="kept-moments">
              <h2>Inbox</h2>
              <p className="kept-moments-lead">
                Open thoughts waiting to grow — open a stack to connect, or promote to an idea
                card.
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
                  <KeptNoteRow key={t.id} thought={t} onOpenStack={openStackForThought} />
                ))}
                {listeningGroups.map((group) => (
                  <KeptMomentGroup
                    key={group[0].parent.id}
                    thoughts={group}
                    onOpenStack={openStackForThought}
                  />
                ))}
                {scriptureThoughts.map((t) => (
                  <KeptNoteRow key={t.id} thought={t} onOpenStack={openStackForThought} />
                ))}
              </ul>
            </section>
          )}

          {ideas.length > 0 && (
            <section className="kept-stream">
              <h2>Idea cards</h2>
              <p className="kept-moments-lead">
                Promoted and bookmarked cards — use Back to thought when you want to edit again.
              </p>
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
