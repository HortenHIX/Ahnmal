/**
 * Wappen-Renderer.
 *
 * Zeichnet ein Wappen als SVG: Schild, Teilung, Heroldsbilder, gemeine Figuren,
 * Herzschild und auf Wunsch das volle Wappen mit Helm, Decke, Helmzier,
 * Schildhaltern und Wahlspruch.
 *
 * Alles ist Vektorgrafik – ein Wappen muss auf dem Briefkopf so gut aussehen
 * wie auf dem Bildschirm.
 */

import { useId } from 'react'
import type {
  Arms, BlazonSpec, Charge, Crest, Division, ShieldShape, Tincture,
} from '../core/types'
import { CHARGE_MAP } from './charges'
import { H, ordinaryPath, RING_ORDINARIES, SHIELD_PATHS, styledLine, W } from './shapes'
import { TINCTURES } from './tinctures'

// ---------------------------------------------------------------------------
// Musterdefinitionen für Pelzwerk
// ---------------------------------------------------------------------------

/** Hermelinschwänzchen – das Erkennungszeichen des Pelzwerks. */
const ERMINE_SPOT =
  'M10 2 C8 6 6 8 6 11 C6 13 8 15 10 15 C12 15 14 13 14 11 C14 8 12 6 10 2 Z ' +
  'M6 16 L4 21 L7 19 L10 22 L13 19 L16 21 L14 16 Z'

function FurPatterns({ prefix }: { prefix: string }) {
  return (
    <>
      {/* Hermelin und seine Abwandlungen */}
      {([
        ['ermine', '#f2f2ee', '#1c1c1c'],
        ['ermines', '#1c1c1c', '#f2f2ee'],
        ['erminois', '#d4af37', '#1c1c1c'],
        ['pean', '#1c1c1c', '#d4af37'],
      ] as const).map(([key, bg, fg]) => (
        <pattern key={key} id={`${prefix}-${key}`} width="40" height="44" patternUnits="userSpaceOnUse">
          <rect width="40" height="44" fill={bg} />
          <g fill={fg}>
            <path d={ERMINE_SPOT} transform="translate(4 2) scale(0.9)" />
            <path d={ERMINE_SPOT} transform="translate(24 24) scale(0.9)" />
          </g>
        </pattern>
      ))}

      {/* Feh: blaue und silberne Glöckchen, wechselnd */}
      <pattern id={`${prefix}-vair`} width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#f2f2ee" />
        <path d="M0 0 H20 V4 C20 14 16 18 10 20 C4 18 0 14 0 4 Z" fill="#20487a" />
        <path d="M20 20 H40 V24 C40 34 36 38 30 40 C24 38 20 34 20 24 Z" fill="#20487a" />
        <path d="M20 0 H40 V4 C40 14 36 18 30 20 C24 18 20 14 20 4 Z" fill="#f2f2ee" stroke="#20487a" strokeWidth="1.2" />
        <path d="M0 20 H20 V24 C20 34 16 38 10 40 C4 38 0 34 0 24 Z" fill="#f2f2ee" stroke="#20487a" strokeWidth="1.2" />
      </pattern>

      <pattern id={`${prefix}-counterVair`} width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#f2f2ee" />
        <path d="M0 0 H20 V4 C20 14 16 18 10 20 C4 18 0 14 0 4 Z" fill="#20487a" />
        <path d="M20 40 H40 V36 C40 26 36 22 30 20 C24 22 20 26 20 36 Z" fill="#20487a" />
      </pattern>

      <pattern id={`${prefix}-vairEnPoint`} width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#f2f2ee" />
        <path d="M0 0 H20 V4 C20 14 16 18 10 20 C4 18 0 14 0 4 Z" fill="#20487a" />
        <path d="M10 20 H30 V24 C30 34 26 38 20 40 C14 38 10 34 10 24 Z" fill="#20487a" />
      </pattern>

      {/* Krückenfeh */}
      <pattern id={`${prefix}-potent`} width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#f2f2ee" />
        <path d="M0 0 H20 V6 H14 V20 H6 V6 H0 Z" fill="#20487a" />
        <path d="M20 20 H40 V26 H34 V40 H26 V26 H20 Z" fill="#20487a" />
      </pattern>
      <pattern id={`${prefix}-counterPotent`} width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#f2f2ee" />
        <path d="M0 0 H20 V6 H14 V20 H6 V6 H0 Z" fill="#20487a" />
        <path d="M20 40 H40 V34 H34 V20 H26 V34 H20 Z" fill="#20487a" />
      </pattern>
    </>
  )
}

