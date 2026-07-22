/**
 * Shared feed-proxy helpers — used by Vite middleware and the Docker Node sidecar.
 * GET /api/feed-proxy?url=<https URL>
 */
import dns from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 20_000
const UA = 'ThinkerFeedProxy/1.0 (+https://thinker.360web.cloud)'

/** @param {string} ip */
function isPrivateIp(ip) {
  if (ip === '::1' || ip === '0.0.0.0') return true
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return true
  if (ip.startsWith('169.254.') || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) {
    return true
  }
  const m = /^172\.(\d+)\./.exec(ip)
  if (m) {
    const n = Number(m[1])
    if (n >= 16 && n <= 31) return true
  }
  // IPv4-mapped IPv6
  if (ip.startsWith('::ffff:')) return isPrivateIp(ip.slice(7))
  return false
}

/**
 * @param {string} rawUrl
 * @returns {Promise<{ ok: true, url: URL } | { ok: false, status: number, error: string }>}
 */
export async function validateFeedUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ok: false, status: 400, error: 'Missing url query parameter' }
  }
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, status: 400, error: 'Invalid URL' }
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, status: 400, error: 'Only https URLs are allowed' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, status: 400, error: 'URLs with credentials are not allowed' }
  }
  const host = parsed.hostname
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return { ok: false, status: 400, error: 'Private hosts are not allowed' }
  }
  if (isIP(host) && isPrivateIp(host)) {
    return { ok: false, status: 400, error: 'Private IP addresses are not allowed' }
  }
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true })
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        return { ok: false, status: 400, error: 'Host resolves to a private address' }
      }
    }
  } catch {
    return { ok: false, status: 400, error: 'Could not resolve host' }
  }
  return { ok: true, url: parsed }
}

/**
 * @param {string} rawUrl
 * @returns {Promise<{ ok: true, status: number, contentType: string, body: string } | { ok: false, status: number, error: string }>}
 */
export async function proxyFeed(rawUrl) {
  const checked = await validateFeedUrl(rawUrl)
  if (!checked.ok) return checked

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(checked.url.href, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept:
          'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*',
      },
    })
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) {
      return { ok: false, status: 502, error: 'Feed response too large' }
    }
    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    if (!res.ok) {
      return {
        ok: false,
        status: 502,
        error: `Upstream ${res.status} ${res.statusText}`,
      }
    }
    return {
      ok: true,
      status: 200,
      contentType,
      body: buf.toString('utf8'),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Feed proxy failed'
    return { ok: false, status: 502, error: message }
  } finally {
    clearTimeout(timer)
  }
}
