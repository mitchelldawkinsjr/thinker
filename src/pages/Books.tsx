import { useState, type FormEvent } from 'react'
import { ExternalLinkIcon } from '../components/CardMedia'
import {
  GUTENBERG_HOME,
  curatedGutenbergMeta,
  gutenbergCoverUrl,
  gutenbergShelves,
  gutenbergUrl,
  searchGutenberg,
} from '../data/gutenberg'
import type { GutenbergBook } from '../data/types'
import './Books.css'

function BookCard({
  id,
  title,
  author,
  why,
  coverUrl,
}: {
  id: number
  title: string
  author: string
  why?: string
  coverUrl?: string
}) {
  return (
    <a
      className="book-card"
      href={gutenbergUrl(id)}
      target="_blank"
      rel="noreferrer"
    >
      <div className="book-cover-wrap">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="book-cover" loading="lazy" />
        ) : (
          <div className="book-cover book-cover--fallback" aria-hidden>
            PG
          </div>
        )}
      </div>
      <div className="book-info">
        <h3>{title}</h3>
        <p className="book-author">{author}</p>
        {why && <p className="book-why">{why}</p>}
        <span className="book-link">
          Read free on Gutenberg <ExternalLinkIcon />
        </span>
      </div>
    </a>
  )
}

export function Books() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GutenbergBook[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  async function onSearch(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) {
      setResults(null)
      return
    }
    try {
      setSearching(true)
      setSearchError(null)
      setResults(await searchGutenberg(query))
    } catch {
      setSearchError('Search failed. Try again, or browse gutenberg.org directly.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="books-page">
      <header className="books-head">
        <p className="books-kicker">Free knowledge</p>
        <h1>Project Gutenberg shelf</h1>
        <p>
          Pull ideas from public-domain ebooks and open the full text on{' '}
          <a href={GUTENBERG_HOME} target="_blank" rel="noreferrer">
            gutenberg.org
          </a>
          . Shelves below map to Thinker topics — politics, finance, history, and clearer thinking.
        </p>
      </header>

      <form className="books-search" onSubmit={onSearch}>
        <label htmlFor="pg-search" className="sr-only">
          Search Project Gutenberg
        </label>
        <input
          id="pg-search"
          type="search"
          placeholder="Search titles & authors (e.g. Tocqueville, Federalist…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {searchError && <p className="books-error">{searchError}</p>}

      {results && (
        <section className="books-section">
          <h2>Search results</h2>
          {results.length === 0 ? (
            <p className="books-muted">No English matches. Try another spelling or author.</p>
          ) : (
            <div className="books-grid">
              {results.map((book) => (
                <BookCard
                  key={book.id}
                  id={book.id}
                  title={book.title}
                  author={book.authors[0] ?? curatedGutenbergMeta[book.id]?.author ?? 'Unknown'}
                  why={curatedGutenbergMeta[book.id]?.why}
                  coverUrl={book.coverUrl}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {gutenbergShelves.map((shelf) => (
        <section key={shelf.id} className="books-section">
          <div className="books-section-head">
            <h2>{shelf.title}</h2>
            <p>{shelf.blurb}</p>
          </div>
          <div className="books-grid">
            {shelf.bookIds.map((id) => {
              const meta = curatedGutenbergMeta[id]
              if (!meta) return null
              return (
                <BookCard
                  key={id}
                  id={id}
                  title={meta.title}
                  author={meta.author}
                  why={meta.why}
                  coverUrl={gutenbergCoverUrl(id)}
                />
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