/** Schraffur nach Petra Sancta – für einfarbigen Druck und Gravuren. */
function HatchPatterns({ prefix }: { prefix: string }) {
  const line = (d: string) => (
    <path d={d} stroke="#1c1c1c" strokeWidth="1.1" fill="none" />
  )
  return (
    <>
      <pattern id={`${prefix}-h-vertical`} width="7" height="7" patternUnits="userSpaceOnUse">
        {line('M3.5 0 V7')}
      </pattern>
      <pattern id={`${prefix}-h-horizontal`} width="7" height="7" patternUnits="userSpaceOnUse">
        {line('M0 3.5 H7')}
      </pattern>
      <pattern id={`${prefix}-h-diagonal`} width="7" height="7" patternUnits="userSpaceOnUse">
        {line('M0 7 L7 0')}
      </pattern>
      <pattern id={`${prefix}-h-diagonalSinister`} width="7" height="7" patternUnits="userSpaceOnUse">
        {line('M0 0 L7 7')}
      </pattern>
      <pattern id={`${prefix}-h-cross`} width="7" height="7" patternUnits="userSpaceOnUse">
        {line('M3.5 0 V7')}
        {line('M0 3.5 H7')}
      </pattern>
      <pattern id={`${prefix}-h-dots`} width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="1.1" fill="#1c1c1c" />
      </pattern>
    </>
  )
}

// ---------------------------------------------------------------------------

export interface RenderOptions {
  /** Volle Wappendarstellung mit Helm, Decke und Helmzier. */
  full?: boolean
  /** Schwarzweiß mit Schraffur statt Farbe. */
  hatched?: boolean
  /** Plastische Wölbung des Schildes. */
  relief?: boolean
  showMotto?: boolean
  showSupporters?: boolean
}

function fillFor(t: Tincture, prefix: string, hatched: boolean): string {
  const def = TINCTURES[t]
  if (!def) return '#cccccc'
  if (def.class === 'fur') return `url(#${prefix}-${t})`
  if (hatched) {
    if (def.hatch && def.hatch !== 'none' && def.hatch !== 'plain') return `url(#${prefix}-h-${def.hatch})`
    return '#ffffff'
  }
  return def.fill
}

// ---------------------------------------------------------------------------
// Teilungen
// ---------------------------------------------------------------------------

