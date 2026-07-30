import type { TopicId } from './types'

export type CuratedNewsFeed = {
  id: string
  name: string
  topicIds: TopicId[]
}

/**
 * Mirrors FEEDS in scripts/ingest-news.mjs — ids must stay in sync with ingest `feedId`.
 */
export const curatedNewsFeeds: CuratedNewsFeed[] = [
  { id: 'allsides', name: 'AllSides', topicIds: ['politics', 'current-events'] },
  { id: 'al-jazeera', name: 'Al Jazeera', topicIds: ['current-events', 'politics'] },
  {
    id: 'al-jazeera-news-feed',
    name: 'Al Jazeera News Feed',
    topicIds: ['current-events', 'politics'],
  },
  { id: 'npr-politics', name: 'NPR Politics', topicIds: ['politics', 'current-events'] },
  { id: 'npr-news-now', name: 'NPR News Now', topicIds: ['current-events'] },
  {
    id: 'npr-politics-podcast',
    name: 'NPR Politics Podcast',
    topicIds: ['politics', 'current-events'],
  },
  { id: 'npr-up-first', name: 'Up First', topicIds: ['current-events', 'politics'] },
  { id: 'npr-code-switch', name: 'Code Switch', topicIds: ['current-events'] },
  {
    id: 'npr-morning-edition',
    name: 'Morning Edition',
    topicIds: ['current-events', 'politics'],
  },
  {
    id: 'the-conversation-politics',
    name: 'The Conversation · Politics',
    topicIds: ['politics', 'current-events'],
  },
  { id: 'propublica', name: 'ProPublica', topicIds: ['politics', 'current-events'] },
  { id: 'bbc-politics', name: 'BBC Politics', topicIds: ['politics', 'current-events'] },
  {
    id: 'black-political-news',
    name: 'Black Political News',
    topicIds: ['politics', 'current-events'],
  },
  { id: 'congress', name: 'Congress', topicIds: ['politics', 'current-events'] },
  { id: 'war', name: 'War', topicIds: ['politics', 'current-events'] },
  {
    id: 'christian-today',
    name: 'Christian Today',
    topicIds: ['current-events', 'mental-models'],
  },
  {
    id: 'christianity-today',
    name: 'Christianity Today',
    topicIds: ['current-events', 'mental-models'],
  },
  {
    id: 'crosswalk',
    name: 'Crosswalk',
    topicIds: ['mental-models', 'current-events'],
  },
  { id: 'ap-top-news', name: 'AP Top News', topicIds: ['current-events'] },
  {
    id: 'aaron-parnas',
    name: 'The Parnas Perspective',
    topicIds: ['politics', 'current-events'],
  },
  {
    id: 'parnas-news',
    name: 'PARNAS News',
    topicIds: ['politics', 'current-events'],
  },
  {
    id: 'cspan-washington-today',
    name: 'C-SPAN · Washington Today',
    topicIds: ['politics', 'current-events'],
  },
  {
    id: 'cspan-qa',
    name: 'C-SPAN · Q&A',
    topicIds: ['politics', 'history', 'current-events'],
  },
  { id: 'philip-lewis', name: 'Philip Lewis', topicIds: ['current-events'] },
  { id: 'black-pop-culture', name: 'Black Pop Culture', topicIds: ['current-events'] },
  { id: 'essence', name: 'Essence', topicIds: ['current-events'] },
  {
    id: 'billboard-rb-hip-hop',
    name: 'Billboard R&B/Hip-Hop',
    topicIds: ['current-events'],
  },
  { id: 'xxl', name: 'XXL', topicIds: ['current-events'] },
  { id: 'vibe', name: 'Vibe', topicIds: ['current-events'] },
  { id: 'the-shade-room', name: 'The Shade Room', topicIds: ['current-events'] },
  { id: 'mediatakeout', name: 'MediaTakeOut', topicIds: ['current-events'] },
  {
    id: 'nba-basketball-news',
    name: 'NBA & Basketball News',
    topicIds: ['nba-analytics', 'sports-biz'],
  },
  {
    id: 'nfl-football-news',
    name: 'NFL & Football News',
    topicIds: ['football-film', 'sports-biz'],
  },
  {
    id: 'marketwatch-marketpulse',
    name: 'MarketWatch · MarketPulse',
    topicIds: ['finance', 'current-events'],
  },
  {
    id: 'marketwatch-bulletins',
    name: 'MarketWatch · Bulletins',
    topicIds: ['finance', 'current-events'],
  },
  { id: 'cnbc-finance', name: 'CNBC · Finance', topicIds: ['finance', 'current-events'] },

  // AI news / research
  {
    id: 'ai-weekly',
    name: 'AI Weekly',
    topicIds: ['ai-agents', 'llms-prompting', 'current-events'],
  },
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch · AI',
    topicIds: ['ai-agents', 'current-events', 'building-products'],
  },
  {
    id: 'mit-tr-ai',
    name: 'MIT Technology Review · AI',
    topicIds: ['ai-agents', 'llms-prompting', 'current-events'],
  },
  { id: 'openai-news', name: 'OpenAI News', topicIds: ['ai-agents', 'llms-prompting'] },
  {
    id: 'huggingface-blog',
    name: 'Hugging Face Blog',
    topicIds: ['llms-prompting', 'rag-context', 'ai-agents'],
  },
  {
    id: 'deepmind-blog',
    name: 'Google DeepMind',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'nvidia-dev-blog',
    name: 'NVIDIA Technical Blog',
    topicIds: ['ai-agents', 'rag-context'],
  },
  { id: 'the-gradient', name: 'The Gradient', topicIds: ['llms-prompting', 'ai-agents'] },
  {
    id: 'import-ai',
    name: 'Import AI',
    topicIds: ['ai-agents', 'llms-prompting', 'current-events'],
  },
  {
    id: 'last-week-in-ai',
    name: 'Last Week in AI',
    topicIds: ['ai-agents', 'current-events'],
  },
  {
    id: 'simon-willison',
    name: 'Simon Willison',
    topicIds: ['ai-agents', 'llms-prompting', 'rag-context'],
  },
  {
    id: 'latent-space',
    name: 'Latent Space',
    topicIds: ['ai-agents', 'llms-prompting', 'building-products'],
  },
  {
    id: 'langchain-blog',
    name: 'LangChain Blog',
    topicIds: ['ai-agents', 'rag-context', 'llms-prompting'],
  },
  {
    id: 'one-useful-thing',
    name: 'One Useful Thing',
    topicIds: ['llms-prompting', 'ai-agents', 'building-products'],
  },
  {
    id: 'interconnects',
    name: 'Interconnects',
    topicIds: ['llms-prompting', 'ai-agents'],
  },
  {
    id: 'bens-bites',
    name: "Ben's Bites",
    topicIds: ['ai-agents', 'current-events', 'building-products'],
  },
  {
    id: 'ars-technica-ai',
    name: 'Ars Technica · AI',
    topicIds: ['ai-agents', 'current-events'],
  },
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    topicIds: ['ai-agents', 'llms-prompting'],
  },

  // YouTube + Shorts
  {
    id: 'yt-two-minute-papers',
    name: 'Two Minute Papers',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'yt-two-minute-papers-shorts',
    name: 'Two Minute Papers · Shorts',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'yt-karpathy',
    name: 'Andrej Karpathy',
    topicIds: ['llms-prompting', 'ai-agents'],
  },
  {
    id: 'yt-3blue1brown',
    name: '3Blue1Brown',
    topicIds: ['llms-prompting', 'mental-models'],
  },
  {
    id: 'yt-3blue1brown-shorts',
    name: '3Blue1Brown · Shorts',
    topicIds: ['llms-prompting', 'mental-models'],
  },
  {
    id: 'yt-deeplearning-ai',
    name: 'DeepLearning.AI',
    topicIds: ['llms-prompting', 'ai-agents', 'rag-context'],
  },
  {
    id: 'yt-deeplearning-ai-shorts',
    name: 'DeepLearning.AI · Shorts',
    topicIds: ['llms-prompting', 'ai-agents', 'rag-context'],
  },
  {
    id: 'yt-yannic-kilcher',
    name: 'Yannic Kilcher',
    topicIds: ['llms-prompting', 'ai-agents'],
  },
  {
    id: 'yt-yannic-kilcher-shorts',
    name: 'Yannic Kilcher · Shorts',
    topicIds: ['llms-prompting', 'ai-agents'],
  },
  {
    id: 'yt-lex-fridman',
    name: 'Lex Fridman',
    topicIds: ['ai-agents', 'mental-models'],
  },
  {
    id: 'yt-lex-fridman-shorts',
    name: 'Lex Fridman · Shorts',
    topicIds: ['ai-agents', 'mental-models'],
  },
  {
    id: 'yt-sentdex',
    name: 'Sentdex',
    topicIds: ['llms-prompting', 'ai-agents'],
  },
  {
    id: 'yt-sentdex-shorts',
    name: 'Sentdex · Shorts',
    topicIds: ['llms-prompting', 'ai-agents'],
  },
  {
    id: 'yt-statquest',
    name: 'StatQuest',
    topicIds: ['llms-prompting', 'mental-models'],
  },
  {
    id: 'yt-statquest-shorts',
    name: 'StatQuest · Shorts',
    topicIds: ['llms-prompting', 'mental-models'],
  },
  {
    id: 'yt-dwarkesh',
    name: 'Dwarkesh Patel',
    topicIds: ['ai-agents', 'llms-prompting', 'current-events'],
  },
  {
    id: 'yt-dwarkesh-shorts',
    name: 'Dwarkesh Patel · Shorts',
    topicIds: ['ai-agents', 'llms-prompting', 'current-events'],
  },
  {
    id: 'yt-openai',
    name: 'OpenAI · YouTube',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'yt-openai-shorts',
    name: 'OpenAI · Shorts',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'yt-anthropic',
    name: 'Anthropic · YouTube',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'yt-anthropic-shorts',
    name: 'Anthropic · Shorts',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'yt-huggingface',
    name: 'Hugging Face · YouTube',
    topicIds: ['llms-prompting', 'rag-context', 'ai-agents'],
  },
  {
    id: 'yt-huggingface-shorts',
    name: 'Hugging Face · Shorts',
    topicIds: ['llms-prompting', 'rag-context', 'ai-agents'],
  },
  {
    id: 'yt-deepmind',
    name: 'Google DeepMind · YouTube',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'yt-deepmind-shorts',
    name: 'Google DeepMind · Shorts',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'yt-nvidia-dev',
    name: 'NVIDIA Developer · YouTube',
    topicIds: ['ai-agents', 'rag-context'],
  },
  {
    id: 'yt-nvidia-dev-shorts',
    name: 'NVIDIA Developer · Shorts',
    topicIds: ['ai-agents', 'rag-context'],
  },
  {
    id: 'yt-techcrunch',
    name: 'TechCrunch · YouTube',
    topicIds: ['ai-agents', 'current-events', 'building-products'],
  },
  {
    id: 'yt-techcrunch-shorts',
    name: 'TechCrunch · Shorts',
    topicIds: ['ai-agents', 'current-events', 'building-products'],
  },
  {
    id: 'yt-mit-tr',
    name: 'MIT Technology Review · YouTube',
    topicIds: ['ai-agents', 'current-events'],
  },
  {
    id: 'yt-mit-tr-shorts',
    name: 'MIT Technology Review · Shorts',
    topicIds: ['ai-agents', 'current-events'],
  },
  {
    id: 'yt-langchain',
    name: 'LangChain · YouTube',
    topicIds: ['ai-agents', 'rag-context', 'llms-prompting'],
  },
  {
    id: 'yt-langchain-shorts',
    name: 'LangChain · Shorts',
    topicIds: ['ai-agents', 'rag-context', 'llms-prompting'],
  },
  {
    id: 'yt-latent-space',
    name: 'Latent Space · YouTube',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'yt-latent-space-shorts',
    name: 'Latent Space · Shorts',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'yt-ai-explained',
    name: 'AI Explained',
    topicIds: ['ai-agents', 'llms-prompting', 'current-events'],
  },
  {
    id: 'yt-matthew-berman',
    name: 'Matthew Berman',
    topicIds: ['ai-agents', 'llms-prompting'],
  },
  {
    id: 'yt-wes-roth',
    name: 'Wes Roth',
    topicIds: ['ai-agents', 'current-events'],
  },
  {
    id: 'yt-wes-roth-shorts',
    name: 'Wes Roth · Shorts',
    topicIds: ['ai-agents', 'current-events'],
  },
  {
    id: 'yt-ai-coffee-break',
    name: 'AI Coffee Break',
    topicIds: ['llms-prompting', 'ai-agents'],
  },
  {
    id: 'yt-ai-coffee-break-shorts',
    name: 'AI Coffee Break · Shorts',
    topicIds: ['llms-prompting', 'ai-agents'],
  },
  {
    id: 'yt-black-history-two-min',
    name: 'Black History in Two Minutes · YouTube',
    topicIds: ['history'],
  },
  {
    id: 'yt-black-history-two-min-shorts',
    name: 'Black History in Two Minutes · Shorts',
    topicIds: ['history'],
  },
  {
    id: 'yt-the-pivot',
    name: 'The Pivot Podcast · YouTube',
    topicIds: ['sports-biz', 'nba-analytics', 'football-film'],
  },
  {
    id: 'yt-the-pivot-shorts',
    name: 'The Pivot Podcast · Shorts',
    topicIds: ['sports-biz', 'nba-analytics', 'football-film'],
  },
  {
    id: 'yt-ruslan-kd',
    name: 'Ruslan KD · YouTube',
    topicIds: ['current-events', 'mental-models'],
  },
  {
    id: 'yt-ruslan-kd-shorts',
    name: 'Ruslan KD · Shorts',
    topicIds: ['current-events', 'mental-models'],
  },
  {
    id: 'yt-raven-rock-homestead',
    name: 'Raven Rock Homestead',
    topicIds: ['mental-models', 'building-products'],
  },
  {
    id: 'yt-raw-room-shorts',
    name: 'Raw Room · Shorts',
    topicIds: ['sports-biz', 'football-film', 'current-events'],
  },
  {
    id: 'yt-89show-shorts',
    name: '89 — Steve Smith Sr. · Shorts',
    topicIds: ['football-film', 'sports-biz'],
  },
  {
    id: 'yt-mind-the-game-shorts',
    name: 'Mind the Game · Shorts',
    topicIds: ['nba-analytics', 'sports-biz'],
  },
  {
    id: 'yt-mojo-brookzz-shorts',
    name: 'Mojo Brookzz · Shorts',
    topicIds: ['current-events'],
  },
  {
    id: 'yt-cspan-shorts',
    name: 'C-SPAN · Shorts',
    topicIds: ['politics', 'current-events'],
  },
  {
    id: 'yt-npr-podcasts-shorts',
    name: 'NPR Podcasts · Shorts',
    topicIds: ['current-events', 'politics'],
  },
  {
    id: 'yt-npr-shorts',
    name: 'NPR · Shorts',
    topicIds: ['current-events', 'politics'],
  },
  {
    id: 'yt-npr-music-shorts',
    name: 'NPR Music · Shorts',
    topicIds: ['current-events'],
  },
  {
    id: 'yt-espn-shorts',
    name: 'ESPN · Shorts',
    topicIds: ['sports-biz', 'nba-analytics', 'football-film', 'wnba'],
  },
  {
    id: 'yt-joel-tudman',
    name: 'Joel Tudman Official',
    topicIds: ['mental-models', 'current-events'],
  },
  {
    id: 'yt-joel-tudman-shorts',
    name: 'Joel Tudman Official · Shorts',
    topicIds: ['mental-models', 'current-events'],
  },
]
