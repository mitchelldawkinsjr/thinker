#!/usr/bin/env node
/**
 * Draft Thinker Idea cards via OpenAI for human review in the feed.
 * Writes:
 *   - scripts/drafts/ideas-<topic>-<YYYY-MM-DD>.json (archive)
 *   - public/content/idea-drafts.json (feed review queue)
 * Never writes ideas.ts or live ideas.json (use promote after Approve).
 *
 * Usage:
 *   node scripts/draft-ideas.mjs --topic football-film --count 4
 *   node scripts/draft-ideas.mjs --all-thin
 *   node scripts/draft-ideas.mjs --topic nba-analytics --topic wnba --count 3
 *   node scripts/draft-ideas.mjs --seeds path/to/thinker-thought-seeds.json --topic mental-models
 *   node scripts/draft-ideas.mjs --seeds-dir scripts/seeds/inbox
 *
 * Requires OPENAI_API_KEY (env or .env).
 */
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const IDEAS_TS = join(ROOT, 'src', 'data', 'ideas.ts')
const LIVE_JSON = join(ROOT, 'public', 'content', 'ideas.json')
const DRAFT_QUEUE_JSON = join(ROOT, 'public', 'content', 'idea-drafts.json')
const DRAFTS_DIR = join(ROOT, 'scripts', 'drafts')
const DEFAULT_COUNT = 4
const THIN_FLOOR = 8
const DEFAULT_MODEL = 'gpt-4o-mini'
const SOURCE_TYPES = new Set(['book', 'article', 'podcast', 'research', 'practice', 'site'])

const TOPIC_IDS = [
  'ai-agents',
  'llms-prompting',
  'rag-context',
  'ai-frontend',
  'nba-analytics',
  'wnba',
  'football-film',
  'sports-biz',
  'current-events',
  'history',
  'politics',
  'finance',
  'mental-models',
  'building-products',
]