/** Erzeugt die Flächen einer Teilung. */
function divisionShapes(d: Division): { path: string; tincture: Tincture }[] {
  const t = d.tinctures
  const at = (i: number) => t[i % t.length] ?? 'argent'
  const line = d.line ?? 'straight'
  const cx = W / 2
  const cy = H / 2
  const out: { path: string; tincture: Tincture }[] = []

  switch (d.type) {
    case 'perPale':
      out.push({ path: `M${cx} -10 ${styledLine(cx, -10, cx, H + 10, line)} L-10 ${H + 10} L-10 -10 Z`, tincture: at(0) })
      out.push({ path: `M${cx} -10 ${styledLine(cx, -10, cx, H + 10, line)} L${W + 10} ${H + 10} L${W + 10} -10 Z`, tincture: at(1) })
      break
    case 'perFess':
      out.push({ path: `M-10 ${cy} ${styledLine(-10, cy, W + 10, cy, line)} L${W + 10} -10 L-10 -10 Z`, tincture: at(0) })
      out.push({ path: `M-10 ${cy} ${styledLine(-10, cy, W + 10, cy, line)} L${W + 10} ${H + 10} L-10 ${H + 10} Z`, tincture: at(1) })
      break
    case 'perBend':
      out.push({ path: `M-10 -10 ${styledLine(-10, -10, W + 10, H + 10, line)} L${W + 10} -10 Z`, tincture: at(0) })
      out.push({ path: `M-10 -10 ${styledLine(-10, -10, W + 10, H + 10, line)} L-10 ${H + 10} Z`, tincture: at(1) })
      break
    case 'perBendSinister':
      out.push({ path: `M${W + 10} -10 ${styledLine(W + 10, -10, -10, H + 10, line)} L-10 -10 Z`, tincture: at(0) })
      out.push({ path: `M${W + 10} -10 ${styledLine(W + 10, -10, -10, H + 10, line)} L${W + 10} ${H + 10} Z`, tincture: at(1) })
      break
    case 'quarterly':
      out.push({ path: `M-10 -10 H${cx} V${cy} H-10 Z`, tincture: at(0) })
      out.push({ path: `M${cx} -10 H${W + 10} V${cy} H${cx} Z`, tincture: at(1) })
      out.push({ path: `M-10 ${cy} H${cx} V${H + 10} H-10 Z`, tincture: at(1) })
      out.push({ path: `M${cx} ${cy} H${W + 10} V${H + 10} H${cx} Z`, tincture: at(0) })
      break
    case 'perSaltire':
      out.push({ path: `M-10 -10 L${cx} ${cy} L${W + 10} -10 Z`, tincture: at(0) })
      out.push({ path: `M${W + 10} -10 L${cx} ${cy} L${W + 10} ${H + 10} Z`, tincture: at(1) })
      out.push({ path: `M${W + 10} ${H + 10} L${cx} ${cy} L-10 ${H + 10} Z`, tincture: at(0) })
      out.push({ path: `M-10 ${H + 10} L${cx} ${cy} L-10 -10 Z`, tincture: at(1) })
      break
    case 'perChevron':
      out.push({ path: `M-10 -10 H${W + 10} V${cy + 10} L${cx} ${cy - 34} L-10 ${cy + 10} Z`, tincture: at(0) })
      out.push({ path: `M-10 ${cy + 10} L${cx} ${cy - 34} L${W + 10} ${cy + 10} V${H + 10} H-10 Z`, tincture: at(1) })
      break
    case 'tiercedPerPale': {
      const a = W / 3
      out.push({ path: `M-10 -10 H${a} V${H + 10} H-10 Z`, tincture: at(0) })
      out.push({ path: `M${a} -10 H${2 * a} V${H + 10} H${a} Z`, tincture: at(1) })
      out.push({ path: `M${2 * a} -10 H${W + 10} V${H + 10} H${2 * a} Z`, tincture: at(2) })
      break
    }
    case 'tiercedPerFess': {
      const a = H / 3
      out.push({ path: `M-10 -10 H${W + 10} V${a} H-10 Z`, tincture: at(0) })
      out.push({ path: `M-10 ${a} H${W + 10} V${2 * a} H-10 Z`, tincture: at(1) })
      out.push({ path: `M-10 ${2 * a} H${W + 10} V${H + 10} H-10 Z`, tincture: at(2) })
      break
    }
    case 'gyronny': {
      const pts: [number, number][] = [
        [-10, -10], [cx, -10], [W + 10, -10], [W + 10, cy],
        [W + 10, H + 10], [cx, H + 10], [-10, H + 10], [-10, cy],
      ]
      for (let i = 0; i < 8; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % 8]
        out.push({ path: `M${cx} ${cy} L${a[0]} ${a[1]} L${b[0]} ${b[1]} Z`, tincture: at(i) })
      }
      break
    }
    case 'barry': {
      const n = d.count ?? 6
      const step = (H + 20) / n
      for (let i = 0; i < n; i++) {
        out.push({ path: `M-10 ${-10 + i * step} H${W + 10} V${-10 + (i + 1) * step} H-10 Z`, tincture: at(i) })
      }
      break
    }
    case 'paly': {
      const n = d.count ?? 6
      const step = (W + 20) / n
      for (let i = 0; i < n; i++) {
        out.push({ path: `M${-10 + i * step} -10 V${H + 10} H${-10 + (i + 1) * step} V-10 Z`, tincture: at(i) })
      }
      break
    }
    case 'bendy':
    case 'bendySinister': {
      const n = d.count ?? 6
      const step = (W + H) / n
      const sinister = d.type === 'bendySinister'
      for (let i = 0; i < n; i++) {
        const o = -H + i * step
        const p = sinister
          ? `M${W + 10 - o} -10 L${W + 10 - o - step} -10 L${-10 - o - step + H} ${H + 10} L${-10 - o + H} ${H + 10} Z`
          : `M${o} -10 L${o + step} -10 L${o + step + H} ${H + 10} L${o + H} ${H + 10} Z`
        out.push({ path: p, tincture: at(i) })
      }
      break
    }
    case 'checky': {
      const n = d.count ?? 6
      const sx = (W + 20) / n
      const sy = sx
      const rows = Math.ceil((H + 20) / sy)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < n; c++) {
          out.push({
            path: `M${-10 + c * sx} ${-10 + r * sy} h${sx} v${sy} h${-sx} Z`,
            tincture: at((r + c) % 2),
          })
        }
      }
      break
    }
    case 'lozengy':
    case 'fusilly': {
      const n = d.count ?? 5
      const sx = (W + 20) / n
      const sy = d.type === 'fusilly' ? sx * 1.8 : sx * 1.25
      const rows = Math.ceil((H + 20) / sy) + 1
      out.push({ path: `M-10 -10 H${W + 10} V${H + 10} H-10 Z`, tincture: at(0) })
      for (let r = -1; r < rows; r++) {
        for (let c = -1; c < n + 1; c++) {
          const ox = -10 + c * sx + (r % 2 ? sx / 2 : 0)
          const oy = -10 + r * sy
          out.push({
            path: `M${ox + sx / 2} ${oy} L${ox + sx} ${oy + sy / 2} L${ox + sx / 2} ${oy + sy} L${ox} ${oy + sy / 2} Z`,
            tincture: at(1),
          })
        }
      }
      break
    }
    case 'chevronny': {
      const n = d.count ?? 5
      const step = (H + 40) / n
      for (let i = 0; i < n; i++) {
        const base = -20 + i * step + step
        out.push({
          path: `M-10 ${base} L${cx} ${base - 56} L${W + 10} ${base} V${base + step} L${cx} ${base - 56 + step} L-10 ${base + step} Z`,
          tincture: at(i),
        })
      }
      break
    }
    default:
      out.push({ path: `M-10 -10 H${W + 10} V${H + 10} H-10 Z`, tincture: at(0) })
  }
  return out
}

