export type GameScoreId = 'reaction' | 'spot' | 'memory' | 'math'

function storageKey(id: GameScoreId) {
  return `thinker-game-${id}-best`
}

export function getGameHighScore(id: GameScoreId): number {
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

/** Returns the new best (may equal previous if not beaten). */
export function recordGameScore(id: GameScoreId, score: number): number {
  const prev = getGameHighScore(id)
  const next = Math.max(prev, Math.max(0, Math.floor(score)))
  if (next > prev) {
    try {
      localStorage.setItem(storageKey(id), String(next))
    } catch {
      // ignore quota
    }
  }
  return next
}
