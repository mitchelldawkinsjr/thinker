import { decodeHtmlEntities } from './htmlEntities'
import type { NewsItem } from '../data/newsTypes'
import {
  NEWS_TTL_DAYS_DEFAULT,
  NEWS_TTL_DAYS_POLITICS,
} from '../data/newsTypes'
import type { TopicId } from '../data/types'
import { detectMediaKind, mediaPathExt } from './mediaUrl'

const DAY_MS = 24 * 60 * 60 * 1000

export type FeedEntry = {
  title: string
  link: string
  summary: string
  published: string
  /** Card thumbnail when the feed exposes one (Reddit media:thumbnail, img, etc.) */
  imageUrl?: string
}

export type FeedMeta = {
  name: string
  topicIds: TopicId[]
  limit?: number
  ttlDays?: number
  feedId?: string
}

function stripHtml(html: string): string {
  // Decode entities first — Reddit Atom encodes markup as &lt;img…&gt;, so tag
  // stripping must run on the decoded HTML or the card body shows raw markup.
  const decoded = decodeHtmlEntities(
    String(html || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'),
  )
  return decoded
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(block: string, name: string): string {
  const re = new RegExp(
    `<(?:${name}|[^:>]+:${name})(?:\\s[^>]*)?>([\\s\\S]*?)</(?:${name}|[^:>]+:${name})>`,
    'i',
  )
  const m = block.match(re)
  return m ? stripHtml(m[1]) : ''
}

function attr(block: string, name: string, attrName: string): string {
  const re = new RegExp(
    `<(?:${name}|[^:>]+:${name})[^>]*\\s${attrName}=["']([^"']+)["'][^>]*/?>`,
    'i',
  )
  const m = block.match(re)
  return m ? m[1] : ''
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'])

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function isImageUrl(url: string, type = '', medium = ''): boolean {
  if (medium.toLowerCase() === 'image') return true
  const t = type.toLowerCase()
  if (t.startsWith('image/')) return true
  const ext = mediaPathExt(url)
  return !!(ext && IMAGE_EXTS.has(ext))
}

/** Prefer playable audio/video enclosures over webpage <link> (e.g. Club 520). */
function mediaEnclosureUrl(block: string): string {
  const candidates: Array<{ url: string; type: string }> = [
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
    const url = decodeHtmlEntities(c.url || '').trim()
    if (!url) continue
    const type = (c.type || '').toLowerCase()
    if (type.startsWith('audio/') || type.startsWith('video/')) return url
    if (detectMediaKind(url)) return url
  }
  return ''
}

function attrFromOpenTag(openTagAttrs: string, attrName: string): string {
  const m = openTagAttrs.match(
    new RegExp(`(?:^|\\s)${attrName}=["']([^"']+)["']`, 'i'),
  )
  return m ? m[1] : ''
}

/** First usable image: media:thumbnail, image enclosure/content, then <img> in HTML body. */
function entryImageUrl(block: string): string {
  const thumb = decodeHtmlEntities(
    attr(block, 'media:thumbnail', 'url') || attr(block, 'thumbnail', 'url') || '',
  ).trim()
  if (thumb && isHttpUrl(thumb)) return thumb

  const mediaRe = /<(?:media:content|enclosure)(\s[^>]*)?\/?>/gi
  let m: RegExpExecArray | null
  while ((m = mediaRe.exec(block))) {
    const attrs = m[1] || ''
    const url = decodeHtmlEntities(attrFromOpenTag(attrs, 'url')).trim()
    if (!url || !isHttpUrl(url)) continue
    const type = attrFromOpenTag(attrs, 'type')
    const medium = attrFromOpenTag(attrs, 'medium')
    if (isImageUrl(url, type, medium)) return url
  }

  const htmlParts: string[] = []
  for (const name of ['description', 'summary', 'content', 'content:encoded']) {
    const re = new RegExp(
      `<(?:${name}|[^:>]+:${name})(?:\\s[^>]*)?>([\\s\\S]*?)</(?:${name}|[^:>]+:${name})>`,
      'i',
    )
    const hit = block.match(re)
    if (hit) htmlParts.push(hit[1])
  }
  const html = decodeHtmlEntities(
    htmlParts.join(' ').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'),
  )
  const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi
  while ((m = imgRe.exec(html))) {
    const src = decodeHtmlEntities(m[1] || '').trim()
    if (!src || !isHttpUrl(src)) continue
    // Skip tiny chrome / award icons that show up in Reddit HTML
    if (/redditstatic\.com/i.test(src) && /icon|award|emoji|snoo/i.test(src)) continue
    if (/\b(emoji|award|icon)\b/i.test(src)) continue
    return src
  }
  return ''
}

function parseEntries(xml: string): FeedEntry[] {
  const chunks: string[] = []
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi
  const entryRe = /<entry[\s>][\s\S]*?<\/entry>/gi
  let m: RegExpExecArray | null
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
    link = decodeHtmlEntities(link)
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
    const imageUrl = entryImageUrl(block) || undefined
    return { title, link, summary, published, imageUrl }
  })
}

function parseJsonFeed(text: string): FeedEntry[] {
  const data = JSON.parse(text) as {
    items?: Array<{
      title?: string
      url?: string
      external_url?: string
      content_text?: string
      summary?: string
      content_html?: string
      date_published?: string
      date_modified?: string
      image?: string
      banner_image?: string
      attachments?: Array<{ url?: string; mime_type?: string }>
    }>
  }
  const items = Array.isArray(data.items) ? data.items : []
  return items.map((it) => {
    let imageUrl = String(it.image || it.banner_image || '').trim()
    if (!imageUrl && Array.isArray(it.attachments)) {
      for (const a of it.attachments) {
        const url = String(a.url || '').trim()
        if (url && isImageUrl(url, a.mime_type || '')) {
          imageUrl = url
          break
        }
      }
    }
    if (!imageUrl && it.content_html) {
      imageUrl = entryImageUrl(`<content>${it.content_html}</content>`)
    }
    return {
      title: stripHtml(it.title || ''),
      link: String(it.url || it.external_url || '').trim(),
      summary: stripHtml(it.content_text || it.summary || it.content_html || ''),
      published: String(it.date_published || it.date_modified || ''),
      imageUrl: imageUrl || undefined,
    }
  })
}

export function parseFeedBody(text: string, feedUrl: string): FeedEntry[] {
  const trimmed = text.trimStart()
  if (feedUrl.includes('.json') || trimmed.startsWith('{')) {
    return parseJsonFeed(text)
  }
  return parseEntries(text)
}

function hookFromTitle(title: string): string {
  const t = title.trim()
  if (t.length <= 72) return t
  const cut = t.slice(0, 69)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`
}

function lessonFrom(summary: string, title: string): string {
  const s = (summary || '').trim()
  if (s.length >= 40) {
    const cut = s.slice(0, 320)
    const sp = cut.lastIndexOf(' ')
    return `${(sp > 120 ? cut.slice(0, sp) : cut).trim()}`
  }
  if (s.length > 0) return s
  return title.trim()
}

function toIso(published: string): string {
  const t = Date.parse(published)
  if (!Number.isNaN(t)) return new Date(t).toISOString()
  return new Date().toISOString()
}

function ttlDaysFor(meta: FeedMeta): number {
  if (typeof meta.ttlDays === 'number' && meta.ttlDays > 0) return meta.ttlDays
  if (meta.topicIds.includes('politics')) return NEWS_TTL_DAYS_POLITICS
  return NEWS_TTL_DAYS_DEFAULT
}

async function sha1Hex12(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12)
}

export async function entriesToNewsItems(
  entries: FeedEntry[],
  meta: FeedMeta,
  now = Date.now(),
): Promise<NewsItem[]> {
  const ttlDays = ttlDaysFor(meta)
  const limit = meta.limit ?? 8
  const out: NewsItem[] = []
  for (const e of entries.slice(0, limit)) {
    if (!e.title || !e.link) continue
    const hash = await sha1Hex12(`${e.link}|${e.title}`)
    out.push({
      id: `rss-${hash}`,
      hook: hookFromTitle(e.title),
      title: e.title,
      lesson: lessonFrom(e.summary, e.title),
      source: meta.name,
      sourceUrl: e.link,
      publishedAt: toIso(e.published),
      expiresAt: new Date(now + ttlDays * DAY_MS).toISOString(),
      topicIds: meta.topicIds,
      feedId: meta.feedId,
      imageUrl: e.imageUrl,
      angles: [{ label: 'Full story', url: e.link }],
    })
  }
  return out
}

export async function parseFeedToNewsItems(
  text: string,
  feedUrl: string,
  meta: FeedMeta,
): Promise<NewsItem[]> {
  const entries = parseFeedBody(text, feedUrl)
  return entriesToNewsItems(entries, meta)
}

/** Fetch via CORS-safe app proxy. */
export async function fetchFeedViaProxy(url: string): Promise<string> {
  const res = await fetch(`/api/feed-proxy?url=${encodeURIComponent(url)}`)
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return res.text()
}
