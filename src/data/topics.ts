import type { Topic } from './types'

export const topics: Topic[] = [
  {
    id: 'ai-agents',
    name: 'AI Agents & Tooling',
    tagline: 'Systems that act, not just answer',
    description:
      'Agent loops, tool use, MCP, evals, and the craft of shipping reliable autonomous workflows.',
    color: '#1a2332',
    accent: '#3d9cf0',
  },
  {
    id: 'llms-prompting',
    name: 'LLMs & Prompting',
    tagline: 'Talk to models like an engineer',
    description:
      'Context windows, system prompts, structured outputs, and patterns that turn vague asks into precise results.',
    color: '#1f1a2e',
    accent: '#a78bfa',
  },
  {
    id: 'rag-context',
    name: 'RAG & Context',
    tagline: 'Give models the right memory',
    description:
      'Retrieval, chunking, embeddings, and context engineering — how to keep answers grounded in your data.',
    color: '#14241f',
    accent: '#34d399',
  },
  {
    id: 'ai-frontend',
    name: 'AI Frontend Craft',
    tagline: 'Interfaces for streaming minds',
    description:
      'Streaming UIs, optimistic updates, chat patterns, and product design for AI-native apps.',
    color: '#2a1f18',
    accent: '#fb923c',
  },
  {
    id: 'nba-analytics',
    name: 'NBA Analytics',
    tagline: 'The game in numbers',
    description:
      'Possessions, efficiency, lineup data, and how modern front offices read the court.',
    color: '#1a2030',
    accent: '#60a5fa',
  },
  {
    id: 'wnba',
    name: 'WNBA',
    tagline: 'Pace, skill, and a rising league',
    description:
      'Rosters, styles of play, injuries, and the storylines shaping the WNBA season.',
    color: '#2a1824',
    accent: '#f472b6',
  },
  {
    id: 'football-film',
    name: 'Football Film',
    tagline: 'See what the coach sees',
    description:
      'Play design, coverages, tempo, and film study habits that sharpen football IQ.',
    color: '#1c2418',
    accent: '#84cc16',
  },
  {
    id: 'sports-biz',
    name: 'Sports Business',
    tagline: 'Where sports meet markets',
    description:
      'Props, media rights, NIL, and the economics behind the games you watch.',
    color: '#241c14',
    accent: '#fbbf24',
  },
  {
    id: 'current-events',
    name: 'Current Events',
    tagline: 'Signal through the noise',
    description:
      'Frameworks for reading headlines without drowning in the feed.',
    color: '#1a1f28',
    accent: '#38bdf8',
  },
  {
    id: 'history',
    name: 'History',
    tagline: 'Patterns that keep repeating',
    description:
      'Empires, revolutions, and the long arcs that explain why today looks the way it does.',
    color: '#2a2218',
    accent: '#d4a574',
  },
  {
    id: 'politics',
    name: 'Politics & Power',
    tagline: 'How decisions get made',
    description:
      'Institutions, incentives, and the quiet mechanics of influence — with free primary texts from Project Gutenberg.',
    color: '#1e1a28',
    accent: '#c084fc',
  },
  {
    id: 'finance',
    name: 'Finance & Markets',
    tagline: 'Money as a system',
    description:
      'Compounding, risk, incentives, and mental models for building and keeping wealth.',
    color: '#14221c',
    accent: '#4ade80',
  },
  {
    id: 'mental-models',
    name: 'Mental Models',
    tagline: 'Better thinking tools',
    description:
      'First principles, inversion, second-order effects — portable lenses for hard problems.',
    color: '#221a1a',
    accent: '#f87171',
  },
  {
    id: 'building-products',
    name: 'Building Products',
    tagline: 'Ship what matters',
    description:
      'Scope, feedback loops, and the discipline of turning ideas into things people use.',
    color: '#1a2228',
    accent: '#22d3ee',
  },
]

export const getTopic = (id: string) => topics.find((t) => t.id === id)
