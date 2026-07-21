const STORAGE_KEY = 'thinker-ask-latencies'
const MAX_SAMPLES = 12

export function loadAskLatencies(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((n): n is number => typeof n === 'number' && n > 0).slice(-MAX_SAMPLES)
  } catch {
    return []
  }
}

/** Persist a successful LLM wait; returns the updated sample list. */
export function recordAskLatency(ms: number): number[] {
  const next = [...loadAskLatencies(), Math.round(ms)].slice(-MAX_SAMPLES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
  return next
}

export function averageAskLatency(samples: number[]): number | null {
  if (samples.length === 0) return null
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
}

export function formatWait(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
