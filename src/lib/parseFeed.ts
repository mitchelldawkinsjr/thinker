import { decodeHtmlEntities } from './htmlEntities'
import type { NewsItem } from '../data/newsTypes'
import {
  NEWS_TTL_DAYS_DEFAULT,
  NEWS_TTL_DAYS_POLITICS,
} from '../data/newsTypes'
import type { TopicId } from '../data/types'

const DAY_MS = 24 * 60 * 60 * 1000

export type FeedEntry = {
  title: string
  link: string
  summary: string
  published: string
}

export type FeedMeta = {
  name: string
  topicIds: TopicId[]
  limit?: number
  ttlDays?: number
  feedId?: string
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    String(html || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, ' '),
  )
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
    if (!link) {
      link = attr(block, 'enclosure', 'url') || attr(block, 'media:content', 'url') || ''
    }
    link = decodeHtmlEntities(link)
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
    }>
  }
  const items = Array.isArray(data.items) ? data.items : []
  return items.map((it) => ({
    title: stripHtml(it.title || ''),
    link: String(it.url || it.external_url || '').trim(),
    summary: stripHtml(it.content_text || it.summary || it.content_html || ''),
    published: String(it.date_published || it.date_modified || ''),
  }))
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
