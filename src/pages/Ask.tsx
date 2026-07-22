import { AskPanel } from '../components/AskPanel'
import './Ask.css'

export function Ask() {
  return (
    <div className="ask-page">
      <AskPanel />
      <aside className="ask-aside">
        <h2>How this works</h2>
        <p>
          Questions hit your VPS <strong>llm-runtime</strong> (Ollama over Tailscale). The model
          returns a short answer plus outbound links from Thinker’s resource catalog and Gutenberg
          shelf — so you dig deeper on purpose instead of endless scrolling.
        </p>
        <ul>
          <li>
            Default: <code>mistral:latest</code> on VPS llm-runtime (fast bounce)
          </li>
          <li>
            Quality upgrade: <code>qwen2.5:14b</code> (pick in the model menu)
          </li>
          <li>
            Skip local <code>qwen2.5-coder:32b</code> — great for code, weak for topic guidance
          </li>
          <li>Follow-up chips refill the box so you can keep going</li>
        </ul>
      </aside>
    </div>
  )
}
