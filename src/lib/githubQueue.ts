/** Client helpers for the idea-loop GitHub queue (server holds the PAT). */

const QUEUE_SECRET_KEY = 'thinker-queue-secret-v1'

export type QueueKind = 'seeds' | 'promote'

export type GithubQueueStatus = {
  configured: boolean
  repo?: string
}

export type QueuePullRequestResult = {
  prUrl: string | null
  prNumber: number | null
  path: string
  branch: string
}

export function loadQueueSecret(): string {
  try {
    return localStorage.getItem(QUEUE_SECRET_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

export function saveQueueSecret(secret: string) {
  try {
    const v = secret.trim()
    if (v) localStorage.setItem(QUEUE_SECRET_KEY, v)
    else localStorage.removeItem(QUEUE_SECRET_KEY)
  } catch {
    // private mode
  }
}

export async function fetchGithubQueueStatus(): Promise<GithubQueueStatus> {
  try {
    const res = await fetch('/api/github/status')
    if (!res.ok) return { configured: false }
    const data = (await res.json()) as GithubQueueStatus
    return { configured: Boolean(data.configured), repo: data.repo }
  } catch {
    return { configured: false }
  }
}

export async function openIdeaLoopPullRequest(opts: {
  kind: QueueKind
  payload: unknown
  filename?: string
  secret?: string
}): Promise<QueuePullRequestResult> {
  const secret = (opts.secret ?? loadQueueSecret()).trim()
  if (!secret) {
    throw new Error('Set the idea-loop gate secret in Settings first.')
  }
  const res = await fetch('/api/github/queue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Queue-Secret': secret,
    },
    body: JSON.stringify({
      kind: opts.kind,
      payload: opts.payload,
      filename: opts.filename,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    prUrl?: string | null
    prNumber?: number | null
    path?: string
    branch?: string
  }
  if (!res.ok) {
    throw new Error(data.error || `Queue failed (${res.status})`)
  }
  return {
    prUrl: data.prUrl ?? null,
    prNumber: data.prNumber ?? null,
    path: data.path || '',
    branch: data.branch || '',
  }
}
