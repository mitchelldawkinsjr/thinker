import { useEffect, useState } from 'react'

type ContentFile<T> = {
  items?: T[]
  updatedAt?: string
}

type CacheEntry<T> = {
  items: T[]
  updatedAt: string | null
}

/** In-memory cache so remounts (Home → Feed) reuse the same fetch. */
const contentCache = new Map<string, CacheEntry<unknown>>()
const contentInflight = new Map<string, Promise<CacheEntry<unknown> | null>>()

async function loadContentJson<T>(
  url: string,
  seedItems: T[],
  seedUpdatedAt: string | null,
  merge?: (seed: T[], live: T[]) => T[],
): Promise<CacheEntry<T> | null> {
  const cached = contentCache.get(url) as CacheEntry<T> | undefined
  if (cached) return cached

  const inflight = contentInflight.get(url) as Promise<CacheEntry<T> | null> | undefined
  if (inflight) return inflight

  const promise = (async (): Promise<CacheEntry<T> | null> => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${url} ${res.status}`)
      const data = (await res.json()) as ContentFile<T>
      const live = data.items ?? []
      if (live.length === 0) return null
      const next = merge ? merge(seedItems, live) : live
      if (next.length === 0) return null
      const entry: CacheEntry<T> = {
        items: next,
        updatedAt: data.updatedAt ?? seedUpdatedAt,
      }
      contentCache.set(url, entry as CacheEntry<unknown>)
      return entry
    } catch {
      return null
    } finally {
      contentInflight.delete(url)
    }
  })()

  contentInflight.set(url, promise as Promise<CacheEntry<unknown> | null>)
  return promise
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
  const cached = contentCache.get(url) as CacheEntry<T> | undefined
  const [items, setItems] = useState<T[]>(cached?.items ?? seedItems)
  const [updatedAt, setUpdatedAt] = useState<string | null>(
    cached?.updatedAt ?? seedUpdatedAt,
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const entry = await loadContentJson(url, seedItems, seedUpdatedAt, merge)
      if (cancelled || !entry) return
      setItems(entry.items)
      setUpdatedAt(entry.updatedAt)
    })()
    return () => {
      cancelled = true
    }
    // Seed arrays are module constants — stable for the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return { items, updatedAt }
}
