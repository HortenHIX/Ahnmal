/**
 * Zugriffshilfen auf das Datenmodell.
 *
 * Alle Funktionen sind rein lesend und arbeiten auf einer `Database`, damit sie
 * sich sowohl in der Oberfläche als auch in Prüf- und Exportläufen verwenden
 * lassen.
 */

import { dateValue, dateYear, formatDate, yearsBetween } from './dates'
import { uid } from './ids'
import type {
  Database, EventType, Family, GEvent, ID, Person, PersonName, Place, Sex,
} from './types'

// ---------------------------------------------------------------------------
// Namen
// ---------------------------------------------------------------------------

export function primaryName(p: Person | undefined): PersonName | undefined {
  if (!p) return undefined
  return p.names.find((n) => n.primary) ?? p.names[0]
}

/** „Maria Anna von Hüfingen“ */
export function displayName(p: Person | undefined): string {
  if (!p) return 'Unbekannt'
  const n = primaryName(p)
  if (!n) return 'Unbekannt'
  const parts = [n.prefix, n.given, n.surnamePrefix, n.surname, n.suffix].filter(Boolean)
  const s = parts.join(' ').replace(/\s+/g, ' ').trim()
  return s || 'Unbekannt'
}

/** „von Hüfingen, Maria Anna“ – für Listen und Sortierung. */
export function listName(p: Person | undefined): string {
  if (!p) return 'Unbekannt'
  const n = primaryName(p)
  if (!n) return 'Unbekannt'
  const sur = [n.surnamePrefix, n.surname].filter(Boolean).join(' ')
  const giv = [n.given, n.suffix].filter(Boolean).join(' ')
  if (sur && giv) return `${sur}, ${giv}`
  return sur || giv || 'Unbekannt'
}

export function surnameOf(p: Person | undefined): string {
  const n = primaryName(p)
  return (n?.surname ?? '').trim()
}

export function givenOf(p: Person | undefined): string {
  const n = primaryName(p)
  return (n?.given ?? '').trim()
}

/**
 * Vergleichsform für Suche und Dublettenabgleich: ohne Umlaute, ohne
 * Satzzeichen, klein geschrieben.
 */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Kölner Phonetik – auf deutsche Namen abgestimmt und dem Soundex überlegen,
 * weil sie Umlaute und deutsche Konsonantenhäufungen richtig behandelt.
 * Nötig, weil derselbe Name in Kirchenbüchern über Jahrhunderte in bis zu
 * einem Dutzend Schreibweisen auftaucht (Meyer/Maier/Mayr/Meier).
 */
export function coloniaPhonetic(input: string): string {
  const s = normalizeName(input).replace(/ /g, '')
  if (!s) return ''
  const out: string[] = []
  const isVowel = (c: string) => 'aeiouy'.includes(c)
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const prev = s[i - 1]
    const next = s[i + 1]
    let code = ''
    switch (c) {
      case 'a': case 'e': case 'i': case 'o': case 'u': case 'y': code = '0'; break
      case 'b': code = '1'; break
      case 'p': code = next === 'h' ? '3' : '1'; break
      case 'd': case 't': code = next && 'csz'.includes(next) ? '8' : '2'; break
      case 'f': case 'v': case 'w': code = '3'; break
      case 'g': case 'k': case 'q': code = '4'; break
      case 'c':
        if (i === 0) code = next && 'ahkloqrux'.includes(next) ? '4' : '8'
        else if (prev && 'sz'.includes(prev)) code = '8'
        else code = next && 'ahkoqux'.includes(next) ? '4' : '8'
        break
      case 'x': code = prev && 'ckq'.includes(prev) ? '8' : '48'; break
      case 'l': code = '5'; break
      case 'm': case 'n': code = '6'; break
      case 'r': code = '7'; break
      case 's': case 'z': code = '8'; break
      case 'h': code = ''; break
      default: code = ''
    }
    if (code) out.push(code)
    void isVowel
  }
  // Doppelte zusammenziehen, Nullen außer der ersten streichen
  let res = ''
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== out[i - 1]) res += out[i]
  }
  return res[0] + res.slice(1).replace(/0/g, '')
}

// ---------------------------------------------------------------------------
// Ereignisse
// ---------------------------------------------------------------------------

export function eventOf(p: Person | Family | undefined, type: EventType): GEvent | undefined {
  return p?.events.find((e) => e.type === type)
}

/** Geburt, ersatzweise Taufe – die Taufe ist oft das einzig Überlieferte. */
export function birthEvent(p: Person | undefined): GEvent | undefined {
  return eventOf(p, 'BIRT') ?? eventOf(p, 'CHR') ?? eventOf(p, 'BAPM')
}

