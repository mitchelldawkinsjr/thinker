#!/usr/bin/env node
/**
 * Promote reviewed draft Idea cards into public/content/ideas.json (rotate pool).
 * Does not touch src/data/ideas.ts or ideaDepth.ts.
 *
 * Usage:
 *   node scripts/promote-ideas.mjs scripts/drafts/ideas-football-film-2026-07-24.json --ids draft-foo,draft-bar
 *   node scripts/promote-ideas.mjs scripts/drafts/ideas-football-film-2026-07-24.json --all
 *   node scripts/promote-ideas.mjs ~/Downloads/thinker-approved-drafts-2026-07-25.json --all
 *   node scripts/promote-ideas.mjs public/content/idea-drafts.json --ids id1,id2
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'content', 'ideas.json')
const DRAFT_QUEUE = join(ROOT, 'public', 'content', 'idea-drafts.json')
const TTL_DAYS = 21
const DAY_MS = 24 * 60 * 60 * 1000

const TOPIC_IDS = new Set([
  'ai-agents',
  'llms-prompting',
  'rag-context',
  'ai-frontend',
  'nba-analytics',
  'wnba',
  'football-film',
  'sports-biz',
  'current-events',
  'history',
  'politics',
  'finance',
  'mental-models',
  'building-products',
])

const SOURCE_TYPES = new Set(['book', 'article', 'podcast', 'research', 'practice', 'site'])

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {string | null} */
  let file = null
  /** @type {string[] | null} */
  let ids = null
  let all = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--ids' && argv[i + 1]) {
      ids = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (a === '--all') {
      all = true
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  node scripts/promote-ideas.mjs <draft-or-approved.json> --all
  node scripts/promote-ideas.mjs <draft-or-approved.json> --ids id1,id2

Approved exports from Kept (Export approved drafts for promote) work with --all.`)
      process.exit(0)
    } else if (!a.startsWith('-')) {
      file = a
    }
  }

  return { file, ids, all }
}

/**
 * @param {unknown} raw
 * @param {string} ingestedAt
 * @param {string} expiresAt
 */
function normalizeIdea(raw, ingestedAt, expiresAt) {
  if (!raw || typeof raw !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (raw)
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const topicId = typeof o.topicId === 'string' ? o.topicId.trim() : ''
  const title = typeof o.title === 'string' ? o.title.trim() : ''
  const body = typeof o.body === 'string' ? o.body.trim() : ''
  const source = typeof o.source === 'string' ? o.source.trim() : ''
  const sourceType = typeof o.sourceType === 'string' ? o.sourceType.trim() : ''
  if (!id || !title || !body || !source) return null
  if (!TOPIC_IDS.has(topicId)) return null
  if (!SOURCE_TYPES.has(sourceType)) return null

  /** @type {Record<string, unknown>} */
  const idea = {
    id,
    topicId,
    title,
    body,
    source,
    sourceType,
    readMinutes: Number(o.readMinutes) === 1 ? 1 : 2,
    ingestedAt,
    expiresAt,
  }
  if (typeof o.hook === 'string' && o.hook.trim()) idea.hook = o.hook.trim()
  if (typeof o.lesson === 'string' && o.lesson.trim()) idea.lesson = o.lesson.trim()
  if (typeof o.takeaway === 'string' && o.takeaway.trim()) idea.takeaway = o.takeaway.trim()
  if (typeof o.example === 'string' && o.example.trim()) idea.example = o.example.trim()
  if (typeof o.sourceUrl === 'string' && /^https:\/\//i.test(o.sourceUrl.trim())) {
    idea.sourceUrl = o.sourceUrl.trim()
  }
  return idea
}

/** @param {{ expiresAt?: string }} item @param {number} now */
function isActive(item, now) {
  if (!item.expiresAt) return true
  const exp = Date.parse(item.expiresAt)
  if (Number.isNaN(exp)) return true
  return exp > now
}

async function main() {
  const { file, ids, all } = parseArgs(process.argv.slice(2))
  if (!file) {
    console.error('Pass a draft JSON path. See --help.')
    process.exit(1)
  }
  if (!all && (!ids || ids.length === 0)) {
    console.error('Pass --all or --ids id1,id2 (refuse to promote without an explicit selection).')
    process.exit(1)
  }

  const draftPath = resolve(file)
  const draft = JSON.parse(await readFile(draftPath, 'utf8'))
  const draftItems = Array.isArray(draft.items) ? draft.items : []
  if (draftItems.length === 0) {
    console.error('Draft file has no items.')
    process.exit(1)
  }

  const idSet = all ? null : new Set(ids)
  const now = Date.now()
  const ingestedAt = new Date(now).toISOString()
  const expiresAt = new Date(now + TTL_DAYS * DAY_MS).toISOString()

  /** @type {object[]} */
  const promoted = []
  for (const raw of draftItems) {
    if (idSet && !idSet.has(raw?.id)) continue
    const idea = normalizeIdea(raw, ingestedAt, expiresAt)
    if (!idea) {
      console.warn(`  skip invalid: ${raw?.id ?? '?'}`)
      continue
    }
    promoted.push(idea)
  }

  if (promoted.length === 0) {
    console.error('No ideas selected/valid to promote.')
    process.exit(1)
  }

  /** @type {{ updatedAt?: string, items?: object[], ttlDays?: number, source?: string }} */
  let live = { updatedAt: ingestedAt, ttlDays: TTL_DAYS, items: [], source: 'llm-draft-promote' }
  try {
    live = JSON.parse(await readFile(OUT, 'utf8'))
  } catch {
    // first promote
  }

  const byId = new Map()
  for (const item of live.items ?? []) {
    if (isActive(item, now)) byId.set(item.id, item)
  }
  for (const idea of promoted) {
    byId.set(idea.id, idea)
  }

  const next = {
    updatedAt: ingestedAt,
    source: live.source || 'llm-draft-promote',
    ttlDays: TTL_DAYS,
    items: [...byId.values()],
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  console.log(
    `Promoted ${promoted.length} → ${OUT} (${next.items.length} active in pool, TTL ${TTL_DAYS}d)`,
  )

  // Drop promoted ids from the in-feed review queue
  const promotedIds = new Set(promoted.map((p) => p.id))
  try {
    const queue = JSON.parse(await readFile(DRAFT_QUEUE, 'utf8'))
    const remaining = (queue.items ?? []).filter((item) => !promotedIds.has(item?.id))
    if (remaining.length !== (queue.items ?? []).length) {
      await writeFile(
        DRAFT_QUEUE,
        `${JSON.stringify(
          {
            updatedAt: ingestedAt,
            source: queue.source || 'llm-draft-queue',
            items: remaining,
          },
          null,
          2,
        )}\n`,
        'utf8',
      )
      console.log(
        `Pruned review queue → ${DRAFT_QUEUE} (${remaining.length} still pending)`,
      )
    }
  } catch {
    // no queue file
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
