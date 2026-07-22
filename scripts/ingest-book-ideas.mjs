#!/usr/bin/env node
/**
 * Pull book-summary excerpts from 5minutebooksummary.com (WP REST)
 * → public/content/book-ideas.json as Thinker Idea cards.
 *
 * Uses category excerpts only (not full chapter HTML). Respects crawl-delay.
 *
 * Usage: node scripts/ingest-book-ideas.mjs
 */
import { createHash } from 'node:crypto'
import dns from 'node:dns'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

dns.setDefaultResultOrder('ipv4first')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'content', 'book-ideas.json')
const BASE = 'https://5minutebooksummary.com'
const UA = 'ThinkerBookIdeasBot/1.0 (+https://thinker.360web.cloud)'
/** robots.txt Crawl-delay: 10 */
const DELAY_MS = 10_000
const PER_CATEGORY = 8

/**
 * @typedef {{ id: string, topicId: string, title: string, body: string, hook?: string, lesson?: string, takeaway?: string, source: string, sourceType: 'book', sourceUrl: string, readMinutes: number }} Idea
 */

/** Category slug → Thinker topicId */
const CATEGORIES = [
  { slug: 'politics', topicId: 'politics', limit: PER_CATEGORY },
  { slug: 'history', topicId: 'history', limit: PER_CATEGORY },
  { slug: 'investing-and-finance', topicId: 'finance', limit: PER_CATEGORY },
  { slug: 'economics', topicId: 'finance', limit: 6 },
  { slug: 'business', topicId: 'building-products', limit: PER_CATEGORY },
  { slug: 'leadership', topicId: 'building-products', limit: 6 },
  { slug: 'marketing', topicId: 'building-products', limit: 6 },
  { slug: 'personal-development', topicId: 'mental-models', limit: PER_CATEGORY },
  { slug: 'philosophy', topicId: 'mental-models', limit: 6 },
  { slug: 'psychology', topicId: 'mental-models', limit: PER_CATEGORY },
  { slug: 'productivity', topicId: 'mental-models', limit: 6 },
  { slug: 'computer-science', topicId: 'llms-prompting', limit: 6 },
  { slug: 'technology', topicId: 'ai-frontend', limit: 6 },
  { slug: 'sports', topicId: 'sports-biz', limit: 6 },
  { slug: 'biography', topicId: 'history', limit: 6 },
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '…')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "Book Summary: Title by Author" → { bookTitle, author } */
function parseBookTitle(raw) {
  let t = stripHtml(raw)
    .replace(/^Book Summary:\s*/i, '')
    .trim()
  const by = t.match(/^(.*?)\s+by\s+(.+)$/i)
  if (by) {
    return { bookTitle: by[1].trim().replace(/^["“]|["”]$/g, ''), author: by[2].trim() }
  }
  return { bookTitle: t.replace(/^["“]|["”]$/g, ''), author: '' }
}

function clip(s, max) {
  const t = String(s || '').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > max * 0.5 ? cut.slice(0, sp) : cut).trim()}…`
}

function idFor(slug, link) {
  const h = createHash('sha1').update(slug || link).digest('hex').slice(0, 12)
  return `booksum-${h}`
}

function cleanExcerpt(excerpt) {
  let s = stripHtml(excerpt)
  s = s.replace(/\s*The post\s+Book Summary:.*$/i, '').trim()
  s = s.replace(/\s*appeared first on.*$/i, '').trim()
  return clip(s, 420)
}

/**
 * @param {{ slug: string, topicId: string, limit: number }} cat
 * @param {number} categoryId
 * @returns {Promise<Idea[]>}
 */
async function fetchCategory(cat, categoryId) {
  const url = `${BASE}/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${cat.limit}&_fields=id,slug,title,excerpt,link,date`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 25000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const posts = await res.json()
    if (!Array.isArray(posts)) return []

    return posts
      .map((p) => {
        const link = String(p.link || '').trim()
        const slug = String(p.slug || '')
        if (!link) return null
        const { bookTitle, author } = parseBookTitle(p.title?.rendered || '')
        if (!bookTitle) return null
        const excerpt = cleanExcerpt(p.excerpt?.rendered || '')
        if (!excerpt || excerpt.length < 40) return null

        /** @type {Idea} */
        const idea = {
          id: idFor(slug, link),
          topicId: cat.topicId,
          title: bookTitle,
          hook: `A 5-minute look at “${clip(bookTitle, 48)}”`,
          body: excerpt,
          lesson: `${excerpt} Open the summary, pick one idea you’d actually try, then come back.`,
          takeaway: author
            ? `Read the summary · ${author}`
            : 'Read the free chapter summary, then decide.',
          source: author
            ? `5 Minute Book Summary · ${author}`
            : '5 Minute Book Summary',
          sourceType: 'book',
          sourceUrl: link,
          readMinutes: 5,
        }
        return idea
      })
      .filter(Boolean)
  } finally {
    clearTimeout(timer)
  }
}

async function resolveCategoryIds() {
  const url = `${BASE}/wp-json/wp/v2/categories?per_page=100&_fields=id,slug`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`categories ${res.status}`)
  const list = await res.json()
  /** @type {Map<string, number>} */
  const map = new Map()
  for (const c of list) map.set(c.slug, c.id)
  return map
}

async function loadExisting() {
  try {
    const raw = await readFile(OUT, 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data.items) ? data.items : []
  } catch {
    return []
  }
}

async function main() {
  const existing = await loadExisting()
  console.log(`Resolving categories…`)
  const idBySlug = await resolveCategoryIds()
  await sleep(DELAY_MS)

  /** @type {Idea[]} */
  const scraped = []

  for (const cat of CATEGORIES) {
    const categoryId = idBySlug.get(cat.slug)
    if (!categoryId) {
      console.warn(`· skip ${cat.slug}: category id not found`)
      continue
    }
    try {
      const items = await fetchCategory(cat, categoryId)
      console.log(`✓ ${cat.slug} → ${cat.topicId}: ${items.length}`)
      scraped.push(...items)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`✗ ${cat.slug}: ${msg}`)
    }
    await sleep(DELAY_MS)
  }

  const byId = new Map()
  // Prefer freshly scraped over existing
  for (const item of [...existing, ...scraped]) {
    byId.set(item.id, item)
  }

  const items = [...byId.values()].sort((a, b) => a.title.localeCompare(b.title))

  const payload = {
    updatedAt: new Date().toISOString(),
    source: BASE,
    items,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${items.length} book ideas → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
