import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  learningResources,
  resourceCategories,
  sourceLists,
  type ResourceCategory,
} from '../data/resources'
import './Resources.css'

export function Resources() {
  const [category, setCategory] = useState<ResourceCategory | 'all'>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return learningResources.filter((r) => {
      if (category !== 'all' && r.category !== category) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.blurb.toLowerCase().includes(q) ||
        r.category.includes(q)
      )
    })
  }, [category, query])

  return (
    <div className="resources-page">
      <header className="resources-head">
        <p className="resources-kicker">Stay tapped in</p>
        <h1>Replace endless scroll with real sources</h1>
        <p>
          Curated free learning sites — each card opens the actual website. Parsed from{' '}
          <a href={sourceLists[0].url} target="_blank" rel="noreferrer">
            Knowledge Lover
          </a>
          ,{' '}
          <a href={sourceLists[1].url} target="_blank" rel="noreferrer">
            Go Highbrow
          </a>
          , plus{' '}
          <Link to="/books">Project Gutenberg</Link> for primary texts. No infinite feed —
          pick a destination and learn.
        </p>
      </header>

      <div className="resources-tools">
        <input
          type="search"
          placeholder="Filter sites…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter resources"
        />
        <div className="resources-cats" role="tablist" aria-label="Categories">
          {resourceCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              className={category === c.id ? 'is-active' : ''}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <p className="resources-count">
        {filtered.length} site{filtered.length === 1 ? '' : 's'}
      </p>

      <div className="resources-grid">
        {filtered.map((r) => (
          <a
            key={r.id}
            className="resource-card"
            href={r.url}
            target="_blank"
            rel="noreferrer"
          >
            <span className="resource-cat">{r.category}</span>
            <h2>{r.name}</h2>
            <p>{r.blurb}</p>
            <span className="resource-open">Open site →</span>
          </a>
        ))}
      </div>

      <section className="resources-credit">
        <h2>Source lists</h2>
        <ul>
          {sourceLists.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name}
              </a>
              <span> — {s.note}</span>
            </li>
          ))}
        </ul>
        <p className="resources-note">
          We skipped infinite-scroll feeds on purpose. Use Thinker’s cards + these
          destinations instead of another scroll session.
        </p>
      </section>
    </div>
  )
}
