import type { CSSProperties } from 'react'
import type { Idea } from '../data/types'
import { IdeaCard } from './IdeaCard'
import './StickyIdeaStack.css'

/**
 * Scroll-driven sticky stack of linked kept idea cards.
 * Pins each card; scales/darkens the buried one as the next covers it.
 * ZettelStack (slip shuffle) is separate and untouched.
 */
export function StickyIdeaStack({ ideas }: { ideas: Idea[] }) {
  if (ideas.length === 0) return null

  return (
    <div className="sticky-idea-stack" aria-label="Linked idea stack">
      <p className="sticky-idea-stack-hint">Linked · scroll to stack</p>
      <div className="sticky-idea-stack-scene">
        {ideas.map((idea, i) => (
          <div
            key={idea.id}
            className="sticky-idea-stack-card"
            style={{ '--i': i } as CSSProperties}
          >
            <IdeaCard idea={idea} compact />
          </div>
        ))}
      </div>
    </div>
  )
}
