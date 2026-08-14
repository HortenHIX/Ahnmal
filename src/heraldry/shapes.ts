/**
 * Schildformen und Heroldsbilder als Geometrie.
 *
 * Alles rechnet in einem Feld von 200 × 220. Der Schildrand ist die
 * Beschneidungsmaske für alles Weitere, damit Teilungen und Heroldsbilder
 * sauber an der Kante enden.
 */

import type { LineStyle, OrdinaryType, ShieldShape } from '../core/types'

export const W = 200
export const H = 220

/** Umriss des Schildes. */
export const SHIELD_PATHS: Record<ShieldShape, string> = {
  // Dreiecksschild des Hochmittelalters – die klassische Form
  heater: `M4 4 H196 V78 C196 140 158 186 100 216 C42 186 4 140 4 78 Z`,
  // Normannenschild, langgezogen und oben gerundet
  norman: `M100 2 C60 2 24 10 12 18 C12 90 24 160 100 218 C176 160 188 90 188 18 C176 10 140 2 100 2 Z`,
  // Iberische Form, unten halbrund
  iberian: `M6 4 H194 V130 C194 178 152 210 100 216 C48 210 6 178 6 130 Z`,
  // Französisch modern, mit Nasen und Mittelspitze
  french: `M6 4 H194 V150 C194 176 176 194 152 204 C132 212 112 216 100 218 C88 216 68 212 48 204 C24 194 6 176 6 150 Z`,
  // Rossstirnschild, oval
  italian: `M100 2 C40 2 8 40 8 100 C8 168 46 210 100 218 C154 210 192 168 192 100 C192 40 160 2 100 2 Z`,
  polish: `M8 4 H192 V96 C192 150 160 190 100 218 C40 190 8 150 8 96 Z`,
  // Raute, überliefert für Frauenwappen
  lozenge: `M100 2 L192 110 L100 218 L8 110 Z`,
  oval: `M100 2 C48 2 12 48 12 110 C12 172 48 218 100 218 C152 218 188 172 188 110 C188 48 152 2 100 2 Z`,
  square: `M8 6 H192 V214 H8 Z`,
  // Tartsche mit Speerruhe an der rechten oberen Ecke
  targe: `M4 30 C4 14 16 4 32 4 H120 L120 22 C120 30 126 34 136 34 H196 V96 C196 152 156 194 100 216 C44 194 4 152 4 96 Z`,
}

export const SHIELD_LABELS: Record<ShieldShape, string> = {
  heater: 'Dreiecksschild (hochmittelalterlich)',
  norman: 'Normannenschild',
  iberian: 'Iberischer Schild',
  french: 'Französischer Schild',
  italian: 'Rossstirnschild',
  polish: 'Polnischer Schild',
  lozenge: 'Raute (Frauenwappen)',
  oval: 'Oval',
  square: 'Rechteck (Banner)',
  targe: 'Tartsche mit Speerruhe',
}

// ---------------------------------------------------------------------------
// Schnittlinien
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine Linie zwischen zwei Punkten in der gewünschten Schnittform.
 * Heraldische Schnitte sind nicht Zierrat: Sie unterscheiden Wappen, die sich
 * sonst gleichen, und sind daher Bestandteil der Blasonierung.
 */