/** Tod, ersatzweise Bestattung. */
export function deathEvent(p: Person | undefined): GEvent | undefined {
  return eventOf(p, 'DEAT') ?? eventOf(p, 'BURI') ?? eventOf(p, 'CREM')
}

export function birthYear(p: Person | undefined): number | null {
  return dateYear(birthEvent(p)?.date)
}

export function deathYear(p: Person | undefined): number | null {
  return dateYear(deathEvent(p)?.date)
}

/** „1723–1789“, „* 1723“, „† 1789“ oder leer. */
export function lifespan(p: Person | undefined): string {
  const b = birthYear(p)
  const d = deathYear(p)
  if (b !== null && d !== null) return `${b}–${d}`
  if (b !== null) return `* ${b}`
  if (d !== null) return `† ${d}`
  return ''
}

export function ageAtDeath(p: Person | undefined): number | null {
  return yearsBetween(birthEvent(p)?.date, deathEvent(p)?.date)
}

/**
 * Schätzt, ob eine Person noch leben könnte. Maßgeblich für den Datenschutz:
 * Daten lebender Personen dürfen nicht ohne Weiteres exportiert oder
 * veröffentlicht werden.
 */
export function isProbablyLiving(p: Person | undefined, maxAge = 105): boolean {
  if (!p) return false
  if (p.living !== undefined) return p.living
  if (deathEvent(p)) return false
  const nowYear = new Date().getFullYear()
  const b = birthYear(p)
  if (b !== null) return nowYear - b < maxAge
  // Ohne Geburtsjahr: aus den Ereignissen den spätesten Anhaltspunkt nehmen
  let latest: number | null = null
  for (const e of p.events) {
    const v = dateValue(e.date)
    if (v !== null && (latest === null || v > latest)) latest = v
  }
  for (const a of p.attributes) {
    const v = dateValue(a.date)
    if (v !== null && (latest === null || v > latest)) latest = v
  }
  if (latest !== null) return nowYear - latest < maxAge - 20
  // Keinerlei Daten – im Zweifel schützen
  return true
}

// ---------------------------------------------------------------------------
// Beziehungen
// ---------------------------------------------------------------------------

export function parentsOf(db: Database, personId: ID): { father?: Person; mother?: Person; family?: Family } {
  const p = db.persons[personId]
  if (!p) return {}
  for (const fid of p.childOf) {
    const f = db.families[fid]
    if (!f) continue
    const a = f.partner1 ? db.persons[f.partner1] : undefined
    const b = f.partner2 ? db.persons[f.partner2] : undefined
    const father = a?.sex === 'M' ? a : b?.sex === 'M' ? b : a?.sex !== 'F' ? a : undefined
    const mother = a?.sex === 'F' ? a : b?.sex === 'F' ? b : father === a ? b : a
    return { father, mother, family: f }
  }
  return {}
}

export function childrenOf(db: Database, personId: ID): Person[] {
  const p = db.persons[personId]
  if (!p) return []
  const out: Person[] = []
  for (const fid of p.spouseIn) {
    const f = db.families[fid]
    if (!f) continue
    for (const c of f.children) {
      const child = db.persons[c.personId]
      if (child) out.push(child)
    }
  }
  return sortByBirth(out)
}

export function spousesOf(db: Database, personId: ID): { person?: Person; family: Family }[] {
  const p = db.persons[personId]
  if (!p) return []
  const out: { person?: Person; family: Family }[] = []
  for (const fid of p.spouseIn) {
    const f = db.families[fid]
    if (!f) continue
    const otherId = f.partner1 === personId ? f.partner2 : f.partner1
    out.push({ person: otherId ? db.persons[otherId] : undefined, family: f })
  }
  return out
}

export function siblingsOf(db: Database, personId: ID, includeHalf = true): Person[] {
  const p = db.persons[personId]
  if (!p) return []
  const seen = new Set<ID>([personId])
  const out: Person[] = []
  for (const fid of p.childOf) {
    const f = db.families[fid]
    if (!f) continue
    for (const c of f.children) {
      if (seen.has(c.personId)) continue
      seen.add(c.personId)
      const s = db.persons[c.personId]
      if (s) out.push(s)
    }
  }
  if (includeHalf) {
    const { father, mother } = parentsOf(db, personId)
    for (const parent of [father, mother]) {
      if (!parent) continue
      for (const fid of parent.spouseIn) {
        const f = db.families[fid]
        if (!f) continue
        for (const c of f.children) {
          if (seen.has(c.personId)) continue
          seen.add(c.personId)
          const s = db.persons[c.personId]
          if (s) out.push(s)
        }
      }
    }
  }
  return sortByBirth(out)
}

