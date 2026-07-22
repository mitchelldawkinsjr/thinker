#!/usr/bin/env node
/**
 * Pull curated scriptures from bolls.life (WEB) + Blue Letter Bible Daily Promises
 * (by day-of-year) → public/content/scriptures.json
 *
 * BLB URL: https://www.blueletterbible.org/devotionals/promises/view.cfm?doy={1-365}
 * Verse text prefers WEB from bolls; reflection + link from BLB.
 *
 * Usage: node scripts/ingest-scriptures.mjs
 */
import dns from 'node:dns'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

dns.setDefaultResultOrder('ipv4first')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'content', 'scriptures.json')
const TRANSLATION = 'WEB'
const BASE = 'https://bolls.life'
const BLB_PROMISE = 'https://www.blueletterbible.org/devotionals/promises/view.cfm'
const BLB_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
/** Rolling window of daily promises in the live pool */
const BLB_WINDOW_DAYS = 21
const BLB_DELAY_MS = 400

/** @typedef {{ id: string, reference: string, hook: string, lesson: string, topicIds: string[], bookId: number, chapter: number, verseStart: number, verseEnd: number }} Passage */

/** Curated passages — Thinker hooks; text filled from API */
const PASSAGES = /** @type {Passage[]} */ ([
  {
    id: 'prov-3-5-6',
    reference: 'Proverbs 3:5–6',
    hook: 'Don’t outsource wisdom to your gut alone.',
    lesson:
      'First-principles thinking still needs humility. Lean on understanding — but don’t make it the only pillar.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 20,
    chapter: 3,
    verseStart: 5,
    verseEnd: 6,
  },
  {
    id: 'prov-27-17',
    reference: 'Proverbs 27:17',
    hook: 'Feedback loops beat solo genius.',
    lesson: 'Sharp work usually comes from friction with people who care.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 20,
    chapter: 27,
    verseStart: 17,
    verseEnd: 17,
  },
  {
    id: 'prov-15-22',
    reference: 'Proverbs 15:22',
    hook: 'Plans die in echo chambers.',
    lesson: 'Before you ship a big bet, widen the circle.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 20,
    chapter: 15,
    verseStart: 22,
    verseEnd: 22,
  },
  {
    id: 'prov-18-13',
    reference: 'Proverbs 18:13',
    hook: 'Premature answers are expensive.',
    lesson: 'Hear the full problem before you propose the fix.',
    topicIds: ['mental-models', 'ai-agents'],
    bookId: 20,
    chapter: 18,
    verseStart: 13,
    verseEnd: 13,
  },
  {
    id: 'prov-11-14',
    reference: 'Proverbs 11:14',
    hook: 'Governance fails without counsel.',
    lesson: 'Solo decision-making at scale is a shared failure mode for nations and startups.',
    topicIds: ['politics', 'building-products'],
    bookId: 20,
    chapter: 11,
    verseStart: 14,
    verseEnd: 14,
  },
  {
    id: 'prov-16-9',
    reference: 'Proverbs 16:9',
    hook: 'Plan hard. Hold outcomes lightly.',
    lesson: 'Agency and contingency coexist — adapt when reality redirects the path.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 20,
    chapter: 16,
    verseStart: 9,
    verseEnd: 9,
  },
  {
    id: 'prov-4-7',
    reference: 'Proverbs 4:7',
    hook: 'Pay for understanding — it’s leverage.',
    lesson: 'Budget time and money for real learning, not just content.',
    topicIds: ['finance', 'mental-models'],
    bookId: 20,
    chapter: 4,
    verseStart: 7,
    verseEnd: 7,
  },
  {
    id: 'prov-22-3',
    reference: 'Proverbs 22:3',
    hook: 'Prudence is early risk detection.',
    lesson: 'Seeing danger and stepping aside isn’t fear — it’s compounding survival.',
    topicIds: ['finance', 'mental-models'],
    bookId: 20,
    chapter: 22,
    verseStart: 3,
    verseEnd: 3,
  },
  {
    id: 'ecc-1-9',
    reference: 'Ecclesiastes 1:9',
    hook: 'History rhymes — product cycles do too.',
    lesson: 'When a “new” pattern feels unprecedented, check the archive.',
    topicIds: ['history', 'mental-models'],
    bookId: 21,
    chapter: 1,
    verseStart: 9,
    verseEnd: 9,
  },
  {
    id: 'ecc-3-1',
    reference: 'Ecclesiastes 3:1',
    hook: 'Timing is a strategy, not just luck.',
    lesson: 'Ask if this is a plant season or a prune season.',
    topicIds: ['mental-models', 'finance'],
    bookId: 21,
    chapter: 3,
    verseStart: 1,
    verseEnd: 1,
  },
  {
    id: 'micah-6-8',
    reference: 'Micah 6:8',
    hook: 'Three verbs beat a thousand slogans.',
    lesson: 'Justice, mercy, humility — a compact ethics checklist for power.',
    topicIds: ['politics', 'mental-models'],
    bookId: 33,
    chapter: 6,
    verseStart: 8,
    verseEnd: 8,
  },
  {
    id: 'amos-5-24',
    reference: 'Amos 5:24',
    hook: 'Justice that trickles isn’t justice.',
    lesson: 'Ask whether fairness is episodic — or flowing.',
    topicIds: ['politics', 'current-events'],
    bookId: 30,
    chapter: 5,
    verseStart: 24,
    verseEnd: 24,
  },
  {
    id: 'psalm-46-10',
    reference: 'Psalm 46:10',
    hook: 'Stillness is a skill under noise.',
    lesson: 'Doomscrolling thrives on urgency. Stillness creates judgment.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 19,
    chapter: 46,
    verseStart: 10,
    verseEnd: 10,
  },
  {
    id: 'psalm-90-12',
    reference: 'Psalm 90:12',
    hook: 'Scarcity of time is the real budget.',
    lesson: 'Wisdom starts when you admit the calendar is finite.',
    topicIds: ['mental-models', 'finance'],
    bookId: 19,
    chapter: 90,
    verseStart: 12,
    verseEnd: 12,
  },
  {
    id: 'isa-1-17',
    reference: 'Isaiah 1:17',
    hook: 'Learning without doing is incomplete.',
    lesson: 'Pair study with concrete defense of someone else.',
    topicIds: ['politics', 'mental-models'],
    bookId: 23,
    chapter: 1,
    verseStart: 17,
    verseEnd: 17,
  },
  {
    id: 'matt-7-12',
    reference: 'Matthew 7:12',
    hook: 'The golden rule is a product principle.',
    lesson: 'Treat the other side as you’d want to be treated under the same constraints.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 40,
    chapter: 7,
    verseStart: 12,
    verseEnd: 12,
  },
  {
    id: 'matt-7-3-5',
    reference: 'Matthew 7:3–5',
    hook: 'Debug yourself before you debug the team.',
    lesson: 'Clear your own beam so feedback becomes useful, not theater.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 40,
    chapter: 7,
    verseStart: 3,
    verseEnd: 5,
  },
  {
    id: 'john-8-32',
    reference: 'John 8:32',
    hook: 'Truth is a liberation technology.',
    lesson: 'Prefer costly truth over cheap narrative — in news, markets, and self-talk.',
    topicIds: ['current-events', 'mental-models'],
    bookId: 43,
    chapter: 8,
    verseStart: 32,
    verseEnd: 32,
  },
  {
    id: 'rom-12-2',
    reference: 'Romans 12:2',
    hook: 'Default culture is not destiny.',
    lesson: 'Renewing the mind is deliberate rewiring against feed algorithms and stale defaults.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 45,
    chapter: 12,
    verseStart: 2,
    verseEnd: 2,
  },
  {
    id: 'phil-4-8',
    reference: 'Philippians 4:8',
    hook: 'Attention is a diet.',
    lesson: 'Curate inputs the way you’d curate training data.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 50,
    chapter: 4,
    verseStart: 8,
    verseEnd: 8,
  },
  {
    id: 'james-1-19',
    reference: 'James 1:19',
    hook: 'Listen first. Speak second. Anger last.',
    lesson: 'A three-step latency budget for hard conversations and headlines.',
    topicIds: ['mental-models', 'politics'],
    bookId: 59,
    chapter: 1,
    verseStart: 19,
    verseEnd: 19,
  },
  {
    id: 'james-1-22',
    reference: 'James 1:22',
    hook: 'Consumption isn’t transformation.',
    lesson: 'Close the loop: one action from what you just learned.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 59,
    chapter: 1,
    verseStart: 22,
    verseEnd: 22,
  },
  {
    id: 'gen-1-3',
    reference: 'Genesis 1:3',
    hook: 'Speech that creates — clarity first.',
    lesson: 'Precise language is how builders turn fog into work.',
    topicIds: ['building-products', 'history'],
    bookId: 1,
    chapter: 1,
    verseStart: 3,
    verseEnd: 3,
  },
  {
    id: 'exod-18-21',
    reference: 'Exodus 18:21',
    hook: 'Scale requires delegated integrity.',
    lesson: 'Hire for character, then cascade authority.',
    topicIds: ['building-products', 'politics'],
    bookId: 2,
    chapter: 18,
    verseStart: 21,
    verseEnd: 21,
  },
])

