/**
 * GEDCOM-Zerleger.
 *
 * Liest 5.5, 5.5.1 und 7.0. Die Praxis kennt viele Abweichungen von der Norm:
 * CONC/CONT-Fortsetzungen mitten im Wort, fehlende Nullebenen, BOM, CRLF,
 * ANSEL-Kodierung aus PAF und Ahnenblatt. All das wird hier abgefangen, damit
 * der Importer mit einem sauberen Baum arbeiten kann.
 */

export interface GedLine {
  level: number
  xref?: string
  tag: string
  value: string
  children: GedLine[]
}

/** ANSEL-Sonderzeichen, wie sie ältere Programme schreiben. */
const ANSEL_MAP: Record<number, string> = {
  0xa1: 'Ł', 0xa2: 'Ø', 0xa3: 'Đ', 0xa4: 'Þ', 0xa5: 'Æ', 0xa6: 'Œ', 0xa7: 'ʹ',
  0xa8: '·', 0xa9: '♭', 0xaa: '®', 0xab: '±', 0xac: 'Ơ', 0xad: 'Ư', 0xae: 'ʼ',
  0xb0: 'ʻ', 0xb1: 'ł', 0xb2: 'ø', 0xb3: 'đ', 0xb4: 'þ', 0xb5: 'æ', 0xb6: 'œ',
  0xb7: 'ʺ', 0xb8: 'ı', 0xb9: '£', 0xba: 'ð', 0xbc: 'ơ', 0xbd: 'ư',
  0xc0: '°', 0xc1: 'ℓ', 0xc2: '℗', 0xc3: '©', 0xc4: '♯', 0xc5: '¿', 0xc6: '¡',
}

/** Kombinierende Akzente in ANSEL stehen vor dem Buchstaben, nicht danach. */
const ANSEL_DIACRITICS: Record<number, string> = {
  0xe0: '̉', 0xe1: '̀', 0xe2: '́', 0xe3: '̂', 0xe4: '̃',
  0xe5: '̄', 0xe6: '̆', 0xe7: '̇', 0xe8: '̈', 0xe9: '̌',
  0xea: '̊', 0xeb: '︠', 0xec: '︡', 0xed: '̕', 0xee: '̋',
  0xef: '̐', 0xf0: '̧', 0xf1: '̨', 0xf2: '̣', 0xf3: '̤',
  0xf4: '̥', 0xf5: '̳', 0xf6: '̲', 0xf7: '̦', 0xf8: '̜',
  0xf9: '̮', 0xfa: '︢', 0xfb: '︣', 0xfe: '̓',
}

/** Wandelt ANSEL-Bytes in Unicode. */
export function decodeAnsel(bytes: Uint8Array): string {
  let out = ''
  let pending = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if (b < 0x80) {
      out += String.fromCharCode(b) + pending
      pending = ''
    } else if (ANSEL_DIACRITICS[b]) {
      pending = ANSEL_DIACRITICS[b] + pending
    } else if (ANSEL_MAP[b]) {
      out += ANSEL_MAP[b] + pending
      pending = ''
    } else {
      out += String.fromCharCode(b) + pending
      pending = ''
    }
  }
  return out.normalize('NFC')
}

/**
 * Erkennt die Kodierung an der CHAR-Zeile und liest die Datei entsprechend.
 * Das ist nötig, weil dieselbe Datei je nach Herkunftsprogramm in UTF-8,
 * Windows-1252 oder ANSEL vorliegt und Umlaute sonst zerfallen.
 */
export function decodeGedcomBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  // Byte Order Mark
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)

  // Kopfbereich in Latin-1 lesen, um die CHAR-Angabe zu finden
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 2048)).toUpperCase()
  const m = head.match(/\n\s*\d+\s+CHAR\s+([A-Z0-9_-]+)/)
  const charset = m?.[1] ?? ''

  if (charset === 'ANSEL') return decodeAnsel(bytes)
  if (charset === 'UNICODE') return new TextDecoder('utf-16le').decode(bytes)
  if (charset === 'ASCII' || charset === 'ANSI' || charset === 'IBMPC' || charset === 'CP1252') {
    return new TextDecoder('windows-1252').decode(bytes)
  }
  // Vorgabe ist UTF-8; bei ungültigen Folgen auf Windows-1252 zurückfallen
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

export interface ParseResult {
  records: GedLine[]
  warnings: string[]
}

const LINE_RE = /^\s*(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/

/** Zerlegt den Text in einen Baum von Sätzen. */
export function parseGedcom(text: string): ParseResult {
  const warnings: string[] = []
  const raw = text.replace(/\r\n?/g, '\n').split('\n')

  const roots: GedLine[] = []
  // stack[n] ist der zuletzt gesehene Satz der Ebene n
  const stack: GedLine[] = []
  let lineNo = 0

  for (const line of raw) {
    lineNo++
    if (!line.trim()) continue
    const m = line.match(LINE_RE)
    if (!m) {
      warnings.push(`Zeile ${lineNo} ist nicht deutbar und wurde übergangen: ${line.slice(0, 60)}`)
      continue
    }
    const level = parseInt(m[1], 10)
    const xrefOrValue = m[2]
    const tag = m[3].toUpperCase()
    let value = m[4] ?? ''

    // Fortsetzungszeilen gehören an den Wert des übergeordneten Satzes
    if (tag === 'CONT' || tag === 'CONC') {
      const parent = stack[level - 1]
      if (!parent) {
        warnings.push(`Zeile ${lineNo}: Fortsetzung ohne Bezugszeile.`)
        continue
      }
      parent.value += tag === 'CONT' ? `\n${value}` : value
      continue
    }

    // Manche Programme schreiben den Verweis als Wert statt als Kennung
    let xref = xrefOrValue
    if (!xref && /^@[^@]+@$/.test(value.trim()) && level === 0) {
      xref = value.trim()
      value = ''
    }

    const node: GedLine = { level, tag, value, children: [] }
    if (xref) node.xref = xref

    if (level === 0) {
      roots.push(node)
      stack.length = 0
      stack[0] = node
    } else {
      let parent = stack[level - 1]
      if (!parent) {
        // Ebenensprung – den nächstliegenden gültigen Vorfahren nehmen
        for (let l = level - 2; l >= 0; l--) {
          if (stack[l]) { parent = stack[l]; break }
        }
        if (!parent) {
          warnings.push(`Zeile ${lineNo}: Ebene ${level} ohne übergeordneten Satz.`)
          continue
        }
        warnings.push(`Zeile ${lineNo}: Ebenensprung wurde ausgeglichen.`)
      }
      parent.children.push(node)
      stack[level] = node
      stack.length = level + 1
    }
  }

  return { records: roots, warnings }
}

// ---------------------------------------------------------------------------
// Zugriffshilfen auf den Satzbaum
// ---------------------------------------------------------------------------

export function child(node: GedLine | undefined, tag: string): GedLine | undefined {
  return node?.children.find((c) => c.tag === tag)
}

export function childrenWith(node: GedLine | undefined, ...tags: string[]): GedLine[] {
  if (!node) return []
  return node.children.filter((c) => tags.includes(c.tag))
}

export function value(node: GedLine | undefined, tag: string): string | undefined {
  const c = child(node, tag)
  return c ? c.value.trim() || undefined : undefined
}

/** Entfernt die Klammern einer Kennung: @I42@ → I42 */
export function deref(v: string | undefined): string | undefined {
  if (!v) return undefined
  const t = v.trim()
  return /^@.+@$/.test(t) ? t.slice(1, -1) : t
}
