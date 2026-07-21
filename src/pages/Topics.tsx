import { topics } from '../data/topics'
import { TopicChip } from '../components/TopicChip'
import './Topics.css'

export function Topics() {
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
          <TopicChip key={t.id} topic={t} large />
        ))}
      </div>
    </div>
  )
}
