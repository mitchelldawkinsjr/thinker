#!/usr/bin/env node
/**
 * Fetch politics / current-events / finance RSS → public/content/news.json
 * Thinker-shaped cards with tiered TTL from ingest time:
 *   politics → 3 days (headlines go stale fast)
 *   everything else → 10 days
 * Override per feed with `ttlDays`. Seed lessons are always merged in.
 *
 * Usage: node scripts/ingest-news.mjs
 */
import { createHash } from 'node:crypto'
import dns from 'node:dns'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeHtmlEntities } from './lib/htmlEntities.mjs'

// Prefer IPv4 — some feeds (e.g. Al Jazeera) fail on unreachable IPv6 routes
dns.setDefaultResultOrder('ipv4first')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'content', 'news.json')
/** Hard-news / politics — short window; stories change daily */
const TTL_DAYS_POLITICS = 3
/** Culture, sports, faith, general current-events */
const TTL_DAYS_DEFAULT = 10
const DAY_MS = 24 * 60 * 60 * 1000

/** @typedef {{ id: string, hook: string, title: string, lesson: string, source: string, sourceUrl: string, publishedAt: string, expiresAt: string, topicIds: string[], angles?: { label: string, url: string }[], feedId?: string }} NewsItem */

const FEEDS = [
  {
    // Multi-perspective headlines — primary weekly politics/current-events source
    id: 'allsides',
    name: 'AllSides',
    url: 'https://www.allsides.com/rss/news',
    topicIds: ['politics', 'current-events'],
    limit: 12,
  },
  {
    id: 'al-jazeera',
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    topicIds: ['current-events', 'politics'],
    limit: 10,
  },
  {
    id: 'al-jazeera-news-feed',
    name: 'Al Jazeera News Feed',
    url: 'https://www.omnycontent.com/d/playlist/9c074afa-3313-47e8-b802-a9f900789975/b10cdeda-cd0d-41ea-a737-ad8a01050808/cee1148d-ea1d-4149-9475-ad8a0105363f/podcast.rss',
    topicIds: ['current-events', 'politics'],
    limit: 8,
    kind: 'podcast',
    siteUrl: 'https://www.aljazeera.com/podcasts/news-updates/',
  },
  {
    id: 'npr-politics',
    name: 'NPR Politics',
    url: 'https://feeds.npr.org/1014/rss.xml',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  {
    id: 'npr-news-now',
    name: 'NPR News Now',
    url: 'https://feeds.npr.org/500005/podcast.xml',
    topicIds: ['current-events'],
    limit: 6,
    kind: 'podcast',
    siteUrl: 'https://www.npr.org/podcasts/500005/npr-news-now',
  },
  {
    id: 'npr-politics-podcast',
    name: 'NPR Politics Podcast',
    url: 'https://feeds.npr.org/510310/podcast.xml',
    topicIds: ['politics', 'current-events'],
    limit: 6,
    kind: 'podcast',
    siteUrl: 'https://www.npr.org/podcasts/510310/npr-politics-podcast',
  },
  {
    id: 'npr-up-first',
    name: 'Up First',
    url: 'https://feeds.npr.org/510318/podcast.xml',
    topicIds: ['current-events', 'politics'],
    limit: 6,
    kind: 'podcast',
    siteUrl: 'https://www.npr.org/podcasts/510318/up-first',
  },
  {
    id: 'npr-code-switch',
    name: 'Code Switch',
    url: 'https://feeds.npr.org/510312/podcast.xml',
    topicIds: ['current-events'],
    limit: 5,
    kind: 'podcast',
    siteUrl: 'https://www.npr.org/podcasts/510312/codeswitch',
    lessonStyle: 'culture',
  },
  {
    id: 'npr-morning-edition',
    name: 'Morning Edition',
    url: 'https://feeds.npr.org/3/rss.xml',
    topicIds: ['current-events', 'politics'],
    limit: 8,
  },
  {
    id: 'the-conversation-politics',
    name: 'The Conversation · Politics',
    url: 'https://theconversation.com/us/politics/articles.atom',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  {
    id: 'propublica',
    name: 'ProPublica',
    url: 'https://www.propublica.org/feeds/propublica/main',
    topicIds: ['politics', 'current-events'],
    limit: 6,
  },
  {
    id: 'bbc-politics',
    name: 'BBC Politics',
    url: 'https://feeds.bbci.co.uk/news/politics/rss.xml',
    topicIds: ['politics', 'current-events'],
    limit: 6,
  },
  {
    id: 'black-political-news',
    name: 'Black Political News',
    url: 'https://rss.app/feeds/v1.1/tXmxv8nuAzRRkvTG.json',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  {
    id: 'congress',
    name: 'Congress',
    url: 'https://rss.app/feeds/v1.1/tcKJj9qeKSubFqWa.json',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  {
    id: 'war',
    name: 'War',
    url: 'https://rss.app/feeds/v1.1/tPxxxGsDpoflsm8c.json',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  // Faith / Christian journalism
  {
    id: 'christian-today',
    name: 'Christian Today',
    url: 'https://www.christiantoday.com/rss.xml',
    topicIds: ['current-events', 'mental-models'],
    limit: 6,
  },
  {
    id: 'christianity-today',
    name: 'Christianity Today',
    url: 'https://www.christianitytoday.com/feed/',
    topicIds: ['current-events', 'mental-models'],
    limit: 8,
  },
  {
    id: 'crosswalk',
    name: 'Crosswalk',
    url: 'https://www.crosswalk.com/rss.xml',
    topicIds: ['mental-models', 'current-events'],
    limit: 6,
  },
  {
    id: 'ap-top-news',
    name: 'AP Top News',
    url: 'https://rsshub.app/apnews/topics/apf-topnews',
    topicIds: ['current-events'],
    limit: 5,
    optional: true,
  },
  {
    id: 'aaron-parnas',
    name: 'The Parnas Perspective',
    url: 'https://aaronparnas.substack.com/feed',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  // Black pop culture / music — verified XML only
  {
    id: 'philip-lewis',
    name: 'Philip Lewis',
    url: 'https://rss.app/feeds/v1.1/DMmESHzgp7DfJBh9.json',
    topicIds: ['current-events'],
    limit: 8,
    lessonStyle: 'culture',
  },
  {
    id: 'black-pop-culture',
    name: 'Black Pop Culture',
    url: 'https://rss.app/feeds/v1.1/twaYgziGNNhuhsNL.json',
    topicIds: ['current-events'],
    limit: 8,
    lessonStyle: 'culture',
  },
  {
    id: 'essence',
    name: 'Essence',
    url: 'https://www.essence.com/feed/',
    topicIds: ['current-events'],
    limit: 6,
    lessonStyle: 'culture',
  },
  {
    id: 'billboard-rb-hip-hop',
    name: 'Billboard R&B/Hip-Hop',
    url: 'https://www.billboard.com/c/music/rb-hip-hop/feed/',
    topicIds: ['current-events'],
    limit: 6,
    lessonStyle: 'culture',
  },
  {
    id: 'xxl',
    name: 'XXL',
    url: 'https://www.xxlmag.com/feed/',
    topicIds: ['current-events'],
    limit: 5,
    lessonStyle: 'culture',
  },
  {
    id: 'vibe',
    name: 'Vibe',
    url: 'https://www.vibe.com/feed/',
    topicIds: ['current-events'],
    limit: 5,
    lessonStyle: 'culture',
  },
  {
    id: 'the-shade-room',
    name: 'The Shade Room',
    url: 'https://theshaderoom.com/feed/',
    topicIds: ['current-events'],
    limit: 4,
    lessonStyle: 'culture',
  },
  {
    id: 'mediatakeout',
    name: 'MediaTakeOut',
    url: 'https://mediatakeout.com/feed/',
    topicIds: ['current-events'],
    limit: 3,
    lessonStyle: 'culture',
  },
  // Sports — RSS.app topic feeds (JSON Feed 1.1; NBA has no public XML)
  {
    id: 'nba-basketball-news',
    name: 'NBA & Basketball News',
    url: 'https://rss.app/feeds/v1.1/tCcjmK096Kle1DEN.json',
    topicIds: ['nba-analytics', 'sports-biz'],
    limit: 8,
  },
  {
    id: 'nfl-football-news',
    name: 'NFL & Football News',
    url: 'https://rss.app/feeds/v1.1/tAQFDM5ScLlCIIWp.json',
    topicIds: ['football-film', 'sports-biz'],
    limit: 8,
  },
  // Finance — MarketWatch (Dow Jones)
  {
    id: 'marketwatch-marketpulse',
    name: 'MarketWatch · MarketPulse',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse',
    topicIds: ['finance', 'current-events'],
    limit: 8,
    ttlDays: 3,
  },
  {
    id: 'marketwatch-bulletins',
    name: 'MarketWatch · Bulletins',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_bulletins',
    topicIds: ['finance', 'current-events'],
    limit: 10,
    ttlDays: 3,
  },
  {
    id: 'cnbc-finance',
    name: 'CNBC · Finance',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',
    topicIds: ['finance', 'current-events'],
    limit: 10,
    ttlDays: 3,
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

function decodeEntities(s) {
  return decodeHtmlEntities(s)
}

const MEDIA_EXTS = new Set([
  'mp3',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'opus',
  'wav',
  'flac',
  'weba',
  'mp4',
  'webm',
  'mov',
  'm4v',
  'ogv',
  'mkv',
])

function mediaPathExt(url) {
  try {
    const path = new URL(url, 'https://example.invalid').pathname
    const base = path.split('/').pop() || ''
    const dot = base.lastIndexOf('.')
    if (dot < 0 || dot === base.length - 1) return null
    return base.slice(dot + 1).toLowerCase()
  } catch {
    return null
  }
}

/** Prefer playable audio/video enclosures over webpage <link> (e.g. Club 520). */
function mediaEnclosureUrl(block) {
  const candidates = [
    {
      url: attr(block, 'enclosure', 'url'),
      type: attr(block, 'enclosure', 'type'),
    },
    {
      url: attr(block, 'media:content', 'url'),
      type: attr(block, 'media:content', 'type'),
    },
  ]
  for (const c of candidates) {
    const url = decodeEntities(c.url || '').trim()
    if (!url) continue
    const type = String(c.type || '').toLowerCase()
    if (type.startsWith('audio/') || type.startsWith('video/')) return url
    const ext = mediaPathExt(url)
    if (ext && MEDIA_EXTS.has(ext)) return url
  }
  return ''
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
    link = decodeEntities(link)
    // Podcast / media feeds: enclosure is the playable file; <link> is often a show page
    const media = mediaEnclosureUrl(block)
    if (media) link = media
    else if (!link) link = ''
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

/** JSON Feed 1.1 (rss.app /feeds/v1.1/*.json) */
function parseJsonFeed(text) {
  const data = JSON.parse(text)
  const items = Array.isArray(data.items) ? data.items : []
  return items.map((it) => ({
    title: stripHtml(it.title || ''),
    link: String(it.url || it.external_url || '').trim(),
    summary: stripHtml(it.content_text || it.summary || it.content_html || ''),
    published: String(it.date_published || it.date_modified || ''),
  }))
}

function parseFeedBody(text, feedUrl) {
  const trimmed = text.trimStart()
  if (feedUrl.includes('.json') || trimmed.startsWith('{')) {
    return parseJsonFeed(text)
  }
  return parseEntries(text)
}

function hookFromTitle(title) {
  const t = title.trim()
  if (t.length <= 72) return t
  const cut = t.slice(0, 69)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`
}

/** Summary only — headline challenges are rendered in the UI, not glued on. */
function lessonFrom(summary, title) {
  const s = (summary || '').trim()
  if (s.length >= 40) {
    const cut = s.slice(0, 320)
    const sp = cut.lastIndexOf(' ')
    return `${(sp > 120 ? cut.slice(0, sp) : cut).trim()}`
  }
  if (s.length > 0) return s
  return title.trim()
}

function idFor(url, title) {
  const h = createHash('sha1').update(`${url}|${title}`).digest('hex').slice(0, 12)
  return `rss-${h}`
}

/** Pool lifetime from ingest — not publish date — so stale feeds still get a full window. */
function ttlDaysFor(feed) {
  if (typeof feed.ttlDays === 'number' && feed.ttlDays > 0) return feed.ttlDays
  if (Array.isArray(feed.topicIds) && feed.topicIds.includes('politics')) {
    return TTL_DAYS_POLITICS
  }
  return TTL_DAYS_DEFAULT
}

function expiresFrom(ttlDays, now = Date.now()) {
  return new Date(now + ttlDays * DAY_MS).toISOString()
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
    const body = await res.text()
    const entries = parseFeedBody(body, feed.url).slice(0, feed.limit)
    const ttlDays = ttlDaysFor(feed)
    const ingestedAt = Date.now()
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
          expiresAt: expiresFrom(ttlDays, ingestedAt),
          topicIds: feed.topicIds,
          feedId: feed.id,
          angles: isPodcast
            ? [
                { label: 'Listen', url: e.link },
                {
                  label: 'Show page',
                  url: feed.siteUrl || e.link,
                },
              ]
            : [{ label: 'Full story', url: e.link }],
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

/** Migrate legacy long-TTL politics cards down to the politics window. */
function clampPoliticsExpiry(item, now = Date.now()) {
  if (!Array.isArray(item.topicIds) || !item.topicIds.includes('politics')) return item
  if (String(item.expiresAt || '').startsWith('2099')) return item // evergreen seeds
  const maxExp = now + TTL_DAYS_POLITICS * DAY_MS
  const exp = Date.parse(item.expiresAt)
  if (Number.isNaN(exp) || exp <= maxExp) return item
  return { ...item, expiresAt: new Date(maxExp).toISOString() }
}

/** Drop legacy hardcoded AllSides chips from scraped cards (seeds keep theirs). */
function sanitizeAngles(item) {
  if (!Array.isArray(item.angles) || item.angles.length === 0) return item
  if (String(item.expiresAt || '').startsWith('2099')) return item
  const angles = item.angles.filter((a) => a.label !== 'AllSides')
  if (angles.length === item.angles.length) return item
  return { ...item, angles }
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
    const next = sanitizeAngles(clampPoliticsExpiry(item))
    if (!isActive(next)) continue
    byId.set(next.id, next)
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