const chapterCache = new Map()

/** boll.s life / Protestant canon book numbers */
const BOOK_NAME_TO_ID = {
  genesis: 1,
  exodus: 2,
  leviticus: 3,
  numbers: 4,
  deuteronomy: 5,
  joshua: 6,
  judges: 7,
  ruth: 8,
  '1 samuel': 9,
  '2 samuel': 10,
  '1 kings': 11,
  '2 kings': 12,
  '1 chronicles': 13,
  '2 chronicles': 14,
  ezra: 15,
  nehemiah: 16,
  esther: 17,
  job: 18,
  psalm: 19,
  psalms: 19,
  proverbs: 20,
  ecclesiastes: 21,
  'song of solomon': 22,
  'song of songs': 22,
  canticles: 22,
  isaiah: 23,
  jeremiah: 24,
  lamentations: 25,
  ezekiel: 26,
  daniel: 27,
  hosea: 28,
  joel: 29,
  amos: 30,
  obadiah: 31,
  jonah: 32,
  micah: 33,
  nahum: 34,
  habakkuk: 35,
  zephaniah: 36,
  haggai: 37,
  zechariah: 38,
  malachi: 39,
  matthew: 40,
  mark: 41,
  luke: 42,
  john: 43,
  acts: 44,
  romans: 45,
  '1 corinthians': 46,
  '2 corinthians': 47,
  galatians: 48,
  ephesians: 49,
  philippians: 50,
  colossians: 51,
  '1 thessalonians': 52,
  '2 thessalonians': 53,
  '1 timothy': 54,
  '2 timothy': 55,
  titus: 56,
  philemon: 57,
  hebrews: 58,
  james: 59,
  '1 peter': 60,
  '2 peter': 61,
  '1 john': 62,
  '2 john': 63,
  '3 john': 64,
  jude: 65,
  revelation: 66,
  // common abbrevs
  gen: 1,
  exo: 2,
  ex: 2,
  lev: 3,
  num: 4,
  deut: 5,
  jos: 6,
  jdg: 7,
  rut: 8,
  '1 sam': 9,
  '2 sam': 10,
  '1 ki': 11,
  '2 ki': 12,
  '1 chr': 13,
  '2 chr': 14,
  ezr: 15,
  neh: 16,
  est: 17,
  psa: 19,
  ps: 19,
  prov: 20,
  ecc: 21,
  sos: 22,
  isa: 23,
  jer: 24,
  lam: 25,
  eze: 26,
  ezk: 26,
  dan: 27,
  hos: 28,
  jol: 29,
  amo: 30,
  oba: 31,
  jon: 32,
  mic: 33,
  nah: 34,
  hab: 35,
  zep: 36,
  hag: 37,
  zec: 38,
  mal: 39,
  mat: 40,
  matt: 40,
  mrk: 41,
  luk: 42,
  jhn: 43,
  joh: 43,
  act: 44,
  rom: 45,
  '1 cor': 46,
  '2 cor': 47,
  gal: 48,
  eph: 49,
  php: 50,
  phil: 50,
  col: 51,
  '1 th': 52,
  '1 thess': 52,
  '2 th': 53,
  '2 thess': 53,
  '1 tim': 54,
  '2 tim': 55,
  tit: 56,
  phm: 57,
  heb: 58,
  jas: 59,
  '1 pet': 60,
  '2 pet': 61,
  '1 jn': 62,
  '2 jn': 63,
  '3 jn': 64,
  jud: 65,
  rev: 66,
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function dayOfYear(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor((now - start) / 86400000)
}

/** Rolling doys ending at today (handles year wrap via Date math). */
function recentDoys(windowDays = BLB_WINDOW_DAYS, from = new Date()) {
  const out = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - i),
    )
    out.push(dayOfYear(d))
  }
  return out
}