export function sortByBirth(list: Person[]): Person[] {
  return [...list].sort((a, b) => {
    const va = dateValue(birthEvent(a)?.date)
    const vb = dateValue(birthEvent(b)?.date)
    if (va === null && vb === null) return listName(a).localeCompare(listName(b), 'de')
    if (va === null) return 1
    if (vb === null) return -1
    return va - vb
  })
}

// ---------------------------------------------------------------------------
// Orte
// ---------------------------------------------------------------------------

export function placeLabel(db: Database, ev: { placeId?: ID; placeText?: string } | undefined): string {
  if (!ev) return ''
  if (ev.placeId) {
    const pl = db.places[ev.placeId]
    if (pl) return fullPlaceName(pl)
  }
  return ev.placeText ?? ''
}

export function fullPlaceName(pl: Place): string {
  return [pl.name, ...(pl.hierarchy ?? [])].filter(Boolean).join(', ')
}

/** Kurzfassung eines Ereignisses für Listen: „* 14.08.1723, Hüfingen“. */
export function eventSummary(db: Database, e: GEvent | undefined): string {
  if (!e) return ''
  const d = formatDate(e.date)
  const pl = placeLabel(db, e)
  return [d, pl].filter(Boolean).join(', ')
}

export const EVENT_LABELS: Record<string, string> = {
  BIRT: 'Geburt', CHR: 'Taufe', BAPM: 'Taufe', DEAT: 'Tod', BURI: 'Bestattung',
  CREM: 'Einäscherung', ADOP: 'Adoption', BARM: 'Bar Mitzwa', BASM: 'Bat Mitzwa',
  BLES: 'Segnung', CONF: 'Konfirmation', FCOM: 'Erstkommunion', ORDN: 'Ordination',
  NATU: 'Einbürgerung', EMIG: 'Auswanderung', IMMI: 'Einwanderung', CENS: 'Volkszählung',
  PROB: 'Testamentseröffnung', WILL: 'Testament', GRAD: 'Abschluss', RETI: 'Ruhestand',
  EVEN: 'Ereignis',
  MARR: 'Heirat', MARB: 'Aufgebot', MARC: 'Ehevertrag', MARL: 'Trauschein',
  MARS: 'Ehevertrag', ENGA: 'Verlobung', DIV: 'Scheidung', DIVF: 'Scheidungsantrag',
  ANUL: 'Aufhebung der Ehe',
}

export const ATTRIBUTE_LABELS: Record<string, string> = {
  OCCU: 'Beruf', RESI: 'Wohnort', RELI: 'Konfession', NATI: 'Volkszugehörigkeit',
  EDUC: 'Ausbildung', TITL: 'Titel', PROP: 'Besitz', CAST: 'Stand',
  DSCR: 'Beschreibung', IDNO: 'Kennnummer', SSN: 'Sozialversicherungsnr.',
  NCHI: 'Kinderzahl', NMR: 'Zahl der Ehen', FACT: 'Merkmal',
}

export function eventLabel(e: GEvent): string {
  if (e.type === 'EVEN' && e.label) return e.label
  return EVENT_LABELS[e.type] ?? e.type
}

export const SEX_LABELS: Record<Sex, string> = {
  M: 'männlich', F: 'weiblich', U: 'unbekannt', X: 'divers',
}

// ---------------------------------------------------------------------------
// Fabriken
// ---------------------------------------------------------------------------

export function newPerson(partial: Partial<Person> = {}): Person {
  const now = Date.now()
  return {
    id: uid('p'),
    names: [{ id: uid('n'), type: 'birth', primary: true }],
    sex: 'U',
    events: [],
    attributes: [],
    childOf: [],
    spouseIn: [],
    mediaIds: [],
    citations: [],
    notes: [],
    created: now,
    changed: now,
    ...partial,
  }
}

export function newFamily(partial: Partial<Family> = {}): Family {
  const now = Date.now()
  return {
    id: uid('f'),
    unionType: 'married',
    children: [],
    events: [],
    mediaIds: [],
    citations: [],
    notes: [],
    created: now,
    changed: now,
    ...partial,
  }
}

export function newEvent(type: EventType, partial: Partial<GEvent> = {}): GEvent {
  return { id: uid('e'), type, ...partial }
}
