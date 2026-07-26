#!/usr/bin/env node
/**
 * Pull curated scriptures from bolls.life (WEB) + Blue Letter Bible devotionals
 * → public/content/scriptures.json
 *
 * Pools:
 * - evergreen: curated passages + Faith's Checkbook + Spurgeon Morning
 *   (feed shows a 5-day rotating cohort)
 * - daily: BLB Daily Promises (feed shows today's doy only)
 *
 * BLB URLs (doy 1–365):
 * - promises: .../devotionals/promises/view.cfm?doy=
 * - checkbook: .../devotionals/faiths-checkbook/view.cfm?doy=
 * - morning: .../devotionals/me/view.cfm?doy=&Time=am
 *
 * Usage: node scripts/ingest-scriptures.mjs
 */
import dns from 'node:dns'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { proxyFeed } from './lib/feedProxy.mjs'
import { decodeHtmlEntities } from './lib/htmlEntities.mjs'

dns.setDefaultResultOrder('ipv4first')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'content', 'scriptures.json')
const TRANSLATION = 'WEB'
const BASE = 'https://bolls.life'
const BLB_PROMISE = 'https://www.blueletterbible.org/devotionals/promises/view.cfm'
const BLB_CHECKBOOK = 'https://www.blueletterbible.org/devotionals/faiths-checkbook/view.cfm'
const BLB_MORNING = 'https://www.blueletterbible.org/devotionals/me/view.cfm'
/** Rolling window of daily promises in the live pool */
const BLB_WINDOW_DAYS = 21
/** Evergreen filler sources — larger window = longer rest between cohort returns */
const EVERGREEN_SOURCE_WINDOW_DAYS = 60
const BLB_DELAY_MS = 400
const EVERGREEN_WINDOW_DAYS = 5
const EVERGREEN_SET_SIZE = 5

/** @typedef {{ id: string, reference: string, hook: string, lesson: string, topicIds: string[], bookId: number, chapter: number, verseStart: number, verseEnd: number }} Passage */

