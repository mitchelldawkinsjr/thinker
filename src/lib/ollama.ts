export type ExploreLink = {
  title: string
  url: string
  why: string
}

export type ExploreResult = {
  answer: string
  digDeeper: string[]
  links: ExploreLink[]
  topics: string[]
  model: string
  /** Wall-clock ms for this path when measured */
  latencyMs?: number
}

export type ExploreContext = {
  question: string
  ideaTitle?: string
  ideaBody?: string
  topicName?: string
  topicId?: string
}

/** Fastest usable general model on CPU llm-runtime */
const DEFAULT_MODEL = 'phi3:mini'

const FAST_MODELS = ['phi3:mini', 'qwen2.5:3b', 'mistral:latest', 'llama3.1:8b']

export function getConfiguredModel() {
  return import.meta.env.VITE_OLLAMA_MODEL?.trim() || DEFAULT_MODEL
}

export function pickFastModel(available: string[]): string {
  const preferred = getConfiguredModel()
  if (available.includes(preferred)) return preferred
  for (const m of FAST_MODELS) {
    if (available.includes(m)) return m
  }
  return available[0] || preferred
}

type OllamaChatResponse = {
  message?: { content?: string }
  model?: string
  error?: string
}

function parseExploreJson(content: string): {
  answer?: string
  digDeeper?: string[]
  links?: ExploreLink[]
  topics?: string[]
} {
  return JSON.parse(content.trim())
}

export async function listOllamaModels(): Promise<string[]> {
  const res = await fetch('/api/ollama/api/tags')
  if (!res.ok) throw new Error(`Ollama unreachable (${res.status})`)
  const data = (await res.json()) as { models?: { name: string }[] }
  return (data.models ?? []).map((m) => m.name)
}

export async function exploreQuestion(
  ctx: ExploreContext,
  catalogBlock: string,
  opts?: { model?: string; signal?: AbortSignal },
): Promise<ExploreResult> {
  const model = opts?.model || getConfiguredModel()
  const t0 = performance.now()

  const system = `Thinker research guide. Reply ONLY compact JSON:
{"answer":"max 50 words","digDeeper":["q1","q2"],"links":[{"title":"t","url":"https://...","why":"short"}],"topics":["topic-id"]}
Rules: use ONLY catalog URLs; never invent links; no social-feed URLs; 2 digDeeper max; 3 links max.

CATALOG:
${catalogBlock}`

  const userParts = [
    ctx.topicId ? `topic:${ctx.topicId}` : null,
    ctx.ideaTitle ? `idea:${ctx.ideaTitle}` : null,
    ctx.question,
  ].filter(Boolean)

  const res = await fetch('/api/ollama/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts?.signal,
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      keep_alive: '30m',
      options: {
        temperature: 0.2,
        num_predict: 220,
      },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userParts.join('\n') },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      text ||
        `Ollama chat failed (${res.status}). Is llm-runtime up / local Ollama running?`,
    )
  }

  const data = (await res.json()) as OllamaChatResponse
  if (data.error) throw new Error(data.error)
  const content = data.message?.content ?? ''
  const parsed = parseExploreJson(content)
  const latencyMs = Math.round(performance.now() - t0)

  return {
    answer: parsed.answer?.trim() || content.trim(),
    digDeeper: (parsed.digDeeper ?? []).filter(Boolean).slice(0, 3),
    links: (parsed.links ?? [])
      .filter((l) => l?.url && l?.title)
      .slice(0, 4)
      .map((l) => ({
        title: l.title,
        url: l.url,
        why: l.why || 'Related resource',
      })),
    topics: (parsed.topics ?? []).filter(Boolean).slice(0, 3),
    model: data.model || model,
    latencyMs,
  }
}
