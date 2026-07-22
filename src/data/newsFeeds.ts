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
]
