import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Topic, TopicId } from '../data/types'
import { isCatalogTopicId, setRuntimeTopics } from '../data/topics'
import {
  EMPTY_USER_TOPICS,
  loadUserTopics,
  MAX_CUSTOM_TOPICS,
  newCustomTopicId,
  paletteForIndex,
  resolveTopic,
  resolveTopics,
  saveUserTopics,
  type TopicOverride,
  type UserTopicsState,
} from '../data/userTopics'
import { useSubscriptions } from './useSubscriptions'

type TopicsContextValue = {
  /** Visible topics (hidden catalog topics excluded) */
  topics: Topic[]
  /** All topics including hidden catalog ones (for Settings) */
  allTopics: Topic[]
  getTopic: (id: string) => Topic | undefined
  isHidden: (id: string) => boolean
  isCustom: (id: string) => boolean
  updateTopic: (
    id: string,
    patch: Partial<Pick<Topic, 'name' | 'tagline' | 'description' | 'color' | 'accent'>>,
  ) => void
  setTopicHidden: (id: string, hidden: boolean) => void
  addTopic: (input: {
    name: string
    tagline?: string
    description?: string
  }) => Topic | null
  removeTopic: (id: string) => void
  resetTopics: () => void
}

const TopicsContext = createContext<TopicsContextValue | null>(null)

export function TopicsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserTopicsState>(loadUserTopics)
  const { subscriptions, setTopics: setFollowedTopics } = useSubscriptions()

  const topics = useMemo(() => resolveTopics(state, false), [state])
  const allTopics = useMemo(() => resolveTopics(state, true), [state])

  useEffect(() => {
    saveUserTopics(state)
    // Feed/IdeaCard getTopic() reads runtime list (include hidden so deep links still resolve)
    setRuntimeTopics(resolveTopics(state, true))
  }, [state])

  const getTopicCb = useCallback((id: string) => resolveTopic(state, id), [state])

  const isHidden = useCallback(
    (id: string) => Boolean(state.overrides[id]?.hidden),
    [state.overrides],
  )

  const isCustom = useCallback((id: string) => !isCatalogTopicId(id), [])

  const updateTopic = useCallback(
    (
      id: string,
      patch: Partial<Pick<Topic, 'name' | 'tagline' | 'description' | 'color' | 'accent'>>,
    ) => {
      setState((prev) => {
        const existingCustom = prev.custom.find((t) => t.id === id)
        if (existingCustom) {
          const nextCustom = prev.custom.map((t) =>
            t.id === id
              ? {
                  ...t,
                  name: patch.name?.trim() || t.name,
                  tagline: patch.tagline !== undefined ? patch.tagline.trim() : t.tagline,
                  description:
                    patch.description !== undefined
                      ? patch.description.trim()
                      : t.description,
                  color: patch.color ?? t.color,
                  accent: patch.accent ?? t.accent,
                }
              : t,
          )
          return { ...prev, custom: nextCustom }
        }

        const base = resolveTopic(prev, id)
        if (!base) return prev
        const ov: TopicOverride = { ...prev.overrides[id] }
        if (patch.name !== undefined) ov.name = patch.name.trim() || base.name
        if (patch.tagline !== undefined) ov.tagline = patch.tagline.trim()
        if (patch.description !== undefined) ov.description = patch.description.trim()
        if (patch.color !== undefined) ov.color = patch.color
        if (patch.accent !== undefined) ov.accent = patch.accent
        return {
          ...prev,
          overrides: { ...prev.overrides, [id]: ov },
        }
      })
    },
    [],
  )

  const setTopicHidden = useCallback(
    (id: string, hidden: boolean) => {
      if (!isCatalogTopicId(id)) return
      setState((prev) => ({
        ...prev,
        overrides: {
          ...prev.overrides,
          [id]: { ...prev.overrides[id], hidden },
        },
      }))
      if (hidden && subscriptions.topics.includes(id as TopicId)) {
        setFollowedTopics(subscriptions.topics.filter((t) => t !== id))
      }
    },
    [subscriptions.topics, setFollowedTopics],
  )

  const addTopic = useCallback(
    (input: { name: string; tagline?: string; description?: string }): Topic | null => {
      const name = input.name.trim()
      if (!name) return null

      let created: Topic | null = null
      setState((current) => {
        if (current.custom.length >= MAX_CUSTOM_TOPICS) return current
        const existing = new Set(resolveTopics(current, true).map((t) => t.id))
        const id = newCustomTopicId(name, existing)
        const palette = paletteForIndex(current.custom.length)
        const topic: Topic = {
          id,
          name,
          tagline: input.tagline?.trim() || 'Custom topic',
          description:
            input.description?.trim() ||
            'A topic you added for your Thinker mix.',
          color: palette.color,
          accent: palette.accent,
        }
        created = topic
        return { ...current, custom: [...current.custom, topic] }
      })
      return created
    },
    [],
  )

  const removeTopic = useCallback(
    (id: string) => {
      if (isCatalogTopicId(id)) {
        // Catalog: hide instead of delete
        setTopicHidden(id, true)
        return
      }
      setState((prev) => ({
        ...prev,
        custom: prev.custom.filter((t) => t.id !== id),
        overrides: Object.fromEntries(
          Object.entries(prev.overrides).filter(([k]) => k !== id),
        ),
      }))
      if (subscriptions.topics.includes(id as TopicId)) {
        setFollowedTopics(subscriptions.topics.filter((t) => t !== id))
      }
    },
    [setTopicHidden, subscriptions.topics, setFollowedTopics],
  )

  const resetTopics = useCallback(() => {
    setState(structuredClone(EMPTY_USER_TOPICS))
  }, [])

  const value = useMemo(
    () => ({
      topics,
      allTopics,
      getTopic: getTopicCb,
      isHidden,
      isCustom,
      updateTopic,
      setTopicHidden,
      addTopic,
      removeTopic,
      resetTopics,
    }),
    [
      topics,
      allTopics,
      getTopicCb,
      isHidden,
      isCustom,
      updateTopic,
      setTopicHidden,
      addTopic,
      removeTopic,
      resetTopics,
    ],
  )

  return <TopicsContext.Provider value={value}>{children}</TopicsContext.Provider>
}

export function useTopics() {
  const ctx = useContext(TopicsContext)
  if (!ctx) throw new Error('useTopics must be used within TopicsProvider')
  return ctx
}
