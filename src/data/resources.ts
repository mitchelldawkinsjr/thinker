export type ResourceCategory =
  | 'science'
  | 'history'
  | 'philosophy'
  | 'finance'
  | 'tech'
  | 'thinking'
  | 'news'
  | 'culture'
  | 'learning'
  | 'writing'

export interface LearningResource {
  id: string
  name: string
  url: string
  blurb: string
  category: ResourceCategory
  /** Optional Thinker topic affinity */
  topicHints?: string[]
}

export const resourceCategories: { id: ResourceCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'thinking', label: 'Thinking' },
  { id: 'science', label: 'Science' },
  { id: 'history', label: 'History' },
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'finance', label: 'Finance' },
  { id: 'tech', label: 'Tech & Code' },
  { id: 'news', label: 'News & Events' },
  { id: 'culture', label: 'Culture' },
  { id: 'learning', label: 'Courses' },
  { id: 'writing', label: 'Writing' },
]

/** Curated free (or freemium) sites — links go to the real destinations, not Reddit. */
export const learningResources: LearningResource[] = [
  // Thinking / PD
  {
    id: 'farnam-street',
    name: 'Farnam Street',
    url: 'https://fs.blog/',
    blurb: 'Mental models, decision-making, and multidisciplinary wisdom.',
    category: 'thinking',
    topicHints: ['mental-models', 'building-products'],
  },
  {
    id: 'wait-but-why',
    name: 'Wait But Why',
    url: 'https://waitbutwhy.com/',
    blurb: 'Long illustrated essays on AI, history, procrastination, and big questions.',
    category: 'thinking',
    topicHints: ['ai-agents', 'mental-models'],
  },
  {
    id: 'marginalian',
    name: 'The Marginalian',
    url: 'https://www.themarginalian.org/',
    blurb: 'Literature, philosophy, science, and art — formerly Brain Pickings.',
    category: 'thinking',
    topicHints: ['mental-models', 'history'],
  },
  {
    id: 'aeon',
    name: 'Aeon',
    url: 'https://aeon.co/',
    blurb: 'Longform essays on philosophy, science, psychology, and culture.',
    category: 'thinking',
    topicHints: ['mental-models', 'philosophy'],
  },
  {
    id: 'greater-good',
    name: 'Greater Good Science Center',
    url: 'https://greatergood.berkeley.edu/',
    blurb: 'Evidence-based happiness, compassion, and social connection research.',
    category: 'thinking',
  },
  {
    id: 'james-clear',
    name: 'James Clear',
    url: 'https://jamesclear.com/',
    blurb: 'Habits, continuous improvement, and practical decision frameworks.',
    category: 'thinking',
    topicHints: ['building-products'],
  },
  {
    id: 'seth-godin',
    name: 'Seth’s Blog',
    url: 'https://seths.blog/',
    blurb: 'Daily short posts on marketing, creativity, and shipping work.',
    category: 'thinking',
    topicHints: ['building-products'],
  },

  // Science
  {
    id: 'quanta',
    name: 'Quanta Magazine',
    url: 'https://www.quantamagazine.org/',
    blurb: 'Clear reporting on math, physics, CS, and biology breakthroughs.',
    category: 'science',
    topicHints: ['llms-prompting', 'rag-context'],
  },
  {
    id: 'our-world-in-data',
    name: 'Our World in Data',
    url: 'https://ourworldindata.org/',
    blurb: 'Global trends via charts — poverty, health, climate, tech progress.',
    category: 'science',
    topicHints: ['current-events', 'finance'],
  },
  {
    id: 'science-daily',
    name: 'ScienceDaily',
    url: 'https://www.sciencedaily.com/',
    blurb: 'Breaking research summaries across scientific fields.',
    category: 'science',
  },
  {
    id: 'howstuffworks',
    name: 'HowStuffWorks',
    url: 'https://www.howstuffworks.com/',
    blurb: 'Illustrated explainers for earth science, tech, and everyday systems.',
    category: 'science',
  },
  {
    id: 'scientific-american',
    name: 'Scientific American',
    url: 'https://www.scientificamerican.com/',
    blurb: 'In-depth science journalism for learning and teaching.',
    category: 'science',
  },
  {
    id: 'livescience',
    name: 'Live Science',
    url: 'https://www.livescience.com/',
    blurb: 'Developments in science, space, and technology.',
    category: 'science',
  },
  {
    id: 'space-com',
    name: 'Space.com',
    url: 'https://www.space.com/',
    blurb: 'Spaceflight, astronomy, and space tech explainers.',
    category: 'science',
  },
  {
    id: '3blue1brown',
    name: '3Blue1Brown',
    url: 'https://www.3blue1brown.com/',
    blurb: 'Visual math that makes linear algebra and calculus click.',
    category: 'science',
  },
  {
    id: 'phet',
    name: 'PhET Simulations',
    url: 'https://phet.colorado.edu/',
    blurb: 'Free interactive physics, chem, bio, and math sims from CU Boulder.',
    category: 'science',
  },
  {
    id: 'ars-technica',
    name: 'Ars Technica',
    url: 'https://arstechnica.com/',
    blurb: 'Deep tech reporting with real expertise — security, space, science.',
    category: 'science',
    topicHints: ['ai-agents', 'current-events'],
  },

  // History
  {
    id: 'smithsonian',
    name: 'Smithsonian Magazine',
    url: 'https://www.smithsonianmag.com/',
    blurb: 'History, science, culture, and innovation journalism.',
    category: 'history',
    topicHints: ['history'],
  },
  {
    id: 'history-extra',
    name: 'History Extra',
    url: 'https://www.historyextra.com/',
    blurb: 'BBC History Magazine — articles, podcasts, expert explainers.',
    category: 'history',
    topicHints: ['history'],
  },
  {
    id: 'history-com',
    name: 'HISTORY',
    url: 'https://www.history.com/',
    blurb: 'Speeches, this-day-in-history, and historical topic guides.',
    category: 'history',
    topicHints: ['history'],
  },
  {
    id: 'biography',
    name: 'Biography',
    url: 'https://www.biography.com/',
    blurb: 'True stories about notable people and their eras.',
    category: 'history',
  },
  {
    id: 'atlas-obscura',
    name: 'Atlas Obscura',
    url: 'https://www.atlasobscura.com/',
    blurb: 'Hidden places, odd histories, and curious cultural practices.',
    category: 'history',
  },
  {
    id: 'public-domain-review',
    name: 'The Public Domain Review',
    url: 'https://publicdomainreview.org/',
    blurb: 'Curated out-of-copyright cultural artifacts with expert context.',
    category: 'history',
    topicHints: ['history'],
  },
  {
    id: 'open-culture',
    name: 'Open Culture',
    url: 'https://www.openculture.com/',
    blurb: 'Free courses, ebooks, films, and language lessons aggregated.',
    category: 'learning',
  },
  {
    id: 'gutenberg',
    name: 'Project Gutenberg',
    url: 'https://www.gutenberg.org/',
    blurb: '70k+ free public-domain ebooks — primary texts for politics, finance, philosophy.',
    category: 'history',
    topicHints: ['history', 'politics', 'finance', 'mental-models'],
  },

  // Philosophy
  {
    id: 'sep',
    name: 'Stanford Encyclopedia of Philosophy',
    url: 'https://plato.stanford.edu/',
    blurb: 'Peer-reviewed, deep entries on philosophical topics and thinkers.',
    category: 'philosophy',
    topicHints: ['mental-models', 'politics'],
  },
  {
    id: 'iep',
    name: 'Internet Encyclopedia of Philosophy',
    url: 'https://iep.utm.edu/',
    blurb: 'Open-access philosophy encyclopedia, clearer entry points than SEP.',
    category: 'philosophy',
    topicHints: ['mental-models'],
  },
  {
    id: 'philosophy-now',
    name: 'Philosophy Now',
    url: 'https://philosophynow.org/',
    blurb: 'Accessible magazine-style philosophy connected to current life.',
    category: 'philosophy',
  },

  // Finance
  {
    id: 'investopedia',
    name: 'Investopedia',
    url: 'https://www.investopedia.com/',
    blurb: 'Finance encyclopedia — from budgeting basics to markets.',
    category: 'finance',
    topicHints: ['finance', 'sports-biz'],
  },
  {
    id: 'khan-finance',
    name: 'Khan Academy — Personal Finance',
    url: 'https://www.khanacademy.org/college-careers-more/personal-finance',
    blurb: 'Free lessons on budgeting, credit, investing, and money decisions.',
    category: 'finance',
    topicHints: ['finance'],
  },
  {
    id: 'mmm',
    name: 'Mr. Money Mustache',
    url: 'https://www.mrmoneymustache.com/',
    blurb: 'Financial independence through frugality and deliberate spending.',
    category: 'finance',
    topicHints: ['finance'],
  },

  // Tech & coding
  {
    id: 'freecodecamp',
    name: 'freeCodeCamp',
    url: 'https://www.freecodecamp.org/',
    blurb: 'Free full-stack curriculum with real projects and certifications.',
    category: 'tech',
    topicHints: ['ai-frontend', 'building-products'],
  },
  {
    id: 'odin',
    name: 'The Odin Project',
    url: 'https://www.theodinproject.com/',
    blurb: 'Open-source web-dev path that teaches you to think like a developer.',
    category: 'tech',
    topicHints: ['ai-frontend'],
  },
  {
    id: 'mit-ocw',
    name: 'MIT OpenCourseWare',
    url: 'https://ocw.mit.edu/',
    blurb: '2,500+ free MIT courses — notes, exams, and often full video.',
    category: 'learning',
    topicHints: ['llms-prompting', 'rag-context'],
  },
  {
    id: 'kaggle-learn',
    name: 'Kaggle Learn',
    url: 'https://www.kaggle.com/learn',
    blurb: 'Hands-on micro-courses in Python, ML, and data science.',
    category: 'tech',
    topicHints: ['rag-context', 'nba-analytics'],
  },
  {
    id: 'css-tricks',
    name: 'CSS-Tricks',
    url: 'https://css-tricks.com/',
    blurb: 'Front-end techniques, layouts, and practical web craft.',
    category: 'tech',
    topicHints: ['ai-frontend'],
  },
  {
    id: 'devto',
    name: 'DEV Community',
    url: 'https://dev.to/',
    blurb: 'Developer articles and tutorials from people shipping in the field.',
    category: 'tech',
    topicHints: ['ai-agents', 'ai-frontend'],
  },
  {
    id: 'exercism',
    name: 'Exercism',
    url: 'https://exercism.org/',
    blurb: 'Coding practice in 50+ languages with mentorship feedback.',
    category: 'tech',
  },
  {
    id: 'yc-startup-school',
    name: 'Y Combinator Startup School',
    url: 'https://www.startupschool.org/',
    blurb: 'Free founder curriculum from the accelerator behind Airbnb & Stripe.',
    category: 'tech',
    topicHints: ['building-products', 'sports-biz'],
  },
  {
    id: 'indie-hackers',
    name: 'Indie Hackers',
    url: 'https://www.indiehackers.com/',
    blurb: 'Bootstrapped founders sharing revenue, tactics, and case studies.',
    category: 'tech',
    topicHints: ['building-products'],
  },
  {
    id: 'first-round',
    name: 'First Round Review',
    url: 'https://review.firstround.com/',
    blurb: 'Tactical startup ops, management, and growth from operators.',
    category: 'tech',
    topicHints: ['building-products'],
  },
  {
    id: 'hacker-news',
    name: 'Hacker News',
    url: 'https://news.ycombinator.com/',
    blurb: 'Tech + essays with high-signal discussion — use with intent, not endless scroll.',
    category: 'tech',
    topicHints: ['ai-agents', 'current-events'],
  },

  // News / current events (anti-doomscroll alternatives)
  {
    id: 'the-conversation',
    name: 'The Conversation',
    url: 'https://theconversation.com/',
    blurb: 'Academics write for the public — current events with expert context.',
    category: 'news',
    topicHints: ['current-events', 'politics'],
  },
  {
    id: 'allsides',
    name: 'AllSides',
    url: 'https://www.allsides.com/',
    blurb:
      'Same story from left, center, and right — primary weekly source for Thinker’s politics & news cards (RSS: allsides.com/rss/news).',
    category: 'news',
    topicHints: ['current-events', 'politics'],
  },
  {
    id: 'ground-news',
    name: 'Ground News',
    url: 'https://ground.news/',
    blurb: 'See which outlets cover a story and how bias skews coverage.',
    category: 'news',
    topicHints: ['current-events'],
  },
  {
    id: 'propublica',
    name: 'ProPublica',
    url: 'https://www.propublica.org/',
    blurb: 'Investigative journalism in the public interest.',
    category: 'news',
    topicHints: ['politics', 'current-events'],
  },
  {
    id: 'the-markup',
    name: 'The Markup',
    url: 'https://themarkup.org/',
    blurb: 'Nonprofit investigations into tech’s impact on privacy and fairness.',
    category: 'news',
    topicHints: ['current-events', 'ai-agents'],
  },

  // Culture / art
  {
    id: 'ted-ed',
    name: 'TED-Ed',
    url: 'https://ed.ted.com/',
    blurb: 'Short animated lessons — dream science, markets, history, and more.',
    category: 'culture',
  },
  {
    id: 'crash-course',
    name: 'Crash Course',
    url: 'https://thecrashcourse.com/',
    blurb: 'Fast educational series on history, science, econ, philosophy, and more.',
    category: 'culture',
  },
  {
    id: 'smarthistory',
    name: 'Smarthistory',
    url: 'https://smarthistory.org/',
    blurb: 'Free art history — videos, essays, and museum-quality images.',
    category: 'culture',
  },
  {
    id: 'wikiart',
    name: 'WikiArt',
    url: 'https://www.wikiart.org/',
    blurb: 'Visual art encyclopedia spanning eras and movements.',
    category: 'culture',
  },
  {
    id: 'met',
    name: 'The Met Collection',
    url: 'https://www.metmuseum.org/art/collection',
    blurb: 'Explore the Met’s collection with high-res images and context.',
    category: 'culture',
  },
  {
    id: '99pi',
    name: '99% Invisible',
    url: 'https://99percentinvisible.org/',
    blurb: 'Design that hides in plain sight — cities, sound, architecture.',
    category: 'culture',
  },
  {
    id: 'mental-floss',
    name: 'Mental Floss',
    url: 'https://www.mentalfloss.com/',
    blurb: 'Facts, trivia, and curious history without the feed dopamine trap.',
    category: 'culture',
  },
  {
    id: 'britannica',
    name: 'Encyclopædia Britannica',
    url: 'https://www.britannica.com/',
    blurb: 'Trusted general-knowledge encyclopedia for quick grounded lookups.',
    category: 'learning',
  },
  {
    id: 'wikiwand',
    name: 'Wikiwand',
    url: 'https://www.wikiwand.com/',
    blurb: 'A cleaner reading interface for Wikipedia articles.',
    category: 'learning',
  },

  // Courses / platforms
  {
    id: 'khan',
    name: 'Khan Academy',
    url: 'https://www.khanacademy.org/',
    blurb: 'Mastery-based lessons in math, science, econ, history, and coding.',
    category: 'learning',
  },
  {
    id: 'coursera',
    name: 'Coursera',
    url: 'https://www.coursera.org/',
    blurb: 'University courses — audit most for free (videos + materials).',
    category: 'learning',
  },
  {
    id: 'edx',
    name: 'edX',
    url: 'https://www.edx.org/',
    blurb: 'MIT, Harvard, Berkeley courses — audit many at no cost.',
    category: 'learning',
  },
  {
    id: 'highbrow',
    name: 'Highbrow',
    url: 'https://gohighbrow.com/',
    blurb: '10-day email courses — bite-sized morning lessons.',
    category: 'learning',
  },
  {
    id: 'listenable',
    name: 'Listenable',
    url: 'https://www.listenable.io/',
    blurb: 'Bite-sized audio courses you can play while doing something else.',
    category: 'learning',
  },

  // Writing
  {
    id: 'purdue-owl',
    name: 'Purdue OWL',
    url: 'https://owl.purdue.edu/',
    blurb: 'Gold-standard free writing, citation, and research guidance.',
    category: 'writing',
  },
  {
    id: 'hemingway',
    name: 'Hemingway Editor',
    url: 'https://hemingwayapp.com/',
    blurb: 'Highlight muddy prose, passive voice, and hard-to-read sentences.',
    category: 'writing',
  },
  {
    id: 'daily-writing-tips',
    name: 'Daily Writing Tips',
    url: 'https://www.dailywritingtips.com/',
    blurb: 'Short daily lessons on grammar, usage, and style.',
    category: 'writing',
  },
]

export const sourceLists = [
  {
    id: 'knowledgelover' as const,
    name: 'Knowledge Lover',
    url: 'https://knowledgelover.com/websites-to-learn-something-new/',
    note: '100+ websites to learn something new every day',
  },
  {
    id: 'gohighbrow' as const,
    name: 'Go Highbrow / Medium',
    url: 'https://medium.com/go-highbrow/the-30-best-websites-to-expand-your-general-knowledge-48c6d80fb367',
    note: '30 websites to expand general knowledge',
  },
  {
    id: 'gutenberg' as const,
    name: 'Project Gutenberg',
    url: 'https://www.gutenberg.org/',
    note: 'Free public-domain ebooks',
  },
]
