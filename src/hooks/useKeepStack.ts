import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Thought } from '../data/thoughts'
import { thoughtZettelId } from '../data/zettel'
import { useZettel } from './useZettel'

/** Path that opens Kept with a stack selected. */
export function keptStackPath(zettelId: string, opts?: { connect?: boolean }): string {
  const params = new URLSearchParams({ stack: zettelId })
  if (opts?.connect) params.set('connect', '1')
  return `/kept?${params.toString()}`
}

/**
 * After Keep / promote: sync the thought into the slip box (with source link)
 * and optionally navigate to that stack on Kept.
 */
export function useKeepStack() {
  const { syncFromThought, notes } = useZettel()
  const navigate = useNavigate()

  const stackIdForThought = useCallback(
    (thoughtId: string) => {
      const existing = notes.find((n) => n.sourceThoughtId === thoughtId)
      return existing?.id ?? thoughtZettelId(thoughtId)
    },
    [notes],
  )

  const keepToStack = useCallback(
    (thought: Thought, opts?: { land?: boolean; connect?: boolean }) => {
      const z = syncFromThought(thought)
      if (opts?.land) {
        navigate(keptStackPath(z.id, { connect: opts.connect }))
      }
      return z
    },
    [navigate, syncFromThought],
  )

  return { keepToStack, stackIdForThought, keptStackPath }
}
