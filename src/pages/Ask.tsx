import { AskPanel } from '../components/AskPanel'
import { Link } from 'react-router-dom'
import './Ask.css'

export function Ask() {
  return (
    <div className="ask-page">
      <AskPanel />
      <aside className="ask-aside">
        <h2>How this works</h2>
        <p>
          Instant catalog paths first, then <strong>OpenAI</strong> (or Ollama fallback)
          grounds the answer in your <strong>slip box</strong> — matching notes plus their
          linked neighbors — with outbound links from Thinker’s sites and books.
        </p>
        <ul>
          <li>
            Default: <code>gpt-4o-mini</code> (~fractions of a cent per ask)
          </li>
          <li>
            Fallback: local/VPS Ollama if no <code>OPENAI_API_KEY</code>
          </li>
          <li>Follow-up chips refill the box so you can keep going</li>
          <li>
            Build notes on <Link to="/kept">Kept</Link> so Ask has denser ZK context
          </li>
        </ul>
      </aside>
    </div>
  )
}
