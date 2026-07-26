/**
 * Create an inbox file + PR on GitHub for the Thinker idea loop.
 * Used by the Docker sidecar and Vite middleware — keeps GITHUB_TOKEN server-side.
 */
const GITHUB_API = 'https://api.github.com'

/**
 * @param {string} token
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function gh(token, path, init = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  /** @type {unknown} */
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }
  return { ok: res.ok, status: res.status, body }
}

/**
 * @param {'seeds' | 'promote'} kind
 * @param {string | undefined} suggested
 */
export function inboxFilename(kind, suggested) {
  const stamp = new Date().toISOString().slice(0, 10)
  const fallback =
    kind === 'seeds'
      ? `thinker-thought-seeds-${stamp}.json`
      : `thinker-approved-drafts-${stamp}.json`
  const raw = (suggested || fallback).split(/[/\\]/).pop() || fallback
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '-')
  if (!safe.toLowerCase().endsWith('.json')) return fallback
  return safe
}

/**
 * @param {'seeds' | 'promote'} kind
 * @param {string} filename
 */
export function inboxPath(kind, filename) {
  const dir = kind === 'seeds' ? 'scripts/seeds/inbox' : 'scripts/promote/inbox'
  return `${dir}/${filename}`
}

/**
 * @param {{
 *   token: string
 *   repo: string
 *   kind: 'seeds' | 'promote'
 *   payload: unknown
 *   filename?: string
 *   baseBranch?: string
 * }} opts
 */
export async function createQueuePullRequest(opts) {
  const { token, repo, kind, payload, baseBranch = 'main' } = opts
  if (!token) {
    return { ok: false, status: 503, error: 'GITHUB_TOKEN not configured' }
  }
  if (kind !== 'seeds' && kind !== 'promote') {
    return { ok: false, status: 400, error: 'kind must be seeds or promote' }
  }
  if (payload == null || typeof payload !== 'object') {
    return { ok: false, status: 400, error: 'payload object required' }
  }

  const filename = inboxFilename(kind, opts.filename)
  const path = inboxPath(kind, filename)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const branch = `queue-${kind}-${stamp}`
  const content = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8').toString(
    'base64',
  )

  const ref = await gh(token, `/repos/${repo}/git/ref/heads/${baseBranch}`)
  if (!ref.ok) {
    const msg =
      /** @type {{ message?: string }} */ (ref.body)?.message ||
      `Could not read ${baseBranch}`
    return { ok: false, status: ref.status, error: msg }
  }
  const baseSha = /** @type {{ object?: { sha?: string } }} */ (ref.body).object?.sha
  if (!baseSha) {
    return { ok: false, status: 502, error: `Missing SHA for ${baseBranch}` }
  }

  const createdRef = await gh(token, `/repos/${repo}/git/refs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  })
  if (!createdRef.ok) {
    const msg =
      /** @type {{ message?: string }} */ (createdRef.body)?.message ||
      'Could not create branch'
    return { ok: false, status: createdRef.status, error: msg }
  }

  const commitMessage =
    kind === 'seeds'
      ? `chore: queue thought seeds (${filename})`
      : `chore: queue approved drafts (${filename})`

  const put = await gh(token, `/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      content,
      branch,
    }),
  })
  if (!put.ok) {
    const msg =
      /** @type {{ message?: string }} */ (put.body)?.message || 'Could not commit file'
    return { ok: false, status: put.status, error: msg }
  }

  const title =
    kind === 'seeds' ? 'chore: queue thought seeds' : 'chore: queue approved drafts'
  const body =
    kind === 'seeds'
      ? `## Summary
- Queued Kept seed export into \`${path}\`
- **Merge this PR** → Draft ideas Action drafts from the inbox and opens a review PR

## Test plan
- [ ] Confirm the JSON looks right
- [ ] Merge to start drafting
`
      : `## Summary
- Queued approved draft export into \`${path}\`
- **Merge this PR** → Promote ideas Action updates the live pool PR

## Test plan
- [ ] Confirm approved items look right
- [ ] Merge to promote
`

  const pr = await gh(token, `/repos/${repo}/pulls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      head: branch,
      base: baseBranch,
      body,
    }),
  })
  if (!pr.ok) {
    const msg =
      /** @type {{ message?: string }} */ (pr.body)?.message || 'Could not open PR'
    return { ok: false, status: pr.status, error: msg }
  }

  const prBody = /** @type {{ html_url?: string, number?: number }} */ (pr.body)
  return {
    ok: true,
    status: 201,
    prUrl: prBody.html_url || null,
    prNumber: prBody.number || null,
    path,
    branch,
  }
}

/**
 * @param {string | undefined} token
 * @param {string | undefined} queueSecret
 */
export function githubQueueConfigured(token, queueSecret) {
  return Boolean(token?.trim() && queueSecret?.trim())
}
