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

/** Direct media file links only — article/podcast pages return null. */
export function detectMediaKind(url: string | undefined | null): MediaKind | null {
  if (!url) return null
  const ext = mediaPathExt(url)
  if (!ext) return null
  if (AUDIO_EXT.has(ext)) return 'audio'
  if (VIDEO_EXT.has(ext)) return 'video'
  return null
}