async function fetchChapter(bookId, chapter) {
  const key = `${bookId}:${chapter}`
  if (chapterCache.has(key)) return chapterCache.get(key)
  const url = `${BASE}/get-text/${TRANSLATION}/${bookId}/${chapter}/`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ThinkerScriptureBot/1.0' },
  })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  const data = await res.json()
  chapterCache.set(key, data)
  return data
}

function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/** Parse "(Galatians 3:29)" or "(1 John 4:7-8)" from BLB blockquote. */
function parseReference(raw) {
  const s = stripTags(decodeEntities(raw))
  const m = s.match(
    /\(([1-3]?\s*[A-Za-z]+(?:\s+(?:of\s+)?[A-Za-z]+)?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?\)\s*$/,
  )
  if (!m) return null
  const bookName = m[1].replace(/\s+/g, ' ').trim().toLowerCase()
  const bookId = BOOK_NAME_TO_ID[bookName]
  if (!bookId) return null
  const chapter = Number(m[2])
  const verseStart = Number(m[3])
  const verseEnd = m[4] ? Number(m[4]) : verseStart
  const reference = `${m[1].replace(/\s+/g, ' ').trim()} ${chapter}:${verseStart}${
    verseEnd !== verseStart ? `–${verseEnd}` : ''
  }`
  const verseText = s.replace(m[0], '').replace(/\[[^\]]*\]/g, '').trim()
  return { bookId, chapter, verseStart, verseEnd, reference, verseText }
}

