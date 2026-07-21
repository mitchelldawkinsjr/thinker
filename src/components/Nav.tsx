import { Link, NavLink } from 'react-router-dom'
import { useStash } from '../hooks/useStash'
import './Nav.css'

export function Nav() {
  const { count } = useStash()

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-brand" aria-label="Thinker home">
            <span className="nav-mark" aria-hidden>
              <svg viewBox="0 0 32 32" width="28" height="28">
                <circle cx="16" cy="16" r="15" fill="currentColor" opacity="0.12" />
                <path
                  d="M16 6c-4.4 0-8 3-8 7.2 0 2.4 1.2 4.5 3.1 5.8L10 26h4l1.2-4h1.6L18 26h4l-1.1-7c1.9-1.3 3.1-3.4 3.1-5.8C24 9 20.4 6 16 6zm0 3.2c2.6 0 4.6 1.8 4.6 4 0 2.2-2 4-4.6 4s-4.6-1.8-4.6-4c0-2.2 2-4 4.6-4z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="nav-word">Thinker</span>
          </Link>

          <nav className="nav-links" aria-label="Primary">
            <NavLink to="/feed">Feed</NavLink>
            <NavLink to="/ask">Ask</NavLink>
            <NavLink to="/topics">Topics</NavLink>
            <NavLink to="/resources">Resources</NavLink>
            <NavLink to="/books">Gutenberg</NavLink>
            <NavLink to="/library" className="nav-library">
              Library
              {count > 0 && <span className="nav-badge">{count}</span>}
            </NavLink>
          </nav>

          <Link to="/feed" className="nav-cta">
            Start thinking
          </Link>
        </div>
      </header>

      <nav className="nav-mobile" aria-label="Mobile">
        <NavLink to="/feed">Feed</NavLink>
        <NavLink to="/ask">Ask</NavLink>
        <NavLink to="/resources">Sites</NavLink>
        <NavLink to="/library">
          Lib
          {count > 0 && <span className="nav-badge">{count}</span>}
        </NavLink>
      </nav>
    </>
  )
}
