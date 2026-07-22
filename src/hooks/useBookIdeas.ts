import { useCallback, useEffect, useState } from 'react'
import type { Idea } from '../data/types'
import {
  bookIdeasSeed,
  getSeedBookIdeas,
  type BookIdeasFile,
} from '../data/bookIdeasSeed'

/**
 * Load book-summary ideas from /content/book-ideas.json (ingest),
 * merge with bundled seed.
 */
export function useBookIdeas(): {
  items: Idea[]
  updatedAt: string | null
  loading: boolean
} {
  const [items, setItems] = useState<Idea[]>(() => getSeedBookIdeas())
  const [updatedAt, setUpdatedAt] = useState<string | null>(bookIdeasSeed.updatedAt)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/content/book-ideas.json?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`book-ideas.json ${res.status}`)
      const data = (await res.json()) as BookIdeasFile
      const byId = new Map<string, Idea>()
      for (const idea of [...getSeedBookIdeas(), ...(data.items ?? [])]) {
        byId.set(idea.id, idea)
      }
      const merged = [...byId.values()]
      if (merged.length > 0) {
        setItems(merged)
        setUpdatedAt(data.updatedAt ?? bookIdeasSeed.updatedAt)
      }
    } catch {
      // Seed already set — fine offline / before first ingest
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { items, updatedAt, loading }
}
