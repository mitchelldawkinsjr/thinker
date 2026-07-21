import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { topics } from '../data/topics'
import { TopicChip } from '../components/TopicChip'
import './Home.css'

const floatingIdeas = [
  { title: 'The agent loop', rotate: -8, x: '6%', y: '18%' },
  { title: 'Per possession', rotate: 7, x: '78%', y: '14%' },
  { title: 'Margin of safety', rotate: -5, x: '82%', y: '58%' },
  { title: 'Read the coverage', rotate: 9, x: '4%', y: '62%' },
]

export function Home() {
  const featured = topics.slice(0, 6)

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-atmosphere" aria-hidden />
        <div className="hero-grid" aria-hidden />

        {floatingIdeas.map((card) => (
          <div
            key={card.title}
            className="hero-float"
            style={
              {
                '--rx': `${card.rotate}deg`,
                left: card.x,
                top: card.y,
              } as CSSProperties
            }
          >
            <span>Idea</span>
            <strong>{card.title}</strong>
          </div>
        ))}

        <div className="hero-copy">
          <p className="hero-toast">
            <span className="hero-toast-dot" />
            Stay tapped in — not doomscrolling Reddit
          </p>
          <h1 className="hero-brand">Thinker</h1>
          <p className="hero-line">
            Replace <span className="strike">doomscrolling</span> with{' '}
            <em>microlearning</em>
          </p>
          <p className="hero-sub">
            Bite-sized ideas on AI, sports, markets, and history — then jump to the
            real sites: Gutenberg, Quanta, Farnam Street, SEP, and more.
          </p>
          <div className="hero-actions">
            <Link to="/feed" className="btn btn-primary">
              Start thinking
            </Link>
            <Link to="/resources" className="btn btn-ghost">
              Browse free resources
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <h2>Your learning stack</h2>
          <p>Topics tuned to AI development, sports you care about, and the wider world.</p>
        </div>
        <div className="topic-grid">
          {featured.map((t) => (
            <TopicChip key={t.id} topic={t} large />
          ))}
        </div>
        <div className="section-foot">
          <Link to="/topics" className="text-link">
            See all {topics.length} topics →
          </Link>
        </div>
      </section>

      <section className="home-section home-why">
        <div className="section-head">
          <h2>Knowledge, in minutes</h2>
          <p>
            One idea at a time. Every kept thought can open its source site —
            not another Reddit tab.
          </p>
        </div>
        <div className="why-grid">
          <article>
            <h3>Swipe the feed</h3>
            <p>Mixed ideas from agents, NBA, film, finance, and more — no algorithm rabbit hole.</p>
          </article>
          <article>
            <h3>Open the source</h3>
            <p>
              Cards link out to Gutenberg, Quanta, Investopedia, SEP, and the rest of
              your resource shelf.
            </p>
          </article>
          <article>
            <h3>Browse free sites</h3>
            <p>
              A curated directory from Knowledge Lover + Go Highbrow — real destinations,
              one click.
            </p>
          </article>
        </div>
        <div className="section-foot" style={{ marginTop: '1.5rem' }}>
          <Link to="/resources" className="text-link">
            Open resources →
          </Link>
          {' · '}
          <Link to="/books" className="text-link">
            Gutenberg shelf →
          </Link>
        </div>
      </section>
    </div>
  )
}
