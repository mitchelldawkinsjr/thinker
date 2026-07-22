const STORAGE_KEY = 'thinker-feed-seen-v1'
const HIDDEN_KEY = 'thinker-feed-hidden-v1'
const HIDDEN_CAP = 2000

/** Cards seen within this window get a hard penalty so they don't reappear immediately */
const RECENT_HOURS = 18
const RECENT_PENALTY = 80
const COUNT_WEIGHT = 28
const DAY_DECAY = 3

type SeenMap = Record<string, { count: number; lastSeen: number }>

function load(): SeenMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as SeenMap
  } catch {
    return {}
  }
}

function save(map: SeenMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota
  }
}

/** Wipe same-day seen map (called when the local calendar day rolls). */
export function clearSeen() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function loadHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function saveHidden(ids: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore quota
  }
}

/** Permanently remove a card from the local feed pool (never show again on this device). */
export function hideFromPool(id: string) {
  const ids = loadHidden()
  ids.add(id)
  if (ids.size > HIDDEN_CAP) {
    const trimmed = [...ids].slice(ids.size - HIDDEN_CAP)
    saveHidden(new Set(trimmed))
    return
  }
  saveHidden(ids)
}

export function filterHidden<T extends { id: string }>(items: T[]): T[] {
  const hidden = loadHidden()
  if (hidden.size === 0) return items
  return items.filter((item) => !hidden.has(item.id))
}

/** Lower score = show sooner (unseen / stale first) */
export function freshnessScore(id: string, now = Date.now()): number {
  const entry = load()[id]
  if (!entry) return 0
  const ms = now - entry.lastSeen
  const days = ms / (1000 * 60 * 60 * 24)
  const hours = ms / (1000 * 60 * 60)
  let score = entry.count * COUNT_WEIGHT - days * DAY_DECAY
  if (hours < RECENT_HOURS) {
    score += RECENT_PENALTY * (1 - hours / RECENT_HOURS)
  }
  return score
}

export function sortByFreshness<T extends { id: string }>(items: T[]): T[] {
  const now = Date.now()
  return [...items].sort(
    (a, b) => freshnessScore(a.id, now) - freshnessScore(b.id, now),
  )
}

export function markSeen(id: string) {
  const map = load()
  const prev = map[id]
  map[id] = {
    count: (prev?.count ?? 0) + 1,
    lastSeen: Date.now(),
  }
  // Cap map size
  const ids = Object.keys(map)
  if (ids.length > 400) {
    ids
      .sort((a, b) => (map[a].lastSeen ?? 0) - (map[b].lastSeen ?? 0))
      .slice(0, ids.length - 400)
      .forEach((k) => delete map[k])
  }
  save(map)
}

/** Stable-ish daily shuffle seed (local calendar day). */
export function daySeed(extra = ''): number {
  const d = new Date()
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${extra}`
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
