import type { Topic, TopicId } from './types'
import { catalogTopics, isCatalogTopicId } from './topics'

export const USER_TOPICS_KEY = 'thinker-user-topics-v1'
export const MAX_CUSTOM_TOPICS = 24

export type TopicOverride = {
  name?: string
  tagline?: string
  description?: string
  color?: string
  accent?: string
  /** Hide from browse / follow without deleting the catalog entry */
  hidden?: boolean
}

export type UserTopicsState = {
  /** Field overrides + hide flags for catalog (and optionally custom) topics */
  overrides: Record<string, TopicOverride>
  /** User-created topics */
  custom: Topic[]
}

export const EMPTY_USER_TOPICS: UserTopicsState = {
  overrides: {},
  custom: [],
}

/** Palette cycled when adding a custom topic */
export const TOPIC_PALETTE: { color: string; accent: string }[] = [
  { color: '#1a2332', accent: '#3d9cf0' },
  { color: '#1f1a2e', accent: '#a78bfa' },
  { color: '#14241f', accent: '#34d399' },
  { color: '#2a1f18', accent: '#fb923c' },
  { color: '#2a1824', accent: '#f472b6' },
  { color: '#1c2418', accent: '#84cc16' },
  { color: '#241c14', accent: '#fbbf24' },
  { color: '#221a1a', accent: '#f87171' },
]

function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
}

function normalizeOverride(raw: unknown): TopicOverride | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const next: TopicOverride = {}
  if (typeof o.name === 'string' && o.name.trim()) next.name = o.name.trim()
  if (typeof o.tagline === 'string') next.tagline = o.tagline.trim()
  if (typeof o.description === 'string') next.description = o.description.trim()
  if (isHexColor(o.color)) next.color = o.color
  if (isHexColor(o.accent)) next.accent = o.accent
  if (typeof o.hidden === 'boolean') next.hidden = o.hidden
  return Object.keys(next).length ? next : null
}

function normalizeCustomTopic(raw: unknown): Topic | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id.trim()) return null
  if (typeof o.name !== 'string' || !o.name.trim()) return null
  if (isCatalogTopicId(o.id)) return null
  const palette = TOPIC_PALETTE[0]
  return {
    id: o.id.trim(),
    name: o.name.trim(),
    tagline: typeof o.tagline === 'string' ? o.tagline.trim() : 'Custom topic',
    description:
      typeof o.description === 'string'
        ? o.description.trim()
        : 'A topic you added for your Thinker mix.',
    color: isHexColor(o.color) ? o.color : palette.color,
    accent: isHexColor(o.accent) ? o.accent : palette.accent,
  }
}

export function normalizeUserTopics(raw: unknown): UserTopicsState {
  if (!raw || typeof raw !== 'object') return structuredClone(EMPTY_USER_TOPICS)
  const o = raw as Record<string, unknown>
  const overridesIn =
    o.overrides && typeof o.overrides === 'object'
      ? (o.overrides as Record<string, unknown>)
      : {}
  const overrides: Record<string, TopicOverride> = {}
  for (const [id, value] of Object.entries(overridesIn)) {
    const n = normalizeOverride(value)
    if (n) overrides[id] = n
  }
  const custom = Array.isArray(o.custom)
    ? o.custom.map(normalizeCustomTopic).filter((t): t is Topic => t !== null)
    : []
  // Dedupe custom by id
  const byId = new Map<string, Topic>()
  for (const t of custom) byId.set(t.id, t)
  return { overrides, custom: [...byId.values()] }
}

export function loadUserTopics(): UserTopicsState {
  try {
    const raw = localStorage.getItem(USER_TOPICS_KEY)
    if (!raw) return structuredClone(EMPTY_USER_TOPICS)
    return normalizeUserTopics(JSON.parse(raw))
  } catch {
    return structuredClone(EMPTY_USER_TOPICS)
  }
}

export function saveUserTopics(state: UserTopicsState) {
  try {
    localStorage.setItem(USER_TOPICS_KEY, JSON.stringify(state))
  } catch {
    // ignore quota
  }
}

function applyOverride(topic: Topic, override?: TopicOverride): Topic {
  if (!override) return topic
  return {
    ...topic,
    name: override.name ?? topic.name,
    tagline: override.tagline ?? topic.tagline,
    description: override.description ?? topic.description,
    color: override.color ?? topic.color,
    accent: override.accent ?? topic.accent,
  }
}

/**
 * Merge catalog + custom topics with overrides.
 * @param includeHidden when false, drops hidden catalog topics (default for UI lists)
 */
export function resolveTopics(
  state: UserTopicsState,
  includeHidden = false,
): Topic[] {
  const catalog = catalogTopics.map((t) => {
    const ov = state.overrides[t.id]
    return applyOverride(t, ov)
  })
  const visibleCatalog = includeHidden
    ? catalog
    : catalog.filter((t) => !state.overrides[t.id]?.hidden)

  const custom = state.custom.map((t) => applyOverride(t, state.overrides[t.id]))
  const byId = new Map<string, Topic>()
  for (const t of [...visibleCatalog, ...custom]) byId.set(t.id, t)
  return [...byId.values()]
}

export function resolveTopic(
  state: UserTopicsState,
  id: string,
): Topic | undefined {
  return resolveTopics(state, true).find((t) => t.id === id)
}

export function slugifyTopicId(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'topic'
}

export function newCustomTopicId(name: string, existing: Set<string>): TopicId {
  const base = `user-${slugifyTopicId(name)}`
  if (!existing.has(base) && !isCatalogTopicId(base)) return base
  for (let i = 2; i < 100; i++) {
    const id = `${base}-${i}`
    if (!existing.has(id)) return id
  }
  return `user-${crypto.randomUUID().slice(0, 8)}`
}

export function paletteForIndex(index: number) {
  return TOPIC_PALETTE[index % TOPIC_PALETTE.length]
}
