import { topics } from '../data/topics'
import { getIdeasByTopic } from '../data/ideas'
import { TopicChip } from '../components/TopicChip'
import { useBookIdeas } from '../hooks/useBookIdeas'
import './Topics.css'

export function Topics() {
  const { items: bookIdeas } = useBookIdeas()

  return (
    <div className="topics-page">
      <header className="topics-head">
        <h1>Browse all topics</h1>
        <p>
          AI development you’re learning, sports you follow, plus current events,
          history, politics, finance, and sharper thinking.
        </p>
      </header>
      <div className="topics-grid">
        {topics.map((t) => (
          <TopicChip
            key={t.id}
            topic={t}
            large
            ideaCount={getIdeasByTopic(t.id, bookIdeas).length}
          />
        ))}
      </div>
    </div>
  )
}
