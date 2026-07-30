#!/usr/bin/env node
/**
 * Pull philosopher idea cards from Philosophers API.
 * Weekly rotation: a slice of the catalog gets quote + key-idea enrichment.
 * Writes public/content/philosophers.json
 *
 * Usage: node scripts/ingest-philosophers.mjs
 */
import dns from 'node:dns'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

dns.setDefaultResultOrder('ipv4first')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'content', 'philosophers.json')
const BASE = 'https://philosophersapi.com'
const UA = 'ThinkerPhilosophersBot/1.0 (+https://thinker.360web.cloud)'
/** Cards kept in the live pool each ingest */
const BATCH = 36
/** Pause between detail GETs */
const DELAY_MS = 150

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

function wikiUrl(wikiTitle) {
  if (!wikiTitle) return `${BASE}/`
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}`
}

function slugId(name, uuid) {
  const slug = String(name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const short = String(uuid || '')
    .replace(/-/g, '')
    .slice(0, 8)
    .toLowerCase()
  return `phil-${slug || 'x'}${short ? `-${short}` : ''}`
}

function topicFor(school, interests) {
  const hay = `${school || ''} ${interests || ''}`.toLowerCase()
  if (/econom|political economy|invisible hand/.test(hay)) return 'finance'
  if (/politic|justice|law|government/.test(hay)) return 'politics'
  if (/histor/.test(hay)) return 'history'
  return 'mental-models'
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

/**
 * @param {Record<string, unknown>} listRow
 * @param {Record<string, unknown> | null} detail
 * @param {string} ingestedAt
 * @returns {Idea}
 */
function toIdea(listRow, detail, ingestedAt) {
  const name = String(listRow.name || 'Unknown')
  const life = String(listRow.life || '').trim()
  const school = String(listRow.school || detail?.school || '').trim()
  const interests = String(listRow.interests || detail?.interests || '').trim()
  const topical = String(
    listRow.topicalDescription || detail?.topicalDescription || '',
  ).trim()
  const wikiTitle = String(listRow.wikiTitle || detail?.wikiTitle || name)

  const quotes = Array.isArray(detail?.quotes) ? detail.quotes : []
  const keyIdeas = Array.isArray(detail?.keyIdeas) ? detail.keyIdeas : []
  const quote = quotes.find((q) => q?.quote)?.quote
  const keyIdea = [...keyIdeas]
    .sort((a, b) => Number(a?.order || 99) - Number(b?.order || 99))
    .find((k) => k?.text)?.text

  const hook = [school, life].filter(Boolean).join(' · ') || 'Philosopher'
  const body =
    topical ||
    (interests
      ? `${name} worked across ${interests.replace(/,/g, ', ')}.`
      : `${name}${life ? ` ${life}` : ''} — open the wiki for the fuller arc.`)

  const lesson = keyIdea
    ? clip(keyIdea, 320)
    : quote
      ? `“${clip(quote, 280)}”`
      : clip(body, 280)

  // Full quote in Example when we also have a key idea for the lesson body.
  const example = quote && keyIdea
    ? `“${String(quote).replace(/\s+/g, ' ').trim()}”`
    : undefined

  return {
    id: slugId(name, listRow.id),
    topicId: topicFor(school, interests),
    title: name,
    body: clip(body, 420),
    hook,
    lesson,
    takeaway: school
      ? `Snapshot ${school}, then read the wiki.`
      : 'Snapshot the thinker, then read the wiki.',
    ...(example ? { example } : {}),
    source: 'Philosophers API',
    sourceType: 'site',
    sourceUrl: wikiUrl(wikiTitle),
    readMinutes: 2,
    ingestedAt,
  }
}

/**
 * Rotate through the full catalog so weekly ingest covers everyone over time.
 * @param {unknown[]} all
 * @param {number} size
 */
function weekBatch(all, size) {
  const sorted = [...all].sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || '')),
  )
  if (sorted.length <= size) return sorted
  const week = Math.floor(Date.now() / (7 * 86_400_000))
  const start = (week * size) % sorted.length
  const out = []
  for (let i = 0; i < size; i++) {
    out.push(sorted[(start + i) % sorted.length])
  }
  return out
}

async function main() {
  console.log('Fetching /api/philosophers …')
  const list = await apiGet('/api/philosophers')
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Empty philosophers list')
  }

  const batch = weekBatch(list, BATCH)
  console.log(`Enriching ${batch.length} of ${list.length} philosophers…`)

  const ingestedAt = new Date().toISOString()
  /** @type {Idea[]} */
  const items = []

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i]
    const name = encodeURIComponent(String(row.name || '').replace(/ /g, '+'))
    let detail = null
    try {
      detail = await apiGet(`/api/philosophers/name/${name}`)
    } catch (err) {
      console.warn(`  skip detail ${row.name}: ${err.message || err}`)
    }
    items.push(toIdea(row, detail, ingestedAt))
    if (i + 1 < batch.length) await sleep(DELAY_MS)
    if ((i + 1) % 12 === 0) console.log(`  …${i + 1}/${batch.length}`)
  }

  items.sort((a, b) => a.title.localeCompare(b.title))

  const payload = {
    updatedAt: ingestedAt,
    source: `${BASE}/api/philosophers`,
    batchSize: BATCH,
    catalogSize: list.length,
    items,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${items.length} philosopher ideas → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
