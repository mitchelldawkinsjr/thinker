import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Topic } from '../data/types'
import './TopicChip.css'

export function TopicChip({
  topic,
  large,
  ideaCount,
}: {
  topic: Topic
  large?: boolean
  ideaCount: number
}) {
  return (
    <Link
      to={`/topics/${topic.id}`}
      className={`topic-chip ${large ? 'topic-chip--large' : ''}`}
      style={
        {
          '--topic-accent': topic.accent,
          '--topic-bg': topic.color,
        } as CSSProperties
      }
    >
      <span className="topic-chip-name">#{topic.name}</span>
      {large && <span className="topic-chip-tag">{topic.tagline}</span>}
      <span className="topic-chip-count">{ideaCount} ideas</span>
    </Link>
  )
}
