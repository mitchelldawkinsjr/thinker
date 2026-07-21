import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'thinker-stash'

type StashContextValue = {
  stashed: Set<string>
  toggle: (id: string) => void
  count: number
}

const StashContext = createContext<StashContextValue | null>(null)

function loadStash(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function StashProvider({ children }: { children: ReactNode }) {
  const [stashed, setStashed] = useState(loadStash)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...stashed]))
  }, [stashed])

  function toggle(id: string) {
    setStashed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <StashContext.Provider value={{ stashed, toggle, count: stashed.size }}>
      {children}
    </StashContext.Provider>
  )
}

export function useStash() {
  const ctx = useContext(StashContext)
  if (!ctx) throw new Error('useStash must be used within StashProvider')
  return ctx
}
