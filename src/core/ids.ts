/** Kennungen. Bewusst ohne Zufallsquelle aus dem Netz – alles läuft lokal. */

let counter = 0

export function uid(prefix = 'x'): string {
  counter += 1
  const rnd = Math.random().toString(36).slice(2, 8)
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${rnd}`
}

/** GEDCOM-Kennung im üblichen Format @I123@. */
export function xref(kind: 'I' | 'F' | 'S' | 'R' | 'O' | 'N', n: number): string {
  return `@${kind}${n}@`
}
