import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { TopicId } from '../data/types'
import {
  DEFAULT_SUBSCRIPTIONS,
  loadSubscriptions,
  MAX_CUSTOM_FEEDS,
  MAX_CUSTOM_SITES,
  newId,
  saveSubscriptions,
  type ContentKindKey,
  type CustomFeed,
  type CustomSite,
  type Subscriptions,
} from '../data/subscriptions'

type SubscriptionsContextValue = {
  subscriptions: Subscriptions
  setKind: (key: ContentKindKey, on: boolean) => void
  setTopics: (topics: TopicId[]) => void
  toggleTopic: (topicId: TopicId) => void
  setFeedMuted: (feedId: string, muted: boolean) => void
  addCustomSite: (site: Omit<CustomSite, 'id'> & { id?: string }) => string | null
  removeCustomSite: (id: string) => void
  addCustomFeed: (feed: Omit<CustomFeed, 'id'> & { id?: string }) => string | null
  updateCustomFeed: (id: string, patch: Partial<CustomFeed>) => void
  removeCustomFeed: (id: string) => void
  resetSubscriptions: () => void
}

const SubscriptionsContext = createContext<SubscriptionsContextValue | null>(null)

export function SubscriptionsProvider({ children }: { children: ReactNode }) {
  const [subscriptions, setSubscriptions] = useState(loadSubscriptions)

  useEffect(() => {
    saveSubscriptions(subscriptions)
  }, [subscriptions])

  const setKind = useCallback((key: ContentKindKey, on: boolean) => {
    setSubscriptions((prev) => ({
      ...prev,
      kinds: { ...prev.kinds, [key]: on },
    }))
  }, [])

  const setTopics = useCallback((topics: TopicId[]) => {
    setSubscriptions((prev) => ({ ...prev, topics }))
  }, [])

  const toggleTopic = useCallback((topicId: TopicId) => {
    setSubscriptions((prev) => {
      const has = prev.topics.includes(topicId)
      return {
        ...prev,
        topics: has ? prev.topics.filter((t) => t !== topicId) : [...prev.topics, topicId],
      }
    })
  }, [])

  const setFeedMuted = useCallback((feedId: string, muted: boolean) => {
    setSubscriptions((prev) => {
      const set = new Set(prev.disabledFeedIds)
      if (muted) set.add(feedId)
      else set.delete(feedId)
      return { ...prev, disabledFeedIds: [...set] }
    })
  }, [])

  const addCustomSite = useCallback(
    (site: Omit<CustomSite, 'id'> & { id?: string }): string | null => {
      const id = site.id ?? newId('site')
      let accepted = false
      setSubscriptions((prev) => {
        if (prev.customSites.length >= MAX_CUSTOM_SITES) return prev
        accepted = true
        return {
          ...prev,
          customSites: [
            ...prev.customSites,
            {
              id,
              name: site.name.trim(),
              url: site.url.trim(),
              blurb: site.blurb?.trim() || undefined,
              topicHints: site.topicHints,
            },
          ],
        }
      })
      return accepted ? id : null
    },
    [],
  )

  const removeCustomSite = useCallback((id: string) => {
    setSubscriptions((prev) => ({
      ...prev,
      customSites: prev.customSites.filter((s) => s.id !== id),
    }))
  }, [])

  const addCustomFeed = useCallback(
    (feed: Omit<CustomFeed, 'id'> & { id?: string }): string | null => {
      const id = feed.id ?? newId('feed')
      let accepted = false
      setSubscriptions((prev) => {
        if (prev.customFeeds.length >= MAX_CUSTOM_FEEDS) return prev
        accepted = true
        return {
          ...prev,
          customFeeds: [
            ...prev.customFeeds,
            {
              id,
              name: feed.name.trim(),
              url: feed.url.trim(),
              topicIds: feed.topicIds.length ? feed.topicIds : ['current-events'],
              limit: feed.limit,
              enabled: feed.enabled !== false,
            },
          ],
        }
      })
      return accepted ? id : null
    },
    [],
  )

  const updateCustomFeed = useCallback((id: string, patch: Partial<CustomFeed>) => {
    setSubscriptions((prev) => ({
      ...prev,
      customFeeds: prev.customFeeds.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }))
  }, [])

  const removeCustomFeed = useCallback((id: string) => {
    setSubscriptions((prev) => ({
      ...prev,
      customFeeds: prev.customFeeds.filter((f) => f.id !== id),
    }))
  }, [])

  const resetSubscriptions = useCallback(() => {
    setSubscriptions(structuredClone(DEFAULT_SUBSCRIPTIONS))
  }, [])

  const value = useMemo(
    () => ({
      subscriptions,
      setKind,
      setTopics,
      toggleTopic,
      setFeedMuted,
      addCustomSite,
      removeCustomSite,
      addCustomFeed,
      updateCustomFeed,
      removeCustomFeed,
      resetSubscriptions,
    }),
    [
      subscriptions,
      setKind,
      setTopics,
      toggleTopic,
      setFeedMuted,
      addCustomSite,
      removeCustomSite,
      addCustomFeed,
      updateCustomFeed,
      removeCustomFeed,
      resetSubscriptions,
    ],
  )

  return (
    <SubscriptionsContext.Provider value={value}>{children}</SubscriptionsContext.Provider>
  )
}

export function useSubscriptions() {
  const ctx = useContext(SubscriptionsContext)
  if (!ctx) throw new Error('useSubscriptions must be used within SubscriptionsProvider')
  return ctx
}
