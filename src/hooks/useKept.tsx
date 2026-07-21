import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'thinker-kept'
const LEGACY_KEY = 'thinker-stash'

type KeptContextValue = {
  kept: Set<string>
  toggle: (id: string) => void
  count: number
}

const KeptContext = createContext<KeptContextValue | null>(null)

function loadKept(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function KeptProvider({ children }: { children: ReactNode }) {
  const [kept, setKept] = useState(loadKept)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...kept]))
  }, [kept])

  function toggle(id: string) {
    setKept((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <KeptContext.Provider value={{ kept, toggle, count: kept.size }}>
      {children}
    </KeptContext.Provider>
  )
}

export function useKept() {
  const ctx = useContext(KeptContext)
  if (!ctx) throw new Error('useKept must be used within KeptProvider')
  return ctx
}
