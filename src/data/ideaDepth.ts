import type { Idea } from './types'

/** Depth overlays for flagship ideas — hook → lesson → takeaway */
export const ideaDepth: Record<
  string,
  Pick<Idea, 'hook' | 'lesson' | 'takeaway' | 'example'>
> = {
  'agent-loop': {
    hook: 'An agent isn’t magic — it’s a loop that needs a stop condition.',
    lesson:
      'Strip the hype and you’re left with observe → decide → act → update. Reliability comes from bounding that loop: clear stop conditions, tool allowlists, and evals on the paths that matter. A flashy demo with no bounds will wander forever in production.',
    takeaway: 'Ship the loop bounds before you ship the autonomy.',
    example:
      'A film-review agent that can “always dig one more play” needs a max-tool-calls limit — or it’ll chew tokens until the session dies.',
  },
  'mcp-contract': {
    hook: 'Vague mega-tools are how agents fail silently.',
    lesson:
      'MCP and tool calling work when each tool has a narrow job, typed inputs, and predictable failures. Prefer small tools that return structured results. “Do anything with the browser” sounds powerful — until you can’t tell why it broke.',
    takeaway: 'Treat tools like APIs with contracts, not wishes.',
    example:
      'Split “scrape roster” and “update odds sheet” into two tools. When the roster call fails, the agent knows which step died.',
  },
  'agent-evals': {
    hook: 'If you can’t measure the agent, you can’t ship the agent.',
    lesson:
      'Prompt tweaks feel productive until production. Build a tiny eval set from real failures: wrong tool choice, hallucinated IDs, infinite loops. Run it on every prompt or model change. Demos lie; regressions don’t.',
    takeaway: 'Evals turn vibes into a release gate.',
  },
  'possessions-matter': {
    hook: 'Raw points lie. Possessions tell the truth.',
    lesson:
      'A team that scores 110 in a slow game may be less efficient than one that scores 108 in a fast one. Offensive and defensive rating (points per 100 possessions) are the lingua franca of modern NBA analysis. Pace without efficiency is just noise.',
    takeaway: 'Always normalize by possessions before you rank.',
    example:
      'Two WNBA teams post similar scores; the faster one may still be the worse offense once you look at points per 100.',
  },
  'keys-to-coverage': {
    hook: 'Before you name the play, name the shell.',
    lesson:
      'Film study starts with safety depth and corner alignment: single-high, two-high, or muddy post-snap. Route concepts are chosen against coverage families. Calling plays without reading the shell is guessing.',
    takeaway: 'Coverage family first — concept second.',
  },
  'veto-points': {
    hook: '“Nothing happening” is often the system working as designed.',
    lesson:
      'Committees, courts, and federalism multiply veto points. Big change gets hard; incrementalism becomes the default. Frustration with gridlock often reflects institutional design — not just cowardice. Federalist Nos. 10 and 51 still explain the shape.',
    takeaway: 'Count the veto points before you blame the people.',
  },
  'compounding': {
    hook: 'The boring edge that repeats beats the dramatic one-off.',
    lesson:
      'Small advantages, kept alive over time, dominate flashy wins. In markets and careers, time in the game beats timing the game — if you protect the downside so compounding can work.',
    takeaway: 'Protect the streak; the streak does the work.',
  },
  'division-of-labor': {
    hook: 'Specialization multiplies output — and coordination is the tax.',
    lesson:
      'Smith’s pin factory: split work into focused tasks and productivity jumps. The same pattern shows up in software teams, sports roles, and AI toolchains. Gains come with a coordination cost you have to design for.',
    takeaway: 'Split the work, then pay for the handoffs deliberately.',
  },
  'stoic-morning': {
    hook: 'Judge what you control. Release the rest.',
    lesson:
      'Marcus Aurelius wrote notes to himself on campaign — not for an audience. The durable move is separating controllable inputs from outcomes. Free on Gutenberg; treat it as a field manual, not a shrine.',
    takeaway: 'Control the inputs; stop arguing with the scoreboard.',
  },
  'three-angles': {
    hook: 'One feed is not the whole picture.',
    lesson:
      'AllSides puts left, center, and right coverage side by side. Bias doesn’t disappear — but you stop mistaking one timeline for reality. Better than refreshing one feed for “balance.”',
    takeaway: 'Read the same story three ways before you decide.',
  },
  'stream-tokens': {
    hook: 'Waiting for the full LLM reply feels broken.',
    lesson:
      'Stream tokens, show partial tool status, keep the UI alive. Perceived speed is product quality in AI apps — even when total latency is unchanged. Blank spinners create anxiety; progress creates trust.',
    takeaway: 'Streaming is the interaction, not a nicety.',
  },
  'narrow-wedge': {
    hook: 'Broad platforms die unfinished.',
    lesson:
      'Ship a sharp use case for a real user — film review for one coach, props for one sport — then expand. Depth creates the right to go wide. Scope cuts are how unfinished products become finished.',
    takeaway: 'Win a narrow wedge first.',
  },
  'data-before-take': {
    hook: 'Check the chart before the take.',
    lesson:
      'Hot takes thrive on vibes. Our World in Data shows long-run trends for poverty, health, energy, and tech. Open the chart, then form the opinion — reverse of a comment-thread habit.',
    takeaway: 'Evidence first, narrative second.',
  },
  'props-as-markets': {
    hook: 'A points line isn’t a prediction — it’s a price.',
    lesson:
      'Player props are probability markets. Sharp bettors think in distributions and correlations (minutes, pace, opponent). Casual fans think in narratives. The edge lives in that gap.',
    takeaway: 'Price the distribution, not the story.',
  },
  'chunk-for-questions': {
    hook: 'Bad chunks poison good retrieval.',
    lesson:
      'Arbitrary 500-token slices ignore document structure. Chunk by section, API method, or play concept — units that answer real questions. Retrieval quality starts at ingestion, not at the vector search call.',
    takeaway: 'Chunk for the questions you’ll ask.',
  },
}

export function presentIdea(idea: Idea) {
  const depth = ideaDepth[idea.id]
  const hook = depth?.hook ?? idea.hook ?? idea.title
  const lesson = depth?.lesson ?? idea.lesson ?? idea.body
  const takeaway = depth?.takeaway ?? idea.takeaway
  const example = depth?.example ?? idea.example
  // Only collapse when there's real extra structure (example / takeaway) —
  // never hide a leftover sentence behind "Read more".
  const hasMore = Boolean(takeaway || example)

  return { hook, lesson, takeaway, example, hasMore }
}
