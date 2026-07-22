import { AskPanel } from '../components/AskPanel'
import './Ask.css'

export function Ask() {
  return (
    <div className="ask-page">
      <AskPanel />
      <aside className="ask-aside">
        <h2>How this works</h2>
        <p>
          Instant catalog paths first, then <strong>OpenAI</strong> (or Ollama fallback)
          appends a short answer with outbound links from Thinker’s resources and Gutenberg —
          so you dig deeper on purpose instead of endless scrolling.
        </p>
        <ul>
          <li>
            Default: <code>gpt-4o-mini</code> (~fractions of a cent per ask)
          </li>
          <li>
            Fallback: local/VPS Ollama if no <code>OPENAI_API_KEY</code>
          </li>
          <li>Follow-up chips refill the box so you can keep going</li>
        </ul>
      </aside>
    </div>
  )
}
