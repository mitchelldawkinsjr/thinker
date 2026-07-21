import { useCallback, useEffect, useState } from 'react'
import type { ScriptureFile, ScriptureItem } from '../data/scriptureTypes'
import { getSeedScriptures, scriptureSeed } from '../data/scriptureSeed'

/**
 * Load scriptures from /content/scriptures.json (bolls.life ingest),
 * fall back to bundled WEB seed.
 */
export function useScriptures(): {
  items: ScriptureItem[]
  updatedAt: string | null
  loading: boolean
} {
  const [items, setItems] = useState<ScriptureItem[]>(() => getSeedScriptures())
  const [updatedAt, setUpdatedAt] = useState<string | null>(scriptureSeed.updatedAt)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/content/scriptures.json?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`scriptures.json ${res.status}`)
      const data = (await res.json()) as ScriptureFile
      const live = data.items ?? []
      if (live.length > 0) {
        setItems(live)
        setUpdatedAt(data.updatedAt ?? null)
      }
    } catch {
      // seed already set
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { items, updatedAt, loading }
}
