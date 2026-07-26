#!/usr/bin/env node
/**
 * Node sidecar for Docker (nginx proxies here):
 *   GET  /api/feed-proxy?url=…
 *   GET  /api/github/status
 *   POST /api/github/queue
 * Listen: FEED_PROXY_PORT (default 3091)
 */
import http from 'node:http'
import { proxyFeed } from './lib/feedProxy.mjs'
import {
  createQueuePullRequest,
  githubQueueConfigured,
} from './lib/githubQueue.mjs'

const PORT = Number(process.env.FEED_PROXY_PORT || 3091)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim() || ''
const QUEUE_SECRET = process.env.QUEUE_SECRET?.trim() || ''
const GITHUB_REPO = process.env.GITHUB_REPO?.trim() || 'mitchelldawkinsjr/thinker'

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

/**
 * @param {import('node:http').IncomingMessage} req
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * @param {import('node:http').IncomingMessage} req
 */
function authorized(req) {
  const header = req.headers['x-queue-secret']
  const provided = Array.isArray(header) ? header[0] : header
  return Boolean(QUEUE_SECRET && provided && provided === QUEUE_SECRET)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  if (url.pathname === '/api/github/status') {
    if (req.method !== 'GET') {
      json(res, 405, { error: 'Method not allowed' })
      return
    }
    json(res, 200, {
      configured: githubQueueConfigured(GITHUB_TOKEN, QUEUE_SECRET),
      repo: GITHUB_REPO,
    })
    return
  }

  if (url.pathname === '/api/github/queue') {
    if (req.method !== 'POST') {
      json(res, 405, { error: 'Method not allowed' })
      return
    }
    if (!githubQueueConfigured(GITHUB_TOKEN, QUEUE_SECRET)) {
      json(res, 503, { error: 'GitHub queue not configured on server' })
      return
    }
    if (!authorized(req)) {
      json(res, 401, { error: 'Invalid or missing X-Queue-Secret' })
      return
    }
    try {
      const raw = await readBody(req)
      const parsed = JSON.parse(raw.toString('utf8') || '{}')
      const kind = parsed.kind
      const result = await createQueuePullRequest({
        token: GITHUB_TOKEN,
        repo: GITHUB_REPO,
        kind,
        payload: parsed.payload,
        filename: typeof parsed.filename === 'string' ? parsed.filename : undefined,
      })
      if (!result.ok) {
        json(res, result.status || 502, { error: result.error })
        return
      }
      json(res, 201, {
        prUrl: result.prUrl,
        prNumber: result.prNumber,
        path: result.path,
        branch: result.branch,
      })
    } catch (err) {
      json(res, 400, {
        error: err instanceof Error ? err.message : 'Invalid request body',
      })
    }
    return
  }

  if (url.pathname !== '/api/feed-proxy' && url.pathname !== '/') {
    json(res, 404, { error: 'Not found' })
    return
  }
  if (req.method !== 'GET') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }
  const target = url.searchParams.get('url') || ''
  const result = await proxyFeed(target)
  if (!result.ok) {
    json(res, result.status, { error: result.error })
    return
  }
  res.writeHead(200, {
    'Content-Type': result.contentType,
    'Cache-Control': 'no-store',
  })
  res.end(result.body)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`thinker api sidecar listening on ${PORT}`)
})
