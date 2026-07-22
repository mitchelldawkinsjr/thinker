import { AskPanel } from '../components/AskPanel'
import './Ask.css'

export function Ask() {
  return (
    <div className="ask-page">
      <AskPanel />
      <aside className="ask-aside">
        <h2>How this works</h2>
        <p>
          Instant catalog paths first, then your VPS <strong>llm-runtime</strong> (Ollama)
          appends a short answer with outbound links from Thinker’s resources and Gutenberg —
          so you dig deeper on purpose instead of endless scrolling.
        </p>
        <ul>
          <li>
            Default: <code>phi3:mini</code> (fast bounce)
          </li>
          <li>
            Quality upgrade: pick a larger model in the menu when available
          </li>
          <li>Follow-up chips refill the box so you can keep going</li>
        </ul>
      </aside>
    </div>
  )
}
