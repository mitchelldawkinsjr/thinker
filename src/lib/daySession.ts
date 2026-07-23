import { clearSeen } from './feedRotation'

const DAY_KEY = 'thinker-day-v1'
const CURSOR_KEY = 'thinker-day-cursor-v1'
const ORDER_KEY = 'thinker-day-feed-order-v1'

type DayCursor = {
  day: string
  topic: string | null
  index: number
  /** Stable card id — preferred over index when the mix rebuilds */
  itemId?: string
}

type DayFeedOrder = {
  day: string
  topic: string | null
  reshuffle: number
  ids: string[]
}

/** Local calendar day key (YYYY-MM-DD). */
export function localDayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Accept legacy unpadded keys (`2026-7-22`) as the same day as `2026-07-22`. */
function normalizeDayKey(key: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key.trim())
  if (!m) return key
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

function sameDay(a: string, b: string): boolean {
  return normalizeDayKey(a) === normalizeDayKey(b)
}

function topicKey(topic: string | null | undefined): string | null {
  return topic ?? null
}

/**
 * If the calendar day changed since last open, wipe same-day memory (seen + cursor + order).
 * Kept / hidden stay — bookmarks and permanent dismissals survive overnight.
 */
export function ensureFreshDay(): { day: string; rolled: boolean } {
  const today = localDayKey()
  try {
    const prev = localStorage.getItem(DAY_KEY)
    if (prev && sameDay(prev, today)) {
      // Migrate legacy unpadded day keys without treating it as a new day
      if (prev !== today) localStorage.setItem(DAY_KEY, today)
      return { day: today, rolled: false }
    }
    localStorage.setItem(DAY_KEY, today)
    clearSeen()
    localStorage.removeItem(CURSOR_KEY)
    localStorage.removeItem(ORDER_KEY)
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
    const itemId = typeof parsed.itemId === 'string' ? parsed.itemId : undefined
    return {
      day: normalizeDayKey(parsed.day),
      topic,
      index: Math.max(0, Math.floor(parsed.index)),
      itemId,
    }
  } catch {
    return null
  }
}

function saveCursor(cursor: DayCursor) {
  try {
    localStorage.setItem(
      CURSOR_KEY,
      JSON.stringify({ ...cursor, day: normalizeDayKey(cursor.day) }),
    )
  } catch {
    // ignore quota
  }
}

function loadOrder(): DayFeedOrder | null {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DayFeedOrder>
    if (typeof parsed.day !== 'string' || !Array.isArray(parsed.ids)) return null
    if (typeof parsed.reshuffle !== 'number') return null
    const topic =
      parsed.topic === null || typeof parsed.topic === 'string' ? parsed.topic : null
    const ids = parsed.ids.filter((id): id is string => typeof id === 'string')
    return {
      day: normalizeDayKey(parsed.day),
      topic,
      reshuffle: Math.floor(parsed.reshuffle),
      ids,
    }
  } catch {
    return null
  }
}

function saveOrder(order: DayFeedOrder) {
  try {
    localStorage.setItem(
      ORDER_KEY,
      JSON.stringify({ ...order, day: normalizeDayKey(order.day) }),
    )
  } catch {
    // ignore quota
  }
}

/** Restore today’s card index for this topic (0 if new day / different topic). */
export function getFeedCursor(topic: string | null): number {
  const { day } = ensureFreshDay()
  const cursor = loadCursor()
  if (!cursor || !sameDay(cursor.day, day)) return 0
  if (cursor.topic !== topic) return 0
  return cursor.index
}

/** Card id saved with today’s cursor (if any). */
export function getFeedCursorItemId(topic: string | null): string | null {
  const { day } = ensureFreshDay()
  const cursor = loadCursor()
  if (!cursor || !sameDay(cursor.day, day)) return null
  if (cursor.topic !== topic) return null
  return cursor.itemId ?? null
}

export function setFeedCursor(topic: string | null, index: number, itemId?: string | null) {
  const { day } = ensureFreshDay()
  const cursor: DayCursor = {
    day,
    topic,
    index: Math.max(0, Math.floor(index)),
  }
  if (itemId) cursor.itemId = itemId
  saveCursor(cursor)
}

/**
 * Keep today’s feed order stable across remounts / async loads / freshness updates.
 * New cards append; Reshuffle (new reshuffle key) starts a fresh order.
 */
export function stabilizeFeedOrder<T extends { id: string }>(
  items: T[],
  topic: string | null | undefined,
  reshuffle: number,
): T[] {
  const { day } = ensureFreshDay()
  const topicVal = topicKey(topic)
  const saved = loadOrder()
  const byId = new Map(items.map((item) => [item.id, item]))

  if (
    saved &&
    sameDay(saved.day, day) &&
    saved.topic === topicVal &&
    saved.reshuffle === reshuffle &&
    saved.ids.length > 0
  ) {
    const ordered: T[] = []
    const seen = new Set<string>()
    for (const id of saved.ids) {
      const item = byId.get(id)
      if (!item || seen.has(id)) continue
      ordered.push(item)
      seen.add(id)
    }
    for (const item of items) {
      if (seen.has(item.id)) continue
      ordered.push(item)
      seen.add(item.id)
    }
    saveOrder({
      day,
      topic: topicVal,
      reshuffle,
      ids: ordered.map((item) => item.id),
    })
    return ordered
  }

  saveOrder({
    day,
    topic: topicVal,
    reshuffle,
    ids: items.map((item) => item.id),
  })
  return items
}

/** Home CTA: continue if we left mid-feed today. */
export function peekContinue(): { index: number; topic: string | null } | null {
  const { day } = ensureFreshDay()
  const cursor = loadCursor()
  if (!cursor || !sameDay(cursor.day, day) || cursor.index <= 0) return null
  return { index: cursor.index, topic: cursor.topic }
}
