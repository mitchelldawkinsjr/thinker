import type { TopicId } from './types'

export const ZOBOKO_HOME = 'https://zoboko.com'
export const zobokoUrl = (slug: string) => `${ZOBOKO_HOME}/book/${slug}`

/** Fresh-shelf cards expire like book-summary ideas — curated only, never homepage scrape. */
export const ZOBOKO_FRESH_TTL_DAYS = 21

/** Personal feed: keep English-only (non-EN curated entries are skipped). */
export const ZOBOKO_EN_ONLY = true

export type ZobokoBook = {
  id: string
  slug: string
  title: string
  author: string
  why: string
  pages?: number
  language: 'en' | 'es' | 'fr' | 'pt' | 'de' | string
  /** ISO date — when set, book can appear on the Fresh shelf until TTL elapses */
  featuredAt?: string
}

/**
 * Curated Zoboko picks only — models, primary texts, and practical reads.
 * Skipped on purpose: diet, romance, YA, doujin, manifestation fluff, crank physics.
 */
export const curatedZobokoBooks: ZobokoBook[] = [
  // Personal growth → mental-models
  {
    id: 'atomic-habits',
    slug: 'xwevv5y8/atomic-habits-an-easy-proven-way-to-build-good-habits-break-bad-ones',
    title: 'Atomic Habits',
    author: 'James Clear',
    why: 'Identity-based habits — you fall to the level of your systems.',
    pages: 380,
    language: 'en',
    featuredAt: '2026-07-26T00:00:00.000Z',
  },
  {
    id: 'subtle-art',
    slug: 'mopg969d/the-subtle-art-of-not-giving-a-fck-a-counterintuitive-approach-to-living-a-good-life',
    title: 'The Subtle Art of Not Giving a F*ck',
    author: 'Mark Manson',
    why: 'Choose your struggles and values — attention is a finite budget.',
    pages: 225,
    language: 'en',
  },
  {
    id: 'how-to-win-friends',
    slug: '432lv1wg/how-to-win-friends-and-influence-people',
    title: 'How to Win Friends and Influence People',
    author: 'Dale Carnegie',
    why: 'Social levers that still work — interest, appreciation, face-saving.',
    pages: 322,
    language: 'en',
    featuredAt: '2026-07-26T00:00:00.000Z',
  },
  {
    id: 'changing-for-good',
    slug: 'kjpy490r/changing-for-good-a-revolutionary-six-stage-program-for-overcoming-bad-habits-and-moving-your-life-positively-forward',
    title: 'Changing for Good',
    author: 'Prochaska, Norcross & DiClemente',
    why: 'Stages of change — match the tactic to where you actually are.',
    pages: 388,
    language: 'en',
  },
  {
    id: 'science-of-self-discipline',
    slug: 'xwopjry5/the-science-of-self-discipline-the-willpower-mental-toughness-and-self-control-to-resist-temptation-and-achieve-your-goals',
    title: 'The Science of Self-Discipline',
    author: 'Peter Hollins',
    why: 'Willpower as a trainable system — environment beats motivation.',
    pages: 196,
    language: 'en',
  },
  {
    id: 'first-things-first',
    slug: '3drvdg50/first-things-first',
    title: 'First Things First',
    author: 'Stephen R. Covey et al.',
    why: 'Clock vs compass — prioritize importance over urgency.',
    pages: 418,
    language: 'en',
  },

  // Philosophy → mental-models
  {
    id: 'meditations-zoboko',
    slug: '0xn3380v/meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    why: 'Daily stoic practice for judgment under pressure.',
    pages: 273,
    language: 'en',
  },
  {
    id: 'courage-is-calling',
    slug: 'jjv36yrr/courage-is-calling-fortune-favours-the-brave',
    title: 'Courage Is Calling',
    author: 'Ryan Holiday',
    why: 'Stoic courage as a trainable virtue — act before fear sets the agenda.',
    pages: 304,
    language: 'en',
  },
  {
    id: 'right-thing-right-now',
    slug: '2qq1d26q/right-thing-right-now-timeless-stoic-values-from-the-multimillion-selling-author-of-the-daily-stoic',
    title: 'Right Thing, Right Now',
    author: 'Ryan Holiday',
    why: 'Justice as a practice — integrity when shortcuts look cheaper.',
    pages: 368,
    language: 'en',
  },
  {
    id: 'meaning-of-life-klein',
    slug: '2g2jdvo6/every-time-i-find-the-meaning-of-life-they-change-it-wisdom-of-the-great-philosophers-on-how-to-live',
    title: 'Every Time I Find the Meaning of Life, They Change It',
    author: 'Daniel Klein',
    why: 'Pocket tour of philosophers on how to live — think, don’t conclude.',
    pages: 224,
    language: 'en',
  },

  // Psychology → mental-models
  {
    id: 'art-of-thinking-clearly',
    slug: '8mnoqx3l/the-art-of-thinking-clearly',
    title: 'The Art of Thinking Clearly',
    author: 'Rolf Dobelli',
    why: 'A field guide to cognitive biases — name the trap before you step in it.',
    pages: 400,
    language: 'en',
    featuredAt: '2026-07-26T00:00:00.000Z',
  },
  {
    id: 'expectation-effect',
    slug: 'wev904x6/the-expectation-effect-how-your-mindset-can-change-your-world',
    title: 'The Expectation Effect',
    author: 'David Robson',
    why: 'Beliefs shape outcomes — placebo, nocebo, and self-fulfilling frames.',
    pages: 460,
    language: 'en',
  },
  {
    id: 'rapport',
    slug: 'vex8w35l/rapport-the-four-ways-to-read-people-communicate-better-and-build-lasting-connections',
    title: 'Rapport',
    author: 'Emily & Laurence Alison',
    why: 'Interrogation-grade listening models for hard conversations.',
    pages: 439,
    language: 'en',
  },

  // Political ideologies → politics
  {
    id: '50-politics-classics',
    slug: 'p5rnlpry/50-politics-classics-freedom-equality-power',
    title: '50 Politics Classics',
    author: 'Tom Butler-Bowdon',
    why: 'Map of freedom, equality, and power — from Plato to modern theorists.',
    pages: 544,
    language: 'en',
    featuredAt: '2026-07-20T00:00:00.000Z',
  },
  {
    id: 'political-science-classics',
    slug: '15ny8m83/15-political-science-classics-collection-the-art-of-war-tao-te-ching-the-republic-meditations-the-prince-utopia-utilitarianism-anarchism-and-others',
    title: 'Political Science Classics Collection',
    author: 'Sun Tzu, Plato, Machiavelli, et al.',
    why: 'Primary texts on power, republics, and strategy in one shelf.',
    pages: 1200,
    language: 'en',
  },
  {
    id: 'blackshirts-and-reds',
    slug: 'q1el9olj/blackshirts-and-reds-rational-fascism-and-the-overthrow-of-communism',
    title: 'Blackshirts and Reds',
    author: 'Michael Parenti',
    why: 'Class analysis of fascism, capitalism, and counter-revolution.',
    pages: 192,
    language: 'en',
  },

  // Small business → building-products / finance
  {
    id: 'psychology-of-money',
    slug: 'mlg0y9d8/the-psychology-of-money-timeless-lessons-on-wealth-greed-and-happiness',
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    why: 'Money is behavior — luck, risk, and enough beat spreadsheet IQ.',
    pages: 247,
    language: 'en',
    featuredAt: '2026-07-26T00:00:00.000Z',
  },
  {
    id: 'what-you-do-is-who-you-are',
    slug: '5ov80glr/what-you-do-is-who-you-are-how-to-create-your-business-culture',
    title: 'What You Do Is Who You Are',
    author: 'Ben Horowitz',
    why: 'Culture is decisions under pressure — design it on purpose.',
    pages: 288,
    language: 'en',
  },
  {
    id: 'tools-of-titans',
    slug: '3rqeeqxd/tools-of-titans-the-tactics-routines-and-habits-of-billionaires-icons-and-world-class-performers',
    title: 'Tools of Titans',
    author: 'Tim Ferriss',
    why: 'Actionable routines from high performers — skim for one lever.',
    pages: 704,
    language: 'en',
  },
  {
    id: 'lean-project-management',
    slug: '6ogd0ewo/lean-project-management-this-book-includes-lean-startup-enterprise-analytics-agile-project-management-six-sigma-kaizen',
    title: 'Lean Project Management',
    author: 'Philip Small',
    why: 'Lean + agile loops for shipping without drowning in process.',
    pages: 420,
    language: 'en',
  },
  {
    id: 'low-risk-high-reward',
    slug: 'x5od3125/low-risk-high-reward-starting-and-growing-your-own-business-with-minimal-risk',
    title: 'Low Risk, High Reward',
    author: 'Bob Reiss',
    why: 'Entrepreneurship as risk reduction — anticipate, offset, then bet.',
    pages: 451,
    language: 'en',
  },

  // Physics → AI / hard-science adjacent
  {
    id: 'quantum-supremacy',
    slug: '36x05nd2/quantum-supremacy-how-the-quantum-computer-revolution-will-change-everything',
    title: 'Quantum Supremacy',
    author: 'Michio Kaku',
    why: 'Quantum computing as the next compute curve — encryption, AI, materials.',
    pages: 504,
    language: 'en',
    featuredAt: '2026-07-22T00:00:00.000Z',
  },
  {
    id: 'emperors-new-mind',
    slug: 'odx2xw8o/the-emperors-new-mind-concerning-computers-minds-and-the-laws-of-physics',
    title: "The Emperor's New Mind",
    author: 'Roger Penrose',
    why: 'Mind vs machine — physics limits on what computers can emulate.',
    pages: 480,
    language: 'en',
  },
  {
    id: '30-second-theories',
    slug: 'monw9lqj/30-second-theories-the-50-most-thought-provoking-theories-in-science',
    title: '30-Second Theories',
    author: 'Paul Parsons et al.',
    why: 'Fast map of big science ideas — quantum to selection to cosmology.',
    pages: 160,
    language: 'en',
  },
  {
    id: 'quantum-legacies',
    slug: 'm8ew8jxd/quantum-legacies-dispatches-from-an-uncertain-world',
    title: 'Quantum Legacies',
    author: 'David Kaiser',
    why: 'How physicists actually discovered (and argued) quantum reality.',
    pages: 360,
    language: 'en',
  },
]

