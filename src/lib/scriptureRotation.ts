/**
 * Evergreen scriptures rotate in fixed cohorts:
 * a set stays active for WINDOW_DAYS, then rests until the cycle returns.
 * Larger pools → longer rest. Daily promises stay outside this rotation.
 */

export const EVERGREEN_WINDOW_DAYS = 5
/** How many evergreen cards are eligible during an active window */
export const EVERGREEN_SET_SIZE = 5

export function isDailyScripture(s: { id: string; pool?: string }): boolean {
  if (s.pool === 'daily') return true
  if (s.pool === 'evergreen') return false
  return /^blb-promise-doy-\d+$/.test(s.id)
}

/** Local calendar epoch-day (UTC midnight of local Y-M-D). */
export function localEpochDay(from = new Date()): number {
  return Math.floor(
    Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()) / 86_400_000,
  )
}

function sourceBucket(id: string): string {
  if (id.startsWith('blb-checkbook-')) return 'checkbook'
  if (id.startsWith('blb-morning-')) return 'morning'
  return 'curated'
}

/** Stable order that stripes curated / checkbook / morning for mixed sets. */
export function stripeEvergreenOrder<T extends { id: string }>(items: T[]): T[] {
  const buckets = new Map<string, T[]>()
  for (const item of items) {
    const key = sourceBucket(item.id)
    const list = buckets.get(key) ?? []
    list.push(item)
    buckets.set(key, list)
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id))
  }
  const keys = [...buckets.keys()].sort()
  const queues = keys.map((k) => buckets.get(k)!)
  const out: T[] = []
  let added = true
  while (added) {
    added = false
    for (const q of queues) {
      const next = q.shift()
      if (next) {
        out.push(next)
        added = true
      }
    }
  }
  return out
}

/**
 * Stable cohort of evergreen items for the current 5-day window.
 * Same pool + same local day → same set on every device.
 */
export function activeEvergreenScriptures<T extends { id: string }>(
  items: T[],
  from = new Date(),
  windowDays = EVERGREEN_WINDOW_DAYS,
  setSize = EVERGREEN_SET_SIZE,
): T[] {
  const ordered = stripeEvergreenOrder(items)
  const n = ordered.length
  if (n === 0) return []

  const size = Math.min(Math.max(1, setSize), n)
  const cohortCount = Math.ceil(n / size)
  const windowIndex = Math.floor(localEpochDay(from) / Math.max(1, windowDays))
  const cohortIndex = ((windowIndex % cohortCount) + cohortCount) % cohortCount
  const start = cohortIndex * size
  return ordered.slice(start, start + size)
}
