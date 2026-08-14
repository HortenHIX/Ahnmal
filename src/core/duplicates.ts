/**
 * Dublettenerkennung und Zusammenführung.
 *
 * Gewachsene Datenbestände enthalten fast immer dieselbe Person mehrfach – aus
 * Importen, aus getrennt geführten Linien, aus Schreibvarianten. Die Bewertung
 * kombiniert Namensähnlichkeit, Datumsnähe und den Abgleich der Angehörigen.
 */

import { dateValue } from './dates'
import {
  birthEvent, coloniaPhonetic, deathEvent, displayName, givenOf, normalizeName,
  parentsOf, surnameOf,
} from './model'
import type { Database, ID, Person } from './types'

export interface DuplicateCandidate {
  a: ID
  b: ID
  /** 0…100 */
  score: number
  reasons: string[]
}

/** Levenshtein-Abstand, begrenzt auf kurze Zeichenketten. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[b.length]
}

/** Ähnlichkeit zweier Zeichenketten als Wert zwischen 0 und 1. */
export function similarity(a: string, b: string): number {
  const x = normalizeName(a)
  const y = normalizeName(b)
  if (!x || !y) return 0
  if (x === y) return 1
  const max = Math.max(x.length, y.length)
  return Math.max(0, 1 - levenshtein(x, y) / max)
}

/**
 * Namensähnlichkeit mit Rücksicht auf mehrteilige Vornamen. In Kirchenbüchern
 * ist „Johann Georg“ dieselbe Person wie „Georg“ – der Rufname ist oft nur der
 * zweite Vorname.
 */
export function givenNameSimilarity(a: string, b: string): number {
  const ta = normalizeName(a).split(' ').filter(Boolean)
  const tb = normalizeName(b).split(' ').filter(Boolean)
  if (!ta.length || !tb.length) return 0
  let hits = 0
  for (const x of ta) {
    if (tb.some((y) => x === y || similarity(x, y) > 0.85 || coloniaPhonetic(x) === coloniaPhonetic(y))) hits++
  }
  return hits / Math.max(ta.length, tb.length) * 0.7 + (hits > 0 ? 0.3 : 0)
}

/** Bewertet ein Personenpaar. Werte ab etwa 70 sind prüfenswert. */
export function scorePair(db: Database, a: Person, b: Person): DuplicateCandidate | null {
  if (a.id === b.id) return null

  const reasons: string[] = []
  let score = 0

  // Familienname
  const sa = surnameOf(a)
  const sb = surnameOf(b)
  if (sa && sb) {
    const exact = normalizeName(sa) === normalizeName(sb)
    const phon = coloniaPhonetic(sa) === coloniaPhonetic(sb)
    const sim = similarity(sa, sb)
    if (exact) { score += 30; reasons.push('Familienname identisch') }
    else if (phon) { score += 24; reasons.push('Familienname gleichlautend') }
    else if (sim > 0.8) { score += 18; reasons.push('Familienname ähnlich') }
    else return null // ohne Namensnähe keine Dublette
  } else {
    score += 5
  }

  // Vorname
  const ga = givenOf(a)
  const gb = givenOf(b)
  if (ga && gb) {
    const gs = givenNameSimilarity(ga, gb)
    if (gs >= 0.99) { score += 25; reasons.push('Vorname identisch') }
    else if (gs >= 0.6) { score += 18; reasons.push('Vorname teilweise gleich') }
    else if (gs >= 0.3) { score += 8; reasons.push('Vorname verwandt') }
    else score -= 15
  }

  // Geschlecht
  if (a.sex !== 'U' && b.sex !== 'U') {
    if (a.sex === b.sex) score += 5
    else return null // unterschiedliches Geschlecht schließt aus
  }

  // Geburtsdatum
  const ba = dateValue(birthEvent(a)?.date)
  const bb = dateValue(birthEvent(b)?.date)
  if (ba !== null && bb !== null) {
    const diff = Math.abs(ba - bb)
    if (diff < 0.01) { score += 30; reasons.push('Geburtsdatum identisch') }
    else if (diff < 1) { score += 20; reasons.push('Geburtsdatum um weniger als ein Jahr abweichend') }
    else if (diff < 3) { score += 8; reasons.push('Geburtsjahr nahe beieinander') }
    else score -= 25
  }

  // Sterbedatum
  const da = dateValue(deathEvent(a)?.date)
  const dbv = dateValue(deathEvent(b)?.date)
  if (da !== null && dbv !== null) {
    const diff = Math.abs(da - dbv)
    if (diff < 0.01) { score += 20; reasons.push('Sterbedatum identisch') }
    else if (diff < 1) { score += 12; reasons.push('Sterbedatum nahe beieinander') }
    else score -= 20
  }

  // Eltern
  const pa = parentsOf(db, a.id)
  const pb = parentsOf(db, b.id)
  let parentHits = 0
  if (pa.father && pb.father) {
    if (pa.father.id === pb.father.id) parentHits += 2
    else if (similarity(displayName(pa.father), displayName(pb.father)) > 0.85) parentHits += 1
  }
  if (pa.mother && pb.mother) {
    if (pa.mother.id === pb.mother.id) parentHits += 2
    else if (similarity(displayName(pa.mother), displayName(pb.mother)) > 0.85) parentHits += 1
  }
  if (parentHits >= 3) { score += 20; reasons.push('gleiche Eltern') }
  else if (parentHits > 0) { score += 10; reasons.push('Eltern ähnlich') }

  score = Math.max(0, Math.min(100, score))
  if (score < 45) return null
  return { a: a.id, b: b.id, score, reasons }
}

