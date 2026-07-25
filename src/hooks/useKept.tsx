import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'thinker-kept'

type KeptContextValue = {
  kept: Set<string>
  toggle: (id: string) => void
  count: number
}

const KeptContext = createContext<KeptContextValue | null>(null)

function loadKept(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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

  const toggle = useCallback((id: string) => {
    setKept((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ kept, toggle, count: kept.size }),
    [kept, toggle],
  )

  return <KeptContext.Provider value={value}>{children}</KeptContext.Provider>
}

export function useKept() {
  const ctx = useContext(KeptContext)
  if (!ctx) throw new Error('useKept must be used within KeptProvider')
  return ctx
}