/** Curated passages — Thinker hooks; text filled from API */
const PASSAGES = /** @type {Passage[]} */ ([
  {
    id: 'prov-3-5-6',
    reference: 'Proverbs 3:5–6',
    hook: 'Don’t outsource wisdom to your gut alone.',
    lesson:
      'First-principles thinking still needs humility. Lean on understanding — but don’t make it the only pillar.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 20,
    chapter: 3,
    verseStart: 5,
    verseEnd: 6,
  },
  {
    id: 'prov-27-17',
    reference: 'Proverbs 27:17',
    hook: 'Feedback loops beat solo genius.',
    lesson: 'Sharp work usually comes from friction with people who care.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 20,
    chapter: 27,
    verseStart: 17,
    verseEnd: 17,
  },
  {
    id: 'prov-15-22',
    reference: 'Proverbs 15:22',
    hook: 'Plans die in echo chambers.',
    lesson: 'Before you ship a big bet, widen the circle.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 20,
    chapter: 15,
    verseStart: 22,
    verseEnd: 22,
  },
  {
    id: 'prov-18-13',
    reference: 'Proverbs 18:13',
    hook: 'Premature answers are expensive.',
    lesson: 'Hear the full problem before you propose the fix.',
    topicIds: ['mental-models', 'ai-agents'],
    bookId: 20,
    chapter: 18,
    verseStart: 13,
    verseEnd: 13,
  },
  {
    id: 'prov-11-14',
    reference: 'Proverbs 11:14',
    hook: 'Governance fails without counsel.',
    lesson: 'Solo decision-making at scale is a shared failure mode for nations and startups.',
    topicIds: ['politics', 'building-products'],
    bookId: 20,
    chapter: 11,
    verseStart: 14,
    verseEnd: 14,
  },
  {
    id: 'prov-16-9',
    reference: 'Proverbs 16:9',
    hook: 'Plan hard. Hold outcomes lightly.',
    lesson: 'Agency and contingency coexist — adapt when reality redirects the path.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 20,
    chapter: 16,
    verseStart: 9,
    verseEnd: 9,
  },
  {
    id: 'prov-4-7',
    reference: 'Proverbs 4:7',
    hook: 'Pay for understanding — it’s leverage.',
    lesson: 'Budget time and money for real learning, not just content.',
    topicIds: ['finance', 'mental-models'],
    bookId: 20,
    chapter: 4,
    verseStart: 7,
    verseEnd: 7,
  },
  {
    id: 'prov-22-3',
    reference: 'Proverbs 22:3',
    hook: 'Prudence is early risk detection.',
    lesson: 'Seeing danger and stepping aside isn’t fear — it’s compounding survival.',
    topicIds: ['finance', 'mental-models'],
    bookId: 20,
    chapter: 22,
    verseStart: 3,
    verseEnd: 3,
  },
  {
    id: 'ecc-1-9',
    reference: 'Ecclesiastes 1:9',
    hook: 'History rhymes — product cycles do too.',
    lesson: 'When a “new” pattern feels unprecedented, check the archive.',
    topicIds: ['history', 'mental-models'],
    bookId: 21,
    chapter: 1,
    verseStart: 9,
    verseEnd: 9,
  },
  {
    id: 'ecc-3-1',
    reference: 'Ecclesiastes 3:1',
    hook: 'Timing is a strategy, not just luck.',
    lesson: 'Ask if this is a plant season or a prune season.',
    topicIds: ['mental-models', 'finance'],
    bookId: 21,
    chapter: 3,
    verseStart: 1,
    verseEnd: 1,
  },
  {
    id: 'micah-6-8',
    reference: 'Micah 6:8',
    hook: 'Three verbs beat a thousand slogans.',
    lesson: 'Justice, mercy, humility — a compact ethics checklist for power.',
    topicIds: ['politics', 'mental-models'],
    bookId: 33,
    chapter: 6,
    verseStart: 8,
    verseEnd: 8,
  },
  {
    id: 'amos-5-24',
    reference: 'Amos 5:24',
    hook: 'Justice that trickles isn’t justice.',
    lesson: 'Ask whether fairness is episodic — or flowing.',
    topicIds: ['politics', 'current-events'],
    bookId: 30,
    chapter: 5,
    verseStart: 24,
    verseEnd: 24,
  },
  {
    id: 'psalm-46-10',
    reference: 'Psalm 46:10',
    hook: 'Stillness is a skill under noise.',
    lesson: 'Doomscrolling thrives on urgency. Stillness creates judgment.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 19,
    chapter: 46,
    verseStart: 10,
    verseEnd: 10,
  },
  {
    id: 'psalm-90-12',
    reference: 'Psalm 90:12',
    hook: 'Scarcity of time is the real budget.',
    lesson: 'Wisdom starts when you admit the calendar is finite.',
    topicIds: ['mental-models', 'finance'],
    bookId: 19,
    chapter: 90,
    verseStart: 12,
    verseEnd: 12,
  },
  {
    id: 'isa-1-17',
    reference: 'Isaiah 1:17',
    hook: 'Learning without doing is incomplete.',
    lesson: 'Pair study with concrete defense of someone else.',
    topicIds: ['politics', 'mental-models'],
    bookId: 23,
    chapter: 1,
    verseStart: 17,
    verseEnd: 17,
  },
  {
    id: 'matt-7-12',
    reference: 'Matthew 7:12',
    hook: 'The golden rule is a product principle.',
    lesson: 'Treat the other side as you’d want to be treated under the same constraints.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 40,
    chapter: 7,
    verseStart: 12,
    verseEnd: 12,
  },
  {
    id: 'matt-7-3-5',
    reference: 'Matthew 7:3–5',
    hook: 'Debug yourself before you debug the team.',
    lesson: 'Clear your own beam so feedback becomes useful, not theater.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 40,
    chapter: 7,
    verseStart: 3,
    verseEnd: 5,
  },
  {
    id: 'john-8-32',
    reference: 'John 8:32',
    hook: 'Truth is a liberation technology.',
    lesson: 'Prefer costly truth over cheap narrative — in news, markets, and self-talk.',
    topicIds: ['current-events', 'mental-models'],
    bookId: 43,
    chapter: 8,
    verseStart: 32,
    verseEnd: 32,
  },
  {
    id: 'rom-12-2',
    reference: 'Romans 12:2',
    hook: 'Default culture is not destiny.',
    lesson: 'Renewing the mind is deliberate rewiring against feed algorithms and stale defaults.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 45,
    chapter: 12,
    verseStart: 2,
    verseEnd: 2,
  },
  {
    id: 'phil-4-8',
    reference: 'Philippians 4:8',
    hook: 'Attention is a diet.',
    lesson: 'Curate inputs the way you’d curate training data.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 50,
    chapter: 4,
    verseStart: 8,
    verseEnd: 8,
  },
  {
    id: 'james-1-19',
    reference: 'James 1:19',
    hook: 'Listen first. Speak second. Anger last.',
    lesson: 'A three-step latency budget for hard conversations and headlines.',
    topicIds: ['mental-models', 'politics'],
    bookId: 59,
    chapter: 1,
    verseStart: 19,
    verseEnd: 19,
  },
  {
    id: 'james-1-22',
    reference: 'James 1:22',
    hook: 'Consumption isn’t transformation.',
    lesson: 'Close the loop: one action from what you just learned.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 59,
    chapter: 1,
    verseStart: 22,
    verseEnd: 22,
  },
  {
    id: 'gen-1-3',
    reference: 'Genesis 1:3',
    hook: 'Speech that creates — clarity first.',
    lesson: 'Precise language is how builders turn fog into work.',
    topicIds: ['building-products', 'history'],
    bookId: 1,
    chapter: 1,
    verseStart: 3,
    verseEnd: 3,
  },
  {
    id: 'exod-18-21',
    reference: 'Exodus 18:21',
    hook: 'Scale requires delegated integrity.',
    lesson: 'Hire for character, then cascade authority.',
    topicIds: ['building-products', 'politics'],
    bookId: 2,
    chapter: 18,
    verseStart: 21,
    verseEnd: 21,
  },
  {
    id: 'prov-16-3',
    reference: 'Proverbs 16:3',
    hook: 'Commit the work — then release the outcome.',
    lesson: 'Planning is yours; results aren’t a control panel.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 20,
    chapter: 16,
    verseStart: 3,
    verseEnd: 3,
  },
  {
    id: 'prov-27-23',
    reference: 'Proverbs 27:23',
    hook: 'Know the state of your flocks.',
    lesson: 'Dashboards beat vibes — inspect what you own before it drifts.',
    topicIds: ['finance', 'building-products'],
    bookId: 20,
    chapter: 27,
    verseStart: 23,
    verseEnd: 23,
  },
  {
    id: 'ecc-9-10',
    reference: 'Ecclesiastes 9:10',
    hook: 'Whatever your hand finds — do it with might.',
    lesson: 'Half-effort compounds into mediocrity. Finish the pass.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 21,
    chapter: 9,
    verseStart: 10,
    verseEnd: 10,
  },
  {
    id: 'isa-40-31',
    reference: 'Isaiah 40:31',
    hook: 'Strength renews when you stop forcing the sprint.',
    lesson: 'Burnout is often a pacing error. Wait, then run.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 23,
    chapter: 40,
    verseStart: 31,
    verseEnd: 31,
  },
  {
    id: 'micah-7-8',
    reference: 'Micah 7:8',
    hook: 'Falling isn’t the final frame.',
    lesson: 'Recovery is part of the strategy — expect setbacks, plan the rise.',
    topicIds: ['mental-models', 'politics'],
    bookId: 33,
    chapter: 7,
    verseStart: 8,
    verseEnd: 8,
  },
  {
    id: 'matt-5-37',
    reference: 'Matthew 5:37',
    hook: 'Let your yes be yes.',
    lesson: 'Clarity beats clever hedges in product, politics, and promises.',
    topicIds: ['building-products', 'politics'],
    bookId: 40,
    chapter: 5,
    verseStart: 37,
    verseEnd: 37,
  },
  {
    id: 'matt-6-34',
    reference: 'Matthew 6:34',
    hook: 'Tomorrow’s anxiety is a tax on today.',
    lesson: 'Worry borrows trouble you can’t spend yet. Act on what’s in range.',
    topicIds: ['mental-models', 'finance'],
    bookId: 40,
    chapter: 6,
    verseStart: 34,
    verseEnd: 34,
  },
  {
    id: 'luke-16-10',
    reference: 'Luke 16:10',
    hook: 'Faithfulness scales from small stakes.',
    lesson: 'How you handle pennies predicts how you’ll handle platforms.',
    topicIds: ['finance', 'building-products'],
    bookId: 42,
    chapter: 16,
    verseStart: 10,
    verseEnd: 10,
  },
  {
    id: 'gal-6-9',
    reference: 'Galatians 6:9',
    hook: 'Don’t quit in the compound-interest zone.',
    lesson: 'Weariness often arrives right before the harvest. Keep the cadence.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 48,
    chapter: 6,
    verseStart: 9,
    verseEnd: 9,
  },
  {
    id: 'col-3-23',
    reference: 'Colossians 3:23',
    hook: 'Work as if the audience is bigger than the standup.',
    lesson: 'Craft for the real standard — not just the nearest manager.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 51,
    chapter: 3,
    verseStart: 23,
    verseEnd: 23,
  },
  {
    id: 'heb-12-11',
    reference: 'Hebrews 12:11',
    hook: 'Discipline feels like loss until the fruit shows.',
    lesson: 'Training hurts in the moment; judgment shows later. Stay in the reps.',
    topicIds: ['mental-models', 'finance'],
    bookId: 58,
    chapter: 12,
    verseStart: 11,
    verseEnd: 11,
  },
  {
    id: '1pet-5-7',
    reference: '1 Peter 5:7',
    hook: 'Cast the anxiety — don’t hoard it.',
    lesson: 'Carrying every worry is a bad load balancer. Hand off what’s not yours.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 60,
    chapter: 5,
    verseStart: 7,
    verseEnd: 7,
  },
  // Jesus quotes — from Christianity.com “80 Most Powerful Jesus Quotes”
  // https://www.christianity.com/wiki/jesus-christ/jesus-christ-quotes.html
  {
    id: 'john-3-16',
    reference: 'John 3:16',
    hook: 'Love that spends itself.',
    lesson: 'The measure of love is what it gives away — not what it posts.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 43,
    chapter: 3,
    verseStart: 16,
    verseEnd: 16,
  },
  {
    id: 'matt-28-19-20',
    reference: 'Matthew 28:19–20',
    hook: 'Mission includes presence.',
    lesson: 'Go, teach, baptize — and remember the closer: you are not alone to the end.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 40,
    chapter: 28,
    verseStart: 19,
    verseEnd: 20,
  },
  {
    id: 'matt-11-28',
    reference: 'Matthew 11:28',
    hook: 'Rest is an invitation, not a prize.',
    lesson: 'Bring the heavy load — don’t wait until you’ve earned the right to put it down.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 40,
    chapter: 11,
    verseStart: 28,
    verseEnd: 28,
  },
  {
    id: 'matt-5-14-16',
    reference: 'Matthew 5:14–16',
    hook: 'Visibility is stewardship.',
    lesson: 'Light on a stand serves the house. Hide it and everyone stumbles in the dark.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 40,
    chapter: 5,
    verseStart: 14,
    verseEnd: 16,
  },
  {
    id: 'john-14-6',
    reference: 'John 14:6',
    hook: 'Way, truth, life — not a menu.',
    lesson: 'Some claims are exclusive on purpose. Decide whether you treat them as optional branding.',
    topicIds: ['mental-models', 'history'],
    bookId: 43,
    chapter: 14,
    verseStart: 6,
    verseEnd: 6,
  },
  {
    id: 'matt-22-37-39',
    reference: 'Matthew 22:37–39',
    hook: 'Love God. Love neighbor. That’s the stack.',
    lesson: 'Two commandments collapse a thousand debates into a priority queue.',
    topicIds: ['mental-models', 'politics'],
    bookId: 40,
    chapter: 22,
    verseStart: 37,
    verseEnd: 39,
  },
  {
    id: 'luke-6-31',
    reference: 'Luke 6:31',
    hook: 'Symmetry is the ethics shortcut.',
    lesson: 'Before you ship the policy, ask how it feels from the other chair.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 42,
    chapter: 6,
    verseStart: 31,
    verseEnd: 31,
  },
  {
    id: 'matt-6-33',
    reference: 'Matthew 6:33',
    hook: 'Seek first — then the rest orders itself.',
    lesson: 'Priority is a filter. Wrong first things make every second thing feel scarce.',
    topicIds: ['finance', 'mental-models'],
    bookId: 40,
    chapter: 6,
    verseStart: 33,
    verseEnd: 33,
  },
  {
    id: 'matt-7-7',
    reference: 'Matthew 7:7',
    hook: 'Ask. Seek. Knock. Persist.',
    lesson: 'Passive wishing isn’t a strategy. Keep the loop open until the door moves.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 40,
    chapter: 7,
    verseStart: 7,
    verseEnd: 7,
  },
  {
    id: 'matt-5-43-44',
    reference: 'Matthew 5:43–44',
    hook: 'Love the ones who don’t love you back.',
    lesson: 'Enemy-love is the hard mode of neighbor-love — and the clearest tell of the real thing.',
    topicIds: ['politics', 'mental-models'],
    bookId: 40,
    chapter: 5,
    verseStart: 43,
    verseEnd: 44,
  },
  {
    id: 'mark-12-28-31',
    reference: 'Mark 12:28–31',
    hook: 'The greatest command is not complicated.',
    lesson: 'One God, whole heart, neighbor as self — simple enough to memorize, hard enough to live.',
    topicIds: ['mental-models', 'politics'],
    bookId: 41,
    chapter: 12,
    verseStart: 28,
    verseEnd: 31,
  },
  {
    id: 'luke-6-27',
    reference: 'Luke 6:27',
    hook: 'Pray for the people who hunt you.',
    lesson: 'Spite is easy energy. Prayer redirects it before it owns you.',
    topicIds: ['mental-models', 'politics'],
    bookId: 42,
    chapter: 6,
    verseStart: 27,
    verseEnd: 27,
  },
  {
    id: 'luke-10-27',
    reference: 'Luke 10:27',
    hook: 'Heart, soul, strength, mind — all in.',
    lesson: 'Partial devotion is a split CPU. Whole-person love is the load.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 42,
    chapter: 10,
    verseStart: 27,
    verseEnd: 27,
  },
  {
    id: 'john-13-34-35',
    reference: 'John 13:34–35',
    hook: 'Love is the brand mark.',
    lesson: 'Discipleship gets recognized less by slogans than by how you treat each other.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 43,
    chapter: 13,
    verseStart: 34,
    verseEnd: 35,
  },
  {
    id: 'john-15-13',
    reference: 'John 15:13',
    hook: 'Greater love lays itself down.',
    lesson: 'Friendship’s ceiling isn’t affinity — it’s costly loyalty when it hurts.',
    topicIds: ['mental-models', 'history'],
    bookId: 43,
    chapter: 15,
    verseStart: 13,
    verseEnd: 13,
  },
  {
    id: 'john-14-15',
    reference: 'John 14:15',
    hook: 'Love shows up as obedience.',
    lesson: 'Affection without follow-through is theater. Keep the commands you claim to cherish.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 43,
    chapter: 14,
    verseStart: 15,
    verseEnd: 15,
  },
  {
    id: 'matt-4-17',
    reference: 'Matthew 4:17',
    hook: 'Repent — the kingdom is near.',
    lesson: 'Change direction before the map updates. Proximity to the good still demands a turn.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 40,
    chapter: 4,
    verseStart: 17,
    verseEnd: 17,
  },
  {
    id: 'matt-6-21',
    reference: 'Matthew 6:21',
    hook: 'Follow the treasure to find the heart.',
    lesson: 'Budgets and calendars confess what sermons won’t. Watch where attention settles.',
    topicIds: ['finance', 'mental-models'],
    bookId: 40,
    chapter: 6,
    verseStart: 21,
    verseEnd: 21,
  },
  {
    id: 'matt-6-27',
    reference: 'Matthew 6:27',
    hook: 'Worry doesn’t buy hours.',
    lesson: 'Anxiety is expensive and sterile — it spends focus without extending life.',
    topicIds: ['mental-models', 'finance'],
    bookId: 40,
    chapter: 6,
    verseStart: 27,
    verseEnd: 27,
  },
  {
    id: 'matt-7-1',
    reference: 'Matthew 7:1',
    hook: 'Judgment boomerangs.',
    lesson: 'The standard you swing at others will return on you. Soften the gavel.',
    topicIds: ['mental-models', 'politics'],
    bookId: 40,
    chapter: 7,
    verseStart: 1,
    verseEnd: 1,
  },
  {
    id: 'matt-9-2',
    reference: 'Matthew 9:2',
    hook: 'Take heart — sins forgiven.',
    lesson: 'Before the body is healed, the deeper wound gets named: you are not stuck in guilt.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 40,
    chapter: 9,
    verseStart: 2,
    verseEnd: 2,
  },
  {
    id: 'matt-19-26',
    reference: 'Matthew 19:26',
    hook: 'With God, possible expands.',
    lesson: 'Human ceilings are real. Don’t confuse them with absolute ceilings.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 40,
    chapter: 19,
    verseStart: 26,
    verseEnd: 26,
  },
  {
    id: 'mark-8-34',
    reference: 'Mark 8:34',
    hook: 'Take up the cross — then follow.',
    lesson: 'Discipleship isn’t a vibe. It’s costly alignment with a path you didn’t invent.',
    topicIds: ['mental-models', 'history'],
    bookId: 41,
    chapter: 8,
    verseStart: 34,
    verseEnd: 34,
  },
  {
    id: 'john-10-30',
    reference: 'John 10:30',
    hook: 'Unity that is identity.',
    lesson: '“I and the Father are one” is not teamwork talk — it’s a claim about who He is.',
    topicIds: ['mental-models', 'history'],
    bookId: 43,
    chapter: 10,
    verseStart: 30,
    verseEnd: 30,
  },
  {
    id: 'matt-5-3',
    reference: 'Matthew 5:3',
    hook: 'Poverty of spirit is the doorway.',
    lesson: 'Kingdom entry starts with admitting you don’t have the leverage you pretend to.',
    topicIds: ['mental-models', 'finance'],
    bookId: 40,
    chapter: 5,
    verseStart: 3,
    verseEnd: 3,
  },
  {
    id: 'matt-5-4',
    reference: 'Matthew 5:4',
    hook: 'Mourning gets comfort, not scorn.',
    lesson: 'Grief isn’t failure. It’s honesty about loss — and honesty is where comfort lands.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 40,
    chapter: 5,
    verseStart: 4,
    verseEnd: 4,
  },
  {
    id: 'matt-5-5',
    reference: 'Matthew 5:5',
    hook: 'The meek inherit — not the loudest.',
    lesson: 'Soft power outlasts domination theater. Strength under rein still wins the long game.',
    topicIds: ['politics', 'mental-models'],
    bookId: 40,
    chapter: 5,
    verseStart: 5,
    verseEnd: 5,
  },
  {
    id: 'matt-5-6',
    reference: 'Matthew 5:6',
    hook: 'Hunger for rightness gets filled.',
    lesson: 'Appetite for justice is a feature. Starve it with cynicism and you get brittle.',
    topicIds: ['politics', 'mental-models'],
    bookId: 40,
    chapter: 5,
    verseStart: 6,
    verseEnd: 6,
  },
  {
    id: 'matt-5-7',
    reference: 'Matthew 5:7',
    hook: 'Mercy is a reciprocal currency.',
    lesson: 'What you withhold from others often becomes what you lack when you need it.',
    topicIds: ['mental-models', 'politics'],
    bookId: 40,
    chapter: 5,
    verseStart: 7,
    verseEnd: 7,
  },
  {
    id: 'matt-5-8',
    reference: 'Matthew 5:8',
    hook: 'Purity of heart clears the view.',
    lesson: 'Clouded motives make God and people look like mirrors of your agenda.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 40,
    chapter: 5,
    verseStart: 8,
    verseEnd: 8,
  },
  {
    id: 'matt-5-9',
    reference: 'Matthew 5:9',
    hook: 'Peacemakers get named as family.',
    lesson: 'Peace isn’t passivity — it’s the hard craft of repairing what’s torn.',
    topicIds: ['politics', 'mental-models'],
    bookId: 40,
    chapter: 5,
    verseStart: 9,
    verseEnd: 9,
  },
  {
    id: 'matt-5-10',
    reference: 'Matthew 5:10',
    hook: 'Persecution for right still counts as blessing.',
    lesson: 'Pushback isn’t always a signal you’re wrong — sometimes it’s the cost of alignment.',
    topicIds: ['politics', 'mental-models'],
    bookId: 40,
    chapter: 5,
    verseStart: 10,
    verseEnd: 10,
  },
  {
    id: 'john-6-20',
    reference: 'John 6:20',
    hook: 'It is I — do not be afraid.',
    lesson: 'Presence collapses panic. Name who is in the boat before you name the storm.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 43,
    chapter: 6,
    verseStart: 20,
    verseEnd: 20,
  },
  {
    id: 'john-6-35',
    reference: 'John 6:35',
    hook: 'Bread that ends the hunger cycle.',
    lesson: 'Come and believe — the promise is satisfaction that scrolling never delivers.',
    topicIds: ['mental-models', 'finance'],
    bookId: 43,
    chapter: 6,
    verseStart: 35,
    verseEnd: 35,
  },
  {
    id: 'john-8-12',
    reference: 'John 8:12',
    hook: 'Follow the light or walk in dark.',
    lesson: 'Navigation needs a source. Pick a lamp brighter than your feed.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 43,
    chapter: 8,
    verseStart: 12,
    verseEnd: 12,
  },
  {
    id: 'john-8-24',
    reference: 'John 8:24',
    hook: 'Belief is not optional scenery.',
    lesson: 'Some truths you can defer; this one claims your destination depends on trust.',
    topicIds: ['mental-models', 'history'],
    bookId: 43,
    chapter: 8,
    verseStart: 24,
    verseEnd: 24,
  },
  {
    id: 'john-8-28',
    reference: 'John 8:28',
    hook: 'Lifted up, then known.',
    lesson: 'Revelation arrives after the costly act — not before the risk feels safe.',
    topicIds: ['mental-models', 'history'],
    bookId: 43,
    chapter: 8,
    verseStart: 28,
    verseEnd: 28,
  },
  {
    id: 'john-8-58',
    reference: 'John 8:58',
    hook: 'Before Abraham — I am.',
    lesson: 'This isn’t biography flex. It’s a claim that reorders history around a present tense.',
    topicIds: ['history', 'mental-models'],
    bookId: 43,
    chapter: 8,
    verseStart: 58,
    verseEnd: 58,
  },
  {
    id: 'john-10-9',
    reference: 'John 10:9',
    hook: 'The door that saves and pastures.',
    lesson: 'Entry and nourishment share one gate. Don’t invent a side entrance that starves you.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 43,
    chapter: 10,
    verseStart: 9,
    verseEnd: 9,
  },
  {
    id: 'john-10-11',
    reference: 'John 10:11',
    hook: 'The good shepherd spends his life.',
    lesson: 'Leadership that won’t bleed for the flock is hireling management.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 43,
    chapter: 10,
    verseStart: 11,
    verseEnd: 11,
  },
  {
    id: 'john-11-25',
    reference: 'John 11:25',
    hook: 'Resurrection is a person, not a metaphor.',
    lesson: 'Belief rewrites death’s last word — even when the tomb still looks sealed.',
    topicIds: ['mental-models', 'history'],
    bookId: 43,
    chapter: 11,
    verseStart: 25,
    verseEnd: 25,
  },
  {
    id: 'john-15-5',
    reference: 'John 15:5',
    hook: 'Apart from me — nothing.',
    lesson: 'Branches don’t freestyle fruit. Stay connected or watch the yield collapse.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 43,
    chapter: 15,
    verseStart: 5,
    verseEnd: 5,
  },
  {
    id: 'john-18-5',
    reference: 'John 18:5',
    hook: 'I am he — said in the arrest.',
    lesson: 'Identity doesn’t flinch when the cost arrives. He names himself in the trap.',
    topicIds: ['history', 'mental-models'],
    bookId: 43,
    chapter: 18,
    verseStart: 5,
    verseEnd: 5,
  },
  {
    id: 'rev-22-13',
    reference: 'Revelation 22:13',
    hook: 'Alpha and Omega — bookends of reality.',
    lesson: 'If He is first and last, mid-story panic loses its claim to be ultimate.',
    topicIds: ['mental-models', 'history'],
    bookId: 66,
    chapter: 22,
    verseStart: 13,
    verseEnd: 13,
  },
  {
    id: 'matt-4-4',
    reference: 'Matthew 4:4',
    hook: 'Bread alone is not a life.',
    lesson: 'Material supply without word leaves you fed and empty. Eat both.',
    topicIds: ['mental-models', 'finance'],
    bookId: 40,
    chapter: 4,
    verseStart: 4,
    verseEnd: 4,
  },
  {
    id: 'matt-5-13',
    reference: 'Matthew 5:13',
    hook: 'Salt that loses savor is trash.',
    lesson: 'Distinctiveness is the job. Blend into the pile and you forfeit the point.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 40,
    chapter: 5,
    verseStart: 13,
    verseEnd: 13,
  },
  {
    id: 'matt-5-16',
    reference: 'Matthew 5:16',
    hook: 'Let good works point upward.',
    lesson: 'Shine so others credit the Source — not so you collect the spotlight.',
    topicIds: ['building-products', 'mental-models'],
    bookId: 40,
    chapter: 5,
    verseStart: 16,
    verseEnd: 16,
  },
  {
    id: 'matt-6-1',
    reference: 'Matthew 6:1',
    hook: 'Righteousness for applause is empty.',
    lesson: 'If the feed is your reward, heaven has nothing left to pay.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 40,
    chapter: 6,
    verseStart: 1,
    verseEnd: 1,
  },
  {
    id: 'matt-6-6',
    reference: 'Matthew 6:6',
    hook: 'Pray behind the closed door.',
    lesson: 'Secret practice beats performative piety. The audience of One is enough.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 40,
    chapter: 6,
    verseStart: 6,
    verseEnd: 6,
  },
  {
    id: 'matt-6-14',
    reference: 'Matthew 6:14',
    hook: 'Forgive to be forgiven.',
    lesson: 'Clenched fists can’t receive. Release the debt you keep rehearsing.',
    topicIds: ['mental-models', 'politics'],
    bookId: 40,
    chapter: 6,
    verseStart: 14,
    verseEnd: 14,
  },
  {
    id: 'matt-6-24',
    reference: 'Matthew 6:24',
    hook: 'Two masters is a lie.',
    lesson: 'Split loyalty always picks a winner. Name which throne actually runs you.',
    topicIds: ['finance', 'mental-models'],
    bookId: 40,
    chapter: 6,
    verseStart: 24,
    verseEnd: 24,
  },
  {
    id: 'matt-6-25',
    reference: 'Matthew 6:25',
    hook: 'Life is more than the supply chain.',
    lesson: 'Food and clothes matter — anxiety about them shouldn’t become the whole plot.',
    topicIds: ['finance', 'mental-models'],
    bookId: 40,
    chapter: 6,
    verseStart: 25,
    verseEnd: 25,
  },
  {
    id: 'matt-17-20',
    reference: 'Matthew 17:20',
    hook: 'Mustard-seed faith moves mountains.',
    lesson: 'Size of faith isn’t the metric — placement is. Tiny trust aimed right still relocates.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 40,
    chapter: 17,
    verseStart: 20,
    verseEnd: 20,
  },
  {
    id: 'mark-8-35',
    reference: 'Mark 8:35',
    hook: 'Save your life and lose it.',
    lesson: 'Clutching the self is the fastest way to forfeit it. Release to receive.',
    topicIds: ['mental-models', 'history'],
    bookId: 41,
    chapter: 8,
    verseStart: 35,
    verseEnd: 35,
  },
  {
    id: 'mark-8-36',
    reference: 'Mark 8:36',
    hook: 'World gained, soul forfeit — bad trade.',
    lesson: 'Empire without a self left to enjoy it is a spreadsheet win and a human loss.',
    topicIds: ['finance', 'mental-models'],
    bookId: 41,
    chapter: 8,
    verseStart: 36,
    verseEnd: 36,
  },
  {
    id: 'luke-11-9',
    reference: 'Luke 11:9',
    hook: 'Keep asking until it opens.',
    lesson: 'Persistence isn’t nagging heaven — it’s refusing to treat silence as a final no.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 42,
    chapter: 11,
    verseStart: 9,
    verseEnd: 9,
  },
  {
    id: 'matt-7-15',
    reference: 'Matthew 7:15',
    hook: 'Sheep clothes can hide wolves.',
    lesson: 'Audit the fruit, not the costume. Soft branding is easy to fake.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 40,
    chapter: 7,
    verseStart: 15,
    verseEnd: 15,
  },
  {
    id: 'matt-10-28',
    reference: 'Matthew 10:28',
    hook: 'Fear the right scale of loss.',
    lesson: 'Body risk is real; soul risk is ultimate. Calibrate courage accordingly.',
    topicIds: ['mental-models', 'politics'],
    bookId: 40,
    chapter: 10,
    verseStart: 28,
    verseEnd: 28,
  },
  {
    id: 'matt-10-34',
    reference: 'Matthew 10:34',
    hook: 'Not peace, but a sword.',
    lesson: 'Truth divides before it heals. Don’t confuse conflict with failure of the message.',
    topicIds: ['politics', 'mental-models'],
    bookId: 40,
    chapter: 10,
    verseStart: 34,
    verseEnd: 34,
  },
  {
    id: 'matt-10-39',
    reference: 'Matthew 10:39',
    hook: 'Lose life for His sake — find it.',
    lesson: 'The path to keeping what matters is releasing what only feels like control.',
    topicIds: ['mental-models', 'history'],
    bookId: 40,
    chapter: 10,
    verseStart: 39,
    verseEnd: 39,
  },
  {
    id: 'matt-11-29-30',
    reference: 'Matthew 11:29–30',
    hook: 'Yoke easy, burden light.',
    lesson: 'Learn from the gentle Teacher. His load fits; ego’s load never does.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 40,
    chapter: 11,
    verseStart: 29,
    verseEnd: 30,
  },
  {
    id: 'matt-15-11',
    reference: 'Matthew 15:11',
    hook: 'What comes out defiles.',
    lesson: 'Speech and intent pollute faster than diet rules. Guard the mouth-exit.',
    topicIds: ['mental-models', 'politics'],
    bookId: 40,
    chapter: 15,
    verseStart: 11,
    verseEnd: 11,
  },
  {
    id: 'matt-18-3',
    reference: 'Matthew 18:3',
    hook: 'Turn and become like children.',
    lesson: 'Status theater blocks entry. Humility is the ticket, not sophistication.',
    topicIds: ['mental-models', 'building-products'],
    bookId: 40,
    chapter: 18,
    verseStart: 3,
    verseEnd: 3,
  },
  {
    id: 'matt-19-14',
    reference: 'Matthew 19:14',
    hook: 'Let the children come.',
    lesson: 'Don’t gatekeep wonder. The kingdom already belongs to the unpretentious.',
    topicIds: ['mental-models', 'politics'],
    bookId: 40,
    chapter: 19,
    verseStart: 14,
    verseEnd: 14,
  },
  {
    id: 'matt-19-24',
    reference: 'Matthew 19:24',
    hook: 'Camel, needle, rich man.',
    lesson: 'Wealth can thicken the ego until entry looks impossible. Hold riches loosely.',
    topicIds: ['finance', 'mental-models'],
    bookId: 40,
    chapter: 19,
    verseStart: 24,
    verseEnd: 24,
  },
  {
    id: 'matt-24-4-5',
    reference: 'Matthew 24:4–5',
    hook: 'Watch — many will claim the name.',
    lesson: 'Deception often wears familiar branding. Test claims before you follow the crowd.',
    topicIds: ['current-events', 'mental-models'],
    bookId: 40,
    chapter: 24,
    verseStart: 4,
    verseEnd: 5,
  },
  {
    id: 'mark-1-15',
    reference: 'Mark 1:15',
    hook: 'Time fulfilled — repent and believe.',
    lesson: 'The window is open. Delay is a decision dressed as waiting.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 41,
    chapter: 1,
    verseStart: 15,
    verseEnd: 15,
  },
  {
    id: 'mark-2-17',
    reference: 'Mark 2:17',
    hook: 'Doctors are for the sick.',
    lesson: 'He came for sinners, not the self-satisfied. Admit the need or miss the cure.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 41,
    chapter: 2,
    verseStart: 17,
    verseEnd: 17,
  },
  {
    id: 'mark-10-14',
    reference: 'Mark 10:14',
    hook: 'Kingdom belongs to such as these.',
    lesson: 'Childlike receive-mode beats adult gatekeeping. Drop the barrier you built.',
    topicIds: ['mental-models', 'politics'],
    bookId: 41,
    chapter: 10,
    verseStart: 14,
    verseEnd: 14,
  },
  {
    id: 'mark-13-13',
    reference: 'Mark 13:13',
    hook: 'Stand firm to the end.',
    lesson: 'Hate for His sake is predicted. Endurance — not applause — is the finish line.',
    topicIds: ['mental-models', 'politics'],
    bookId: 41,
    chapter: 13,
    verseStart: 13,
    verseEnd: 13,
  },
  {
    id: 'mark-14-36',
    reference: 'Mark 14:36',
    hook: 'Not what I will — what You will.',
    lesson: 'Gethsemane honesty: want the cup gone, still choose the Father’s path.',
    topicIds: ['mental-models', 'history'],
    bookId: 41,
    chapter: 14,
    verseStart: 36,
    verseEnd: 36,
  },
  {
    id: 'luke-6-30',
    reference: 'Luke 6:30',
    hook: 'Give without the claw-back.',
    lesson: 'Open hands beat ledgered generosity. Don’t gift what you plan to reclaim in spite.',
    topicIds: ['finance', 'mental-models'],
    bookId: 42,
    chapter: 6,
    verseStart: 30,
    verseEnd: 30,
  },
  {
    id: 'luke-12-49',
    reference: 'Luke 12:49',
    hook: 'Fire on the earth — already wishing it lit.',
    lesson: 'His mission isn’t mild maintenance. Expect disruption that purifies.',
    topicIds: ['politics', 'mental-models'],
    bookId: 42,
    chapter: 12,
    verseStart: 49,
    verseEnd: 49,
  },
  {
    id: 'john-10-10',
    reference: 'John 10:10',
    hook: 'Life — and life abundantly.',
    lesson: 'He came to enlarge life, not shrink it. Scarcity spirituality is a counterfeit.',
    topicIds: ['mental-models', 'finance'],
    bookId: 43,
    chapter: 10,
    verseStart: 10,
    verseEnd: 10,
  },
  {
    id: 'matt-5-11-12',
    reference: 'Matthew 5:11–12',
    hook: 'Rejoice when you’re lied about for Him.',
    lesson: 'Insult for righteousness is odd fuel — treat it as confirmation, not catastrophe.',
    topicIds: ['politics', 'mental-models'],
    bookId: 40,
    chapter: 5,
    verseStart: 11,
    verseEnd: 12,
  },
  {
    id: 'matt-16-24',
    reference: 'Matthew 16:24',
    hook: 'Deny yourself, take the cross, follow.',
    lesson: 'Three verbs of discipleship: refuse ego, accept cost, keep moving after Him.',
    topicIds: ['mental-models', 'history'],
    bookId: 40,
    chapter: 16,
    verseStart: 24,
    verseEnd: 24,
  },
  {
    id: 'john-14-1',
    reference: 'John 14:1',
    hook: 'Don’t let your heart be troubled.',
    lesson: 'Trust is the anti-panic protocol. Believe God when the room starts shaking.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 43,
    chapter: 14,
    verseStart: 1,
    verseEnd: 1,
  },
  {
    id: 'john-14-27',
    reference: 'John 14:27',
    hook: 'Peace I leave — not as the world gives.',
    lesson: 'World-peace is a ceasefire. His peace holds when the ceasefire fails.',
    topicIds: ['mental-models', 'current-events'],
    bookId: 43,
    chapter: 14,
    verseStart: 27,
    verseEnd: 27,
  },
  {
    id: 'matt-26-39',
    reference: 'Matthew 26:39',
    hook: 'Not as I will, but as You will.',
    lesson: 'The hardest prayer surrenders the preferred outcome without pretending you don’t have one.',
    topicIds: ['mental-models', 'history'],
    bookId: 40,
    chapter: 26,
    verseStart: 39,
    verseEnd: 39,
  },
  {
    id: 'luke-23-34',
    reference: 'Luke 23:34',
    hook: 'Father, forgive them.',
    lesson: 'Forgiveness from the cross redefines power — mercy while being wronged.',
    topicIds: ['politics', 'mental-models'],
    bookId: 42,
    chapter: 23,
    verseStart: 34,
    verseEnd: 34,
  },
])

