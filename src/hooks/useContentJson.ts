import { useEffect, useState } from 'react'

type ContentFile<T> = {
  items?: T[]
  updatedAt?: string
}

/**
 * Load a /content/*.json file with an offline seed fallback.
 * Optional merge keeps seed items that live JSON doesn’t replace.
 */
export function useContentJson<T>(opts: {
  url: string
  seedItems: T[]
  seedUpdatedAt: string | null
  /** Merge seed + live; default replaces with live when non-empty */
  merge?: (seed: T[], live: T[]) => T[]
}): { items: T[]; updatedAt: string | null } {
  const { url, seedItems, seedUpdatedAt, merge } = opts
  const [items, setItems] = useState<T[]>(seedItems)
  const [updatedAt, setUpdatedAt] = useState<string | null>(seedUpdatedAt)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`${url} ${res.status}`)
        const data = (await res.json()) as ContentFile<T>
        const live = data.items ?? []
        if (cancelled || live.length === 0) return
        const next = merge ? merge(seedItems, live) : live
        if (next.length === 0) return
        setItems(next)
        setUpdatedAt(data.updatedAt ?? seedUpdatedAt)
      } catch {
        // Seed already set — fine offline / before first ingest
      }
    })()
    return () => {
      cancelled = true
    }
    // Seed arrays are module constants — stable for the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return { items, updatedAt }
}