// ---------------------------------------------------------------------------
// Figurenanordnung
// ---------------------------------------------------------------------------

interface Slot { x: number; y: number; s: number }

/**
 * Standardanordnung mehrerer gleicher Figuren. Die überlieferten Muster
 * (2 über 1, 2-2, 3-2-1) sind nicht Geschmackssache, sondern Konvention:
 * „drei Löwen“ heißt in der Heraldik immer 2 über 1.
 */
function arrangeCharges(count: number, area: { x: number; y: number; w: number; h: number }): Slot[] {
  const { x, y, w, h } = area
  const grid = (rows: number[]): Slot[] => {
    const out: Slot[] = []
    const rowCount = rows.length
    const size = Math.min(w / Math.max(...rows), h / rowCount) * 0.92
    rows.forEach((n, r) => {
      const cy = y + (h / rowCount) * (r + 0.5)
      for (let i = 0; i < n; i++) {
        const cx = x + (w / n) * (i + 0.5)
        out.push({ x: cx, y: cy, s: size })
      }
    })
    return out
  }

  switch (count) {
    case 1: return [{ x: x + w / 2, y: y + h / 2, s: Math.min(w, h) * 0.96 }]
    case 2: return grid([2])
    case 3: return grid([2, 1])
    case 4: return grid([2, 2])
    case 5: {
      // Schrägkreuzstellung
      const s = Math.min(w, h) * 0.34
      return [
        { x: x + w * 0.25, y: y + h * 0.2, s },
        { x: x + w * 0.75, y: y + h * 0.2, s },
        { x: x + w * 0.5, y: y + h * 0.5, s },
        { x: x + w * 0.25, y: y + h * 0.8, s },
        { x: x + w * 0.75, y: y + h * 0.8, s },
      ]
    }
    case 6: return grid([3, 2, 1])
    case 7: return grid([3, 3, 1])
    case 8: return grid([3, 3, 2])
    case 9: return grid([3, 3, 3])
    default: {
      const cols = Math.ceil(Math.sqrt(count))
      const rows: number[] = []
      let left = count
      while (left > 0) { rows.push(Math.min(cols, left)); left -= cols }
      return grid(rows)
    }
  }
}

/** Bereich, in dem Figuren sitzen dürfen – abhängig von den Heroldsbildern. */
function chargeArea(spec: BlazonSpec): { x: number; y: number; w: number; h: number } {
  const has = (t: string) => spec.ordinaries.some((o) => o.type === t)
  let x = 26, y = 26, w = W - 52, h = 150
  if (has('chief')) { y += 40; h -= 40 }
  if (has('bordure')) { x += 12; y += 12; w -= 24; h -= 18 }
  if (has('fess')) { h = 150 }
  return { x, y, w, h }
}

/**
 * Farbe der Binnenzeichnung. Auf dunklen Tinkturen wird hell gezeichnet, auf
 * hellen dunkel – sonst verschwindet die Gliederung, und ein schwarzer Adler
 * wird zum schwarzen Fleck.
 */
