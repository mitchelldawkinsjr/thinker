#!/usr/bin/env node
/**
 * Pull curated scriptures from bolls.life (free, no API key) → public/content/scriptures.json
 * Uses World English Bible (WEB, public domain).
 * Open links prefer Scriptura (scriptura.360web.cloud); bolls remains the text source + fallback reader.
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
    .replace(/\s+/g, ' ')
    .trim()
}

async function buildItem(passage) {
  const verses = await fetchChapter(passage.bookId, passage.chapter)
  const slice = verses.filter(
    (v) => v.verse >= passage.verseStart && v.verse <= passage.verseEnd,
  )
  if (!slice.length) throw new Error(`No verses for ${passage.id}`)
  const text = slice.map((v) => stripTags(v.text)).join(' ')
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

  if (!items.length) {
    console.error('No scriptures fetched')
    process.exit(1)
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    translation: TRANSLATION,
    source: 'bolls.life',
    items,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${items.length} scriptures → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
