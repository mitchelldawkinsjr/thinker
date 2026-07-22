import type { NewsItem } from '../data/newsTypes'
import type { TopicId } from '../data/types'

export type ChallengeStyle = 'politics' | 'culture' | 'sports'

const POLITICS = [
  'What does this headline want you to believe before you click?',
  'What’s the one fact that would flip this story?',
  'How would the other side title the same event?',
  'Is this a pattern, a one-off, or a pitch?',
  'Who’s the actor here — and who’s left out of the sentence?',
  'Who benefits if this framing sticks?',
  'What’s slippery about how this is phrased?',
  'Speech, budget, or court — which one actually decides this?',
]

const CULTURE = [
  'Signal or noise — and who’s amplifying it?',
  'What’s being sold vs what’s being said?',
  'Whose story is centered, and whose is cut?',
  'What would a primary source change here?',
  'Is this culture, or a marketing cycle wearing culture’s clothes?',
  'What does this headline want you to feel before you think?',
]

const SPORTS = [
  'What does the data say vs the narrative?',
  'Team, media, or player brand — whose incentive is this?',
  'What changes if you ignore the hot take?',
  'Is this news, or a rumor dressed as reporting?',
  'What’s the boring explanation they’re skipping?',
]

const KEYWORD_HITS: { re: RegExp; lines: string[] }[] = [
  {
    re: /\b(ask(?:s|ed)?|request|funding|budget|billion|million|\$)\b/i,
    lines: [
      'Is this a request, a threat, or a headline about the request?',
      'Follow the money — what’s the real ask underneath?',
    ],
  },
  {
    re: /\b(ban|target(?:s|ed)?|crackdown|restrict(?:s|ion)?)\b/i,
    lines: [
      'Who gains power if this ban lands — and who loses it?',
      'Is the story the rule, or the people it hits?',
    ],
  },
  {
    re: /\b(says?|claim(?:s|ed)?|insist(?:s|ed)?|deny(?:s|ied)?)\b/i,
    lines: [
      'Is the news the claim — or whether it’s true?',
      'What would make you distrust this speaker?',
    ],
  },
  {
    re: /\b(amid|as |during|after|ahead of)\b/i,
    lines: [
      'Is “amid” doing real work here, or just vibe?',
      'What happens if you drop the backdrop clause?',
    ],
  },
  {
    re: /\bcandidates?\b/i,
    lines: [
      'Institutions or personalities — which story are they selling?',
      'What doesn’t change no matter who wins?',
    ],
  },
  {
    re: /\b(war|conflict|attack|strike|troops?)\b/i,
    lines: [
      'Who named this a war — and what does that name buy them?',
      'Civilian, soldier, or capital — whose cost is missing?',
    ],
  },
]

const LEGACY_ASK =
  /\s*Ask:\s*(?:who benefits[\s\S]*|what(?:’|')s the cultural signal[\s\S]*)$/i
const LEGACY_HEADLINE =
  /^Headline:\s*[“"][\s\S]*[”"]\.\s*Before reacting[\s\S]*$/i

export function challengeStyleFor(topicIds: TopicId[] | string[]): ChallengeStyle {
  const ids = topicIds ?? []
  if (ids.some((t) => t === 'nba-analytics' || t === 'football-film' || t === 'sports-biz' || t === 'wnba')) {
    return 'sports'
  }
  if (ids.some((t) => t === 'politics')) return 'politics'
  // culture-leaning current-events (no politics tag) — still often culture feeds
  return 'culture'
}

function poolFor(style: ChallengeStyle): string[] {
  if (style === 'sports') return SPORTS
  if (style === 'culture') return CULTURE
  return POLITICS
}

function hashPick(seed: string, n: number): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return n <= 0 ? 0 : (h >>> 0) % n
}

/** Stable per-card challenge aimed at the headline, not a civics worksheet. */
export function pickNewsChallenge(
  id: string,
  title: string,
  style: ChallengeStyle,
): string {
  const keyword = KEYWORD_HITS.find((k) => k.re.test(title))
  if (keyword) {
    return keyword.lines[hashPick(`${id}|kw`, keyword.lines.length)]!
  }
  const pool = poolFor(style)
  return pool[hashPick(id, pool.length)]!
}

/** Remove old ingest boilerplate glued onto RSS summaries. */
export function stripLegacyAsk(lesson: string): string {
  const t = lesson.trim()
  if (LEGACY_HEADLINE.test(t)) {
    // Old no-summary template — fall back empty; UI uses title elsewhere
    return ''
  }
  return t.replace(LEGACY_ASK, '').trim()
}

export function newsCardCopy(item: NewsItem): { body: string; challenge: string } {
  const style = challengeStyleFor(item.topicIds)
  const body = stripLegacyAsk(item.lesson)
  const challenge =
    item.challenge?.trim() ||
    pickNewsChallenge(item.id, item.title, style)
  return { body: body || item.title, challenge }
}
