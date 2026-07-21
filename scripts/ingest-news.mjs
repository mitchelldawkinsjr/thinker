#!/usr/bin/env node
/**
 * Fetch politics / current-events RSS → public/content/news.json
 * Thinker-shaped cards with 14-day TTL. Seed lessons are always merged in.
 *
 * Usage: node scripts/ingest-news.mjs
 */
import { createHash } from 'node:crypto'
import dns from 'node:dns'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Prefer IPv4 — some feeds (e.g. Al Jazeera) fail on unreachable IPv6 routes
dns.setDefaultResultOrder('ipv4first')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'content', 'news.json')
const TTL_DAYS = 14

/** @typedef {{ id: string, hook: string, title: string, lesson: string, source: string, sourceUrl: string, publishedAt: string, expiresAt: string, topicIds: string[], angles?: { label: string, url: string }[] }} NewsItem */

const FEEDS = [
  {
    // Multi-perspective headlines — primary weekly politics/current-events source
    name: 'AllSides',
    url: 'https://www.allsides.com/rss/news',
    topicIds: ['politics', 'current-events'],
    limit: 12,
  },
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    topicIds: ['current-events', 'politics'],
    limit: 10,
  },
  {
    name: 'Al Jazeera News Feed',
    url: 'https://www.omnycontent.com/d/playlist/9c074afa-3313-47e8-b802-a9f900789975/b10cdeda-cd0d-41ea-a737-ad8a01050808/cee1148d-ea1d-4149-9475-ad8a0105363f/podcast.rss',
    topicIds: ['current-events', 'politics'],
    limit: 8,
    kind: 'podcast',
    siteUrl: 'https://www.aljazeera.com/podcasts/news-updates/',
  },
  {
    name: 'NPR Politics',
    url: 'https://feeds.npr.org/1014/rss.xml',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  {
    name: 'The Conversation · Politics',
    url: 'https://theconversation.com/us/politics/articles.atom',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  {
    name: 'ProPublica',
    url: 'https://www.propublica.org/feeds/propublica/main',
    topicIds: ['politics', 'current-events'],
    limit: 6,
  },
  {
    name: 'BBC Politics',
    url: 'https://feeds.bbci.co.uk/news/politics/rss.xml',
    topicIds: ['politics', 'current-events'],
    limit: 6,
  },
  {
    name: 'AP Top News',
    url: 'https://rsshub.app/apnews/topics/apf-topnews',
    topicIds: ['current-events'],
    limit: 5,
    optional: true,
  },
]

const SEED = /** @type {NewsItem[]} */ ([
  {
    id: 'seed-veto-points-2026',
    hook: 'Gridlock isn’t always failure — sometimes it’s design.',
    title: 'Why “nothing happens” in politics is often the system working',
    lesson:
      'Veto points (committees, courts, federalism) make big swings hard. When headlines scream stalemate, ask which institutions are doing their job — and who benefits from delay. Pair the news with Federalist Nos. 10 and 51.',
    source: 'Thinker · Politics',
    sourceUrl: 'https://www.gutenberg.org/ebooks/1404',
    publishedAt: '2026-07-21T12:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    topicIds: ['politics', 'current-events'],
    angles: [
      { label: 'Federalist Papers (Gutenberg)', url: 'https://www.gutenberg.org/ebooks/1404' },
      { label: 'AllSides — compare coverage', url: 'https://www.allsides.com/' },
    ],
  },
  {
    id: 'seed-three-angles',
    hook: 'One outlet is a camera angle — not the whole room.',
    title: 'Read the same story three ways before you decide',
    lesson:
      'Left, center, and right frames change what feels like “the” story. Use AllSides or Ground News as a habit: skim three headlines, then pick one long piece. That’s current events without the feed dopamine trap.',
    source: 'Thinker · Current Events',
    sourceUrl: 'https://www.allsides.com/',
    publishedAt: '2026-07-21T12:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    topicIds: ['current-events', 'politics'],
    angles: [
      { label: 'AllSides', url: 'https://www.allsides.com/' },
      { label: 'Ground News', url: 'https://ground.news/' },
    ],
  },
  {
    id: 'seed-incentives-over-intent',
    hook: 'Ignore the speech. Follow the incentive.',
    title: 'How to read a political promise without getting played',
    lesson:
      'Ask who gets paid, who gets punished, and what happens if nothing changes. Intentions are marketing; incentives are the mechanism. Apply this to budgets, appointments, and regulation fights in today’s headlines.',
    source: 'Thinker · Politics',
    sourceUrl: 'https://www.gutenberg.org/ebooks/1232',
    publishedAt: '2026-07-21T12:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    topicIds: ['politics', 'current-events'],
    angles: [
      { label: 'The Prince (Gutenberg)', url: 'https://www.gutenberg.org/ebooks/1232' },
      { label: 'The Conversation', url: 'https://theconversation.com/' },
    ],
  },
  {
    id: 'seed-policy-vs-presser',
    hook: 'The press conference isn’t the policy.',
    title: 'Passing a law is half the story — watch the machinery',
    lesson:
      'Agencies, funding, and enforcement decide whether a headline is real. After the announcement, look for budgets, guidance memos, and court calendars. That’s where politics becomes life.',
    source: 'Thinker · Politics',
    sourceUrl: 'https://theconversation.com/',
    publishedAt: '2026-07-21T12:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    topicIds: ['politics', 'current-events'],
    angles: [
      { label: 'The Conversation', url: 'https://theconversation.com/' },
      { label: 'ProPublica', url: 'https://www.propublica.org/' },
    ],
  },
  {
    id: 'seed-coalition-math',
    hook: 'Winning is coalition math — not converting everyone.',
    title: 'Map who must say yes before you predict the outcome',
    lesson:
      'Every bill, nomination, and local fight is a stack of must-haves. List the factions and their red lines. Suddenly “surprise” votes look like arithmetic.',
    source: 'Thinker · Politics',
    sourceUrl: 'https://iep.utm.edu/',
    publishedAt: '2026-07-21T12:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    topicIds: ['politics'],
    angles: [
      { label: 'Internet Encyclopedia of Philosophy', url: 'https://iep.utm.edu/' },
      { label: 'NPR Politics', url: 'https://www.npr.org/sections/politics/' },
    ],
  },
])

function stripHtml(html) {
  return String(html || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function parseEntries(xml) {
  const chunks = []
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi
  const entryRe = /<entry[\s>][\s\S]*?<\/entry>/gi
  let m
  while ((m = itemRe.exec(xml))) chunks.push(m[0])
  while ((m = entryRe.exec(xml))) chunks.push(m[0])
  return chunks.map((block) => {
    const title = tag(block, 'title')
    let link =
      tag(block, 'link') ||
      attr(block, 'link', 'href') ||
      (block.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1] ||
      ''
    if (!link) {
      const guid = tag(block, 'guid')
      if (guid.startsWith('http')) link = guid
    }
    // Podcasts often ship audio-only (enclosure) with empty <link>
    if (!link) {
      link =
        attr(block, 'enclosure', 'url') ||
        attr(block, 'media:content', 'url') ||
        ''
    }
    link = decodeEntities(link)
    const summary =
      tag(block, 'description') ||
      tag(block, 'summary') ||
      tag(block, 'content') ||
      tag(block, 'content:encoded') ||
      ''
    const published =
      tag(block, 'pubDate') ||
      tag(block, 'published') ||
      tag(block, 'updated') ||
      tag(block, 'dc:date') ||
      ''
    return { title, link, summary, published }
  })
}

function hookFromTitle(title) {
  const t = title.trim()
  if (t.length <= 72) return t
  const cut = t.slice(0, 69)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`
}

function lessonFrom(summary, title) {
  const s = summary || ''
  if (s.length >= 80) {
    const cut = s.slice(0, 320)
    const sp = cut.lastIndexOf(' ')
    return `${(sp > 120 ? cut.slice(0, sp) : cut).trim()} Ask: who benefits, what’s the mechanism, and what would change your mind?`
  }
  return `Headline: “${title}”. Before reacting, name the incentive, the veto points, and one primary source you’d check. Then decide if this is signal or noise.`
}

function idFor(url, title) {
  const h = createHash('sha1').update(`${url}|${title}`).digest('hex').slice(0, 12)
  return `rss-${h}`
}

function expiresFrom(publishedAt) {
  const t = Date.parse(publishedAt)
  const base = Number.isNaN(t) ? Date.now() : t
  return new Date(base + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

function toIso(published) {
  const t = Date.parse(published)
  if (!Number.isNaN(t)) return new Date(t).toISOString()
  return new Date().toISOString()
}

async function fetchFeed(feed) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'ThinkerNewsBot/1.0 (+https://thinker.360web.cloud)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const xml = await res.text()
    const entries = parseEntries(xml).slice(0, feed.limit)
    return entries
      .filter((e) => e.title && e.link)
      .map((e) => {
        const publishedAt = toIso(e.published)
        const isPodcast = feed.kind === 'podcast'
        /** @type {NewsItem} */
        const item = {
          id: idFor(e.link, e.title),
          hook: hookFromTitle(e.title),
          title: e.title,
          lesson: lessonFrom(e.summary, e.title),
          source: feed.name,
          sourceUrl: e.link,
          publishedAt,
          expiresAt: expiresFrom(publishedAt),
          topicIds: feed.topicIds,
          angles: isPodcast
            ? [
                { label: 'Listen', url: e.link },
                {
                  label: 'Al Jazeera podcasts',
                  url: feed.siteUrl || 'https://www.aljazeera.com/podcasts/news-updates/',
                },
                { label: 'AllSides', url: 'https://www.allsides.com/' },
              ]
            : [
                { label: 'Full story', url: e.link },
                { label: 'AllSides', url: 'https://www.allsides.com/' },
              ],
        }
        return item
      })
  } finally {
    clearTimeout(timer)
  }
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

function isActive(item, now = Date.now()) {
  const exp = Date.parse(item.expiresAt)
  if (Number.isNaN(exp)) return true
  return exp > now
}

async function main() {
  const existing = await loadExisting()
  /** @type {NewsItem[]} */
  const scraped = []

  for (const feed of FEEDS) {
    try {
      const items = await fetchFeed(feed)
      console.log(`✓ ${feed.name}: ${items.length}`)
      scraped.push(...items)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (feed.optional) {
        console.warn(`· skip optional ${feed.name}: ${msg}`)
      } else {
        console.warn(`✗ ${feed.name}: ${msg}`)
      }
    }
  }

  const byId = new Map()
  for (const item of [...existing, ...scraped, ...SEED]) {
    if (!isActive(item)) continue
    byId.set(item.id, item)
  }

  const items = [...byId.values()].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  )

  const payload = {
    updatedAt: new Date().toISOString(),
    items,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${items.length} items → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
