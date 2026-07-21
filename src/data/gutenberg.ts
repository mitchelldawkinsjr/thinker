import type { GutenbergBook, TopicId } from './types'

export const GUTENBERG_HOME = 'https://www.gutenberg.org'
export const gutenbergUrl = (id: number) => `${GUTENBERG_HOME}/ebooks/${id}`
export const gutenbergCoverUrl = (id: number) =>
  `${GUTENBERG_HOME}/cache/epub/${id}/pg${id}.cover.medium.jpg`

/** Curated public-domain books mapped to Thinker topics */
export const gutenbergShelves: {
  id: string
  title: string
  blurb: string
  topicIds: TopicId[]
  bookIds: number[]
}[] = [
  {
    id: 'power-politics',
    title: 'Power & Politics',
    blurb: 'How authority works — from princes to republics.',
    topicIds: ['politics', 'history'],
    bookIds: [1232, 1404, 147, 815, 3207, 34901, 1497],
  },
  {
    id: 'markets-wealth',
    title: 'Markets & Wealth',
    blurb: 'Foundational economics and the logic of trade.',
    topicIds: ['finance'],
    bookIds: [3300, 61],
  },
  {
    id: 'thinking-well',
    title: 'Thinking Well',
    blurb: 'Stoicism, strategy, and how the mind learns.',
    topicIds: ['mental-models', 'building-products'],
    bookIds: [2680, 132, 37423, 10615],
  },
  {
    id: 'american-story',
    title: 'American Story',
    blurb: 'Founders, generals, and the experiment in self-rule.',
    topicIds: ['history', 'politics'],
    bookIds: [20203, 4367, 147, 1404],
  },
]

export const curatedGutenbergMeta: Record<
  number,
  { title: string; author: string; why: string }
> = {
  1232: {
    title: 'The Prince',
    author: 'Niccolò Machiavelli',
    why: 'Incentives, power, and political realism.',
  },
  3300: {
    title: 'The Wealth of Nations',
    author: 'Adam Smith',
    why: 'Division of labor, markets, and invisible coordination.',
  },
  1404: {
    title: 'The Federalist Papers',
    author: 'Hamilton, Madison, Jay',
    why: 'Why institutions and veto points were designed that way.',
  },
  2680: {
    title: 'Meditations',
    author: 'Marcus Aurelius',
    why: 'Daily stoic practice for judgment under pressure.',
  },
  1497: {
    title: 'The Republic',
    author: 'Plato',
    why: 'Justice, education, and the shape of a polity.',
  },
  147: {
    title: 'Common Sense',
    author: 'Thomas Paine',
    why: 'How a pamphlet moves public opinion.',
  },
  61: {
    title: 'The Communist Manifesto',
    author: 'Marx & Engels',
    why: 'Class conflict as an analytical frame — read the primary text.',
  },
  132: {
    title: 'The Art of War',
    author: 'Sunzi',
    why: 'Strategy, terrain, and winning without wasted force.',
  },
  815: {
    title: 'Democracy in America, Vol. 1',
    author: 'Alexis de Tocqueville',
    why: 'Equality, associations, and soft despotism.',
  },
  3207: {
    title: 'Leviathan',
    author: 'Thomas Hobbes',
    why: 'Why people trade freedom for order.',
  },
  34901: {
    title: 'On Liberty',
    author: 'John Stuart Mill',
    why: 'Harm principle and freedom of thought.',
  },
  20203: {
    title: 'Autobiography of Benjamin Franklin',
    author: 'Benjamin Franklin',
    why: 'Self-improvement systems and civic building.',
  },
  4367: {
    title: 'Personal Memoirs of U. S. Grant',
    author: 'Ulysses S. Grant',
    why: 'Command decisions written without romance.',
  },
  37423: {
    title: 'How We Think',
    author: 'John Dewey',
    why: 'Reflective thinking as a trainable habit.',
  },
  10615: {
    title: 'An Essay Concerning Humane Understanding',
    author: 'John Locke',
    why: 'How ideas form — and why empiricism still matters.',
  },
}

type GutendexBook = {
  id: number
  title: string
  authors: { name: string }[]
  formats: Record<string, string>
}

type GutendexPage = {
  results: GutendexBook[]
}

function mapBook(b: GutendexBook): GutenbergBook {
  return {
    id: b.id,
    title: b.title,
    authors: b.authors.map((a) => a.name),
    coverUrl: b.formats['image/jpeg'],
  }
}

export async function searchGutenberg(query: string): Promise<GutenbergBook[]> {
  const q = query.trim()
  if (!q) return []
  const res = await fetch(
    `https://gutendex.com/books/?search=${encodeURIComponent(q)}&languages=en`,
  )
  if (!res.ok) throw new Error(`Gutendex error ${res.status}`)
  const data = (await res.json()) as GutendexPage
  return data.results.map(mapBook)
}
