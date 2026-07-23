#!/usr/bin/env node
/**
 * Pull book-summary Ideas from:
 *   1. 5minutebooksummary.com (WP REST excerpts)
 *   2. 20minutebooks.com/rss/ (podcast: page link + MP3 enclosure)
 *
 * Overlapping titles are merged: keep the 5-minute text card and attach audioUrl.
 * Writes public/content/book-ideas.json
 *
 * Usage: node scripts/ingest-book-ideas.mjs
 */
import { createHash } from 'node:crypto'
import dns from 'node:dns'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeHtmlEntities } from './lib/htmlEntities.mjs'

dns.setDefaultResultOrder('ipv4first')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'content', 'book-ideas.json')
const BASE_5MIN = 'https://5minutebooksummary.com'
const RSS_20MIN = 'https://www.20minutebooks.com/rss/'
const UA = 'ThinkerBookIdeasBot/1.0 (+https://thinker.360web.cloud)'
/** robots.txt Crawl-delay: 10 (5-minute site) */
const DELAY_MS = 10_000
const PER_CATEGORY = 8
/** Max new (no 5-min twin) 20 Minute Books episodes to keep — RSS can be 1000+ */
const MAX_20MIN_AUDIO_ONLY = 48

/**
 * @typedef {{
 *   id: string,
 *   topicId: string,
 *   title: string,
 *   body: string,
 *   hook?: string,
 *   lesson?: string,
 *   takeaway?: string,
 *   source: string,
 *   sourceType: 'book',
 *   sourceUrl: string,
 *   audioUrl?: string,
 *   audioPageUrl?: string,
 *   readMinutes: number,
 * }} Idea
 */

/** Category slug → Thinker topicId (5 Minute Book Summary) */
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