async function verseTextFromBolls(bookId, chapter, verseStart, verseEnd) {
  const verses = await fetchChapter(bookId, chapter)
  const slice = verses.filter((v) => v.verse >= verseStart && v.verse <= verseEnd)
  if (!slice.length) return ''
  return slice.map((v) => stripTags(v.text)).join(' ')
}

async function buildItem(passage) {
  const text = await verseTextFromBolls(
    passage.bookId,
    passage.chapter,
    passage.verseStart,
    passage.verseEnd,
  )
  if (!text) throw new Error(`No verses for ${passage.id}`)
  return {
    id: passage.id,
    reference: passage.reference,
    text,
    translation: TRANSLATION,
    hook: passage.hook,
    lesson: passage.lesson,
    topicIds: passage.topicIds,
    sourceUrl: `${BASE}/${TRANSLATION}/${passage.bookId}/${passage.chapter}/`,
    bookId: passage.bookId,
    chapter: passage.chapter,
    verseStart: passage.verseStart,
    verseEnd: passage.verseEnd,
  }
}

/**
 * @param {number} doy
 */
async function fetchBlbPromise(doy) {
  const url = `${BLB_PROMISE}?doy=${doy}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': BLB_UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const html = await res.text()

  const titleM = html.match(/<h1>\s*Daily Promises\s*<br\s*\/?>\s*\(([^)]+)\)\s*<\/h1>/i)
  const dateLabel = titleM ? stripTags(titleM[1]) : `Day ${doy}`

  const bqM = html.match(/<blockquote>\s*<p>([\s\S]*?)<\/p>\s*<\/blockquote>/i)
  if (!bqM) throw new Error('no blockquote')
  const parsed = parseReference(bqM[1])
  if (!parsed) throw new Error(`unparsed ref: ${stripTags(bqM[1]).slice(0, 80)}`)

  const reflM = html.match(
    /<h4>\s*Reflection\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i,
  )
  const reflection = reflM
    ? stripTags(decodeEntities(reflM[1]))
    : 'Sit with this promise — then take one faithful next step.'

  let text = ''
  try {
    text = await verseTextFromBolls(
      parsed.bookId,
      parsed.chapter,
      parsed.verseStart,
      parsed.verseEnd,
    )
  } catch {
    text = ''
  }
  if (!text) text = parsed.verseText
  if (!text) throw new Error('no verse text')

  return {
    id: `blb-promise-doy-${doy}`,
    reference: parsed.reference,
    text,
    translation: TRANSLATION,
    hook: `Daily promise · ${dateLabel}`,
    lesson: `${reflection} Open the full Blue Letter Bible reading for ${dateLabel}.`,
    topicIds: ['mental-models', 'current-events'],
    sourceUrl: url,
    bookId: parsed.bookId,
    chapter: parsed.chapter,
    verseStart: parsed.verseStart,
    verseEnd: parsed.verseEnd,
  }
}

async function main() {
  const items = []

  for (const p of PASSAGES) {
    try {
      const item = await buildItem(p)
      items.push(item)
      console.log(`✓ ${p.reference}`)
    } catch (err) {
      console.warn(`✗ ${p.reference}:`, err instanceof Error ? err.message : err)
    }
  }

  const doys = recentDoys(BLB_WINDOW_DAYS)
  console.log(`BLB Daily Promises doy ${doys[0]}…${doys[doys.length - 1]} (${doys.length} days)`)
  for (const doy of doys) {
    try {
      const item = await fetchBlbPromise(doy)
      items.push(item)
      console.log(`✓ BLB doy=${doy} · ${item.reference}`)
    } catch (err) {
      console.warn(
        `✗ BLB doy=${doy}:`,
        err instanceof Error ? err.message : err,
      )
    }
    await sleep(BLB_DELAY_MS)
  }

  if (!items.length) {
    console.error('No scriptures fetched')
    process.exit(1)
  }

  const byId = new Map()
  for (const item of items) byId.set(item.id, item)

  const payload = {
    updatedAt: new Date().toISOString(),
    translation: TRANSLATION,
    source: 'bolls.life + blueletterbible.org/devotionals/promises',
    blbWindowDays: BLB_WINDOW_DAYS,
    items: [...byId.values()],
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${byId.size} scriptures → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
