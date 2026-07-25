import type { Idea } from './types'

/** Resolve display fields — hook/lesson/takeaway/example with safe fallbacks. */
export function presentIdea(idea: Idea) {
  const hook = idea.hook ?? idea.title
  const lesson = idea.lesson ?? idea.body
  const takeaway = idea.takeaway
  const example = idea.example
  // Only collapse when there's real extra structure (example / takeaway) —
  // never hide a leftover sentence behind "Read more".
  const hasMore = Boolean(takeaway || example)

  return { hook, lesson, takeaway, example, hasMore }
}
