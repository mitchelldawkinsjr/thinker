/** boll.s life / Protestant canon book numbers → api.bible / Scriptura USFM ids */

const BOLLS_TO_USFM: Record<number, string> = {
  1: 'GEN',
  2: 'EXO',
  3: 'LEV',
  4: 'NUM',
  5: 'DEU',
  6: 'JOS',
  7: 'JDG',
  8: 'RUT',
  9: '1SA',
  10: '2SA',
  11: '1KI',
  12: '2KI',
  13: '1CH',
  14: '2CH',
  15: 'EZR',
  16: 'NEH',
  17: 'EST',
  18: 'JOB',
  19: 'PSA',
  20: 'PRO',
  21: 'ECC',
  22: 'SNG',
  23: 'ISA',
  24: 'JER',
  25: 'LAM',
  26: 'EZK',
  27: 'DAN',
  28: 'HOS',
  29: 'JOL',
  30: 'AMO',
  31: 'OBA',
  32: 'JON',
  33: 'MIC',
  34: 'NAH',
  35: 'HAB',
  36: 'ZEP',
  37: 'HAG',
  38: 'ZEC',
  39: 'MAL',
  40: 'MAT',
  41: 'MRK',
  42: 'LUK',
  43: 'JHN',
  44: 'ACT',
  45: 'ROM',
  46: '1CO',
  47: '2CO',
  48: 'GAL',
  49: 'EPH',
  50: 'PHP',
  51: 'COL',
  52: '1TH',
  53: '2TH',
  54: '1TI',
  55: '2TI',
  56: 'TIT',
  57: 'PHM',
  58: 'HEB',
  59: 'JAS',
  60: '1PE',
  61: '2PE',
  62: '1JN',
  63: '2JN',
  64: '3JN',
  65: 'JUD',
  66: 'REV',
}

const BOLLS_BASE = 'https://bolls.life'
const DEFAULT_SCRIPTURA = 'https://scriptura.360web.cloud'
const PREFER_KEY = 'thinker-prefer-scriptura'
const PROBE_TTL_MS = 10 * 60 * 1000

export type ScriptureRef = {
  bookId: number
  chapter: number
  verseStart?: number
  verseEnd?: number
  translation?: string
  /** Legacy bolls URL from seed/ingest — used if we cannot build one */
  sourceUrl?: string
}

export function bollsToUsfm(bookId: number): string | null {
  return BOLLS_TO_USFM[bookId] ?? null
}

export function getScripturaBase(): string {
  const fromEnv = import.meta.env.VITE_SCRIPTURA_URL?.trim()
  return (fromEnv || DEFAULT_SCRIPTURA).replace(/\/$/, '')
}

export function bollsPassageUrl(ref: ScriptureRef): string {
  if (ref.sourceUrl?.includes('bolls.life')) return ref.sourceUrl
  const tr = ref.translation || 'WEB'
  return `${BOLLS_BASE}/${tr}/${ref.bookId}/${ref.chapter}/`
}

export function scripturaPassageUrl(ref: ScriptureRef): string | null {
  const book = bollsToUsfm(ref.bookId)
  if (!book) return null
  const q = new URLSearchParams({
    book,
    chapter: String(ref.chapter),
  })
  if (ref.verseStart && ref.verseStart > 0) {
    q.set('verse', String(ref.verseStart))
  }
  return `${getScripturaBase()}/?${q}`
}

function readPreferScriptura(): boolean {
  try {
    const raw = localStorage.getItem(PREFER_KEY)
    if (raw === '0') return false
    if (raw === '1') return true
  } catch {
    /* ignore */
  }
  return true
}

function writePreferScriptura(prefer: boolean) {
  try {
    localStorage.setItem(PREFER_KEY, prefer ? '1' : '0')
  } catch {
    /* ignore */
  }
}

let lastProbeAt = 0
let probing: Promise<boolean> | null = null

/** Lightweight reachability probe — falls back to bolls when Scriptura is down. */
export async function probeScriptura(force = false): Promise<boolean> {
  const now = Date.now()
  if (!force && now - lastProbeAt < PROBE_TTL_MS && probing == null) {
    return readPreferScriptura()
  }
  if (probing) return probing

  probing = (async () => {
    try {
      const ctrl = new AbortController()
      const t = window.setTimeout(() => ctrl.abort(), 3500)
      // mode: no-cors still resolves if the host is reachable (opaque response)
      await fetch(getScripturaBase() + '/', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: ctrl.signal,
      })
      window.clearTimeout(t)
      writePreferScriptura(true)
      lastProbeAt = Date.now()
      return true
    } catch {
      writePreferScriptura(false)
      lastProbeAt = Date.now()
      return false
    } finally {
      probing = null
    }
  })()

  return probing
}

/** Prefer Scriptura; bounce to bolls when probe failed or USFM unknown. */
export function preferredPassageUrl(ref: ScriptureRef): {
  href: string
  via: 'scriptura' | 'bolls'
  fallbackHref: string
} {
  const bolls = bollsPassageUrl(ref)
  const scriptura = scripturaPassageUrl(ref)
  const prefer = readPreferScriptura()

  if (prefer && scriptura) {
    return { href: scriptura, via: 'scriptura', fallbackHref: bolls }
  }
  return { href: bolls, via: 'bolls', fallbackHref: bolls }
}

/** Call once on scripture card mount / feed load. */
export function warmScripturaProbe() {
  void probeScriptura()
}