/**
 * Sucht Dubletten im gesamten Bestand. Zur Begrenzung des Aufwands werden nur
 * Personen mit gleichlautendem Familiennamen paarweise verglichen (Blocking).
 */
export function findDuplicates(db: Database, minScore = 60): DuplicateCandidate[] {
  const buckets = new Map<string, Person[]>()
  for (const p of Object.values(db.persons)) {
    const key = coloniaPhonetic(surnameOf(p)) || '_'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(p)
  }

  const out: DuplicateCandidate[] = []
  for (const list of buckets.values()) {
    if (list.length < 2) continue
    // Sehr große Namensgruppen würden quadratisch wachsen
    const cap = list.length > 400 ? 400 : list.length
    for (let i = 0; i < cap; i++) {
      for (let j = i + 1; j < cap; j++) {
        const c = scorePair(db, list[i], list[j])
        if (c && c.score >= minScore) out.push(c)
      }
    }
  }
  return out.sort((x, y) => y.score - x.score)
}

// ---------------------------------------------------------------------------
// Zusammenführen
// ---------------------------------------------------------------------------

export interface MergeResult {
  db: Database
  kept: ID
  removed: ID
}

/**
 * Führt zwei Personen zusammen. `keepId` bleibt bestehen und erhält alle
 * Angaben von `dropId`; Verweise in Familien werden umgehängt.
 */
export function mergePersons(db: Database, keepId: ID, dropId: ID): MergeResult {
  const keep = db.persons[keepId]
  const drop = db.persons[dropId]
  if (!keep || !drop || keepId === dropId) return { db, kept: keepId, removed: dropId }

  const persons = { ...db.persons }
  const families = { ...db.families }

  const merged: Person = {
    ...keep,
    names: dedupeNames([...keep.names, ...drop.names.map((n) => ({ ...n, primary: false }))]),
    sex: keep.sex !== 'U' ? keep.sex : drop.sex,
    events: mergeEvents(keep.events, drop.events),
    attributes: [...keep.attributes, ...drop.attributes],
    childOf: unique([...keep.childOf, ...drop.childOf]),
    spouseIn: unique([...keep.spouseIn, ...drop.spouseIn]),
    mediaIds: unique([...keep.mediaIds, ...drop.mediaIds]),
    citations: [...keep.citations, ...drop.citations],
    notes: [...keep.notes, ...drop.notes],
    armsId: keep.armsId ?? drop.armsId,
    tags: unique([...(keep.tags ?? []), ...(drop.tags ?? [])]),
    changed: Date.now(),
  }
  persons[keepId] = merged
  delete persons[dropId]

  for (const f of Object.values(families)) {
    let touched = false
    const nf = { ...f }
    if (nf.partner1 === dropId) { nf.partner1 = nf.partner2 === keepId ? undefined : keepId; touched = true }
    if (nf.partner2 === dropId) { nf.partner2 = nf.partner1 === keepId ? undefined : keepId; touched = true }
    const before = nf.children.length
    const seen = new Set<ID>()
    nf.children = nf.children
      .map((c) => (c.personId === dropId ? { ...c, personId: keepId } : c))
      .filter((c) => (seen.has(c.personId) ? false : (seen.add(c.personId), true)))
    if (nf.children.length !== before) touched = true
    if (touched) families[f.id] = { ...nf, changed: Date.now() }
  }

  // Leere Familien nach dem Zusammenführen entfernen
  for (const f of Object.values(families)) {
    if (!f.partner1 && !f.partner2 && f.children.length === 0) delete families[f.id]
  }

  // Verweise in beiden Richtungen konsistent halten
  for (const p of Object.values(persons)) {
    const childOf = p.childOf.filter((fid) => families[fid])
    const spouseIn = p.spouseIn.filter((fid) => families[fid])
    if (childOf.length !== p.childOf.length || spouseIn.length !== p.spouseIn.length) {
      persons[p.id] = { ...p, childOf, spouseIn }
    }
  }

  return { db: { ...db, persons, families }, kept: keepId, removed: dropId }
}

function unique<T>(list: T[]): T[] {
  return [...new Set(list)]
}

function dedupeNames(names: Person['names']): Person['names'] {
  const seen = new Set<string>()
  const out: Person['names'] = []
  for (const n of names) {
    const key = normalizeName([n.given, n.surnamePrefix, n.surname, n.suffix].filter(Boolean).join(' ')) + '|' + n.type
    if (seen.has(key)) continue
    seen.add(key)
    out.push(n)
  }
  if (out.length && !out.some((n) => n.primary)) out[0].primary = true
  return out
}

/** Gleichartige Ereignisse mit gleichem Datum werden nicht doppelt übernommen. */
function mergeEvents(a: Person['events'], b: Person['events']): Person['events'] {
  const out = [...a]
  for (const e of b) {
    const dup = out.find(
      (x) => x.type === e.type && dateValue(x.date) === dateValue(e.date) && (x.placeText ?? '') === (e.placeText ?? ''),
    )
    if (dup) {
      dup.citations = [...(dup.citations ?? []), ...(e.citations ?? [])]
      dup.note = dup.note ?? e.note
      continue
    }
    out.push(e)
  }
  return out
}