/** 20 Minute Books category label → Thinker topicId */
const TOPIC_20MIN = {
  'money & investments': 'finance',
  economics: 'finance',
  'technology & the future': 'ai-frontend',
  technology: 'ai-frontend',
  'career & success': 'building-products',
  'management & leadership': 'building-products',
  'marketing & sales': 'building-products',
  entrepreneurship: 'building-products',
  creativity: 'building-products',
  politics: 'politics',
  history: 'history',
  'biography & memoir': 'history',
  science: 'mental-models',
  psychology: 'mental-models',
  philosophy: 'mental-models',
  'mindfulness & happiness': 'mental-models',
  'motivation & inspiration': 'mental-models',
  'health & nutrition': 'mental-models',
  'sex & relationships': 'mental-models',
  'nature & the environment': 'mental-models',
  'communication skills': 'mental-models',
  productivity: 'mental-models',
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function stripHtml(html) {
  return decodeHtmlEntities(
    String(html || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(block, name) {
  const re = new RegExp(
    `<(?:${name}|[^:>]+:${name})(?:\\s[^>]*)?>([\\s\\S]*?)</(?:${name}|[^:>]+:${name})>`,
    'i',
  )
  const m = block.match(re)
  return m ? stripHtml(m[1]) : ''
}

function attr(block, name, attrName) {
  const re = new RegExp(
    `<(?:${name}|[^:>]+:${name})[^>]*\\s${attrName}=["']([^"']+)["'][^>]*/?>`,
    'i',
  )
  const m = block.match(re)
  return m ? m[1] : ''
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

function idFor5(slug, link) {
  const h = createHash('sha1').update(slug || link).digest('hex').slice(0, 12)
  return `booksum-${h}`
}

function idFor20(guid, link) {
  const h = createHash('sha1').update(guid || link).digest('hex').slice(0, 12)
  return `20min-${h}`
}

/** Normalize titles so “Blink” matches “Blink - Book Summary”. */
function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*[-–—:]\s*book summary\s*$/i, '')
    .replace(/\bbook summary\b/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanExcerpt(excerpt) {
  let s = stripHtml(excerpt)
  s = s.replace(/\s*The post\s+Book Summary:.*$/i, '').trim()
  s = s.replace(/\s*appeared first on.*$/i, '').trim()
  return clip(s, 420)
}

function parseDurationMinutes(raw) {
  const s = String(raw || '').trim()
  if (!s) return 20
  if (/^\d+$/.test(s)) return Math.max(1, Math.round(Number(s) / 60))
  const parts = s.split(':').map((p) => Number(p))
  if (parts.some((n) => Number.isNaN(n))) return 20
  if (parts.length === 3) return Math.max(1, Math.round(parts[0] * 60 + parts[1] + parts[2] / 60))
  if (parts.length === 2) return Math.max(1, Math.round(parts[0] + parts[1] / 60))
  return 20
}

function topicFor20Category(label) {
  const key = String(label || '')
    .toLowerCase()
    .trim()
  return TOPIC_20MIN[key] || 'mental-models'
}

/**
 * @param {{ slug: string, topicId: string, limit: number }} cat
 * @param {number} categoryId
 * @returns {Promise<Idea[]>}
 */
async function fetchCategory(cat, categoryId) {
  const url = `${BASE_5MIN}/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${cat.limit}&_fields=id,slug,title,excerpt,link,date`
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
          id: idFor5(slug, link),
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
  const url = `${BASE_5MIN}/wp-json/wp/v2/categories?per_page=100&_fields=id,slug`
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

/**
 * Parse 20 Minute Books podcast RSS → Ideas (page link + MP3).
 * @returns {Promise<Idea[]>}
 */
async function fetch20MinuteBooks() {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 45000)
  try {
    const res = await fetch(RSS_20MIN, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const xml = await res.text()
    const chunks = []
    const itemRe = /<item[\s>][\s\S]*?<\/item>/gi
    let m
    while ((m = itemRe.exec(xml))) chunks.push(m[0])

    /** @type {Idea[]} */
    const ideas = []
    for (const block of chunks) {
      const rawTitle = tag(block, 'title')
      const bookTitle = rawTitle.replace(/\s*[-–—]\s*Book Summary\s*$/i, '').trim()
      if (!bookTitle) continue

      const pageLink =
        tag(block, 'link') ||
        attr(block, 'link', 'href') ||
        (block.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1] ||
        ''
      const pageUrl = decodeHtmlEntities(pageLink).trim()
      const audioUrl = decodeHtmlEntities(attr(block, 'enclosure', 'url') || '').trim()
      if (!pageUrl && !audioUrl) continue

      const guid = tag(block, 'guid') || pageUrl || audioUrl
      const descRaw =
        tag(block, 'description') ||
        tag(block, 'itunes:summary') ||
        tag(block, 'summary') ||
        ''
      const authorMatch = descRaw.match(/Author:\s*(.+?)(?:\s+Category:|$)/i)
      const categoryMatch = descRaw.match(/Category:\s*(.+)$/i)
      const author = (authorMatch?.[1] || '').trim()
      const category = (categoryMatch?.[1] || '').trim()

      // Subtitle is usually the first quoted phrase in the description
      const subtitleMatch = descRaw.match(/^["“](.+?)["”]/)
      let body = subtitleMatch ? subtitleMatch[1].trim() : ''
      if (!body) {
        body = clip(
          descRaw
            .replace(/For more insights[\s\S]*$/i, '')
            .replace(/Transcript and[\s\S]*$/i, '')
            .replace(/Author:[\s\S]*$/i, '')
            .trim(),
          280,
        )
      }
      if (!body) body = `A ~20-minute audio summary of “${bookTitle}”.`

      const minutes = parseDurationMinutes(tag(block, 'itunes:duration'))
      const topicId = topicFor20Category(category)

      /** @type {Idea} */
      ideas.push({
        id: idFor20(guid, pageUrl || audioUrl),
        topicId,
        title: bookTitle,
        hook: `A ~${minutes}-minute listen on “${clip(bookTitle, 48)}”`,
        body,
        lesson: `${body} Hit play, note one idea you’d try this week, then come back.`.replace(
          /([^.!?…])\s+Hit play/,
          '$1. Hit play',
        ),
        takeaway: author ? `Listen · ${author}` : 'Listen to the free summary, then decide.',
        source: author ? `20 Minute Books · ${author}` : '20 Minute Books',
        sourceType: 'book',
        sourceUrl: pageUrl || audioUrl,
        ...(audioUrl ? { audioUrl } : {}),
        readMinutes: minutes,
      })
    }
    return ideas
  } finally {
    clearTimeout(timer)
  }
}

function withAudioCredit(source) {
  const base = String(source || '')
    .replace(/(\s*\+\s*audio)+$/i, '')
    .trim()
  if (/20 Minute Books/i.test(base)) return base
  return `${base} + audio`
}

/**
 * Prefer 5-minute text when titles overlap; attach 20-minute audio.
 * Scans the full 20-min catalog for overlaps; caps standalone audio cards.
 * @param {Idea[]} fiveMin
 * @param {Idea[]} twentyMin newest-first from RSS
 * @returns {{ items: Idea[], merged: number, audioOnly: number }}
 */
function mergeByTitle(fiveMin, twentyMin) {
  /** @type {Map<string, Idea>} */
  const byNorm = new Map()
  for (const item of fiveMin) {
    const key = normalizeTitle(item.title)
    if (!key) continue
    byNorm.set(key, { ...item })
  }

  let merged = 0
  let audioOnly = 0
  for (const audio of twentyMin) {
    const key = normalizeTitle(audio.title)
    if (!key) continue
    const existing = byNorm.get(key)
    if (existing) {
      const page =
        audio.sourceUrl && !/\.mp3(\?|$)/i.test(audio.sourceUrl)
          ? audio.sourceUrl
          : existing.audioPageUrl
      byNorm.set(key, {
        ...existing,
        audioUrl: audio.audioUrl || existing.audioUrl,
        ...(page ? { audioPageUrl: page } : {}),
        readMinutes: audio.audioUrl
          ? Math.max(existing.readMinutes || 5, audio.readMinutes || 20)
          : existing.readMinutes,
        takeaway: audio.audioUrl
          ? `Read or listen · 20 Minute Books`
          : existing.takeaway,
        source: withAudioCredit(existing.source),
      })
      merged += 1
      continue
    }
    if (audioOnly >= MAX_20MIN_AUDIO_ONLY) continue
    byNorm.set(key, { ...audio })
    audioOnly += 1
  }

  return { items: [...byNorm.values()], merged, audioOnly }
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

async function scrape5Minute() {
  console.log(`Resolving 5-minute categories…`)
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
      console.log(`✓ 5min ${cat.slug} → ${cat.topicId}: ${items.length}`)
      scraped.push(...items)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`✗ 5min ${cat.slug}: ${msg}`)
    }
    await sleep(DELAY_MS)
  }
  return scraped
}

async function main() {
  const existing = await loadExisting()
  const skip5 = process.argv.includes('--skip-5min')

  /** @type {Idea[]} */
  let fiveMin = []
  if (skip5) {
    fiveMin = existing.filter((i) => String(i.id || '').startsWith('booksum-'))
    console.log(`· --skip-5min: reusing ${fiveMin.length} existing 5-minute cards`)
  } else {
    try {
      fiveMin = await scrape5Minute()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`✗ 5-minute ingest failed (${msg}); continuing with existing + 20min`)
      fiveMin = existing.filter((i) => String(i.id || '').startsWith('booksum-'))
    }
  }

  /** @type {Idea[]} */
  let twentyMin = []
  try {
    twentyMin = await fetch20MinuteBooks()
    console.log(`✓ 20min RSS: ${twentyMin.length} episodes`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`✗ 20min RSS: ${msg}`)
    twentyMin = existing.filter((i) => String(i.id || '').startsWith('20min-') || i.audioUrl)
  }

  const { items: mergedFresh, merged, audioOnly } = mergeByTitle(fiveMin, twentyMin)
  console.log(`· title merge: ${merged} overlaps, ${audioOnly} audio-only (cap ${MAX_20MIN_AUDIO_ONLY})`)

  /** @type {Map<string, Idea>} */
  const byId = new Map()
  /** @type {Map<string, Idea>} */
  const freshByNorm = new Map()
  for (const item of mergedFresh) {
    freshByNorm.set(normalizeTitle(item.title), item)
    byId.set(item.id, item)
  }

  // Keep older 5-minute cards not in this scrape; attach audio when titles match.
  // Do not retain stale 20min-* beyond the fresh audio-only cap.
  for (const item of existing) {
    const id = String(item.id || '')
    if (byId.has(id)) continue
    if (id.startsWith('20min-')) continue
    const fresh = freshByNorm.get(normalizeTitle(item.title))
    if (fresh?.audioUrl && !item.audioUrl) {
      byId.set(id, {
        ...item,
        audioUrl: fresh.audioUrl,
        ...(fresh.audioPageUrl ? { audioPageUrl: fresh.audioPageUrl } : {}),
        readMinutes: Math.max(item.readMinutes || 5, fresh.readMinutes || 20),
        takeaway: item.takeaway || fresh.takeaway,
        source: withAudioCredit(item.source),
      })
    } else if (fresh?.audioPageUrl && !item.audioPageUrl) {
      byId.set(id, { ...item, audioPageUrl: fresh.audioPageUrl })
    } else {
      byId.set(id, item)
    }
  }

  // One card per book title: prefer 5-min text (+ audio) over audio-only 20-min
  /** @type {Map<string, Idea>} */
  const byTitle = new Map()
  for (const item of byId.values()) {
    const key = normalizeTitle(item.title)
    if (!key) continue
    const prev = byTitle.get(key)
    if (!prev) {
      byTitle.set(key, item)
      continue
    }
    const score = (i) =>
      (String(i.id).startsWith('booksum-') ? 4 : 0) +
      (i.audioUrl ? 2 : 0) +
      (i.body && i.body.length > 80 ? 1 : 0)
    byTitle.set(
      key,
      score(item) >= score(prev)
        ? {
            ...item,
            audioUrl: item.audioUrl || prev.audioUrl,
            audioPageUrl: item.audioPageUrl || prev.audioPageUrl,
          }
        : {
            ...prev,
            audioUrl: prev.audioUrl || item.audioUrl,
            audioPageUrl: prev.audioPageUrl || item.audioPageUrl,
          },
    )
  }

  const items = [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title))
  const withAudio = items.filter((i) => i.audioUrl).length

  const payload = {
    updatedAt: new Date().toISOString(),
    source: `${BASE_5MIN} + ${RSS_20MIN}`,
    items,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${items.length} book ideas (${withAudio} with audio) → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
