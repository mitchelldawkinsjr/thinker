import { Link } from 'react-router-dom'
import { useStash } from '../hooks/useStash'
import { getIdea } from '../data/ideas'
import { IdeaCard } from '../components/IdeaCard'
import './Library.css'

export function Library() {
  const { stashed } = useStash()
  const ideas = [...stashed]
    .map((id) => getIdea(id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i))

  return (
    <div className="library">
      <header className="library-head">
        <h1>Your library</h1>
        <p>
          {ideas.length === 0
            ? 'Stash ideas from the feed and they’ll land here.'
            : `${ideas.length} idea${ideas.length === 1 ? '' : 's'} saved on this device.`}
        </p>
      </header>

      {ideas.length === 0 ? (
        <div className="library-empty">
          <p>Nothing stashed yet.</p>
          <Link to="/feed" className="btn btn-primary">
            Open feed
          </Link>
        </div>
      ) : (
        <div className="library-grid">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} compact />
          ))}
        </div>
      )}
    </div>
  )
}