const chapterCache = new Map()

/** boll.s life / Protestant canon book numbers */
const BOOK_NAME_TO_ID = {
  genesis: 1,
  exodus: 2,
  leviticus: 3,
  numbers: 4,
  deuteronomy: 5,
  joshua: 6,
  judges: 7,
  ruth: 8,
  '1 samuel': 9,
  '2 samuel': 10,
  '1 kings': 11,
  '2 kings': 12,
  '1 chronicles': 13,
  '2 chronicles': 14,
  ezra: 15,
  nehemiah: 16,
  esther: 17,
  job: 18,
  psalm: 19,
  psalms: 19,
  proverbs: 20,
  ecclesiastes: 21,
  'song of solomon': 22,
  'song of songs': 22,
  canticles: 22,
  isaiah: 23,
  jeremiah: 24,
  lamentations: 25,
  ezekiel: 26,
  daniel: 27,
  hosea: 28,
  joel: 29,
  amos: 30,
  obadiah: 31,
  jonah: 32,
  micah: 33,
  nahum: 34,
  habakkuk: 35,
  zephaniah: 36,
  haggai: 37,
  zechariah: 38,
  malachi: 39,
  matthew: 40,
  mark: 41,
  luke: 42,
  john: 43,
  acts: 44,
  romans: 45,
  '1 corinthians': 46,
  '2 corinthians': 47,
  galatians: 48,
  ephesians: 49,
  philippians: 50,
  colossians: 51,
  '1 thessalonians': 52,
  '2 thessalonians': 53,
  '1 timothy': 54,
  '2 timothy': 55,
  titus: 56,
  philemon: 57,
  hebrews: 58,
  james: 59,
  '1 peter': 60,
  '2 peter': 61,
  '1 john': 62,
  '2 john': 63,
  '3 john': 64,
  jude: 65,
  revelation: 66,
  // common abbrevs
  gen: 1,
  exo: 2,
  ex: 2,
  lev: 3,
  num: 4,
  deut: 5,
  jos: 6,
  jdg: 7,
  rut: 8,
  '1 sam': 9,
  '2 sam': 10,
  '1 ki': 11,
  '2 ki': 12,
  '1 chr': 13,
  '2 chr': 14,
  ezr: 15,
  neh: 16,
  est: 17,
  psa: 19,
  ps: 19,
  prov: 20,
  ecc: 21,
  sos: 22,
  isa: 23,
  jer: 24,
  lam: 25,
  eze: 26,
  ezk: 26,
  dan: 27,
  hos: 28,
  jol: 29,
  amo: 30,
  oba: 31,
  jon: 32,
  mic: 33,
  nah: 34,
  hab: 35,
  zep: 36,
  hag: 37,
  zec: 38,
  mal: 39,
  mat: 40,
  matt: 40,
  mrk: 41,
  luk: 42,
  jhn: 43,
  joh: 43,
  act: 44,
  rom: 45,
  '1 cor': 46,
  '2 cor': 47,
  gal: 48,
  eph: 49,
  php: 50,
  phil: 50,
  col: 51,
  '1 th': 52,
  '1 thess': 52,
  '2 th': 53,
  '2 thess': 53,
  '1 tim': 54,
  '2 tim': 55,
  tit: 56,
  phm: 57,
  heb: 58,
  jas: 59,
  '1 pet': 60,
  '2 pet': 61,
  '1 jn': 62,
  '2 jn': 63,
  '3 jn': 64,
  jud: 65,
  rev: 66,
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function dayOfYear(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor((now - start) / 86400000)
}

/** Rolling doys ending at today (handles year wrap via Date math). */
function recentDoys(windowDays = BLB_WINDOW_DAYS, from = new Date()) {
  const out = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - i),
    )
    out.push(dayOfYear(d))
  }
  return out
}