/** @type {Record<string, string>} */
const TOPIC_BRIEFS = {
  'ai-agents':
    'Agent loops, tool contracts, MCP, evals, human-in-the-loop, blast-radius. Ship reliable systems that act.',
  'llms-prompting':
    'Context windows, system prompts, structured outputs, temperature, evals. Engineer prompts, don’t vibe.',
  'rag-context':
    'Chunking, retrieval, embeddings, citations, context budgets. Ground answers in real data.',
  'ai-frontend':
    'Streaming UIs, optimistic updates, chat patterns, latency, failure states for AI products.',
  'nba-analytics':
    'Possessions, efficiency, lineup data, shot quality, pace. Teach how front offices read the court — no box-score gossip.',
  wnba:
    'Pace, skill, roster construction, injuries as systems. Concepts that transfer — not rumor mills.',
  'football-film':
    'Coverage shells, leverage, tempo, run fits, situational menus. Film IQ — no scores, trades, or fantasy rankings.',
  'sports-biz':
    'Props as markets, media rights, NIL, proprietary data. Economics behind the games.',
  'current-events':
    'Frameworks for reading headlines: incentives, veto points, base rates. Not hot takes on today’s story.',
  history:
    'Patterns that repeat: logistics, institutions, primary sources. Prefer durable lessons over trivia.',
  politics:
    'Institutions, incentives, veto points, coalition math. Mechanics of power — not partisan cheerleading.',
  finance:
    'Compounding, margin of safety, risk, incentives. Money as a system.',
  'mental-models':
    'First principles, inversion, second-order effects, feedback loops. Portable thinking tools.',
  'building-products':
    'Scope, wedges, feedback loops, shipping. Turn ideas into things people use.',
}

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

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {string[]} */
  const topics = []
  let count = DEFAULT_COUNT
  let allThin = false
  let floor = THIN_FLOOR
  /** @type {string | null} */
  let seedsPath = null
  /** @type {string | null} */
  let seedsDir = null

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--topic' && argv[i + 1]) {
      topics.push(argv[++i])
    } else if (a === '--count' && argv[i + 1]) {
      count = Math.max(1, Number(argv[++i]) || DEFAULT_COUNT)
    } else if (a === '--all-thin') {
      allThin = true
    } else if (a === '--floor' && argv[i + 1]) {
      floor = Math.max(1, Number(argv[++i]) || THIN_FLOOR)
    } else if (a === '--seeds' && argv[i + 1]) {
      seedsPath = argv[++i]
    } else if (a === '--seeds-dir' && argv[i + 1]) {
      seedsDir = argv[++i]
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  node scripts/draft-ideas.mjs --topic football-film --count 4
  node scripts/draft-ideas.mjs --all-thin [--floor 8] [--count 4]
  node scripts/draft-ideas.mjs --topic nba-analytics --topic wnba
  node scripts/draft-ideas.mjs --seeds thinker-thought-seeds.json --topic mental-models
  node scripts/draft-ideas.mjs --seeds-dir scripts/seeds/inbox`)
      process.exit(0)
    }
  }

  return { topics, count, allThin, floor, seedsPath, seedsDir }
}

/**
 * @param {string} path
 * @returns {Promise<{ topicId: string, note: string, title?: string, source?: string, parentTitle?: string, startSec?: number, kind?: string, reference?: string }[]>}
 */
async function loadSeeds(path) {
  const raw = JSON.parse(await readFile(resolve(path), 'utf8'))
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.seeds) ? raw.seeds : []
  return list
    .filter((s) => s && typeof s === 'object' && typeof s.note === 'string' && s.note.trim())
    .map((s) => ({
      topicId: typeof s.topicId === 'string' ? s.topicId : 'mental-models',
      note: String(s.note).trim(),
      title: typeof s.title === 'string' ? s.title.trim() : undefined,
      source: typeof s.source === 'string' ? s.source.trim() : undefined,
      parentTitle: typeof s.parentTitle === 'string' ? s.parentTitle.trim() : undefined,
      startSec: typeof s.startSec === 'number' ? s.startSec : undefined,
      kind: typeof s.kind === 'string' ? s.kind : undefined,
      reference: typeof s.reference === 'string' ? s.reference.trim() : undefined,
    }))
}

/**
 * Load every *.json export under a directory (CI seeds inbox).
 * @param {string} dir
 */
async function loadSeedsDir(dir) {
  const abs = resolve(dir)
  let names = []
  try {
    names = (await readdir(abs)).filter((n) => n.endsWith('.json')).sort()
  } catch {
    return { seeds: [], files: [] }
  }
  /** @type {Awaited<ReturnType<typeof loadSeeds>>} */
  const seeds = []
  const files = []
  for (const name of names) {
    const path = join(abs, name)
    const batch = await loadSeeds(path)
    seeds.push(...batch)
    files.push(path)
  }
  return { seeds, files }
}

/**
 * @param {string} text
 * @returns {{ id: string, topicId: string, title: string }[]}
 */
function extractIdeasFromTs(text) {
  /** @type {{ id: string, topicId: string, title: string }[]} */
  const out = []
  const blockRe =
    /\{\s*id:\s*'([^']+)'\s*,\s*topicId:\s*'([^']+)'\s*,\s*title:\s*'((?:\\'|[^'])*)'/g
  let m
  while ((m = blockRe.exec(text))) {
    out.push({
      id: m[1],
      topicId: m[2],
      title: m[3].replace(/\\'/g, "'"),
    })
  }
  // Also match double-quoted titles if any
  const blockRe2 =
    /\{\s*id:\s*'([^']+)'\s*,\s*topicId:\s*'([^']+)'\s*,\s*title:\s*"((?:\\"|[^"])*)"/g
  while ((m = blockRe2.exec(text))) {
    if (!out.some((x) => x.id === m[1])) {
      out.push({
        id: m[1],
        topicId: m[2],
        title: m[3].replace(/\\"/g, '"'),
      })
    }
  }
  return out
}

/**
 * @returns {Promise<{ id: string, topicId: string, title: string }[]>}
 */
async function loadExistingIdeas() {
  const tsText = await readFile(IDEAS_TS, 'utf8')
  const fromTs = extractIdeasFromTs(tsText)
  /** @type {{ id: string, topicId: string, title: string }[]} */
  let fromLive = []
  try {
    const live = JSON.parse(await readFile(LIVE_JSON, 'utf8'))
    fromLive = (live.items ?? []).map((/** @type {{ id: string, topicId: string, title: string }} */ i) => ({
      id: i.id,
      topicId: i.topicId,
      title: i.title,
    }))
  } catch {
    // no live file yet
  }
  const byId = new Map()
  for (const i of [...fromTs, ...fromLive]) byId.set(i.id, i)
  return [...byId.values()]
}

/** @param {string} s */
function normalizeTitle(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** @param {string} a @param {string} b */
function titleSimilarity(a, b) {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const wa = new Set(na.split(' ').filter((w) => w.length > 2))
  const wb = new Set(nb.split(' ').filter((w) => w.length > 2))
  if (wa.size === 0 || wb.size === 0) return 0
  let inter = 0
  for (const w of wa) if (wb.has(w)) inter++
  return (2 * inter) / (wa.size + wb.size)
}

/** @param {string} title @param {string} topicId */
function slugId(title, topicId) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const hash = createHash('sha256')
    .update(`${topicId}:${title}`)
    .digest('hex')
    .slice(0, 8)
  return `draft-${base || 'idea'}-${hash}`
}

/**
 * @param {string} topicId
 * @param {number} count
 * @param {{ id: string, topicId: string, title: string }[]} existing
 * @param {string} model
 * @param {string} apiKey
 * @param {{ topicId: string, note: string, title?: string, source?: string, parentTitle?: string, startSec?: number }[]} seeds
 */
async function draftForTopic(topicId, count, existing, model, apiKey, seeds = []) {
  const brief = TOPIC_BRIEFS[topicId] || topicId
  const existingTitles = existing
    .filter((i) => i.topicId === topicId)
    .map((i) => i.title)
  const allTitles = existing.map((i) => i.title)
  const topicSeeds = seeds.filter((s) => s.topicId === topicId).slice(0, Math.max(count, 6))

  const system = `You are drafting microlearning Idea cards for Thinker — a bite-sized learning app.
Reply ONLY with compact JSON: {"ideas":[...]}
Each idea object fields:
  "title": string (one clear claim, not a news headline)
  "body": string (60–100 words, actionable / diagnostic)
  "source": string (plausible practice/article label — not a fake URL)
  "sourceType": one of book|article|podcast|research|practice|site
  "readMinutes": 1 or 2
  "hook": optional short tension line
  "takeaway": optional one-liner
  "sourceUrl": optional — ONLY a real well-known URL you are certain of; otherwise omit or ""

Rules:
- Teach ONE concept. Thinker voice: sharp, concrete, no LinkedIn fluff.
- For sports topics: no scores, trades, fantasy rankings, or rumors — film/analytics concepts only.
- Do NOT invent URLs. Prefer omit sourceUrl.
- Do NOT duplicate or lightly rephrase any title in the avoid list.
- Exactly ${count} ideas for topicId "${topicId}".
- Do not include id or topicId in objects (script adds them).
- If USER SEEDS are provided: prefer expanding those notes into full Idea cards first (keep the core claim), then fill any remaining slots with new concepts.`

  const seedBlock =
    topicSeeds.length > 0
      ? `\nUser seeds (expand these first — listening moments and scripture notes the user saved):\n${topicSeeds
          .map((s, i) => {
            const bits = [`${i + 1}. ${s.note}`]
            if (s.kind === 'scripture' && s.reference) bits.push(`(scripture: ${s.reference})`)
            else if (s.parentTitle) bits.push(`(from “${s.parentTitle}”)`)
            if (s.source) bits.push(`[${s.source}]`)
            return bits.join(' ')
          })
          .join('\n')}\n`
      : ''

  const user = `Topic: ${topicId}
Brief: ${brief}
${seedBlock}
Avoid these existing titles:
${[...new Set([...existingTitles, ...allTitles.slice(0, 80)])]
  .map((t) => `- ${t}`)
  .join('\n')}

Draft ${count} new Idea cards.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 2200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 400)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? '{}'
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('Model returned non-JSON')
  }

  const raw = Array.isArray(parsed.ideas) ? parsed.ideas : []
  /** @type {object[]} */
  const accepted = []
  const usedTitles = [...allTitles]

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const title = String(item.title ?? '').trim()
    const body = String(item.body ?? '').trim()
    const source = String(item.source ?? '').trim()
    const sourceType = String(item.sourceType ?? 'practice').trim()
    if (!title || !body || !source) continue
    if (!SOURCE_TYPES.has(sourceType)) continue
    let dup = false
    for (const t of usedTitles) {
      if (titleSimilarity(title, t) >= 0.72) {
        dup = true
        break
      }
    }
    if (dup) {
      console.warn(`  skip near-duplicate: ${title}`)
      continue
    }

    const readMinutes = Number(item.readMinutes) === 1 ? 1 : 2
    const sourceUrl =
      typeof item.sourceUrl === 'string' && /^https:\/\//i.test(item.sourceUrl.trim())
        ? item.sourceUrl.trim()
        : undefined

    /** @type {Record<string, unknown>} */
    const idea = {
      id: slugId(title, topicId),
      topicId,
      title,
      body,
      source,
      sourceType,
      readMinutes,
    }
    if (typeof item.hook === 'string' && item.hook.trim()) idea.hook = item.hook.trim()
    if (typeof item.takeaway === 'string' && item.takeaway.trim()) {
      idea.takeaway = item.takeaway.trim()
    }
    if (typeof item.lesson === 'string' && item.lesson.trim()) idea.lesson = item.lesson.trim()
    if (sourceUrl) idea.sourceUrl = sourceUrl

    accepted.push(idea)
    usedTitles.push(title)
    if (accepted.length >= count) break
  }

  return accepted
}

