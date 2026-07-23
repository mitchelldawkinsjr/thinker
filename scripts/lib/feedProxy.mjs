/**
 * Shared feed-proxy helpers — used by Vite middleware and the Docker Node sidecar.
 * GET /api/feed-proxy?url=<https URL>
 */
import dns from 'node:dns/promises'
import https from 'node:https'
import { isIP } from 'node:net'

const MAX_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 20_000
const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1']
const UA =
  'Mozilla/5.0 (compatible; ThinkerFeedProxy/1.0; +https://thinker.360web.cloud) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

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
 * System DNS first; fall back to public resolvers when the OS returns NXDOMAIN
 * (common in locked-down sandboxes that still allow egress by IP).
 * @param {string} host
 * @returns {Promise<Array<{ address: string, family: number }>>}
 */
async function lookupHost(host) {
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true })
    if (records.length) return records
  } catch {
    // fall through to public DNS
  }
  const resolver = new dns.Resolver()
  resolver.setServers(PUBLIC_DNS)
  /** @type {Array<{ address: string, family: number }>} */
  const out = []
  try {
    for (const address of await resolver.resolve4(host)) {
      out.push({ address, family: 4 })
    }
  } catch {
    // ignore
  }
  try {
    for (const address of await resolver.resolve6(host)) {
      out.push({ address, family: 6 })
    }
  } catch {
    // ignore
  }
  if (!out.length) throw new Error('Could not resolve host')
  return out
}

/**
 * @param {string} rawUrl
 * @returns {Promise<{ ok: true, url: URL, records: Array<{ address: string, family: number }> } | { ok: false, status: number, error: string }>}
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
  let records
  try {
    records = isIP(host)
      ? [{ address: host, family: isIP(host) }]
      : await lookupHost(host)
  } catch {
    return { ok: false, status: 400, error: 'Could not resolve host' }
  }
  for (const r of records) {
    if (isPrivateIp(r.address)) {
      return { ok: false, status: 400, error: 'Host resolves to a private address' }
    }
  }
  return { ok: true, url: parsed, records }
}

/**
 * HTTPS GET via resolved IP + SNI so we don't depend on the OS stub resolver for fetch().
 * @param {URL} url
 * @param {Array<{ address: string, family: number }>} records
 * @param {AbortSignal} signal
 */
function httpsGetByIp(url, records, signal) {
  const ip = records[0]?.address
  if (!ip) return Promise.reject(new Error('No resolved address'))

  return new Promise((resolve, reject) => {
    /** @type {import('node:http').IncomingMessage | null} */
    let incoming = null
    const req = https.request(
      {
        host: ip,
        servername: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          Host: url.hostname,
          'User-Agent': UA,
          Accept:
            'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*',
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        incoming = res
        /** @type {Buffer[]} */
        const chunks = []
        let total = 0
        res.on('data', (chunk) => {
          total += chunk.length
          if (total > MAX_BYTES) {
            req.destroy()
            reject(new Error('Feed response too large'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            statusMessage: res.statusMessage || '',
            contentType: res.headers['content-type'] || 'application/octet-stream',
            body: Buffer.concat(chunks),
          })
        })
      },
    )

    const onAbort = () => {
      req.destroy()
      incoming?.destroy()
      reject(new Error('Aborted'))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Upstream timeout'))
    })
    req.on('error', reject)
    req.end()
  })
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
    const upstream = await httpsGetByIp(checked.url, checked.records, ctrl.signal)
    if (upstream.body.byteLength > MAX_BYTES) {
      return { ok: false, status: 502, error: 'Feed response too large' }
    }
    if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
      return {
        ok: false,
        status: 502,
        error: `Upstream ${upstream.statusCode} ${upstream.statusMessage}`,
      }
    }
    return {
      ok: true,
      status: 200,
      contentType: String(upstream.contentType),
      body: upstream.body.toString('utf8'),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Feed proxy failed'
    return { ok: false, status: 502, error: message }
  } finally {
    clearTimeout(timer)
  }
}
