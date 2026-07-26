import type { TopicId } from './types'

export const ZOBOKO_HOME = 'https://zoboko.com'
export const zobokoUrl = (slug: string) => `${ZOBOKO_HOME}/book/${slug}`

export type ZobokoBook = {
  id: string
  slug: string
  title: string
  author: string
  why: string
}

/** Curated personal-growth titles — models & habits, not manifestation fluff. */
export const curatedZobokoBooks: ZobokoBook[] = [
  {
    id: 'atomic-habits',
    slug: 'xwevv5y8/atomic-habits-an-easy-proven-way-to-build-good-habits-break-bad-ones',
    title: 'Atomic Habits',
    author: 'James Clear',
    why: 'Identity-based habits — you fall to the level of your systems.',
  },
  {
    id: 'art-of-thinking-clearly',
    slug: '8mnoqx3l/the-art-of-thinking-clearly',
    title: 'The Art of Thinking Clearly',
    author: 'Rolf Dobelli',
    why: 'A field guide to cognitive biases — name the trap before you step in it.',
  },
  {
    id: 'subtle-art',
    slug: 'mopg969d/the-subtle-art-of-not-giving-a-fck-a-counterintuitive-approach-to-living-a-good-life',
    title: 'The Subtle Art of Not Giving a F*ck',
    author: 'Mark Manson',
    why: 'Choose your struggles and values — attention is a finite budget.',
  },
  {
    id: 'how-to-win-friends',
    slug: '432lv1wg/how-to-win-friends-and-influence-people',
    title: 'How to Win Friends and Influence People',
    author: 'Dale Carnegie',
    why: 'Social levers that still work — interest, appreciation, face-saving.',
  },
  {
    id: 'changing-for-good',
    slug: 'kjpy490r/changing-for-good-a-revolutionary-six-stage-program-for-overcoming-bad-habits-and-moving-your-life-positively-forward',
    title: 'Changing for Good',
    author: 'Prochaska, Norcross & DiClemente',
    why: 'Stages of change — match the tactic to where you actually are.',
  },
  {
    id: 'expectation-effect',
    slug: 'wev904x6/the-expectation-effect-how-your-mindset-can-change-your-world',
    title: 'The Expectation Effect',
    author: 'David Robson',
    why: 'Beliefs shape outcomes — placebo, nocebo, and self-fulfilling frames.',
  },
  {
    id: 'science-of-self-discipline',
    slug: 'xwopjry5/the-science-of-self-discipline-the-willpower-mental-toughness-and-self-control-to-resist-temptation-and-achieve-your-goals',
    title: 'The Science of Self-Discipline',
    author: 'Peter Hollins',
    why: 'Willpower as a trainable system — environment beats motivation.',
  },
  {
    id: 'first-things-first',
    slug: '3drvdg50/first-things-first',
    title: 'First Things First',
    author: 'Stephen R. Covey et al.',
    why: 'Clock vs compass — prioritize importance over urgency.',
  },
]

export const zobokoShelves: {
  id: string
  title: string
  blurb: string
  topicIds: TopicId[]
  bookIds: string[]
}[] = [
  {
    id: 'personal-growth',
    title: 'Personal Growth',
    blurb:
      'Habits, biases, and change models for clearer thinking — curated under Mental Models.',
    topicIds: ['mental-models'],
    bookIds: curatedZobokoBooks.map((b) => b.id),
  },
]

export const curatedZobokoMeta: Record<
  string,
  { title: string; author: string; why: string; slug: string }
> = Object.fromEntries(
  curatedZobokoBooks.map((b) => [
    b.id,
    { title: b.title, author: b.author, why: b.why, slug: b.slug },
  ]),
)