/**
 * @param {{ id: string, topicId: string, title: string }[]} existing
 * @param {number} floor
 */
function thinTopics(existing, floor) {
  /** @type {Record<string, number>} */
  const counts = Object.fromEntries(TOPIC_IDS.map((id) => [id, 0]))
  for (const i of existing) {
    if (counts[i.topicId] !== undefined) counts[i.topicId]++
  }
  return TOPIC_IDS.filter((id) => counts[id] < floor).map((id) => ({
    id,
    have: counts[id],
    need: floor - counts[id],
  }))
}

async function main() {
  await loadDotEnv()
  const { topics: topicArgs, count, allThin, floor, seedsPath, seedsDir } = parseArgs(
    process.argv.slice(2),
  )
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY (set env or .env)')
    process.exit(1)
  }
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL

  const existing = await loadExistingIdeas()
  /** @type {{ topicId: string, note: string, title?: string, source?: string, parentTitle?: string, startSec?: number, kind?: string, reference?: string }[]} */
  let seeds = []
  /** @type {string[]} */
  let seedFiles = []
  if (seedsDir) {
    const loaded = await loadSeedsDir(seedsDir)
    seeds = loaded.seeds
    seedFiles = loaded.files
    console.log(
      `Loaded ${seeds.length} seed(s) from ${seedFiles.length} file(s) in ${seedsDir}`,
    )
  } else if (seedsPath) {
    seeds = await loadSeeds(seedsPath)
    seedFiles = [resolve(seedsPath)]
    console.log(`Loaded ${seeds.length} listening seed(s) from ${seedsPath}`)
  }

  /** @type {{ id: string, count: number }[]} */
  let jobs = []

  if (allThin) {
    const thin = thinTopics(existing, floor)
    if (thin.length === 0) {
      console.log(`No thin topics (floor ${floor}). Nothing to draft.`)
      return
    }
    for (const t of thin) {
      jobs.push({ id: t.id, count: Math.min(count, t.need) })
    }
    console.log(
      `Thin topics (floor ${floor}): ${thin.map((t) => `${t.id}(${t.have})`).join(', ')}`,
    )
  } else if (topicArgs.length > 0) {
    for (const id of topicArgs) {
      if (!TOPIC_IDS.includes(id)) {
        console.error(`Unknown topic: ${id}`)
        process.exit(1)
      }
      jobs.push({ id, count })
    }
  } else if (seeds.length > 0) {
    const byTopic = new Map()
    for (const s of seeds) {
      if (!TOPIC_IDS.includes(s.topicId)) continue
      byTopic.set(s.topicId, (byTopic.get(s.topicId) || 0) + 1)
    }
    for (const [id, n] of byTopic) {
      jobs.push({ id, count: Math.min(count, Math.max(n, 1)) })
    }
    if (jobs.length === 0) {
      console.error('Seeds had no recognized topicId values.')
      process.exit(1)
    }
    console.log(`Drafting from seeds by topic: ${jobs.map((j) => j.id).join(', ')}`)
  } else {
    console.error('Pass --topic <id>, --all-thin, --seeds <file>, or --seeds-dir <dir>. See --help.')
    process.exit(1)
  }

  await mkdir(DRAFTS_DIR, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  /** @type {string[]} */
  const written = []

  for (const job of jobs) {
    console.log(`Drafting ${job.count} for ${job.id}…`)
    const ideas = await draftForTopic(job.id, job.count, existing, model, apiKey, seeds)
    if (ideas.length === 0) {
      console.warn(`  no valid ideas for ${job.id}`)
      continue
    }
    // Grow existing list so later topics in this run also dedupe
    for (const idea of ideas) {
      existing.push({ id: idea.id, topicId: idea.topicId, title: idea.title })
    }
    const outPath = join(DRAFTS_DIR, `ideas-${job.id}-${date}.json`)
    const payload = {
      draftedAt: new Date().toISOString(),
      model,
      topicId: job.id,
      seededFrom: seedsDir || seedsPath || undefined,
      seedFiles: seedFiles.length > 0 ? seedFiles.map((p) => p.replace(`${ROOT}/`, '')) : undefined,
      items: ideas,
    }
    await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(`  wrote ${ideas.length} → ${outPath}`)
    written.push(outPath)
  }

  if (written.length === 0) {
    console.error('No draft files written.')
    process.exit(1)
  }

  // Merge into the feed review queue (pending approve/deny in the app).
  /** @type {{ updatedAt?: string, items?: object[], source?: string }} */
  let queue = { updatedAt: new Date().toISOString(), source: 'llm-draft-queue', items: [] }
  try {
    queue = JSON.parse(await readFile(DRAFT_QUEUE_JSON, 'utf8'))
  } catch {
    // first drafts
  }
  /** @type {Set<string>} */
  const liveIds = new Set()
  try {
    const live = JSON.parse(await readFile(LIVE_JSON, 'utf8'))
    for (const item of live.items ?? []) {
      if (typeof item?.id === 'string') liveIds.add(item.id)
    }
  } catch {
    // no live pool yet
  }

  const byId = new Map()
  for (const item of queue.items ?? []) {
    if (!item?.id || liveIds.has(item.id)) continue
    byId.set(item.id, item)
  }
  for (const path of written) {
    const draft = JSON.parse(await readFile(path, 'utf8'))
    for (const item of draft.items ?? []) {
      if (!item?.id || liveIds.has(item.id)) continue
      byId.set(item.id, item)
    }
  }

  const nextQueue = {
    updatedAt: new Date().toISOString(),
    source: 'llm-draft-queue',
    items: [...byId.values()],
  }
  await mkdir(dirname(DRAFT_QUEUE_JSON), { recursive: true })
  await writeFile(DRAFT_QUEUE_JSON, `${JSON.stringify(nextQueue, null, 2)}\n`, 'utf8')
  console.log(
    `\nReview queue: ${nextQueue.items.length} pending → ${DRAFT_QUEUE_JSON}`,
  )
  console.log('Open the feed, Approve / Deny on Draft cards.')
  console.log(
    `Then export approved from Kept, or:\n  npm run promote:ideas -- ${written[0]} --ids <approved-ids>`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