const DARK_TINCTURES: Tincture[] = [
  'sable', 'azure', 'gules', 'vert', 'purpure', 'murrey', 'sanguine', 'ermines', 'pean',
]

function inkFor(t: Tincture, hatched: boolean): string {
  if (hatched) return '#1c1c1c'
  return DARK_TINCTURES.includes(t) ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.55)'
}

function ChargeGlyph({
  charge, slot, prefix, hatched,
}: { charge: Charge; slot: Slot; prefix: string; hatched: boolean }) {
  const def = CHARGE_MAP[charge.key]
  if (!def) return null
  const scale = (slot.s / 100) * (charge.scale ?? 1)
  const flip = charge.attitudes?.includes('contourne')
  const inverted = charge.attitudes?.includes('inverted')
  const main = fillFor(charge.tincture, prefix, hatched)
  const armed = charge.armedTincture ? fillFor(charge.armedTincture, prefix, hatched) : main
  const ink = inkFor(charge.tincture, hatched)

  const transforms = [
    `translate(${slot.x + (charge.dx ?? 0)} ${slot.y + (charge.dy ?? 0)})`,
    `scale(${flip ? -scale : scale} ${inverted ? -scale : scale})`,
    'translate(-50 -50)',
  ].join(' ')

  return (
    <g transform={transforms}>
      {def.paths.map((p, i) => {
        if (p.role === 'line') {
          return (
            <path
              key={i}
              d={p.d}
              fill="none"
              stroke={p.fixed ?? ink}
              strokeWidth={p.width ?? 1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        }
        if (p.role === 'detail') {
          return <path key={i} d={p.d} fill={p.fixed ?? ink} fillRule="evenodd" />
        }
        return (
          <path
            key={i}
            d={p.d}
            fill={p.fixed ?? (p.role === 'armed' ? armed : main)}
            fillRule="evenodd"
            stroke={ink}
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
        )
      })}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Schildinhalt
// ---------------------------------------------------------------------------

function ShieldContent({
  spec, prefix, hatched,
}: { spec: BlazonSpec; prefix: string; hatched: boolean }) {
  const area = chargeArea(spec)

  return (
    <>
      {/* Feld */}
      {spec.division && spec.division.type !== 'none' ? (
        divisionShapes(spec.division).map((s, i) => (
          <path key={`d${i}`} d={s.path} fill={fillFor(s.tincture, prefix, hatched)} />
        ))
      ) : (
        <rect x={-10} y={-10} width={W + 20} height={H + 20} fill={fillFor(spec.field, prefix, hatched)} />
      )}

      {/* Heroldsbilder */}
      {spec.ordinaries.map((o, i) => {
        if (RING_ORDINARIES.includes(o.type)) {
          return (
            <path
              key={`o${i}`}
              d={SHIELD_PATHS.heater}
              fill="none"
              stroke={fillFor(o.tincture, prefix, hatched)}
              strokeWidth={o.type === 'bordure' ? 18 : o.type === 'orle' ? 9 : 6}
              strokeLinejoin="round"
              transform={o.type === 'bordure' ? undefined : 'translate(100 110) scale(0.86) translate(-100 -110)'}
            />
          )
        }
        const count = o.count ?? 1
        return Array.from({ length: count }, (_, k) => (
          <path
            key={`o${i}-${k}`}
            d={ordinaryPath(o.type, o.line, k, count)}
            fill={fillFor(o.tincture, prefix, hatched)}
            fillRule="evenodd"
            stroke={o.fimbriation ? fillFor(o.fimbriation, prefix, hatched) : 'none'}
            strokeWidth={o.fimbriation ? 3 : 0}
          />
        ))
      })}

      {/* Gemeine Figuren */}
      {spec.charges.map((c, i) => {
        // Am Schildfuß aufsitzende Figuren wie der Dreiberg füllen die Breite
        const anchored = CHARGE_MAP[c.key]?.anchor === 'base'
        // „oben“ und „unten“ verweisen die Figur in das obere oder untere Feld
        const field = c.position === 'chief'
          ? { ...area, h: area.h / 2 }
          : c.position === 'base'
            ? { ...area, y: area.y + area.h / 2, h: area.h / 2 }
            : area

        const issuant = c.attitudes?.includes('issuant')
        const cutLine = field.y + field.h

        const slots = anchored
          ? [{ x: W / 2, y: 105, s: 200 }]
          // Eine wachsende Figur sitzt auf der Schnittlinie; alles darunter
          // wird abgeschnitten, sodass nur die obere Hälfte erscheint
          : issuant
            ? arrangeCharges(c.count, field).map((s) => ({ ...s, y: cutLine, s: s.s * 1.35 }))
            : arrangeCharges(c.count, field)

        const glyphs = slots.map((s, k) => (
          <ChargeGlyph key={`c${i}-${k}`} charge={c} slot={s} prefix={prefix} hatched={hatched} />
        ))

        if (!issuant) return glyphs
        return (
          <g key={`iss${i}`}>
            <clipPath id={`${prefix}-iss${i}`}>
              <rect x={-20} y={-20} width={W + 40} height={cutLine + 20} />
            </clipPath>
            <g clipPath={`url(#${prefix}-iss${i})`}>{glyphs}</g>
          </g>
        )
      })}

      {/* Herzschild */}
      {spec.inescutcheon && (
        <g>
          <clipPath id={`${prefix}-inesc`}>
            <path d={ordinaryPath('inescutcheon')} />
          </clipPath>
          <g clipPath={`url(#${prefix}-inesc)`}>
            <ShieldContent spec={spec.inescutcheon} prefix={`${prefix}i`} hatched={hatched} />
          </g>
          <path d={ordinaryPath('inescutcheon')} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={2.5} />
        </g>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Helm, Decke, Helmzier
// ---------------------------------------------------------------------------

const CORONETS: Record<string, string> = {
  baron: 'M-40 0 L-40 -12 L-24 -4 L-8 -16 L8 -16 L24 -4 L40 -12 L40 0 Z',
  count: 'M-46 0 L-46 -10 L-30 -20 L-14 -10 L0 -22 L14 -10 L30 -20 L46 -10 L46 0 Z',
  duke: 'M-48 0 L-48 -8 L-32 -26 L-16 -8 L0 -28 L16 -8 L32 -26 L48 -8 L48 0 Z',
  prince: 'M-50 0 L-50 -6 L-34 -30 L-17 -8 L0 -34 L17 -8 L34 -30 L50 -6 L50 0 Z',
  royal: 'M-52 0 L-52 -6 L-36 -34 L-18 -10 L0 -40 L18 -10 L36 -34 L52 -6 L52 0 Z',
  mural: 'M-44 0 L-44 -20 L-34 -20 L-34 -28 L-20 -28 L-20 -20 L-8 -20 L-8 -28 L8 -28 L8 -20 L20 -20 L20 -28 L34 -28 L34 -20 L44 -20 L44 0 Z',
  naval: 'M-44 0 L-44 -10 L-28 -10 L-28 -24 L-14 -10 L0 -26 L14 -10 L28 -24 L28 -10 L44 -10 L44 0 Z',
}

export const CORONET_LABELS: Record<string, string> = {
  none: 'keine', baron: 'Freiherrnkrone', count: 'Grafenkrone', duke: 'Herzogskrone',
  prince: 'Fürstenhut', royal: 'Königskrone', mural: 'Mauerkrone', naval: 'Schiffskrone',
}

export const HELM_LABELS: Record<string, string> = {
  none: 'kein Helm', tilting: 'Stechhelm', barred: 'Spangenhelm',
  pot: 'Topfhelm', sallet: 'Schaller',
}

function Helm({ crest, prefix, hatched }: { crest: Crest; prefix: string; hatched: boolean }) {
  const type = crest.helmType ?? 'tilting'
  if (type === 'none') return null
  const steel = hatched ? '#ffffff' : '#b8bcc2'
  const steelDark = hatched ? '#ffffff' : '#7d838c'
  const stroke = '#3a3d42'

  if (type === 'barred') {
    // Spangenhelm, von vorn – dem Adel vorbehalten gewesen
    return (
      <g>
        <path d="M-38 6 C-38 -26 -20 -44 0 -44 C20 -44 38 -26 38 6 L38 18 L-38 18 Z" fill={steel} stroke={stroke} strokeWidth={2} />
        <path d="M-30 -6 H30 M-32 4 H32 M-30 14 H30" stroke={steelDark} strokeWidth={4} strokeLinecap="round" />
        <path d="M-42 18 C-42 30 -20 38 0 38 C20 38 42 30 42 18 Z" fill={steelDark} stroke={stroke} strokeWidth={2} />
      </g>
    )
  }
  if (type === 'pot') {
    return (
      <g>
        <path d="M-32 -40 H32 V22 C32 34 18 40 0 40 C-18 40 -32 34 -32 22 Z" fill={steel} stroke={stroke} strokeWidth={2} />
        <path d="M-32 -12 H32 V-4 H-32 Z" fill={stroke} />
        <path d="M-4 -40 H4 V22 H-4 Z" fill={steelDark} />
      </g>
    )
  }
  // Stechhelm im Profil – der bürgerliche Helm
  return (
    <g>
      <path d="M-36 10 C-36 -22 -18 -40 6 -40 C26 -40 40 -26 40 -6 L40 16 C40 30 22 38 2 38 C-20 38 -36 28 -36 10 Z" fill={steel} stroke={stroke} strokeWidth={2} />
      <path d="M-34 0 C-20 -6 6 -8 26 -4 L26 6 C6 2 -20 4 -34 10 Z" fill={stroke} opacity={0.85} />
      <path d="M-30 20 C-14 26 14 26 32 20" stroke={steelDark} strokeWidth={3} fill="none" />
      {crest.coronet && crest.coronet !== 'none' && (
        <path
          d={CORONETS[crest.coronet]}
          transform="translate(0 -40)"
          fill={fillFor('or', prefix, hatched)}
          stroke="rgba(0,0,0,0.5)"
          strokeWidth={1.5}
        />
      )}
      {!crest.coronet || crest.coronet === 'none' ? (
        crest.torse ? (
          <g transform="translate(0 -42)">
            {Array.from({ length: 6 }, (_, i) => (
              <ellipse
                key={i}
                cx={-33 + i * 13}
                cy={0}
                rx={7}
                ry={6}
                fill={fillFor(crest.torse![i % 2], prefix, hatched)}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={1}
              />
            ))}
          </g>
        ) : null
      ) : null}
    </g>
  )
}

function Mantling({ crest, prefix, hatched }: { crest: Crest; prefix: string; hatched: boolean }) {
  const outer = fillFor(crest.mantlingOuter ?? 'gules', prefix, hatched)
  const inner = fillFor(crest.mantlingInner ?? 'argent', prefix, hatched)
  // Die Helmdecke bildet den zerschlissenen Umhang nach, den der Helm im
  // Turnier trug – außen in der Hauptfarbe, innen im Metall des Wappens.
  const leaf = (dir: 1 | -1) => `
    M0 -30
    C${28 * dir} -40 ${52 * dir} -20 ${46 * dir} 4
    C${60 * dir} 0 ${72 * dir} 16 ${62 * dir} 32
    C${76 * dir} 34 ${80 * dir} 54 ${66 * dir} 66
    C${78 * dir} 74 ${74 * dir} 96 ${56 * dir} 102
    C${62 * dir} 114 ${48 * dir} 128 ${32 * dir} 124
    C${34 * dir} 106 ${26 * dir} 92 ${18 * dir} 84
    C${28 * dir} 78 ${34 * dir} 64 ${28 * dir} 52
    C${22 * dir} 40 ${10 * dir} 32 ${2 * dir} 26
    Z`
  return (
    <g>
      <path d={leaf(-1)} fill={outer} stroke="rgba(0,0,0,0.4)" strokeWidth={1.6} />
      <path d={leaf(1)} fill={inner} stroke="rgba(0,0,0,0.4)" strokeWidth={1.6} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Hauptkomponente
// ---------------------------------------------------------------------------

export interface CoatOfArmsProps extends RenderOptions {
  arms: Pick<Arms, 'spec' | 'shape'> & Partial<Pick<Arms, 'crest' | 'motto' | 'supporters' | 'mottoPosition'>>
  size?: number
  className?: string
  title?: string
}

export function CoatOfArms({
  arms, size = 220, full = false, hatched = false, relief = true,
  showMotto = true, showSupporters = true, className, title,
}: CoatOfArmsProps) {
  const rid = useId().replace(/:/g, '')
  const prefix = `wb${rid}`
  const shape: ShieldShape = arms.shape ?? 'heater'

  const hasCrest = full && arms.crest && (arms.crest.helmType ?? 'tilting') !== 'none'
  const hasMotto = full && showMotto && !!arms.motto
  const hasSupporters = full && showSupporters && (arms.supporters?.length ?? 0) > 0

  // Der Rahmen wächst nach oben für Helm und Zier, nach unten für den Spruch.
  // Mit Helmzier braucht es zusätzlichen Raum, sonst wird sie oben beschnitten.
  const padTop = hasCrest ? (arms.crest?.key ? 250 : 190) : 8
  const padBottom = hasMotto ? 58 : 8
  const padX = hasSupporters ? 90 : hasCrest ? 60 : 8
  const vbW = W + padX * 2
  const vbH = H + padTop + padBottom
  const height = (size / vbW) * vbH

  return (
    <svg
      width={size}
      height={height}
      viewBox={`${-padX} ${-padTop} ${vbW} ${vbH}`}
      className={className}
      role="img"
      aria-label={title ?? 'Wappen'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <FurPatterns prefix={prefix} />
        <HatchPatterns prefix={prefix} />
        <clipPath id={`${prefix}-shield`}>
          <path d={SHIELD_PATHS[shape]} />
        </clipPath>
        {relief && !hatched && (
          <>
            <radialGradient id={`${prefix}-relief`} cx="34%" cy="24%" r="78%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
              <stop offset="52%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.30" />
            </radialGradient>
            <filter id={`${prefix}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.3" />
            </filter>
          </>
        )}
      </defs>

      {title && <title>{title}</title>}

      {/* Helmdecke und Helm hinter dem Schild */}
      {hasCrest && arms.crest && (
        <g transform="translate(100 -66)">
          <Mantling crest={arms.crest} prefix={prefix} hatched={hatched} />
          <Helm crest={arms.crest} prefix={prefix} hatched={hatched} />
          {arms.crest.key && CHARGE_MAP[arms.crest.key] && (
            <g transform="translate(0 -108)">
              <ChargeGlyph
                charge={{
                  key: arms.crest.key,
                  tincture: arms.crest.tincture ?? 'or',
                  count: 1,
                }}
                slot={{ x: 0, y: 0, s: 96 }}
                prefix={prefix}
                hatched={hatched}
              />
            </g>
          )}
        </g>
      )}

      {/* Schildhalter */}
      {hasSupporters && arms.supporters?.map((s, i) => {
        const left = i === 0
        return (
          <g key={i} transform={`translate(${left ? -46 : W + 46} 116) scale(${left ? 1.5 : -1.5} 1.5)`}>
            <ChargeGlyph
              charge={{ key: s.key, tincture: s.tincture, count: 1 }}
              slot={{ x: 0, y: 0, s: 100 }}
              prefix={prefix}
              hatched={hatched}
            />
          </g>
        )
      })}

      {/* Schild */}
      <g filter={relief && !hatched ? `url(#${prefix}-shadow)` : undefined}>
        <g clipPath={`url(#${prefix}-shield)`}>
          <ShieldContent spec={arms.spec} prefix={prefix} hatched={hatched} />
          {relief && !hatched && (
            <path d={SHIELD_PATHS[shape]} fill={`url(#${prefix}-relief)`} style={{ mixBlendMode: 'multiply' }} />
          )}
        </g>
        <path
          d={SHIELD_PATHS[shape]}
          fill="none"
          stroke={hatched ? '#1c1c1c' : '#20232a'}
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
      </g>

      {/* Wahlspruch auf einem Spruchband */}
      {hasMotto && (
        <g transform={`translate(100 ${H + 34})`}>
          <path
            d="M-118 -14 C-92 -24 -40 -28 0 -28 C40 -28 92 -24 118 -14 L118 10 C92 0 40 -4 0 -4 C-40 -4 -92 0 -118 10 Z"
            fill={hatched ? '#ffffff' : '#efe6d2'}
            stroke="#7a6a4a"
            strokeWidth={1.6}
          />
          <text
            x={0}
            y={-9}
            textAnchor="middle"
            fontSize={16}
            fontFamily="'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif"
            fontStyle="italic"
            fill="#3c3223"
          >
            {arms.motto}
          </text>
        </g>
      )}
    </svg>
  )
}

/** Erzeugt eigenständiges SVG zum Herunterladen. */
export function armsToSVGString(arms: Arms, size = 480, full = false): string {
  // Der Renderer läuft im Browser; für den Export wird die gezeichnete Grafik
  // aus dem Dokument geholt und um den XML-Kopf ergänzt.
  const holder = document.createElement('div')
  holder.style.position = 'absolute'
  holder.style.left = '-99999px'
  document.body.appendChild(holder)
  try {
    const svg = document.querySelector<SVGSVGElement>(`svg[data-arms="${arms.id}"]`)
    if (svg) {
      const clone = svg.cloneNode(true) as SVGSVGElement
      clone.setAttribute('width', String(size))
      clone.removeAttribute('data-arms')
      return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`
    }
    void full
    return ''
  } finally {
    holder.remove()
  }
}
