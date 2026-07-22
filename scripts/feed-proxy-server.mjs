#!/usr/bin/env node
/**
 * Standalone feed proxy for Docker (nginx proxies /api/feed-proxy here).
 * Listen: FEED_PROXY_PORT (default 3091)
 */
import http from 'node:http'
import { proxyFeed } from './lib/feedProxy.mjs'

const PORT = Number(process.env.FEED_PROXY_PORT || 3091)

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
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
  console.log(`feed-proxy listening on ${PORT}`)
})