async function fetchChapter(bookId, chapter) {
  const key = `${bookId}:${chapter}`
  if (chapterCache.has(key)) return chapterCache.get(key)
  const url = `${BASE}/get-text/${TRANSLATION}/${bookId}/${chapter}/`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ThinkerScriptureBot/1.0' },
  })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  const data = await res.json()
  chapterCache.set(key, data)
  return data
}

function stripTags(s) {
  return decodeHtmlEntities(String(s || '').replace(/<[^>]+>/g, ''))
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(s) {
  return decodeHtmlEntities(s)
}

/** Parse "(Galatians 3:29)" or Spurgeon-style "… — Hebrews 10:17". */
function parseReference(raw) {
  const s = stripTags(decodeEntities(raw))
  const bookPat = `([1-3]?\\s*[A-Za-z]+(?:\\s+(?:of\\s+)?[A-Za-z]+)?)`
  const versePat = `(\\d+):(\\d+)(?:\\s*[-–]\\s*(\\d+))?`

  let m = s.match(new RegExp(`\\(${bookPat}\\s+${versePat}\\)\\s*$`))
  let verseText = ''
  if (m) {
    verseText = s.replace(m[0], '').replace(/\[[^\]]*\]/g, '').trim()
  } else {
    m = s.match(new RegExp(`[—–-]\\s*${bookPat}\\s+${versePat}\\s*$`))
    if (!m) return null
    verseText = s
      .slice(0, m.index)
      .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .trim()
  }

  const bookName = m[1].replace(/\s+/g, ' ').trim().toLowerCase()
  const bookId = BOOK_NAME_TO_ID[bookName]
  if (!bookId) return null
  const chapter = Number(m[2])
  const verseStart = Number(m[3])
  const verseEnd = m[4] ? Number(m[4]) : verseStart
  const reference = `${m[1].replace(/\s+/g, ' ').trim()} ${chapter}:${verseStart}${
    verseEnd !== verseStart ? `–${verseEnd}` : ''
  }`
  return { bookId, chapter, verseStart, verseEnd, reference, verseText }
}

