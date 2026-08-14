/**
 * Genealogische Datumsverarbeitung.
 *
 * Historische Daten sind selten exakt und selten gregorianisch. Dieses Modul
 * liest deutsche und englische Schreibweisen sowie GEDCOM-Datumszeilen, rechnet
 * zwischen Julianischem und Gregorianischem Kalender um und liefert für
 * Sortierung und Plausibilitätsprüfungen eine belastbare Zahl.
 */

import type { Calendar, DateModifier, DatePoint, GDate } from './types'

export const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

const MONTH_LOOKUP: Record<string, number> = {}
{
  const de = ['jan', 'feb', 'mär', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez']
  const deIdx = [1, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  de.forEach((m, i) => (MONTH_LOOKUP[m] = deIdx[i]))
  const en = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  en.forEach((m, i) => (MONTH_LOOKUP[m] = MONTH_LOOKUP[m] ?? i + 1))
  MONTH_LOOKUP['may'] = 5
  MONTH_LOOKUP['oct'] = 10
  MONTH_LOOKUP['dec'] = 12
  MONTH_LOOKUP['sept'] = 9
  // Lateinische Formen, wie sie in Kirchenbüchern stehen
  const la: Record<string, number> = {
    ianuarii: 1, januarii: 1, februarii: 2, martii: 3, aprilis: 4, maii: 5,
    iunii: 6, junii: 6, iulii: 7, julii: 7, augusti: 8, septembris: 9,
    octobris: 10, novembris: 11, decembris: 12,
    '7bris': 9, '8bris': 10, '9bris': 11, '10bris': 12, 'xbris': 12,
  }
  Object.assign(MONTH_LOOKUP, la)
}

const CAL_PREFIX: Record<string, Calendar> = {
  '@#DGREGORIAN@': 'gregorian',
  '@#DJULIAN@': 'julian',
  '@#DHEBREW@': 'hebrew',
  '@#DFRENCH R@': 'french',
  '@#DUNKNOWN@': 'unknown',
}

// ---------------------------------------------------------------------------
// Parsen
// ---------------------------------------------------------------------------

/**
 * Liest eine Datumsangabe. Akzeptiert GEDCOM-Syntax („ABT 1723“, „BET 1720 AND
 * 1723“) ebenso wie deutsche Eingaben („um 1723“, „14.08.1723“, „vor 1800“).
 * Gibt `null` zurück, wenn nichts Verwertbares erkennbar ist.
 */
export function parseDate(input: string | undefined | null): GDate | null {
  if (!input) return null
  let s = String(input).trim()
  if (!s) return null

  // Klammerausdruck: reiner Text, GEDCOM-konform als Phrase behandelt
  if (s.startsWith('(') && s.endsWith(')')) {
    return { modifier: 'phrase', phrase: s.slice(1, -1) }
  }

  let calendar: Calendar | undefined
  const calMatch = s.match(/^(@#D[^@]*@)\s*/i)
  if (calMatch) {
    calendar = CAL_PREFIX[calMatch[1].toUpperCase()] ?? 'unknown'
    s = s.slice(calMatch[0].length)
  }

  const norm = s.toLowerCase()

  const twoPart = (
    re: RegExp,
    modifier: DateModifier,
  ): GDate | null => {
    const m = norm.match(re)
    if (!m) return null
    const a = parsePoint(m[1], calendar)
    const b = parsePoint(m[2], calendar)
    if (!a && !b) return null
    return { modifier, from: a ?? undefined, to: b ?? undefined }
  }

  return (
    twoPart(/^(?:bet|between|zwischen)\s+(.+?)\s+(?:and|und|-)\s+(.+)$/, 'between') ??
    twoPart(/^(?:from|von|vom)\s+(.+?)\s+(?:to|bis)\s+(.+)$/, 'range') ??
    onePart(norm, calendar)
  )
}

function onePart(norm: string, calendar?: Calendar): GDate | null {
  const prefixes: [RegExp, DateModifier][] = [
    [/^(?:abt|about|ca\.?|circa|um|gegen)\s+/, 'about'],
    [/^(?:cal|calculated|errechnet|berechnet)\s+/, 'calculated'],
    [/^(?:est|estimated|geschätzt|schätzung)\s+/, 'estimated'],
    [/^(?:bef|before|vor)\s+/, 'before'],
    [/^(?:aft|after|nach)\s+/, 'after'],
    [/^(?:int|interpreted|gedeutet)\s+/, 'interpreted'],
    [/^(?:from|von|vom|seit)\s+/, 'range'],
    [/^(?:to|bis)\s+/, 'range'],
  ]

  let modifier: DateModifier = 'exact'
  let rest = norm
  let openEndedTo = false
  for (const [re, mod] of prefixes) {
    const m = rest.match(re)
    if (m) {
      modifier = mod
      openEndedTo = /^(?:to|bis)\s+/.test(m[0])
      rest = rest.slice(m[0].length).trim()
      break
    }
  }

  const point = parsePoint(rest, calendar)
  if (!point) {
    return rest ? { modifier: 'phrase', phrase: rest } : null
  }
  if (modifier === 'range' && openEndedTo) return { modifier, to: point }
  return { modifier, from: point }
}

/** Liest einen einzelnen Datumspunkt: „14 AUG 1723“, „14.08.1723“, „1723“. */
export function parsePoint(input: string, calendar?: Calendar): DatePoint | null {
  const s = input.trim().toLowerCase().replace(/\.$/, '')
  if (!s) return null

  // Doppeljahr der Zeit vor der Kalenderreform: 1712/13
  const dual = s.match(/^(.*?)(\d{3,4})\s*\/\s*(\d{1,4})$/)
  let dualYear: number | undefined
  let work = s
  if (dual) {
    const base = parseInt(dual[2], 10)
    const suffix = dual[3]
    // 1712/13 → zweites Jahr 1713; 1712/1713 ebenso
    dualYear = suffix.length >= 3 ? parseInt(suffix, 10) : Math.floor(base / 100) * 100 + parseInt(suffix, 10)
    work = `${dual[1]}${base}`.trim()
  }

  // 14.08.1723 oder 14/8/1723
  let m = work.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{3,4})$/)
  if (m) {
    return build(+m[3], +m[2], +m[1], calendar, dualYear)
  }

  // 1723-08-14 (ISO)
  m = work.match(/^(\d{3,4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return build(+m[1], +m[2], +m[3], calendar, dualYear)

  // 08.1723
  m = work.match(/^(\d{1,2})[.\/](\d{3,4})$/)
  if (m) return build(+m[2], +m[1], undefined, calendar, dualYear)

  // 14 AUG 1723 / 14. August 1723
  m = work.match(/^(\d{1,2})\.?\s+([a-zäöü0-9]+)\.?\s+(\d{3,4})$/)
  if (m) {
    const mo = lookupMonth(m[2])
    if (mo) return build(+m[3], mo, +m[1], calendar, dualYear)
  }

  // AUG 1723
  m = work.match(/^([a-zäöü0-9]+)\.?\s+(\d{3,4})$/)
  if (m) {
    const mo = lookupMonth(m[1])
    if (mo) return build(+m[2], mo, undefined, calendar, dualYear)
  }

  // 1723
  m = work.match(/^(\d{3,4})$/)
  if (m) return build(+m[1], undefined, undefined, calendar, dualYear)

  return null
}

function lookupMonth(token: string): number | undefined {
  const t = token.replace(/\.$/, '')
  if (MONTH_LOOKUP[t]) return MONTH_LOOKUP[t]
  const short = t.slice(0, 3)
  return MONTH_LOOKUP[short]
}

function build(
  year: number,
  month: number | undefined,
  day: number | undefined,
  calendar: Calendar | undefined,
  dualYear: number | undefined,
): DatePoint | null {
  if (!Number.isFinite(year)) return null
  if (month !== undefined && (month < 1 || month > 12)) return null
  if (day !== undefined && (day < 1 || day > 31)) return null
  const p: DatePoint = { year }
  if (month !== undefined) p.month = month
  if (day !== undefined) p.day = day
  if (calendar && calendar !== 'gregorian') p.calendar = calendar
  if (dualYear !== undefined) p.dualYear = dualYear
  return p
}

// ---------------------------------------------------------------------------
// Formatieren
// ---------------------------------------------------------------------------

export function formatPoint(p: DatePoint | undefined, long = false): string {
  if (!p) return ''
  const y = p.dualYear ? `${p.year}/${String(p.dualYear).slice(-2)}` : String(p.year)
  if (p.month === undefined) return y
  if (p.day === undefined) {
    return long ? `${MONTH_NAMES_DE[p.month - 1]} ${y}` : `${pad(p.month)}.${y}`
  }
  return long
    ? `${p.day}. ${MONTH_NAMES_DE[p.month - 1]} ${y}`
    : `${pad(p.day)}.${pad(p.month)}.${y}`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Deutsche Anzeige einer Datumsangabe inklusive Qualifizierer. */
export function formatDate(d: GDate | undefined | null, long = false): string {
  if (!d) return ''
  const a = formatPoint(d.from, long)
  const b = formatPoint(d.to, long)
  const jul = d.from?.calendar === 'julian' ? ' jul.' : ''
  switch (d.modifier) {
    case 'exact': return a + jul
    case 'about': return `um ${a}${jul}`
    case 'calculated': return `errechnet ${a}`
    case 'estimated': return `geschätzt ${a}`
    case 'before': return `vor ${a}`
    case 'after': return `nach ${a}`
    case 'between': return `zwischen ${a} und ${b}`
    case 'range':
      if (a && b) return `von ${a} bis ${b}`
      return a ? `seit ${a}` : `bis ${b}`
    case 'interpreted': return `gedeutet ${a}${d.phrase ? ` (${d.phrase})` : ''}`
    case 'phrase': return d.phrase ?? ''
    default: return a
  }
}

/**
 * Datumsangabe mit passender Präposition für den Fließtext.
 *
 * „am 14.02.1758“, aber „um 1730“ und „vor 1750“: Die Präposition „am“ passt
 * nur zu einem taggenauen Datum. Ohne diese Unterscheidung entsteht in
 * Berichten der Unsinn „am um 1730“.
 */
export function formatDateWithPreposition(d: GDate | undefined | null, long = false): string {
  if (!d) return ''
  const text = formatDate(d, long)
  if (!text) return ''
  if (d.modifier !== 'exact') return text
  // Ohne Tagesangabe heißt es „im August 1723“ beziehungsweise „im Jahr 1723“
  if (d.from?.day === undefined) return d.from?.month === undefined ? `${text}` : `im ${text}`
  return `am ${text}`
}

/** Serialisiert nach GEDCOM. */
export function dateToGedcom(d: GDate | undefined | null): string {
  if (!d) return ''
  const cal = (p?: DatePoint) =>
    p?.calendar === 'julian' ? '@#DJULIAN@ ' : p?.calendar === 'hebrew' ? '@#DHEBREW@ ' : ''
  const pt = (p?: DatePoint) => {
    if (!p) return ''
    const parts: string[] = []
    if (p.day !== undefined) parts.push(String(p.day))
    if (p.month !== undefined) parts.push(['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][p.month - 1])
    parts.push(p.dualYear ? `${p.year}/${String(p.dualYear).slice(-2)}` : String(p.year))
    return cal(p) + parts.join(' ')
  }
  switch (d.modifier) {
    case 'exact': return pt(d.from)
    case 'about': return `ABT ${pt(d.from)}`
    case 'calculated': return `CAL ${pt(d.from)}`
    case 'estimated': return `EST ${pt(d.from)}`
    case 'before': return `BEF ${pt(d.from)}`
    case 'after': return `AFT ${pt(d.from)}`
    case 'between': return `BET ${pt(d.from)} AND ${pt(d.to)}`
    case 'range':
      if (d.from && d.to) return `FROM ${pt(d.from)} TO ${pt(d.to)}`
      return d.from ? `FROM ${pt(d.from)}` : `TO ${pt(d.to)}`
    case 'interpreted': return `INT ${pt(d.from)} (${d.phrase ?? ''})`
    case 'phrase': return `(${d.phrase ?? ''})`
    default: return pt(d.from)
  }
}

// ---------------------------------------------------------------------------
// Rechnen
// ---------------------------------------------------------------------------

/** Julianische Tageszahl für ein gregorianisches Datum. */
export function gregorianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
}

/** Julianische Tageszahl für ein julianisches Datum. */
export function julianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083
}

export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const dd = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * dd) / 4)
  const mm = Math.floor((5 * e + 2) / 153)
  return {
    day: e - Math.floor((153 * mm + 2) / 5) + 1,
    month: mm + 3 - 12 * Math.floor(mm / 10),
    year: 100 * b + dd - 4800 + Math.floor(mm / 10),
  }
}

/**
 * Rechnet ein julianisches Datum in den gregorianischen Kalender um.
 * Ohne diese Umrechnung liegen Daten vor 1582 um bis zu zehn Tage daneben,
 * und Ereignisse aus verschiedenen Territorien lassen sich nicht vergleichen.
 */
export function julianToGregorian(y: number, m: number, d: number) {
  return jdnToGregorian(julianToJDN(y, m, d))
}

/**
 * Vergleichbare Dezimalzahl: 1723.6164 ≙ 14. August 1723.
 * Unvollständige Daten werden auf die Jahresmitte gelegt, damit Sortierung und
 * Altersvergleiche nicht systematisch zum Jahresanfang verzerren.
 */
export function pointToNumber(p: DatePoint | undefined): number | null {
  if (!p) return null
  let { year, month, day } = p
  if (p.calendar === 'julian' && month && day) {
    const g = julianToGregorian(year, month, day)
    year = g.year; month = g.month; day = g.day
  }
  if (month === undefined) return year + 0.5
  const dayOfYear = cumulativeDays(year, month) + (day ?? 15)
  return year + dayOfYear / (isLeap(year) ? 366 : 365)
}

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function cumulativeDays(year: number, month: number) {
  const dm = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let sum = 0
  for (let i = 0; i < month - 1; i++) sum += dm[i]
  return sum
}

/** Ein Zahlenwert für Sortierung und Vergleich – die beste Schätzung. */
export function dateValue(d: GDate | undefined | null): number | null {
  if (!d) return null
  const a = pointToNumber(d.from)
  const b = pointToNumber(d.to)
  if (a !== null && b !== null) return (a + b) / 2
  return a ?? b
}

/** Frühestmöglicher Zeitpunkt – für Plausibilitätsprüfungen. */
export function dateEarliest(d: GDate | undefined | null): number | null {
  if (!d) return null
  if (d.modifier === 'before') return null
  const a = pointToNumber(d.from)
  if (a === null) return pointToNumber(d.to)
  if (d.modifier === 'about' || d.modifier === 'estimated') return a - 2
  return a
}

/** Spätestmöglicher Zeitpunkt. */
export function dateLatest(d: GDate | undefined | null): number | null {
  if (!d) return null
  if (d.modifier === 'after') return null
  const b = pointToNumber(d.to) ?? pointToNumber(d.from)
  if (b === null) return null
  if (d.modifier === 'about' || d.modifier === 'estimated') return b + 2
  return b
}

export function dateYear(d: GDate | undefined | null): number | null {
  if (!d) return null
  return d.from?.year ?? d.to?.year ?? null
}

/** Alter in Jahren zwischen zwei Datumsangaben, auf ganze Jahre abgerundet. */
export function yearsBetween(a: GDate | undefined | null, b: GDate | undefined | null): number | null {
  const va = dateValue(a)
  const vb = dateValue(b)
  if (va === null || vb === null) return null
  return Math.floor(vb - va)
}

/** Heutiges Datum als GDate – für „zuletzt geändert“ und Aufgaben. */
export function today(): GDate {
  const now = new Date()
  return {
    modifier: 'exact',
    from: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
  }
}
