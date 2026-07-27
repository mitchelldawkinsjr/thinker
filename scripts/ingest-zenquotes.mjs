#!/usr/bin/env node
/**
 * Pull quote idea cards from ZenQuotes API.
 * Uses /api/quotes (50 random) + /api/today; cards link attribution to ZenQuotes
 * and point curiosity at the author’s Wikipedia page in the copy.
 * Writes public/content/zenquotes.json
 *
 * Usage: node scripts/ingest-zenquotes.mjs
 */
import { createHash } from 'node:crypto'
import dns from 'node:dns'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

dns.setDefaultResultOrder('ipv4first')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'content', 'zenquotes.json')
const BASE = 'https://zenquotes.io'
const UA = 'ThinkerZenQuotesBot/1.0 (+https://thinker.360web.cloud)'
/** Cap after dedupe (API returns 50; today may add one more) */
const MAX_CARDS = 40
const DELAY_MS = 6_500

/**
 * @typedef {{
 *   id: string,
 *   topicId: string,
 *   title: string,
 *   body: string,
 *   hook?: string,
 *   lesson?: string,
 *   takeaway?: string,
 *   example?: string,
 *   source: string,
 *   sourceType: 'site',
 *   sourceUrl: string,
 *   readMinutes: number,
 *   ingestedAt?: string,
 * }} Idea
 */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function clip(s, n) {
  const t = String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= n) return t
  const cut = t.slice(0, n - 1)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`
}

function wikiUrl(author) {
  const name = String(author || '').trim()
  if (!name || /^unknown$/i.test(name)) return `${BASE}/`
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`
}

function quoteId(q, a, prefix = 'zen') {
  const h = createHash('sha256')
    .update(`${q}\0${a}`)
    .digest('hex')
    .slice(0, 12)
  return `${prefix}-${h}`
}

/**
 * @param {{ q?: string, a?: string, date?: string }} row
 * @param {string} ingestedAt
 * @param {{ today?: boolean }} [opts]
 * @returns {Idea | null}
 */
function toIdea(row, ingestedAt, opts = {}) {
  const quote = String(row.q || '')
    .replace(/\s+/g, ' ')
    .trim()
  const author = String(row.a || 'Unknown')
    .replace(/\s+/g, ' ')
    .trim()
  if (!quote || quote.length < 12) return null

  const wiki = wikiUrl(author)
  const today = Boolean(opts.today)

  return {
    id: today ? `zen-today-${row.date || ingestedAt.slice(0, 10)}` : quoteId(quote, author),
    topicId: 'mental-models',
    title: author,
    body: today
      ? `Quote of the day via ZenQuotes (${BASE}/). Keep the line; open ${author} on Wikipedia to meet the person behind it.`
      : `A line from ${author} via ZenQuotes (${BASE}/). Keep the quote; open their Wikipedia page when you want the life, not just the poster.`,
    hook: clip(`“${quote}”`, 140),
    lesson: `“${clip(quote, 360)}”`,
    takeaway: 'A quote without a life is just wallpaper.',
    example: `Save the line, then skim ${author}’s wiki before you treat it as a tip.`,
    source: 'ZenQuotes',
    sourceType: 'site',
    sourceUrl: wiki,
    readMinutes: 1,
    ingestedAt,
  }
}

/**
 * @param {string} path
 */
async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

async function main() {
  console.log('Fetching ZenQuotes /api/quotes …')
  const batch = await apiGet('/api/quotes')
  if (!Array.isArray(batch) || batch.length === 0) {
    throw new Error('Empty ZenQuotes /api/quotes response')
  }

  await sleep(DELAY_MS)
  console.log('Fetching ZenQuotes /api/today …')
  let todayRows = []
  try {
    const today = await apiGet('/api/today')
    todayRows = Array.isArray(today) ? today : []
  } catch (err) {
    console.warn(`  today skip: ${err.message || err}`)
  }

  const ingestedAt = new Date().toISOString()
  /** @type {Map<string, Idea>} */
  const byId = new Map()

  for (const row of todayRows) {
    const idea = toIdea(row, ingestedAt, { today: true })
    if (idea) byId.set(idea.id, idea)
  }

  for (const row of batch) {
    const idea = toIdea(row, ingestedAt)
    if (!idea || byId.has(idea.id)) continue
    byId.set(idea.id, idea)
    if (byId.size >= MAX_CARDS) break
  }

  const items = [...byId.values()].sort((a, b) => {
    const aToday = a.id.startsWith('zen-today-') ? 0 : 1
    const bToday = b.id.startsWith('zen-today-') ? 0 : 1
    if (aToday !== bToday) return aToday - bToday
    return a.title.localeCompare(b.title)
  })

  const payload = {
    updatedAt: ingestedAt,
    source: `${BASE}/api/quotes`,
    attribution: `${BASE}/`,
    items,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${items.length} ZenQuotes ideas → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