export function isZobokoLanguageAllowed(book: ZobokoBook): boolean {
  if (!ZOBOKO_EN_ONLY) return true
  return book.language.toLowerCase().startsWith('en')
}

export function isZobokoFresh(book: ZobokoBook, now = Date.now()): boolean {
  if (!book.featuredAt) return false
  const t = Date.parse(book.featuredAt)
  if (Number.isNaN(t)) return false
  return now - t < ZOBOKO_FRESH_TTL_DAYS * 86_400_000
}

export function activeFreshZobokoIds(now = Date.now()): string[] {
  return curatedZobokoBooks
    .filter((b) => isZobokoLanguageAllowed(b) && isZobokoFresh(b, now))
    .map((b) => b.id)
}

/** Category shelves (excludes the rotating Fresh shelf). */
export const zobokoCategoryShelves: {
  id: string
  title: string
  blurb: string
  topicIds: TopicId[]
  bookIds: string[]
  kindLabel: string
}[] = [
  {
    id: 'personal-growth',
    title: 'Personal Growth',
    blurb: 'Habits and change models — curated for Mental Models, not woo.',
    topicIds: ['mental-models'],
    kindLabel: 'Book · personal growth',
    bookIds: [
      'atomic-habits',
      'subtle-art',
      'how-to-win-friends',
      'changing-for-good',
      'science-of-self-discipline',
      'first-things-first',
    ],
  },
  {
    id: 'philosophy',
    title: 'Philosophy',
    blurb: 'Stoicism and how-to-live lenses that travel into daily judgment.',
    topicIds: ['mental-models'],
    kindLabel: 'Book · philosophy',
    bookIds: [
      'meditations-zoboko',
      'courage-is-calling',
      'right-thing-right-now',
      'meaning-of-life-klein',
    ],
  },
  {
    id: 'psychology',
    title: 'Psychology',
    blurb: 'Decision, bias, and mind books — portable thinking tools.',
    topicIds: ['mental-models'],
    kindLabel: 'Book · psychology',
    bookIds: ['art-of-thinking-clearly', 'expectation-effect', 'rapport'],
  },
  {
    id: 'political-ideologies',
    title: 'Political Ideologies',
    blurb: 'Primary / theory texts on power, ideology, and institutions.',
    topicIds: ['politics'],
    kindLabel: 'Book · politics',
    bookIds: [
      '50-politics-classics',
      'political-science-classics',
      'blackshirts-and-reds',
    ],
  },
  {
    id: 'small-business',
    title: 'Small Business & Entrepreneurs',
    blurb: 'Practical shipping, culture, and money behavior for builders.',
    topicIds: ['building-products', 'finance'],
    kindLabel: 'Book · business',
    bookIds: [
      'psychology-of-money',
      'what-you-do-is-who-you-are',
      'tools-of-titans',
      'lean-project-management',
      'low-risk-high-reward',
    ],
  },
  {
    id: 'physics',
    title: 'Physics',
    blurb: 'Hard-science reads adjacent to AI, compute, and how reality works.',
    topicIds: ['llms-prompting', 'ai-agents'],
    kindLabel: 'Book · physics',
    bookIds: [
      'quantum-supremacy',
      'emperors-new-mind',
      '30-second-theories',
      'quantum-legacies',
    ],
  },
]

