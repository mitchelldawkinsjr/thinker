import { getIdeasByTopic } from '../data/ideas'
import { TopicChip } from '../components/TopicChip'
import { useExtraIdeas } from '../hooks/useExtraIdeas'
import { useTopics } from '../hooks/useTopics'
import './Topics.css'

export function Topics() {
  const { topics } = useTopics()
  const { items: extraIdeas } = useExtraIdeas()

  return (
    <div className="topics-page">
      <header className="topics-head">
        <h1>Browse all topics</h1>
        <p>
          AI development you’re learning, sports you follow, plus current events,
          history, politics, finance, and sharper thinking. Edit or add topics in
          Settings.
        </p>
      </header>
      <div className="topics-grid">
        {topics.map((t) => (
          <TopicChip
            key={t.id}
            topic={t}
            large
            ideaCount={getIdeasByTopic(t.id, extraIdeas).length}
          />
        ))}
      </div>
    </div>
  )
}
