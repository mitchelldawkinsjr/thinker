import { lazy, Suspense, useMemo, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { KeptProvider } from './hooks/useKept'
import { ThoughtsProvider } from './hooks/useThoughts'
import { DraftReviewProvider } from './hooks/useDraftReview'
import { useIdeaDrafts } from './hooks/useIdeaDrafts'
import { SubscriptionsProvider } from './hooks/useSubscriptions'
import { TopicsProvider } from './hooks/useTopics'
import { Nav } from './components/Nav'
import { Home } from './pages/Home'
import { ReloadPrompt } from './components/ReloadPrompt'
import './App.css'

const Feed = lazy(() => import('./pages/Feed').then((m) => ({ default: m.Feed })))
const Topics = lazy(() => import('./pages/Topics').then((m) => ({ default: m.Topics })))
const TopicDetail = lazy(() =>
  import('./pages/TopicDetail').then((m) => ({ default: m.TopicDetail })),
)
const Kept = lazy(() => import('./pages/Kept').then((m) => ({ default: m.Kept })))
const Books = lazy(() => import('./pages/Books').then((m) => ({ default: m.Books })))
const Resources = lazy(() =>
  import('./pages/Resources').then((m) => ({ default: m.Resources })),
)
const Ask = lazy(() => import('./pages/Ask').then((m) => ({ default: m.Ask })))
const Settings = lazy(() =>
  import('./pages/Settings').then((m) => ({ default: m.Settings })),
)

function RouteFallback() {
  return <div className="route-fallback" aria-hidden />
}

function DraftReviewGate({ children }: { children: ReactNode }) {
  const { items } = useIdeaDrafts()
  const draftIds = useMemo(() => items.map((i) => i.id), [items])
  return <DraftReviewProvider draftIds={draftIds}>{children}</DraftReviewProvider>
}

export default function App() {
  return (
    <BrowserRouter>
      <KeptProvider>
        <ThoughtsProvider>
          <DraftReviewGate>
            <SubscriptionsProvider>
              <TopicsProvider>
                <div className="app-shell">
                  <Nav />
                  <main>
                    <Suspense fallback={<RouteFallback />}>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/feed" element={<Feed />} />
                        <Route path="/ask" element={<Ask />} />
                        <Route path="/topics" element={<Topics />} />
                        <Route path="/topics/:topicId" element={<TopicDetail />} />
                        <Route path="/resources" element={<Resources />} />
                        <Route path="/books" element={<Books />} />
                        <Route path="/kept" element={<Kept />} />
                        <Route path="/settings" element={<Settings />} />
                      </Routes>
                    </Suspense>
                  </main>
                  <ReloadPrompt />
                </div>
              </TopicsProvider>
            </SubscriptionsProvider>
          </DraftReviewGate>
        </ThoughtsProvider>
      </KeptProvider>
    </BrowserRouter>
  )
}
