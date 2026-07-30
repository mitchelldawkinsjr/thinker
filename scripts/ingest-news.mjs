#!/usr/bin/env node
/**
 * Fetch politics / current-events / finance RSS → public/content/news.json
 * Thinker-shaped cards with tiered TTL from ingest time:
 *   politics → 3 days (headlines go stale fast)
 *   everything else → 10 days
 * Override per feed with `ttlDays`. Seed lessons are always merged in.
 *
 * Usage: node scripts/ingest-news.mjs
 */
import { createHash } from 'node:crypto'
import dns from 'node:dns'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeHtmlEntities } from './lib/htmlEntities.mjs'

// Prefer IPv4 — some feeds (e.g. Al Jazeera) fail on unreachable IPv6 routes
dns.setDefaultResultOrder('ipv4first')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'content', 'news.json')
const YT_ARCHIVE_DIR = join(ROOT, 'public', 'content', 'yt-archives')
/** Hard-news / politics — short window; stories change daily */
const TTL_DAYS_POLITICS = 3
/** Culture, sports, faith, general current-events */
const TTL_DAYS_DEFAULT = 10
const DAY_MS = 24 * 60 * 60 * 1000
const YT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** @typedef {{ id: string, hook: string, title: string, lesson: string, source: string, sourceUrl: string, publishedAt: string, expiresAt: string, topicIds: string[], angles?: { label: string, url: string }[], feedId?: string }} NewsItem */

