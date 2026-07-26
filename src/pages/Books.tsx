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
import {
  ZOBOKO_HOME,
  curatedZobokoMeta,
  isZobokoLanguageAllowed,
  zobokoShelvesForBrowse,
  zobokoUrl,
} from '../data/zoboko'
import type { GutenbergBook } from '../data/types'
import './Books.css'

function BookCard({
  title,
  author,
  why,
  href,
  coverUrl,
  fallbackLabel,
  linkLabel,
  pages,
}: {
  title: string
  author: string
  why?: string
  href: string
  coverUrl?: string
  fallbackLabel: string
  linkLabel: string
  pages?: number
}) {
  return (
    <a className="book-card" href={href} target="_blank" rel="noreferrer">
      <div className="book-cover-wrap">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="book-cover" loading="lazy" />
        ) : (
          <div className="book-cover book-cover--fallback" aria-hidden>
            {fallbackLabel}
          </div>
        )}
      </div>
      <div className="book-info">
        <h3>{title}</h3>
        <p className="book-author">{author}</p>
        {why && <p className="book-why">{why}</p>}
        {pages != null && <p className="book-why">{pages} pages</p>}
        <span className="book-link">
          {linkLabel} <ExternalLinkIcon />
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
        <h1>Books shelf</h1>
        <p>
          Pull ideas from public-domain ebooks on{' '}
          <a href={GUTENBERG_HOME} target="_blank" rel="noreferrer">
            Project Gutenberg
          </a>
          , plus curated Zoboko shelves (EN-only) for philosophy, psychology,
          politics, business, and physics — with a rotating Fresh shelf. Diet,
          romance, and fluff stay off the list.
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
                  title={book.title}
                  author={book.authors[0] ?? curatedGutenbergMeta[book.id]?.author ?? 'Unknown'}
                  why={curatedGutenbergMeta[book.id]?.why}
                  href={gutenbergUrl(book.id)}
                  coverUrl={book.coverUrl}
                  fallbackLabel="PG"
                  linkLabel="Read free on Gutenberg"
                />
              ))}
            </div>
          )}
        </section>
      )}

      {zobokoShelvesForBrowse().map((shelf) => (
        <section key={shelf.id} className="books-section">
          <div className="books-section-head">
            <h2>{shelf.title}</h2>
            <p>
              {shelf.blurb}{' '}
              <a href={ZOBOKO_HOME} target="_blank" rel="noreferrer">
                Zoboko
              </a>
            </p>
          </div>
          <div className="books-grid">
            {shelf.bookIds.map((id) => {
              const meta = curatedZobokoMeta[id]
              if (!meta || !isZobokoLanguageAllowed(meta)) return null
              return (
                <BookCard
                  key={id}
                  title={meta.title}
                  author={meta.author}
                  why={meta.why}
                  href={zobokoUrl(meta.slug)}
                  fallbackLabel="ZB"
                  linkLabel="Open on Zoboko"
                  pages={meta.pages}
                />
              )
            })}
          </div>
        </section>
      ))}

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
                  title={meta.title}
                  author={meta.author}
                  why={meta.why}
                  href={gutenbergUrl(id)}
                  coverUrl={gutenbergCoverUrl(id)}
                  fallbackLabel="PG"
                  linkLabel="Read free on Gutenberg"
                />
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
