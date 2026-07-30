#!/usr/bin/env node
/**
 * Pull Black History Facts idea cards from Black History API.
 * Weekly rotation: one page of /v2/fact/all so the pool stays fresh.
 * Writes public/content/black-history.json
 *
 * Usage: node scripts/ingest-black-history.mjs
 *
 * Requires BLACK_HISTORY_API_KEY (env or .env).
 * Docs / signup: https://www.blackhistoryapi.com/
 */
import dns from 'node:dns'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

dns.setDefaultResultOrder('ipv4first')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'content', 'black-history.json')
const BASE = 'https://rest.blackhistoryapi.io'
const SITE = 'https://www.blackhistoryapi.com/'
const UA = 'ThinkerBlackHistoryBot/1.0 (+https://thinker.360web.cloud)'
/** Cards kept in the live pool each ingest */
const PAGE_SIZE = 40

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

async function loadDotEnv() {
  try {
    const text = await readFile(join(ROOT, '.env'), 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (key && process.env[key] === undefined) process.env[key] = val
    }
  } catch {
    // no .env — fine if CI secrets are set
  }
}

function clean(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDate(iso) {
  const t = clean(iso)
  if (!t) return ''
  const d = new Date(`${t}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return t
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function categories(fact) {
  const tags = Array.isArray(fact?.tags) ? fact.tags : []
  return [
    ...new Set(
      tags
        .map((t) => clean(t?.value))
        .filter(Boolean)
        .filter((v) => !/^birthday/i.test(v)),
    ),
  ]
}

function people(fact) {
  const rows = Array.isArray(fact?.related_people) ? fact.related_people : []
  return [...new Set(rows.map((p) => clean(p?.value)).filter(Boolean))]
}

function sourceUrl(fact) {
  const refs = Array.isArray(fact?.source_references) ? fact.source_references : []
  for (const ref of refs) {
    const url = clean(ref?.source_url)
    if (/^https?:\/\//i.test(url)) return url
  }
  return SITE
}

/**
 * @param {Record<string, unknown>} fact
 * @param {string} ingestedAt
 * @returns {Idea | null}
 */
function toIdea(fact, ingestedAt) {
  const text = clean(fact?.text)
  if (!text || text.length < 24) return null

  const idRaw = clean(fact?.id || fact?._id)
  if (!idRaw) return null

  const names = people(fact)
  const cats = categories(fact)
  const when = formatDate(fact?.date_of_event)
  const where = clean(fact?.location)
  const href = sourceUrl(fact)

  const title = names[0] || cats[0] || 'Black History'
  const hookBits = [cats[0] || 'History', when].filter(Boolean)
  const bodyBits = [
    when ? `On ${when}` : null,
    where ? `in ${where}` : null,
    '— a verified fact from the Black History API.',
  ].filter(Boolean)

  const example =
    names.length > 1 ? `Also connected: ${names.slice(1).join(', ')}.` : undefined

  return {
    id: `bh-${idRaw}`,
    topicId: 'history',
    title,
    body: bodyBits.join(' '),
    hook: hookBits.join(' · '),
    lesson: text,
    takeaway: cats.length
      ? `Tags: ${cats.slice(0, 4).join(' · ')}`
      : 'Keep the fact; follow the source when you want the fuller arc.',
    ...(example ? { example } : {}),
    source: 'Black History API',
    sourceType: 'site',
    sourceUrl: href,
    readMinutes: Math.max(1, Math.min(3, Math.ceil(text.length / 400))),
    ingestedAt,
  }
}

/**
 * Rotate through paginated /fact/all so weekly ingest covers the catalog.
 * @param {number} totalPages
 * @param {number} pageSize
 */
function weekPage(totalPages, pageSize) {
  const pages = Math.max(1, totalPages || 1)
  const week = Math.floor(Date.now() / (7 * 86_400_000))
  const page = (week % pages) + 1
  return { page, pageSize }
}

/**
 * @param {string} path
 * @param {string} apiKey
 */
async function apiGet(path, apiKey) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      Origin: SITE.replace(/\/$/, ''),
      Referer: SITE,
      'User-Agent': UA,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${path} → ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`)
  }
  return res.json()
}

async function main() {
  await loadDotEnv()
  const apiKey = process.env.BLACK_HISTORY_API_KEY?.trim()
  if (!apiKey) {
    console.error('Missing BLACK_HISTORY_API_KEY (set env or .env)')
    process.exit(1)
  }

  console.log('Fetching Black History /v2/fact/all …')
  // Probe page 1 for pagination meta, then load the week’s page.
  const probe = await apiGet(`/v2/fact/all?page=1&pageSize=${PAGE_SIZE}`, apiKey)
  const probeInner = probe?.data && typeof probe.data === 'object' ? probe.data : {}
  const pagination = probeInner.pagination || {}
  const totalPages = Number(pagination.totalPages) || 1
  const { page, pageSize } = weekPage(totalPages, PAGE_SIZE)

  let payload = probe
  if (page !== 1) {
    console.log(`Weekly page ${page}/${totalPages} …`)
    payload = await apiGet(`/v2/fact/all?page=${page}&pageSize=${pageSize}`, apiKey)
  } else {
    console.log(`Weekly page 1/${totalPages} …`)
  }

  const inner = payload?.data && typeof payload.data === 'object' ? payload.data : {}
  const facts = Array.isArray(inner.data)
    ? inner.data
    : Array.isArray(payload?.data)
      ? payload.data
      : []

  if (facts.length === 0) throw new Error('Empty Black History facts response')

  const ingestedAt = new Date().toISOString()
  /** @type {Map<string, Idea>} */
  const byId = new Map()
  for (const fact of facts) {
    const idea = toIdea(fact, ingestedAt)
    if (idea) byId.set(idea.id, idea)
  }

  const items = [...byId.values()].sort((a, b) => a.title.localeCompare(b.title))
  const out = {
    updatedAt: ingestedAt,
    source: `${BASE}/v2/fact/all`,
    attribution: SITE,
    page,
    pageSize,
    catalogSize: Number(pagination.total) || items.length,
    items,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${items.length} Black History ideas → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