export function styledLine(
  x1: number, y1: number, x2: number, y2: number,
  style: LineStyle = 'straight',
  amplitude = 7,
): string {
  if (style === 'straight') return `L${x2} ${y2}`

  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 1) return `L${x2} ${y2}`

  const ux = dx / len
  const uy = dy / len
  // Normale zur Linie
  const nx = -uy
  const ny = ux

  const step = style === 'nebuly' ? 26 : style === 'embattled' || style === 'dovetailed' ? 24 : 18
  const n = Math.max(2, Math.round(len / step))
  const seg = len / n

  const at = (t: number, off = 0) => [x1 + ux * t + nx * off, y1 + uy * t + ny * off] as const
  const parts: string[] = []

  for (let i = 0; i < n; i++) {
    const t0 = i * seg
    const t1 = (i + 1) * seg
    const mid = (t0 + t1) / 2
    const sign = i % 2 === 0 ? 1 : -1

    switch (style) {
      case 'wavy': {
        const [cx, cy] = at(mid, amplitude * sign)
        const [ex, ey] = at(t1)
        parts.push(`Q${cx} ${cy} ${ex} ${ey}`)
        break
      }
      case 'nebuly': {
        const [c1x, c1y] = at(t0 + seg * 0.3, amplitude * 1.6 * sign)
        const [c2x, c2y] = at(t1 - seg * 0.3, amplitude * 1.6 * sign)
        const [ex, ey] = at(t1)
        parts.push(`C${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`)
        break
      }
      case 'engrailed': {
        const [cx, cy] = at(mid, amplitude)
        const [ex, ey] = at(t1)
        parts.push(`Q${cx} ${cy} ${ex} ${ey}`)
        break
      }
      case 'invected': {
        const [cx, cy] = at(mid, -amplitude)
        const [ex, ey] = at(t1)
        parts.push(`Q${cx} ${cy} ${ex} ${ey}`)
        break
      }
      case 'indented':
      case 'dancetty': {
        const amp = style === 'dancetty' ? amplitude * 1.8 : amplitude
        const [mx, my] = at(mid, amp * sign)
        const [ex, ey] = at(t1)
        parts.push(`L${mx} ${my} L${ex} ${ey}`)
        break
      }
      case 'embattled': {
        const [ax, ay] = at(t0, i % 2 === 0 ? 0 : -amplitude)
        const [bx, by] = at(t0, i % 2 === 0 ? -amplitude : 0)
        const [ex, ey] = at(t1, i % 2 === 0 ? -amplitude : 0)
        void ax; void ay
        parts.push(`L${bx} ${by} L${ex} ${ey}`)
        break
      }
      case 'dovetailed': {
        const [ax, ay] = at(t0 + seg * 0.2, sign * amplitude)
        const [bx, by] = at(t1 - seg * 0.2, sign * amplitude)
        const [ex, ey] = at(t1)
        parts.push(`L${ax} ${ay} L${bx} ${by} L${ex} ${ey}`)
        break
      }
      case 'raguly': {
        const [ax, ay] = at(t0, sign * amplitude)
        const [bx, by] = at(t1 - seg * 0.35, sign * amplitude)
        const [ex, ey] = at(t1)
        parts.push(`L${ax} ${ay} L${bx} ${by} L${ex} ${ey}`)
        break
      }
      case 'potenty': {
        const [ax, ay] = at(t0 + seg * 0.25, sign * amplitude)
        const [bx, by] = at(t0 + seg * 0.75, sign * amplitude)
        const [ex, ey] = at(t1)
        parts.push(`L${ax} ${ay} L${bx} ${by} L${ex} ${ey}`)
        break
      }
      default: {
        const [ex, ey] = at(t1)
        parts.push(`L${ex} ${ey}`)
      }
    }
  }
  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Heroldsbilder
// ---------------------------------------------------------------------------

const T = 34 // Regelbreite eines Heroldsbildes, etwa ein Drittel des Schildes

/**
 * Liefert den Pfad eines Heroldsbildes. Die Figuren reichen bewusst über den
 * Schildrand hinaus; das Beschneiden übernimmt die Maske.
 */
