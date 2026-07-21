import { learningResources } from '../data/resources'
import { topics } from '../data/topics'
import { curatedGutenbergMeta, gutenbergUrl } from '../data/gutenberg'
import type { TopicId } from '../data/types'
import type { ExploreContext, ExploreLink, ExploreResult } from './ollama'

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'what',
  'should', 'i', 'me', 'my', 'next', 'about', 'how', 'do', 'does', 'is', 'are',
  'can', 'you', 'read', 'learn', 'more', 'deeper', 'go', 'this', 'that', 'it',
])

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
}

function scoreText(hay: string, queryTokens: string[]): number {
  const h = hay.toLowerCase()
  let score = 0
  for (const t of queryTokens) {
    if (h.includes(t)) score += t.length > 5 ? 2 : 1
  }
  return score
}

/**
 * Instant, no-LLM explore path — keyword match against Thinker catalog.
 * Target: <5ms. Good enough to answer while the model thinks.
 */
export function exploreInstant(ctx: ExploreContext): ExploreResult {
  const blob = [ctx.question, ctx.ideaTitle, ctx.ideaBody, ctx.topicName, ctx.topicId]
    .filter(Boolean)
    .join(' ')
  const qTokens = tokens(blob)

  const topicScores = topics.map((t) => ({
    t,
    score:
      scoreText(`${t.id} ${t.name} ${t.tagline} ${t.description}`, qTokens) +
      (ctx.topicId === t.id ? 8 : 0),
  }))
  topicScores.sort((a, b) => b.score - a.score)
  const topTopics = topicScores.filter((x) => x.score > 0).slice(0, 3)
  const topicIds: TopicId[] = topTopics.map((x) => x.t.id)
  if (topicIds.length === 0 && ctx.topicId) {
    topicIds.push(ctx.topicId as TopicId)
  }

  const resourceHits = learningResources
    .map((r) => ({
      r,
      score:
        scoreText(`${r.name} ${r.blurb} ${r.category} ${(r.topicHints ?? []).join(' ')}`, qTokens) +
        (r.topicHints?.some((h) => topicIds.includes(h as TopicId)) ? 3 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const bookHits = Object.entries(curatedGutenbergMeta)
    .map(([id, meta]) => ({
      id: Number(id),
      meta,
      score: scoreText(`${meta.title} ${meta.author} ${meta.why}`, qTokens),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)

  const links: ExploreLink[] = [
    ...resourceHits.map(({ r }) => ({
      title: r.name,
      url: r.url,
      why: r.blurb,
    })),
    ...bookHits.map(({ id, meta }) => ({
      title: meta.title,
      url: gutenbergUrl(id),
      why: meta.why,
    })),
  ].slice(0, 4)

  // Always give at least one solid default path
  if (links.length === 0) {
    const fallback = learningResources.find((r) => r.id === 'sep')
      ?? learningResources[0]
    links.push({ title: fallback.name, url: fallback.url, why: fallback.blurb })
  }

  const primary = links[0]
  const topicLabel = topTopics[0]?.t.name ?? ctx.topicName ?? 'this topic'
  const answer = primary
    ? `Start with ${primary.title} — ${primary.why} Then ask a sharper follow-up once you’ve skimmed it.`
    : `Follow the links below to go deeper on ${topicLabel}.`

  const digDeeper = [
    `What’s the core idea behind ${topicLabel}?`,
    `Which primary source should I read first on ${topicLabel}?`,
    `How does this apply to something I’m building?`,
  ]

  return {
    answer,
    digDeeper,
    links,
    topics: topicIds.slice(0, 3),
    model: 'instant',
  }
}

/** Slim catalog for LLM — topic-filtered, ~10 sites + matching books */
export function buildSlimCatalog(topicId?: string): string {
  const topicLines = topics
    .map((t) => `- ${t.id}: ${t.name}`)
    .join('\n')

  const sites = learningResources
    .filter((r) => !topicId || r.topicHints?.includes(topicId) || r.category === 'thinking')
    .slice(0, 10)

  // If filter too tight, pad with high-signal defaults
  const padded =
    sites.length >= 6
      ? sites
      : [
          ...sites,
          ...learningResources.filter((r) => !sites.includes(r)).slice(0, 6 - sites.length),
        ]

  const resourceLines = padded
    .map((r) => `- ${r.name} | ${r.url}`)
    .join('\n')

  const bookLines = Object.entries(curatedGutenbergMeta)
    .slice(0, 8)
    .map(([id, meta]) => `- ${meta.title} | ${gutenbergUrl(Number(id))}`)
    .join('\n')

  return `TOPICS:\n${topicLines}\n\nSITES:\n${resourceLines}\n\nBOOKS:\n${bookLines}`
}
