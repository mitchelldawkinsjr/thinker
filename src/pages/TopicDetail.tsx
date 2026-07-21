import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTopic } from '../data/topics'
import { getIdeasByTopic } from '../data/ideas'
import { IdeaCard } from '../components/IdeaCard'
import './TopicDetail.css'

export function TopicDetail() {
  const { topicId = '' } = useParams()
  const topic = getTopic(topicId)
  const ideas = getIdeasByTopic(topicId)

  if (!topic) {
    return (
      <div className="topic-detail">
        <p>Topic not found.</p>
        <Link to="/topics">Back to topics</Link>
      </div>
    )
  }

  return (
    <div className="topic-detail">
      <header
        className="topic-hero"
        style={
          {
            '--topic-accent': topic.accent,
            '--topic-bg': topic.color,
          } as CSSProperties
        }
      >
        <Link to="/topics" className="topic-back">
          ← All topics
        </Link>
        <p className="topic-kicker">Topic</p>
        <h1>#{topic.name}</h1>
        <p className="topic-tagline">{topic.tagline}</p>
        <p className="topic-desc">{topic.description}</p>
        <div className="topic-actions">
          <Link to={`/feed?topic=${topic.id}`} className="btn btn-primary">
            Open topic feed
          </Link>
          <span className="topic-count">{ideas.length} ideas</span>
        </div>
      </header>

      <div className="topic-ideas">
        {ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} compact />
        ))}
      </div>
    </div>
  )
}