export function ordinaryPath(type: OrdinaryType, line: LineStyle = 'straight', index = 0, count = 1): string {
  const cx = W / 2
  const cy = 96

  switch (type) {
    case 'fess': {
      const y = cy - T / 2
      return `M-10 ${y} ${styledLine(-10, y, W + 10, y, line)} L${W + 10} ${y + T} ${styledLine(W + 10, y + T, -10, y + T, line)} Z`
    }
    case 'bar':
    case 'barrulet': {
      const h = type === 'bar' ? 18 : 10
      const spread = 46
      const y = cy - spread / 2 + index * (spread / Math.max(1, count - 1 || 1))
      return `M-10 ${y} L${W + 10} ${y} L${W + 10} ${y + h} L-10 ${y + h} Z`
    }
    case 'pale': {
      const x = cx - T / 2
      return `M${x} -10 ${styledLine(x, -10, x, H + 10, line)} L${x + T} ${H + 10} ${styledLine(x + T, H + 10, x + T, -10, line)} Z`
    }
    case 'pallet':
    case 'endorse': {
      const w = type === 'pallet' ? 18 : 10
      const spread = 60
      const x = cx - spread / 2 + index * (spread / Math.max(1, count - 1 || 1)) - w / 2
      return `M${x} -10 L${x + w} -10 L${x + w} ${H + 10} L${x} ${H + 10} Z`
    }
    case 'bend': {
      const o = T / 1.4
      return `M-20 ${-20 + o} L${-20 + o} -20 L${W + 20} ${H - 20} L${W + 20 - o} ${H - 20 + o} Z`
    }
    case 'bendlet':
    case 'baton': {
      const o = 15
      const shift = (index - (count - 1) / 2) * 34
      const path = `M${-20 + shift} ${-20 + o} L${-20 + o + shift} -20 L${W + 20 + shift} ${H - 20} L${W + 20 - o + shift} ${H - 20 + o} Z`
      return path
    }
    case 'bendSinister': {
      const o = T / 1.4
      return `M${W + 20} ${-20 + o} L${W + 20 - o} -20 L-20 ${H - 20} L${-20 + o} ${H - 20 + o} Z`
    }
    case 'chevron': {
      const t = T * 0.9
      return `M-10 ${H * 0.72} L${cx} ${cy - 44} L${W + 10} ${H * 0.72} L${W + 10} ${H * 0.72 + t} L${cx} ${cy - 44 + t} L-10 ${H * 0.72 + t} Z`
    }
    case 'chevronel': {
      const t = 14
      const shift = index * 36
      const base = H * 0.66 + shift
      return `M-10 ${base} L${cx} ${base - 62} L${W + 10} ${base} L${W + 10} ${base + t} L${cx} ${base - 62 + t} L-10 ${base + t} Z`
    }
    case 'chevronReversed': {
      const t = T * 0.9
      return `M-10 ${cy - 40} L${cx} ${cy + 30} L${W + 10} ${cy - 40} L${W + 10} ${cy - 40 - t} L${cx} ${cy + 30 - t} L-10 ${cy - 40 - t} Z`
    }
    case 'cross': {
      const hx = cx - T / 2
      const hy = cy - T / 2
      return `M${hx} -10 L${hx + T} -10 L${hx + T} ${hy} L${W + 10} ${hy} L${W + 10} ${hy + T} L${hx + T} ${hy + T} L${hx + T} ${H + 10} L${hx} ${H + 10} L${hx} ${hy + T} L-10 ${hy + T} L-10 ${hy} L${hx} ${hy} Z`
    }
    case 'crossHumetty': {
      const a = 30
      const b = 74
      return `M${cx - a / 2} ${cy - b} L${cx + a / 2} ${cy - b} L${cx + a / 2} ${cy - a / 2} L${cx + b} ${cy - a / 2} L${cx + b} ${cy + a / 2} L${cx + a / 2} ${cy + a / 2} L${cx + a / 2} ${cy + b} L${cx - a / 2} ${cy + b} L${cx - a / 2} ${cy + a / 2} L${cx - b} ${cy + a / 2} L${cx - b} ${cy - a / 2} L${cx - a / 2} ${cy - a / 2} Z`
    }
    case 'saltire': {
      const o = T / 1.5
      return [
        `M-20 ${-20 + o} L${-20 + o} -20 L${W + 20} ${H - 20} L${W + 20 - o} ${H - 20 + o} Z`,
        `M${W + 20} ${-20 + o} L${W + 20 - o} -20 L-20 ${H - 20} L${-20 + o} ${H - 20 + o} Z`,
      ].join(' ')
    }
    case 'chief': {
      const h = 52
      return `M-10 -10 L${W + 10} -10 L${W + 10} ${h} ${styledLine(W + 10, h, -10, h, line)} Z`
    }
    case 'base': {
      const y = 150
      return `M-10 ${y} ${styledLine(-10, y, W + 10, y, line)} L${W + 10} ${H + 10} L-10 ${H + 10} Z`
    }
    case 'pile': {
      return `M-4 -10 L${W + 4} -10 L${cx} ${H * 0.78} Z`
    }
    case 'canton':
    case 'quarter': {
      const s = type === 'canton' ? 66 : 90
      return `M-10 -10 L${s} -10 L${s} ${s} L-10 ${s} Z`
    }
    case 'bordure': {
      // Als Ring gezeichnet: äußerer Schildrand minus innerer, verkleinerter Rand
      return `M-10 -10 L${W + 10} -10 L${W + 10} ${H + 10} L-10 ${H + 10} Z`
    }
    case 'orle':
    case 'tressure': {
      return `M-10 -10 L${W + 10} -10 L${W + 10} ${H + 10} L-10 ${H + 10} Z`
    }
    case 'pall': {
      const t = 26
      return `M${-10} ${-10} L${-10 + t} ${-10} L${cx + t / 2} ${cy} L${cx + t / 2} ${H + 10} L${cx - t / 2} ${H + 10} L${cx - t / 2} ${cy} L${W + 10 - t} -10 L${W + 10} -10 L${cx + t / 2} ${cy + 6} Z`
    }
    case 'shakefork':
    case 'pallReversed': {
      const t = 24
      return `M${cx - t / 2} -10 L${cx + t / 2} -10 L${cx + t / 2} ${cy} L${W + 10} ${H + 10} L${W + 10 - t} ${H + 10} L${cx} ${cy + 30} L${-10 + t} ${H + 10} L-10 ${H + 10} L${cx - t / 2} ${cy} Z`
    }
    case 'label': {
      const y = 14
      const h = 18
      const legW = 20
      const legs = [46, 100, 154]
        .map((x) => `M${x - legW / 2} ${y + h} L${x + legW / 2} ${y + h} L${x + legW / 2 + 4} ${y + h + 26} L${x - legW / 2 - 4} ${y + h + 26} Z`)
        .join(' ')
      return `M-10 ${y} L${W + 10} ${y} L${W + 10} ${y + h} L-10 ${y + h} Z ${legs}`
    }
    case 'flaunches': {
      return `M-10 -10 Q${W * 0.34} ${H / 2} -10 ${H + 10} Z M${W + 10} -10 Q${W * 0.66} ${H / 2} ${W + 10} ${H + 10} Z`
    }
    case 'gyron': {
      return `M-10 -10 L${cx} ${cy} L-10 ${cy} Z`
    }
    case 'fret': {
      const t = 12
      const a = 40
      const b = 160
      return [
        `M${a} ${a - t} L${b} ${b - t} L${b} ${b + t} L${a} ${a + t} Z`,
        `M${b} ${a - t} L${a} ${b - t} L${a} ${b + t} L${b} ${a + t} Z`,
        `M${cx - 40} ${cy - 40} L${cx + 40} ${cy - 40} L${cx + 40} ${cy + 40} L${cx - 40} ${cy + 40} Z`,
      ].join(' ')
    }
    case 'inescutcheon': {
      return `M${cx - 38} ${cy - 44} H${cx + 38} V${cy - 8} C${cx + 38} ${cy + 24} ${cx + 20} ${cy + 44} ${cx} ${cy + 56} C${cx - 20} ${cy + 44} ${cx - 38} ${cy + 24} ${cx - 38} ${cy - 8} Z`
    }
    default:
      return ''
  }
}

/** Heroldsbilder, die als Rand gezeichnet werden und eine Innenaussparung brauchen. */
export const RING_ORDINARIES: OrdinaryType[] = ['bordure', 'orle', 'tressure']

/** Verkleinerungsfaktor der Innenaussparung für Rand-Heroldsbilder. */
export function ringInset(type: OrdinaryType): { outer: number; inner: number } {
  switch (type) {
    case 'bordure': return { outer: 1, inner: 0.87 }
    case 'orle': return { outer: 0.87, inner: 0.76 }
    case 'tressure': return { outer: 0.9, inner: 0.84 }
    default: return { outer: 1, inner: 0.9 }
  }
}
