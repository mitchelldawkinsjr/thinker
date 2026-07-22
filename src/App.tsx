import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { KeptProvider } from './hooks/useKept'
import { SubscriptionsProvider } from './hooks/useSubscriptions'
import { Nav } from './components/Nav'
import { Home } from './pages/Home'
import { Feed } from './pages/Feed'
import { Topics } from './pages/Topics'
import { TopicDetail } from './pages/TopicDetail'
import { Kept } from './pages/Kept'
import { Books } from './pages/Books'
import { Resources } from './pages/Resources'
import { Ask } from './pages/Ask'
import { Settings } from './pages/Settings'
import { ReloadPrompt } from './components/ReloadPrompt'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <KeptProvider>
        <SubscriptionsProvider>
          <div className="app-shell">
            <Nav />
            <main>
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
            </main>
            <ReloadPrompt />
          </div>
        </SubscriptionsProvider>
      </KeptProvider>
    </BrowserRouter>
  )
}