async function verseTextFromBolls(bookId, chapter, verseStart, verseEnd) {
  const verses = await fetchChapter(bookId, chapter)
  const slice = verses.filter((v) => v.verse >= verseStart && v.verse <= verseEnd)
  if (!slice.length) return ''
  return slice.map((v) => stripTags(v.text)).join(' ')
}

async function buildItem(passage) {
  const text = await verseTextFromBolls(
    passage.bookId,
    passage.chapter,
    passage.verseStart,
    passage.verseEnd,
  )
  if (!text) throw new Error(`No verses for ${passage.id}`)
  return {
    id: passage.id,
    reference: passage.reference,
    text,
    translation: TRANSLATION,
    hook: passage.hook,
    lesson: passage.lesson,
    topicIds: passage.topicIds,
    sourceUrl: `${BASE}/${TRANSLATION}/${passage.bookId}/${passage.chapter}/`,
    bookId: passage.bookId,
    chapter: passage.chapter,
    verseStart: passage.verseStart,
    verseEnd: passage.verseEnd,
    pool: 'evergreen',
  }
}

/**
 * First substantive paragraph after the verse blockquote.
 * @param {string} html
 */
function lessonAfterBlockquote(html, fallback) {
  const after = html.split(/<\/blockquote>/i)[1] || ''
  const paras = [...after.matchAll(/<p>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(decodeEntities(m[1])))
    .filter((t) => t.length > 40)
  if (!paras.length) return fallback
  const joined = paras.slice(0, 2).join(' ')
  return joined.length > 420 ? `${joined.slice(0, 417).trim()}…` : joined
}

/**
 * @param {number} doy
 * @param {'promise' | 'checkbook' | 'morning'} kind
 */
async function fetchBlbDevotional(doy, kind) {
  /** @type {{ url: string, idPrefix: string, pool: 'daily' | 'evergreen', h1Re: RegExp, hookPrefix: string }} */
  const meta =
    kind === 'promise'
      ? {
          url: `${BLB_PROMISE}?doy=${doy}`,
          idPrefix: 'blb-promise-doy',
          pool: 'daily',
          h1Re: /<h1>\s*Daily Promises\s*<br\s*\/?>\s*\(([^)]+)\)\s*<\/h1>/i,
          hookPrefix: 'Daily promise',
        }
      : kind === 'checkbook'
        ? {
            url: `${BLB_CHECKBOOK}?doy=${doy}`,
            idPrefix: 'blb-checkbook-doy',
            pool: 'evergreen',
            h1Re: /<h1>\s*C\.\s*H\.\s*Spurgeon's\s*<br\s*\/?>\s*Faith's Checkbook\s*<br\s*\/?>\s*\(([^)]+)\)\s*<\/h1>/i,
            hookPrefix: "Faith's Checkbook",
          }
        : {
            url: `${BLB_MORNING}?doy=${doy}&Time=am`,
            idPrefix: 'blb-morning-doy',
            pool: 'evergreen',
            h1Re: /<h1>\s*C\.\s*H\.\s*Spurgeon's\s*<br\s*\/?>\s*Morning Reading\s*<br\s*\/?>\s*\(([^)]+)\)\s*<\/h1>/i,
            hookPrefix: 'Morning reading',
          }

  const proxied = await proxyFeed(meta.url)
  if (!proxied.ok) throw new Error(proxied.error || `proxy ${proxied.status}`)
  const html = proxied.body

  const titleM = html.match(meta.h1Re)
  const dateLabel = titleM ? stripTags(titleM[1]) : `Day ${doy}`

  const bqM = html.match(/<blockquote>\s*<p>([\s\S]*?)<\/p>\s*<\/blockquote>/i)
  if (!bqM) throw new Error('no blockquote')
  const parsed = parseReference(bqM[1])
  if (!parsed) throw new Error(`unparsed ref: ${stripTags(bqM[1]).slice(0, 80)}`)

  let lesson = ''
  if (kind === 'promise') {
    const reflM = html.match(/<h4>\s*Reflection\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i)
    lesson = reflM
      ? stripTags(decodeEntities(reflM[1]))
      : 'Sit with this promise — then take one faithful next step.'
    lesson = `${lesson} Open the full Blue Letter Bible reading for ${dateLabel}.`
  } else {
    lesson = lessonAfterBlockquote(
      html,
      `Sit with ${parsed.reference} — then take one faithful next step.`,
    )
  }

  let text = ''
  try {
    text = await verseTextFromBolls(
      parsed.bookId,
      parsed.chapter,
      parsed.verseStart,
      parsed.verseEnd,
    )
  } catch {
    text = ''
  }
  if (!text) text = parsed.verseText
  if (!text) throw new Error('no verse text')

  return {
    id: `${meta.idPrefix}-${doy}`,
    reference: parsed.reference,
    text,
    translation: TRANSLATION,
    hook: `${meta.hookPrefix} · ${dateLabel}`,
    lesson,
    topicIds: ['mental-models', 'current-events'],
    sourceUrl: meta.url,
    bookId: parsed.bookId,
    chapter: parsed.chapter,
    verseStart: parsed.verseStart,
    verseEnd: parsed.verseEnd,
    pool: meta.pool,
  }
}