const FEEDS = [
  {
    // Multi-perspective headlines — primary weekly politics/current-events source
    id: 'allsides',
    name: 'AllSides',
    url: 'https://www.allsides.com/rss/news',
    topicIds: ['politics', 'current-events'],
    limit: 12,
  },
  {
    id: 'al-jazeera',
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    topicIds: ['current-events', 'politics'],
    limit: 10,
  },
  {
    id: 'al-jazeera-news-feed',
    name: 'Al Jazeera News Feed',
    url: 'https://www.omnycontent.com/d/playlist/9c074afa-3313-47e8-b802-a9f900789975/b10cdeda-cd0d-41ea-a737-ad8a01050808/cee1148d-ea1d-4149-9475-ad8a0105363f/podcast.rss',
    topicIds: ['current-events', 'politics'],
    limit: 8,
    kind: 'podcast',
    siteUrl: 'https://www.aljazeera.com/podcasts/news-updates/',
  },
  {
    id: 'npr-politics',
    name: 'NPR Politics',
    url: 'https://feeds.npr.org/1014/rss.xml',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  {
    id: 'npr-news-now',
    name: 'NPR News Now',
    url: 'https://feeds.npr.org/500005/podcast.xml',
    topicIds: ['current-events'],
    limit: 6,
    kind: 'podcast',
    siteUrl: 'https://www.npr.org/podcasts/500005/npr-news-now',
  },
  {
    id: 'npr-politics-podcast',
    name: 'NPR Politics Podcast',
    url: 'https://feeds.npr.org/510310/podcast.xml',
    topicIds: ['politics', 'current-events'],
    limit: 6,
    kind: 'podcast',
    siteUrl: 'https://www.npr.org/podcasts/510310/npr-politics-podcast',
  },
  {
    id: 'npr-up-first',
    name: 'Up First',
    url: 'https://feeds.npr.org/510318/podcast.xml',
    topicIds: ['current-events', 'politics'],
    limit: 6,
    kind: 'podcast',
    siteUrl: 'https://www.npr.org/podcasts/510318/up-first',
  },
  {
    id: 'npr-code-switch',
    name: 'Code Switch',
    url: 'https://feeds.npr.org/510312/podcast.xml',
    topicIds: ['current-events'],
    limit: 5,
    kind: 'podcast',
    siteUrl: 'https://www.npr.org/podcasts/510312/codeswitch',
    lessonStyle: 'culture',
  },
  {
    id: 'npr-morning-edition',
    name: 'Morning Edition',
    url: 'https://feeds.npr.org/3/rss.xml',
    topicIds: ['current-events', 'politics'],
    limit: 8,
  },
  {
    id: 'the-conversation-politics',
    name: 'The Conversation · Politics',
    url: 'https://theconversation.com/us/politics/articles.atom',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  {
    id: 'propublica',
    name: 'ProPublica',
    url: 'https://www.propublica.org/feeds/propublica/main',
    topicIds: ['politics', 'current-events'],
    limit: 6,
  },
  {
    id: 'bbc-politics',
    name: 'BBC Politics',
    url: 'https://feeds.bbci.co.uk/news/politics/rss.xml',
    topicIds: ['politics', 'current-events'],
    limit: 6,
  },
  {
    id: 'black-political-news',
    name: 'Black Political News',
    url: 'https://rss.app/feeds/v1.1/tXmxv8nuAzRRkvTG.json',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  {
    id: 'congress',
    name: 'Congress',
    url: 'https://rss.app/feeds/v1.1/tcKJj9qeKSubFqWa.json',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  {
    id: 'war',
    name: 'War',
    url: 'https://rss.app/feeds/v1.1/tPxxxGsDpoflsm8c.json',
    topicIds: ['politics', 'current-events'],
    limit: 8,
  },
  // Faith / Christian journalism
  {
    id: 'christian-today',
    name: 'Christian Today',
    url: 'https://www.christiantoday.com/rss.xml',
    topicIds: ['current-events', 'mental-models'],
    limit: 6,
  },
  {
    id: 'christianity-today',
    name: 'Christianity Today',
    url: 'https://www.christianitytoday.com/feed/',
    topicIds: ['current-events', 'mental-models'],
    limit: 8,
  },
  {
    id: 'crosswalk',
    name: 'Crosswalk',
    url: 'https://www.crosswalk.com/rss.xml',
    topicIds: ['mental-models', 'current-events'],
    limit: 6,
  },
  {
    id: 'ap-top-news',
    name: 'AP Top News',
    url: 'https://rsshub.app/apnews/topics/apf-topnews',
    topicIds: ['current-events'],
    limit: 5,
    optional: true,
  },
  {
    id: 'aaron-parnas',
    name: 'The Parnas Perspective',
    url: 'https://aaronparnas.substack.com/feed',
    topicIds: ['politics', 'current-events'],
    limit: 8,
    ttlDays: 3,
    // Substack also attaches mp3 enclosures — keep the article page as CTA
    preferPageLink: true,
  },
  {
    // Site mirrors Substack but has no public RSS — scrape homepage article cards.
    id: 'parnas-news',
    name: 'PARNAS News',
    url: 'https://www.parnasnews.com/',
    topicIds: ['politics', 'current-events'],
    limit: 8,
    kind: 'site-articles',
    articlePathPrefix: '/articles/',
    siteUrl: 'https://www.parnasnews.com/',
    ttlDays: 3,
  },
  // C-SPAN.org HTML/RSS is WAF-challenged; Megaphone podcasts + YouTube carry the news.
  {
    id: 'cspan-washington-today',
    name: 'C-SPAN · Washington Today',
    url: 'https://feeds.megaphone.fm/cspanwashingtontoday',
    topicIds: ['politics', 'current-events'],
    limit: 6,
    kind: 'podcast',
    siteUrl: 'https://www.c-span.org/',
    ttlDays: 3,
  },
  {
    id: 'cspan-qa',
    name: 'C-SPAN · Q&A',
    url: 'https://feeds.megaphone.fm/cspanqa',
    topicIds: ['politics', 'history', 'current-events'],
    limit: 4,
    kind: 'podcast',
    siteUrl: 'https://www.c-span.org/',
    ttlDays: 7,
  },
  // Black pop culture / music — verified XML only
  {
    id: 'philip-lewis',
    name: 'Philip Lewis',
    url: 'https://rss.app/feeds/v1.1/DMmESHzgp7DfJBh9.json',
    topicIds: ['current-events'],
    limit: 8,
    lessonStyle: 'culture',
  },
  {
    id: 'black-pop-culture',
    name: 'Black Pop Culture',
    url: 'https://rss.app/feeds/v1.1/twaYgziGNNhuhsNL.json',
    topicIds: ['current-events'],
    limit: 8,
    lessonStyle: 'culture',
  },
  {
    id: 'essence',
    name: 'Essence',
    url: 'https://www.essence.com/feed/',
    topicIds: ['current-events'],
    limit: 6,
    lessonStyle: 'culture',
  },
  {
    id: 'billboard-rb-hip-hop',
    name: 'Billboard R&B/Hip-Hop',
    url: 'https://www.billboard.com/c/music/rb-hip-hop/feed/',
    topicIds: ['current-events'],
    limit: 6,
    lessonStyle: 'culture',
  },
  {
    id: 'xxl',
    name: 'XXL',
    url: 'https://www.xxlmag.com/feed/',
    topicIds: ['current-events'],
    limit: 5,
    lessonStyle: 'culture',
  },
  {
    id: 'vibe',
    name: 'Vibe',
    url: 'https://www.vibe.com/feed/',
    topicIds: ['current-events'],
    limit: 5,
    lessonStyle: 'culture',
  },
  {
    id: 'the-shade-room',
    name: 'The Shade Room',
    url: 'https://theshaderoom.com/feed/',
    topicIds: ['current-events'],
    limit: 4,
    lessonStyle: 'culture',
  },
  {
    id: 'mediatakeout',
    name: 'MediaTakeOut',
    url: 'https://mediatakeout.com/feed/',
    topicIds: ['current-events'],
    limit: 3,
    lessonStyle: 'culture',
  },
  // Sports — RSS.app topic feeds (JSON Feed 1.1; NBA has no public XML)
  {
    id: 'nba-basketball-news',
    name: 'NBA & Basketball News',
    url: 'https://rss.app/feeds/v1.1/tCcjmK096Kle1DEN.json',
    topicIds: ['nba-analytics', 'sports-biz'],
    limit: 8,
  },
  {
    id: 'nfl-football-news',
    name: 'NFL & Football News',
    url: 'https://rss.app/feeds/v1.1/tAQFDM5ScLlCIIWp.json',
    topicIds: ['football-film', 'sports-biz'],
    limit: 8,
  },
  // Finance — MarketWatch (Dow Jones)
  {
    id: 'marketwatch-marketpulse',
    name: 'MarketWatch · MarketPulse',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse',
    topicIds: ['finance', 'current-events'],
    limit: 8,
    ttlDays: 3,
  },
  {
    id: 'marketwatch-bulletins',
    name: 'MarketWatch · Bulletins',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_bulletins',
    topicIds: ['finance', 'current-events'],
    limit: 10,
    ttlDays: 3,
  },
  {
    id: 'cnbc-finance',
    name: 'CNBC · Finance',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',
    topicIds: ['finance', 'current-events'],
    limit: 10,
    ttlDays: 3,
  },

  // ── AI news / research (blogs + newsletters) ───────────────────────────
  {
    id: 'ai-weekly',
    name: 'AI Weekly',
    url: 'https://aiweekly.co/feed',
    topicIds: ['ai-agents', 'llms-prompting', 'current-events'],
    limit: 8,
  },
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch · AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    topicIds: ['ai-agents', 'current-events', 'building-products'],
    limit: 8,
  },
  {
    id: 'mit-tr-ai',
    name: 'MIT Technology Review · AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/',
    topicIds: ['ai-agents', 'llms-prompting', 'current-events'],
    limit: 6,
  },
  {
    id: 'openai-news',
    name: 'OpenAI News',
    url: 'https://openai.com/blog/rss.xml',
    topicIds: ['ai-agents', 'llms-prompting'],
    limit: 6,
  },
  {
    id: 'huggingface-blog',
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    topicIds: ['llms-prompting', 'rag-context', 'ai-agents'],
    limit: 6,
  },
  {
    id: 'deepmind-blog',
    name: 'Google DeepMind',
    url: 'https://deepmind.google/blog/rss.xml',
    topicIds: ['ai-agents', 'llms-prompting'],
    limit: 6,
  },
  {
    id: 'nvidia-dev-blog',
    name: 'NVIDIA Technical Blog',
    url: 'https://developer.nvidia.com/blog/feed/',
    topicIds: ['ai-agents', 'rag-context'],
    limit: 6,
  },
  {
    id: 'the-gradient',
    name: 'The Gradient',
    url: 'https://thegradient.pub/rss/',
    topicIds: ['llms-prompting', 'ai-agents'],
    limit: 4,
  },
  {
    id: 'import-ai',
    name: 'Import AI',
    url: 'https://importai.substack.com/feed',
    topicIds: ['ai-agents', 'llms-prompting', 'current-events'],
    limit: 6,
  },
  {
    id: 'last-week-in-ai',
    name: 'Last Week in AI',
    url: 'https://lastweekin.ai/feed',
    topicIds: ['ai-agents', 'current-events'],
    limit: 6,
  },
  {
    id: 'simon-willison',
    name: 'Simon Willison',
    url: 'https://simonwillison.net/atom/everything/',
    topicIds: ['ai-agents', 'llms-prompting', 'rag-context'],
    limit: 8,
  },
  {
    id: 'latent-space',
    name: 'Latent Space',
    url: 'https://www.latent.space/feed',
    topicIds: ['ai-agents', 'llms-prompting', 'building-products'],
    limit: 6,
  },
  {
    id: 'langchain-blog',
    name: 'LangChain Blog',
    url: 'https://blog.langchain.com/rss.xml',
    topicIds: ['ai-agents', 'rag-context', 'llms-prompting'],
    limit: 6,
  },
  {
    id: 'one-useful-thing',
    name: 'One Useful Thing',
    url: 'https://www.oneusefulthing.org/feed',
    topicIds: ['llms-prompting', 'ai-agents', 'building-products'],
    limit: 5,
  },
  {
    id: 'interconnects',
    name: 'Interconnects',
    url: 'https://www.interconnects.ai/feed',
    topicIds: ['llms-prompting', 'ai-agents'],
    limit: 5,
  },
  {
    id: 'bens-bites',
    name: "Ben's Bites",
    url: 'https://www.bensbites.com/feed',
    topicIds: ['ai-agents', 'current-events', 'building-products'],
    limit: 6,
  },
  {
    id: 'ars-technica-ai',
    name: 'Ars Technica · AI',
    url: 'https://arstechnica.com/ai/feed/',
    topicIds: ['ai-agents', 'current-events'],
    limit: 6,
  },
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    url: 'https://blog.google/technology/ai/rss/',
    topicIds: ['ai-agents', 'llms-prompting'],
    limit: 6,
  },

  // ── YouTube channels (Atom) + Shorts (UUSH playlist RSS) ───────────────
  // Shorts: playlist_id = "UUSH" + channelId.slice(2)  (undocumented, works)
  ...[
    {
      id: 'yt-two-minute-papers',
      name: 'Two Minute Papers',
      channelId: 'UCbfYPyITQ-7l4upoX8nvctg',
      handle: 'TwoMinutePapers',
      topicIds: ['ai-agents', 'llms-prompting'],
      shorts: true,
    },
    {
      id: 'yt-karpathy',
      name: 'Andrej Karpathy',
      channelId: 'UCXUPKJO5MZQN11PqgIvyuvQ',
      handle: 'AndrejKarpathy',
      topicIds: ['llms-prompting', 'ai-agents'],
      shorts: false,
    },
    {
      id: 'yt-3blue1brown',
      name: '3Blue1Brown',
      channelId: 'UCYO_jab_esuFRV4b17AJtAw',
      handle: '3blue1brown',
      topicIds: ['llms-prompting', 'mental-models'],
      shorts: true,
    },
    {
      id: 'yt-deeplearning-ai',
      name: 'DeepLearning.AI',
      channelId: 'UCcIXc5mJsHVYTZR1maL5l9w',
      handle: 'DeepLearningAI',
      topicIds: ['llms-prompting', 'ai-agents', 'rag-context'],
      shorts: true,
    },
    {
      id: 'yt-yannic-kilcher',
      name: 'Yannic Kilcher',
      channelId: 'UCZHmQk67mSJgfCCTn7xBfew',
      handle: 'YannicKilcher',
      topicIds: ['llms-prompting', 'ai-agents'],
      shorts: true,
    },
    {
      id: 'yt-lex-fridman',
      name: 'Lex Fridman',
      channelId: 'UCSHZKyawb77ixDdsGog4iWA',
      handle: 'lexfridman',
      topicIds: ['ai-agents', 'mental-models'],
      shorts: true,
      limit: 4,
    },
    {
      id: 'yt-sentdex',
      name: 'Sentdex',
      channelId: 'UCfzlCWGWYyIQ0aLC5w48gBQ',
      handle: 'sentdex',
      topicIds: ['llms-prompting', 'ai-agents'],
      shorts: true,
    },
    {
      id: 'yt-statquest',
      name: 'StatQuest',
      channelId: 'UCtYLUTtgS3k1Fg4y5tAhLbw',
      handle: 'statquest',
      topicIds: ['llms-prompting', 'mental-models'],
      shorts: true,
    },
    {
      id: 'yt-dwarkesh',
      name: 'Dwarkesh Patel',
      channelId: 'UCXl4i9dYBrFOabk0xGmbkRA',
      handle: 'DwarkeshPatel',
      topicIds: ['ai-agents', 'llms-prompting', 'current-events'],
      shorts: true,
    },
    {
      id: 'yt-openai',
      name: 'OpenAI · YouTube',
      channelId: 'UCXZCJLdBC09xxGZ6gcdrc6A',
      handle: 'OpenAI',
      topicIds: ['ai-agents', 'llms-prompting'],
      shorts: true,
    },
    {
      id: 'yt-anthropic',
      name: 'Anthropic · YouTube',
      channelId: 'UCrDwWp7EBBv4NwvScIpBDOA',
      handle: 'Anthropic-AI',
      topicIds: ['ai-agents', 'llms-prompting'],
      shorts: true,
    },
    {
      id: 'yt-huggingface',
      name: 'Hugging Face · YouTube',
      channelId: 'UCHlNU7kIZhRgSbhHvFoy72w',
      handle: 'HuggingFace',
      topicIds: ['llms-prompting', 'rag-context', 'ai-agents'],
      shorts: true,
    },
    {
      id: 'yt-deepmind',
      name: 'Google DeepMind · YouTube',
      channelId: 'UCP7jMXSY2xbc3KCAE0MHQ-A',
      handle: 'GoogleDeepMind',
      topicIds: ['ai-agents', 'llms-prompting'],
      shorts: true,
    },
    {
      id: 'yt-nvidia-dev',
      name: 'NVIDIA Developer · YouTube',
      channelId: 'UCBHcMCGaiJhv-ESTcWGJPcw',
      handle: 'NVIDIADeveloper',
      topicIds: ['ai-agents', 'rag-context'],
      shorts: true,
    },
    {
      id: 'yt-techcrunch',
      name: 'TechCrunch · YouTube',
      channelId: 'UCCjyq_K1Xwfg8Lndy7lKMpA',
      handle: 'techcrunch',
      topicIds: ['ai-agents', 'current-events', 'building-products'],
      shorts: true,
    },
    {
      id: 'yt-mit-tr',
      name: 'MIT Technology Review · YouTube',
      channelId: 'UCgy4Mf_tlZGqesYNqPNxjPw',
      handle: 'technologyreview',
      topicIds: ['ai-agents', 'current-events'],
      shorts: true,
    },
    {
      id: 'yt-langchain',
      name: 'LangChain · YouTube',
      channelId: 'UCC-lyoTfSrcJzA1ab3APAgw',
      handle: 'LangChain',
      topicIds: ['ai-agents', 'rag-context', 'llms-prompting'],
      shorts: true,
    },
    {
      id: 'yt-latent-space',
      name: 'Latent Space · YouTube',
      channelId: 'UCxBcwypKK-W3GHd_RZ9FZrQ',
      handle: 'LatentSpacePod',
      topicIds: ['ai-agents', 'llms-prompting'],
      shorts: true,
    },
    {
      id: 'yt-ai-explained',
      name: 'AI Explained',
      channelId: 'UCNJ1Ymd5yFuUPtn21xtRbbw',
      handle: 'aiexplained-official',
      topicIds: ['ai-agents', 'llms-prompting', 'current-events'],
      shorts: false,
    },
    {
      id: 'yt-matthew-berman',
      name: 'Matthew Berman',
      channelId: 'UCzi5kcwU8aT4aLR7LcYhfWQ',
      handle: 'MatthewBerman',
      topicIds: ['ai-agents', 'llms-prompting'],
      shorts: false,
    },
    {
      id: 'yt-wes-roth',
      name: 'Wes Roth',
      channelId: 'UCqcbQf6yw5KzRoDDcZ_wBSw',
      handle: 'WesRoth',
      topicIds: ['ai-agents', 'current-events'],
      shorts: true,
    },
    {
      id: 'yt-ai-coffee-break',
      name: 'AI Coffee Break',
      channelId: 'UCobqgqE4i5Kf7wrxRxhToQA',
      handle: 'AICoffeeBreak',
      topicIds: ['llms-prompting', 'ai-agents'],
      shorts: true,
    },
    {
      id: 'yt-black-history-two-min',
      name: 'Black History in Two Minutes',
      channelId: 'UCYYNgeK89XFPu-7qUm8edqg',
      handle: 'BlackHistoryinTwoMinutes',
      topicIds: ['history'],
      shorts: true,
      limit: 8,
      // Channel is quiet — rotate through the full uploads playlist so older
      // episodes keep showing up alongside whatever is still “recent”.
      archive: {
        playlistId: 'PLsB1WO8xAXzyMz4BihC_6a07RZummkGza',
        batchSize: 8,
        /** Prefer mixing head-of-playlist (newer) with deeper cuts */
        mixRecent: 4,
      },
      ttlDays: 12,
    },
    {
      id: 'yt-the-pivot',
      name: 'The Pivot Podcast',
      channelId: 'UCUnxiP7q4RDDyeioZFZLnXA',
      handle: 'thepivotpodcast',
      topicIds: ['sports-biz', 'nba-analytics', 'football-film'],
      shorts: true,
      limit: 6,
    },
    {
      id: 'yt-ruslan-kd',
      name: 'Ruslan KD',
      channelId: 'UCj2yZE96gWsFyeVYnY9zXeg',
      handle: 'RuslanKD',
      topicIds: ['current-events', 'mental-models'],
      shorts: true,
      limit: 5,
    },
    {
      id: 'yt-raven-rock-homestead',
      name: 'Raven Rock Homestead',
      channelId: 'UCcEAgEkAxcrz1Piezwe9ZJw',
      handle: 'RavenRockHomestead',
      topicIds: ['mental-models', 'building-products'],
      shorts: false,
      limit: 6,
    },
    {
      id: 'yt-raw-room',
      name: 'Raw Room',
      channelId: 'UCS7xvlPBPNGHjUvFRKItUBQ',
      handle: 'raw__room',
      topicIds: ['sports-biz', 'football-film', 'current-events'],
      shortsOnly: true,
      limit: 6,
    },
    {
      id: 'yt-89show',
      name: '89 — Steve Smith Sr.',
      channelId: 'UCwpDj5ZRfVYefwmA2FnlwKw',
      handle: '89show',
      topicIds: ['football-film', 'sports-biz'],
      shortsOnly: true,
      limit: 6,
    },
    {
      id: 'yt-mind-the-game',
      name: 'Mind the Game',
      channelId: 'UC6L_LBqoKZXFa4WxHox5iCw',
      handle: 'MindTheGamePodcast',
      topicIds: ['nba-analytics', 'sports-biz'],
      shortsOnly: true,
      limit: 6,
    },
    {
      id: 'yt-mojo-brookzz',
      name: 'Mojo Brookzz',
      channelId: 'UCvWHvXyTOZu9fzS9JzODkCQ',
      handle: 'mojobrookzz',
      topicIds: ['current-events'],
      shortsOnly: true,
      limit: 6,
    },
    {
      id: 'yt-cspan',
      name: 'C-SPAN',
      channelId: 'UCb--64Gl51jIEVE-GLDAVTg',
      handle: 'CSPAN',
      topicIds: ['politics', 'current-events'],
      shortsOnly: true,
      limit: 6,
    },
    {
      id: 'yt-npr-podcasts',
      name: 'NPR Podcasts',
      channelId: 'UCuVaB0t5qJRxP55gEl6TuKQ',
      handle: 'nprpodcasts',
      topicIds: ['current-events', 'politics'],
      shortsOnly: true,
      limit: 6,
    },
    {
      id: 'yt-npr',
      name: 'NPR',
      channelId: 'UCJnS2EsPfv46u1JR8cnD0NA',
      handle: 'NPR',
      topicIds: ['current-events', 'politics'],
      shortsOnly: true,
      limit: 6,
    },
    {
      id: 'yt-npr-music',
      name: 'NPR Music',
      channelId: 'UC4eYXhJI4-7wSWc8UNRwD4A',
      handle: 'nprmusic',
      topicIds: ['current-events'],
      shortsOnly: true,
      limit: 6,
    },
    {
      id: 'yt-espn',
      name: 'ESPN',
      channelId: 'UCiWLfSweyRNmLpgEHekhoAg',
      handle: 'espn',
      topicIds: ['sports-biz', 'nba-analytics', 'football-film', 'wnba'],
      shortsOnly: true,
      limit: 6,
    },
    {
      id: 'yt-joel-tudman',
      name: 'Joel Tudman Official',
      channelId: 'UCH7Wym9XlXFNEvqLqibX0tg',
      handle: 'JoelTudmanOfficial',
      topicIds: ['mental-models', 'current-events'],
      shorts: true,
      limit: 5,
    },
  ].flatMap((ch) => {
    const siteUrl = `https://www.youtube.com/@${ch.handle}`
    const limit = ch.limit ?? 5
    const shortsBase = ch.name.replace(/\s·\sYouTube$/, '')
    const channelFeed = {
      id: ch.id,
      name: ch.name,
      url: `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`,
      topicIds: ch.topicIds,
      limit,
      kind: 'youtube',
      siteUrl,
      ...(ch.ttlDays ? { ttlDays: ch.ttlDays } : {}),
      ...(ch.archive ? { archive: ch.archive } : {}),
    }
    const shortsFeed = {
      id: `${ch.id}-shorts`,
      name: `${shortsBase} · Shorts`,
      url: `https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH${ch.channelId.slice(2)}`,
      topicIds: ch.topicIds,
      limit: ch.shortsOnly ? limit : 4,
      kind: 'youtube-shorts',
      siteUrl,
      optional: true,
      ...(ch.ttlDays ? { ttlDays: ch.ttlDays } : {}),
    }
    if (ch.shortsOnly) return [shortsFeed]
    if (!ch.shorts) return [channelFeed]
    return [channelFeed, shortsFeed]
  }),
]

const SEED = /** @type {NewsItem[]} */ ([
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
])

function stripHtml(html) {
  // Decode entities first — Reddit Atom encodes markup as &lt;img…&gt;, so tag
  // stripping must run on the decoded HTML or the card body shows raw markup.
  const decoded = decodeHtmlEntities(
    String(html || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'),
  )
  return decoded
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(block, name) {
  const re = new RegExp(
    `<(?:${name}|[^:>]+:${name})(?:\\s[^>]*)?>([\\s\\S]*?)</(?:${name}|[^:>]+:${name})>`,
    'i',
  )
  const m = block.match(re)
  return m ? stripHtml(m[1]) : ''
}

function attr(block, name, attrName) {
  const re = new RegExp(
    `<(?:${name}|[^:>]+:${name})[^>]*\\s${attrName}=["']([^"']+)["'][^>]*/?>`,
    'i',
  )
  const m = block.match(re)
  return m ? m[1] : ''
}

function decodeEntities(s) {
  return decodeHtmlEntities(s)
}

const MEDIA_EXTS = new Set([
  'mp3',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'opus',
  'wav',
  'flac',
  'weba',
  'mp4',
  'webm',
  'mov',
  'm4v',
  'ogv',
  'mkv',
])

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'])

function mediaPathExt(url) {
  try {
    const path = new URL(url, 'https://example.invalid').pathname
    const base = path.split('/').pop() || ''
    const dot = base.lastIndexOf('.')
    if (dot < 0 || dot === base.length - 1) return null
    return base.slice(dot + 1).toLowerCase()
  } catch {
    return null
  }
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url)
}

function isImageUrl(url, type = '', medium = '') {
  if (String(medium || '').toLowerCase() === 'image') return true
  const t = String(type || '').toLowerCase()
  if (t.startsWith('image/')) return true
  const ext = mediaPathExt(url)
  return !!(ext && IMAGE_EXTS.has(ext))
}

/** Prefer playable audio/video enclosures over webpage <link> (e.g. Club 520). */
function mediaEnclosureUrl(block) {
  const candidates = [
    {
      url: attr(block, 'enclosure', 'url'),
      type: attr(block, 'enclosure', 'type'),
    },
    {
      url: attr(block, 'media:content', 'url'),
      type: attr(block, 'media:content', 'type'),
    },
  ]
  for (const c of candidates) {
    const url = decodeEntities(c.url || '').trim()
    if (!url) continue
    const type = String(c.type || '').toLowerCase()
    if (type.startsWith('audio/') || type.startsWith('video/')) return url
    const ext = mediaPathExt(url)
    if (ext && MEDIA_EXTS.has(ext)) return url
  }
  return ''
}

function attrFromOpenTag(openTagAttrs, attrName) {
  const m = String(openTagAttrs || '').match(
    new RegExp(`(?:^|\\s)${attrName}=["']([^"']+)["']`, 'i'),
  )
  return m ? m[1] : ''
}

/** First usable image: media:thumbnail, image enclosure/content, then <img> in HTML body. */
function entryImageUrl(block) {
  const thumb = decodeEntities(
    attr(block, 'media:thumbnail', 'url') || attr(block, 'thumbnail', 'url') || '',
  ).trim()
  if (thumb && isHttpUrl(thumb)) return thumb

  const mediaRe = /<(?:media:content|enclosure)(\s[^>]*)?\/?>/gi
  let m
  while ((m = mediaRe.exec(block))) {
    const attrs = m[1] || ''
    const url = decodeEntities(attrFromOpenTag(attrs, 'url')).trim()
    if (!url || !isHttpUrl(url)) continue
    const type = attrFromOpenTag(attrs, 'type')
    const medium = attrFromOpenTag(attrs, 'medium')
    if (isImageUrl(url, type, medium)) return url
  }

  const htmlParts = []
  for (const name of ['description', 'summary', 'content', 'content:encoded']) {
    const re = new RegExp(
      `<(?:${name}|[^:>]+:${name})(?:\\s[^>]*)?>([\\s\\S]*?)</(?:${name}|[^:>]+:${name})>`,
      'i',
    )
    const hit = block.match(re)
    if (hit) htmlParts.push(hit[1])
  }
  const html = decodeEntities(
    htmlParts.join(' ').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'),
  )
  const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi
  while ((m = imgRe.exec(html))) {
    const src = decodeEntities(m[1] || '').trim()
    if (!src || !isHttpUrl(src)) continue
    if (/redditstatic\.com/i.test(src) && /icon|award|emoji|snoo/i.test(src)) continue
    if (/\b(emoji|award|icon)\b/i.test(src)) continue
    return src
  }
  return ''
}

function parseEntries(xml, opts = {}) {
  const chunks = []
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi
  const entryRe = /<entry[\s>][\s\S]*?<\/entry>/gi
  let m
  while ((m = itemRe.exec(xml))) chunks.push(m[0])
  while ((m = entryRe.exec(xml))) chunks.push(m[0])
  return chunks.map((block) => {
    const title = tag(block, 'title')
    let link =
      tag(block, 'link') ||
      attr(block, 'link', 'href') ||
      (block.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1] ||
      ''
    if (!link) {
      const guid = tag(block, 'guid')
      if (guid.startsWith('http')) link = guid
    }
    link = decodeEntities(link)
    // Podcast / media feeds: enclosure is the playable file; <link> is often a show page
    const media = mediaEnclosureUrl(block)
    if (media && !opts.preferPageLink) link = media
    else if (!link && media) link = media
    else if (!link) link = ''
    const summary =
      tag(block, 'description') ||
      tag(block, 'summary') ||
      tag(block, 'content') ||
      tag(block, 'content:encoded') ||
      ''
    const published =
      tag(block, 'pubDate') ||
      tag(block, 'published') ||
      tag(block, 'updated') ||
      tag(block, 'dc:date') ||
      ''
    const imageUrl = entryImageUrl(block) || undefined
    return { title, link, summary, published, imageUrl }
  })
}

/** JSON Feed 1.1 (rss.app /feeds/v1.1/*.json) */
function parseJsonFeed(text) {
  const data = JSON.parse(text)
  const items = Array.isArray(data.items) ? data.items : []
  return items.map((it) => {
    let imageUrl = String(it.image || it.banner_image || '').trim()
    if (!imageUrl && Array.isArray(it.attachments)) {
      for (const a of it.attachments) {
        const url = String(a.url || '').trim()
        if (url && isImageUrl(url, a.mime_type || '')) {
          imageUrl = url
          break
        }
      }
    }
    if (!imageUrl && it.content_html) {
      imageUrl = entryImageUrl(`<content>${it.content_html}</content>`)
    }
    return {
      title: stripHtml(it.title || ''),
      link: String(it.url || it.external_url || '').trim(),
      summary: stripHtml(it.content_text || it.summary || it.content_html || ''),
      published: String(it.date_published || it.date_modified || ''),
      imageUrl: imageUrl || undefined,
    }
  })
}

function parseFeedBody(text, feedUrl, opts = {}) {
  const trimmed = text.trimStart()
  if (feedUrl.includes('.json') || trimmed.startsWith('{')) {
    return parseJsonFeed(text)
  }
  return parseEntries(text, opts)
}

function hookFromTitle(title) {
  const t = title.trim()
  if (t.length <= 72) return t
  const cut = t.slice(0, 69)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`
}

/** Summary only — headline challenges are rendered in the UI, not glued on. */
function lessonFrom(summary, title) {
  const s = (summary || '').trim()
  if (s.length >= 40) {
    const cut = s.slice(0, 320)
    const sp = cut.lastIndexOf(' ')
    return `${(sp > 120 ? cut.slice(0, sp) : cut).trim()}`
  }
  if (s.length > 0) return s
  return title.trim()
}

function idFor(url, title) {
  const h = createHash('sha1').update(`${url}|${title}`).digest('hex').slice(0, 12)
  return `rss-${h}`
}

/** Pool lifetime from ingest — not publish date — so stale feeds still get a full window. */
function ttlDaysFor(feed) {
  if (typeof feed.ttlDays === 'number' && feed.ttlDays > 0) return feed.ttlDays
  if (Array.isArray(feed.topicIds) && feed.topicIds.includes('politics')) {
    return TTL_DAYS_POLITICS
  }
  return TTL_DAYS_DEFAULT
}

function expiresFrom(ttlDays, now = Date.now()) {
  return new Date(now + ttlDays * DAY_MS).toISOString()
}

function toIso(published) {
  const t = Date.parse(published)
  if (!Number.isNaN(t)) return new Date(t).toISOString()
  return new Date().toISOString()
}

/**
 * Weekly index for rotating archive slices.
 * @param {number} [now]
 */
function weekIndex(now = Date.now()) {
  return Math.floor(now / (7 * DAY_MS))
}

/**
 * Take `n` items from `arr`, wrapping from a week-derived start.
 * @template T
 * @param {T[]} arr
 * @param {number} n
 * @param {number} week
 * @param {number} [salt]
 * @returns {T[]}
 */
function weekSlice(arr, n, week, salt = 0) {
  if (!arr.length || n <= 0) return []
  const size = Math.min(n, arr.length)
  const start = ((week + salt) * size) % arr.length
  /** @type {T[]} */
  const out = []
  for (let i = 0; i < size; i++) out.push(arr[(start + i) % arr.length])
  return out
}

/**
 * Mix newer (playlist head) + deeper archive cuts so quiet channels stay fresh.
 * @template {{ videoId: string }} T
 * @param {T[]} catalog newest-first
 * @param {{ batchSize: number, mixRecent?: number }} archive
 * @param {number} week
 */
function rotateArchiveMix(catalog, archive, week) {
  const batchSize = Math.max(1, archive.batchSize || 8)
  if (catalog.length <= batchSize) return catalog

  const mixRecent = Math.min(
    batchSize,
    Math.max(1, archive.mixRecent ?? Math.ceil(batchSize / 2)),
  )
  const mixOlder = batchSize - mixRecent
  const recentPool = Math.max(
    mixRecent,
    Math.min(catalog.length, Math.ceil(catalog.length * 0.3)),
  )
  const recent = catalog.slice(0, recentPool)
  const older = catalog.slice(recentPool)

  /** @type {Map<string, T>} */
  const byId = new Map()
  for (const item of weekSlice(recent, mixRecent, week, 0)) byId.set(item.videoId, item)
  for (const item of weekSlice(older, mixOlder, week, 19)) byId.set(item.videoId, item)

  // Top up from full catalog if older pool was thin
  if (byId.size < batchSize) {
    for (const item of weekSlice(catalog, batchSize, week, 7)) {
      byId.set(item.videoId, item)
      if (byId.size >= batchSize) break
    }
  }
  return [...byId.values()].slice(0, batchSize)
}

/**
 * @param {string} html
 * @returns {{ videoId: string, title: string, imageUrl?: string }[]}
 */
function parseYoutubePlaylistLockups(html) {
  const m = html.match(/ytInitialData\s*=\s*(\{.*?\});<\/script>/s)
  if (!m) return []
  let data
  try {
    data = JSON.parse(m[1])
  } catch {
    return []
  }

  /** @type {{ videoId: string, title: string, imageUrl?: string }[]} */
  const found = []
  /** @type {Set<string>} */
  const seen = new Set()

  /**
   * @param {unknown} node
   */
  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    const o = /** @type {Record<string, unknown>} */ (node)
    if (o.lockupViewModel && typeof o.lockupViewModel === 'object') {
      const lv = /** @type {Record<string, unknown>} */ (o.lockupViewModel)
      const videoId = typeof lv.contentId === 'string' ? lv.contentId : ''
      const meta = /** @type {Record<string, unknown>} */ (lv.metadata || {})
      const lockupMeta = /** @type {Record<string, unknown>} */ (
        meta.lockupMetadataViewModel || {}
      )
      const titleObj = /** @type {Record<string, unknown>} */ (lockupMeta.title || {})
      const title =
        typeof titleObj.content === 'string'
          ? titleObj.content.trim()
          : typeof (
                /** @type {Record<string, unknown>} */ (lv.rendererContext || {})
                  .accessibilityContext
              )?.label === 'string'
            ? String(
                /** @type {Record<string, any>} */ (lv.rendererContext).accessibilityContext
                  .label,
              )
                .replace(/\s+\d+\s+minutes?.*$/i, '')
                .trim()
            : ''
      let imageUrl
      try {
        const sources =
          /** @type {any} */ (lv.contentImage)?.thumbnailViewModel?.image?.sources
        if (Array.isArray(sources) && sources.length) {
          imageUrl = sources[sources.length - 1]?.url || sources[0]?.url
        }
      } catch {
        // ignore
      }
      if (videoId && title && !seen.has(videoId)) {
        seen.add(videoId)
        found.push({ videoId, title, imageUrl })
      }
    }
    for (const v of Object.values(o)) walk(v)
  }

  walk(data)
  return found
}

/**
 * Load + refresh a YouTube playlist archive, then emit a rotating mix.
 * @param {any} feed
 * @returns {Promise<NewsItem[]>}
 */
async function fetchYoutubeArchiveFeed(feed) {
  const archive = feed.archive
  const playlistId = archive?.playlistId
  if (!playlistId) throw new Error('archive.playlistId required')

  const archivePath = join(YT_ARCHIVE_DIR, `${feed.id}.json`)
  /** @type {{ videoId: string, title: string, imageUrl?: string }[]} */
  let previous = []
  try {
    const raw = JSON.parse(await readFile(archivePath, 'utf8'))
    if (Array.isArray(raw?.items)) previous = raw.items
  } catch {
    // first run
  }

  const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`
  const res = await fetch(playlistUrl, {
    headers: {
      'User-Agent': YT_UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`playlist ${res.status}`)
  const html = await res.text()
  const scraped = parseYoutubePlaylistLockups(html)

  /** @type {Map<string, { videoId: string, title: string, imageUrl?: string }>} */
  const byId = new Map()
  // Prefer scrape order (newest-first); keep prior titles if scrape misses some
  for (const item of scraped) byId.set(item.videoId, item)
  for (const item of previous) {
    if (!byId.has(item.videoId)) byId.set(item.videoId, item)
  }

  // Prefer scraped order for the head of the catalog
  const catalog = [
    ...scraped,
    ...[...byId.values()].filter((i) => !scraped.some((s) => s.videoId === i.videoId)),
  ]
  if (catalog.length === 0) throw new Error('empty YouTube archive catalog')

  await mkdir(YT_ARCHIVE_DIR, { recursive: true })
  await writeFile(
    archivePath,
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        feedId: feed.id,
        playlistId,
        source: playlistUrl,
        items: catalog,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  const week = weekIndex()
  const batch = rotateArchiveMix(catalog, archive, week)
  const ttlDays = ttlDaysFor(feed)
  const ingestedAt = Date.now()
  const siteUrl = feed.siteUrl || playlistUrl

  return batch.map((v, i) => {
    const link = `https://www.youtube.com/watch?v=${v.videoId}`
    const title = v.title
    /** @type {NewsItem} */
    const item = {
      id: idFor(link, title),
      hook: hookFromTitle(title),
      title,
      lesson: `${title} — a short episode from Black History in Two Minutes. Watch, then keep one detail that complicates the usual textbook version.`,
      source: feed.name,
      sourceUrl: link,
      // Stable-ish ordering within the week batch (not true publish dates)
      publishedAt: new Date(ingestedAt - i * 60_000).toISOString(),
      expiresAt: expiresFrom(ttlDays, ingestedAt),
      topicIds: feed.topicIds,
      feedId: feed.id,
      imageUrl: v.imageUrl,
      angles: [
        { label: 'Watch', url: link },
        { label: 'Channel', url: siteUrl },
      ],
    }
    return item
  })
}

/**
 * Sites without RSS (e.g. PARNAS News) — pull article cards from the homepage.
 * Expects links like `/articles/slug` with nearby `img alt="Title"`.
 * @param {any} feed
 * @returns {Promise<NewsItem[]>}
 */
async function fetchSiteArticlesFeed(feed) {
  const prefix = feed.articlePathPrefix || '/articles/'
  const origin = new URL(feed.url).origin
  const res = await fetch(feed.url, {
    headers: {
      'User-Agent': YT_UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const html = await res.text()

  /** @type {{ path: string, title: string }[]} */
  const found = []
  /** @type {Set<string>} */
  const seen = new Set()
  const re = new RegExp(
    `href="(${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]+)"[\\s\\S]{0,1200}?alt="([^"]{8,240})"`,
    'gi',
  )
  let m
  while ((m = re.exec(html)) !== null) {
    const path = m[1].split('#')[0].split('?')[0]
    const title = decodeHtmlEntities(m[2]).replace(/\s+/g, ' ').trim()
    if (!path || !title || seen.has(path)) continue
    seen.add(path)
    found.push({ path, title })
  }

  if (found.length === 0) throw new Error('no site articles found on homepage')

  const limit = feed.limit ?? 8
  const ttlDays = ttlDaysFor(feed)
  const ingestedAt = Date.now()
  const siteUrl = feed.siteUrl || origin

  return found.slice(0, limit).map((row, i) => {
    const link = new URL(row.path, origin).href
    /** @type {NewsItem} */
    const item = {
      id: idFor(link, row.title),
      hook: hookFromTitle(row.title),
      title: row.title,
      lesson: lessonFrom('', row.title),
      source: feed.name,
      sourceUrl: link,
      publishedAt: new Date(ingestedAt - i * 60_000).toISOString(),
      expiresAt: expiresFrom(ttlDays, ingestedAt),
      topicIds: feed.topicIds,
      feedId: feed.id,
      angles: [
        { label: 'Full story', url: link },
        { label: 'Site', url: siteUrl },
      ],
    }
    return item
  })
}

async function fetchFeed(feed) {
  if (feed.archive?.playlistId && feed.kind === 'youtube') {
    return fetchYoutubeArchiveFeed(feed)
  }
  if (feed.kind === 'site-articles') {
    return fetchSiteArticlesFeed(feed)
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'ThinkerNewsBot/1.0 (+https://thinker.360web.cloud)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const body = await res.text()
    const entries = parseFeedBody(body, feed.url, {
      preferPageLink: Boolean(feed.preferPageLink),
    }).slice(0, feed.limit)
    const ttlDays = ttlDaysFor(feed)
    const ingestedAt = Date.now()
    return entries
      .filter((e) => e.title && e.link)
      .map((e) => {
        const publishedAt = toIso(e.published)
        const isPodcast = feed.kind === 'podcast'
        const isYoutube =
          feed.kind === 'youtube' || feed.kind === 'youtube-shorts'
        /** @type {NewsItem} */
        const item = {
          id: idFor(e.link, e.title),
          hook: hookFromTitle(e.title),
          title: e.title,
          lesson: lessonFrom(e.summary, e.title),
          source: feed.name,
          sourceUrl: e.link,
          publishedAt,
          expiresAt: expiresFrom(ttlDays, ingestedAt),
          topicIds: feed.topicIds,
          feedId: feed.id,
          imageUrl: e.imageUrl,
          angles: isPodcast
            ? [
                { label: 'Listen', url: e.link },
                {
                  label: 'Show page',
                  url: feed.siteUrl || e.link,
                },
              ]
            : isYoutube
              ? [
                  {
                    label:
                      feed.kind === 'youtube-shorts' ? 'Watch Short' : 'Watch',
                    url: e.link,
                  },
                  { label: 'Channel', url: feed.siteUrl || e.link },
                ]
              : [{ label: 'Full story', url: e.link }],
        }
        return item
      })
  } finally {
    clearTimeout(timer)
  }
}

async function loadExisting() {
  try {
    const raw = await readFile(OUT, 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data.items) ? data.items : []
  } catch {
    return []
  }
}

function isActive(item, now = Date.now()) {
  const exp = Date.parse(item.expiresAt)
  if (Number.isNaN(exp)) return true
  return exp > now
}

/** Migrate legacy long-TTL politics cards down to the politics window. */
function clampPoliticsExpiry(item, now = Date.now()) {
  if (!Array.isArray(item.topicIds) || !item.topicIds.includes('politics')) return item
  if (String(item.expiresAt || '').startsWith('2099')) return item // evergreen seeds
  const maxExp = now + TTL_DAYS_POLITICS * DAY_MS
  const exp = Date.parse(item.expiresAt)
  if (Number.isNaN(exp) || exp <= maxExp) return item
  return { ...item, expiresAt: new Date(maxExp).toISOString() }
}

/** Drop legacy hardcoded AllSides chips from scraped cards (seeds keep theirs). */
function sanitizeAngles(item) {
  if (!Array.isArray(item.angles) || item.angles.length === 0) return item
  if (String(item.expiresAt || '').startsWith('2099')) return item
  const angles = item.angles.filter((a) => a.label !== 'AllSides')
  if (angles.length === item.angles.length) return item
  return { ...item, angles }
}

async function main() {
  const existing = await loadExisting()
  /** @type {NewsItem[]} */
  const scraped = []

  for (const feed of FEEDS) {
    try {
      const items = await fetchFeed(feed)
      const extra = feed.archive ? ' (archive rotate)' : ''
      console.log(`✓ ${feed.name}: ${items.length}${extra}`)
      scraped.push(...items)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (feed.optional) {
        console.warn(`· skip optional ${feed.name}: ${msg}`)
      } else {
        console.warn(`✗ ${feed.name}: ${msg}`)
      }
    }
  }

  const byId = new Map()
  // Archive-rotated YouTube feeds replace prior cards from the same feedId
  // so quiet channels don't stack old RSS batches on top of the new mix.
  const archiveFeedIds = new Set(
    FEEDS.filter((f) => f.archive?.playlistId).map((f) => f.id),
  )
  const freshArchiveIds = new Set(
    scraped.filter((i) => archiveFeedIds.has(i.feedId)).map((i) => i.id),
  )
  for (const item of [...existing, ...scraped, ...SEED]) {
    const next = sanitizeAngles(clampPoliticsExpiry(item))
    if (!isActive(next)) continue
    if (
      next.feedId &&
      archiveFeedIds.has(next.feedId) &&
      !freshArchiveIds.has(next.id)
    ) {
      continue
    }
    byId.set(next.id, next)
  }

  const items = [...byId.values()].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  )

  const payload = {
    updatedAt: new Date().toISOString(),
    items,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${items.length} items → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
