/** Named entities we see in RSS / feed HTML (plus the XML five). */
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '\u2019',
  lsquo: '\u2018',
  rdquo: '\u201D',
  ldquo: '\u201C',
  pound: '£',
  copy: '©',
  reg: '®',
  trade: '™',
}

/**
 * Decode HTML character references (`&#160;`, `&#x2019;`, `&amp;`, …).
 * Runs a few passes so double-encoded forms like `&amp;#160;` resolve.
 */
export function decodeHtmlEntities(input: string): string {
  let s = String(input ?? '')
  for (let pass = 0; pass < 3; pass++) {
    const next = s.replace(
      /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,
      (entity, body: string) => {
        if (body[0] === '#') {
          const code =
            body[1] === 'x' || body[1] === 'X'
              ? parseInt(body.slice(2), 16)
              : parseInt(body.slice(1), 10)
          if (!Number.isFinite(code) || code < 0) return entity
          try {
            return String.fromCodePoint(code)
          } catch {
            return entity
          }
        }
        const named = NAMED[body.toLowerCase()]
        return named !== undefined ? named : entity
      },
    )
    if (next === s) break
    s = next
  }
  return s
}
