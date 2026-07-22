export type MediaKind = 'audio' | 'video'

const AUDIO_EXT = new Set([
  'mp3',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'opus',
  'wav',
  'flac',
  'weba',
])

const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv', 'mkv'])

/** Path basename without query/hash — e.g. audio.mp3 from an Omny CDN URL. */
export function mediaPathExt(url: string): string | null {
  try {
    const path = new URL(url, 'https://example.invalid').pathname
    const base = path.split('/').pop() || ''
    const dot = base.lastIndexOf('.')
    if (dot < 0 || dot === base.length - 1) return null
    return base.slice(dot + 1).toLowerCase()
  } catch {
    return null
  }
}

/** YouTube watch / short / embed / youtu.be → video id, or null. */
export function youtubeVideoId(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0] || ''
      return /^[\w-]{11}$/.test(id) ? id : null
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const v = u.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)
      if (m) return m[1]
    }
    return null
  } catch {
    return null
  }
}

/** Embed player URL for lightbox autoplay. */
export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeVideoId(url)
  if (!id) return null
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
}

/** Direct media files + YouTube watch/embed links; article/podcast pages return null. */
export function detectMediaKind(url: string | undefined | null): MediaKind | null {
  if (!url) return null
  if (youtubeVideoId(url)) return 'video'
  const ext = mediaPathExt(url)
  if (!ext) return null
  if (AUDIO_EXT.has(ext)) return 'audio'
  if (VIDEO_EXT.has(ext)) return 'video'
  return null
}

/** Prefer a direct audio/video file URL when the card has one. */
export function resolvePlayableUrl(
  sourceUrl: string,
  angles?: Array<{ url: string }> | null,
): { url: string; kind: MediaKind | null } {
  const candidates = [...(angles ?? []).map((a) => a.url), sourceUrl].filter(Boolean)
  for (const url of candidates) {
    const kind = detectMediaKind(url)
    if (kind) return { url, kind }
  }
  const url = angles?.[0]?.url || sourceUrl
  return { url, kind: detectMediaKind(url) }
}
