import type { NewsFile } from './newsTypes'
import { activeNews } from './newsTypes'

/** Bundled seed — replaced/merged by `npm run ingest:news` → public/content/news.json */
export const newsSeed: NewsFile = {
  updatedAt: '2026-07-21T17:00:00.000Z',
  items: [
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
  ],
}

export function getSeedActiveNews() {
  return activeNews(newsSeed.items)
}
