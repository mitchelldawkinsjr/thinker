import { clearSeen } from './feedRotation'

const DAY_KEY = 'thinker-day-v1'
const CURSOR_KEY = 'thinker-day-cursor-v1'

type DayCursor = {
  day: string
  topic: string | null
  index: number
}

/** Local calendar day key (YYYY-MM-DD). */
export function localDayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * If the calendar day changed since last open, wipe same-day memory (seen + cursor).
 * Kept / hidden stay — bookmarks and permanent dismissals survive overnight.
 */
export function ensureFreshDay(): { day: string; rolled: boolean } {
  const today = localDayKey()
  try {
    const prev = localStorage.getItem(DAY_KEY)
    if (prev === today) return { day: today, rolled: false }
    localStorage.setItem(DAY_KEY, today)
    clearSeen()
    localStorage.removeItem(CURSOR_KEY)
    return { day: today, rolled: true }
  } catch {
    return { day: today, rolled: false }
  }
}

function loadCursor(): DayCursor | null {
  try {
    const raw = localStorage.getItem(CURSOR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DayCursor>
    if (typeof parsed.day !== 'string' || typeof parsed.index !== 'number') return null
    const topic =
      parsed.topic === null || typeof parsed.topic === 'string' ? parsed.topic : null
    return { day: parsed.day, topic, index: Math.max(0, Math.floor(parsed.index)) }
  } catch {
    return null
  }
}

function saveCursor(cursor: DayCursor) {
  try {
    localStorage.setItem(CURSOR_KEY, JSON.stringify(cursor))
  } catch {
    // ignore quota
  }
}

/** Restore today’s card index for this topic (0 if new day / different topic). */
export function getFeedCursor(topic: string | null): number {
  const { day } = ensureFreshDay()
  const cursor = loadCursor()
  if (!cursor || cursor.day !== day) return 0
  if (cursor.topic !== topic) return 0
  return cursor.index
}

export function setFeedCursor(topic: string | null, index: number) {
  const { day } = ensureFreshDay()
  saveCursor({
    day,
    topic,
    index: Math.max(0, Math.floor(index)),
  })
}

/** Home CTA: continue if we left mid-feed today. */
export function peekContinue(): { index: number; topic: string | null } | null {
  const { day } = ensureFreshDay()
  const cursor = loadCursor()
  if (!cursor || cursor.day !== day || cursor.index <= 0) return null
  return { index: cursor.index, topic: cursor.topic }
}