async function ingestBlbWindow(kind, windowDays, label) {
  const doys = recentDoys(windowDays)
  console.log(
    `${label} doy ${doys[0]}…${doys[doys.length - 1]} (${doys.length} days)`,
  )
  const items = []
  let ok = 0
  for (const doy of doys) {
    try {
      const item = await fetchBlbDevotional(doy, kind)
      items.push(item)
      ok += 1
      console.log(`✓ ${label} doy=${doy} · ${item.reference}`)
    } catch (err) {
      console.warn(
        `✗ ${label} doy=${doy}:`,
        err instanceof Error ? err.message : err,
      )
    }
    await sleep(BLB_DELAY_MS)
  }
  if (ok === 0) {
    console.warn(`Warning: 0/${doys.length} ${label} fetched`)
  }
  return items
}

async function main() {
  const items = []

  for (const p of PASSAGES) {
    try {
      const item = await buildItem(p)
      items.push(item)
      console.log(`✓ ${p.reference}`)
    } catch (err) {
      console.warn(`✗ ${p.reference}:`, err instanceof Error ? err.message : err)
    }
  }

  items.push(...(await ingestBlbWindow('promise', BLB_WINDOW_DAYS, 'BLB promise')))
  items.push(
    ...(await ingestBlbWindow(
      'checkbook',
      EVERGREEN_SOURCE_WINDOW_DAYS,
      'BLB checkbook',
    )),
  )
  items.push(
    ...(await ingestBlbWindow(
      'morning',
      EVERGREEN_SOURCE_WINDOW_DAYS,
      'BLB morning',
    )),
  )

  if (!items.length) {
    console.error('No scriptures fetched')
    process.exit(1)
  }

  const byId = new Map()
  for (const item of items) byId.set(item.id, item)

  const evergreen = [...byId.values()].filter((i) => i.pool !== 'daily').length
  const daily = [...byId.values()].filter((i) => i.pool === 'daily').length

  const payload = {
    updatedAt: new Date().toISOString(),
    translation: TRANSLATION,
    source:
      'bolls.life + blueletterbible.org (promises, faiths-checkbook, morning)',
    blbWindowDays: BLB_WINDOW_DAYS,
    evergreenSourceWindowDays: EVERGREEN_SOURCE_WINDOW_DAYS,
    evergreenWindowDays: EVERGREEN_WINDOW_DAYS,
    evergreenSetSize: EVERGREEN_SET_SIZE,
    items: [...byId.values()],
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(
    `Wrote ${byId.size} scriptures (${evergreen} evergreen, ${daily} daily) → ${OUT}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
