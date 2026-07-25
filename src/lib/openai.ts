import {
  buildExploreSystemPrompt,
  buildExploreUserParts,
  type ExploreContext,
  type ExploreLink,
  type ExploreResult,
} from './ollama'

const DEFAULT_MODEL = 'gpt-4o-mini'

export function getOpenAIModel() {
  return import.meta.env.VITE_OPENAI_MODEL?.trim() || DEFAULT_MODEL
}

export async function isOpenAIConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/openai/status')
    if (!res.ok) return false
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return false
    const data = (await res.json()) as { configured?: boolean }
    return Boolean(data.configured)
  } catch {
    return false
  }
}

type ChatResponse = {
  choices?: { message?: { content?: string } }[]
  model?: string
  error?: { message?: string }
}

function parseExploreJson(content: string): {
  answer?: string
  digDeeper?: string[]
  links?: ExploreLink[]
  topics?: string[]
} {
  return JSON.parse(content.trim())
}

/** GPT refine — same JSON contract as Ollama explore. */
export async function exploreWithOpenAI(
  ctx: ExploreContext,
  catalogBlock: string,
  opts?: { model?: string; signal?: AbortSignal; thoughtsBlock?: string },
): Promise<ExploreResult> {
  const model = opts?.model || getOpenAIModel()
  const t0 = performance.now()

  const system = buildExploreSystemPrompt(catalogBlock, opts?.thoughtsBlock)
  const userParts = buildExploreUserParts(ctx)

  const res = await fetch('/api/openai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts?.signal,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userParts.join('\n') },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `OpenAI chat failed (${res.status})`)
  }

  const data = (await res.json()) as ChatResponse
  if (data.error?.message) throw new Error(data.error.message)
  const content = data.choices?.[0]?.message?.content ?? ''
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