/** Home category topics for a book (drives feed topic filter + Keep metadata). */
export function zobokoTopicIdsForBook(bookId: string): TopicId[] {
  for (const shelf of zobokoCategoryShelves) {
    if (shelf.bookIds.includes(bookId)) return shelf.topicIds
  }
  return ['mental-models']
}

export function zobokoCategoryLabel(bookId: string): string {
  for (const shelf of zobokoCategoryShelves) {
    if (shelf.bookIds.includes(bookId)) return shelf.title
  }
  return 'Zoboko'
}

/** Fresh first (so TTL cards win the label), then category shelves. */
export function zobokoShelvesForFeed(now = Date.now()) {
  const freshIds = activeFreshZobokoIds(now)
  const fresh =
    freshIds.length > 0
      ? [
          {
            id: 'fresh',
            title: 'Fresh picks',
            blurb: `Hand-rotated modern classics (${ZOBOKO_FRESH_TTL_DAYS}-day TTL) — not a homepage scrape.`,
            topicIds: [] as TopicId[],
            kindLabel: 'Book · fresh',
            bookIds: freshIds,
          },
        ]
      : []
  return [...fresh, ...zobokoCategoryShelves]
}

/** All shelves for the Books page (fresh when any are active). */
export function zobokoShelvesForBrowse(now = Date.now()) {
  return zobokoShelvesForFeed(now)
}

/** @deprecated Prefer zobokoShelvesForBrowse / zobokoShelvesForFeed */
export const zobokoShelves = zobokoCategoryShelves

export const curatedZobokoMeta: Record<string, ZobokoBook> = Object.fromEntries(
  curatedZobokoBooks.map((b) => [b.id, b]),
)
