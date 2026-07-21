import { Link } from 'react-router-dom'
import { useKept } from '../hooks/useKept'
import { getIdea } from '../data/ideas'
import { IdeaCard } from '../components/IdeaCard'
import './Kept.css'

export function Kept() {
  const { kept } = useKept()
  const ideas = [...kept]
    .map((id) => getIdea(id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i))

  return (
    <div className="kept">
      <header className="kept-head">
        <h1>Kept thoughts</h1>
        <p>
          {ideas.length === 0
            ? 'Keep ideas from the feed when you want to think on them later.'
            : `${ideas.length} thought${ideas.length === 1 ? '' : 's'} saved on this device.`}
        </p>
      </header>

      {ideas.length === 0 ? (
        <div className="kept-empty">
          <p>Nothing kept yet.</p>
          <Link to="/feed" className="btn btn-primary">
            Open feed
          </Link>
        </div>
      ) : (
        <div className="kept-grid">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} compact />
          ))}
        </div>
      )}
    </div>
  )
}
