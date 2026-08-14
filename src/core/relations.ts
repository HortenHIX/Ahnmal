/**
 * Verwandtschaftsberechnung.
 *
 * Enthält die Kekulé-Nummerierung, den Verwandtschaftsrechner mit deutscher
 * Benennung, die Berechnung von Ahnenschwund und Verwandtenehe sowie die
 * Sammelfunktionen für Vorfahren und Nachkommen.
 */

import { parentsOf } from './model'
import type { Database, ID, Person } from './types'

// ---------------------------------------------------------------------------
// Vorfahren und Nachkommen
// ---------------------------------------------------------------------------

export interface AncestorNode {
  personId: ID
  /** Kekulé-von-Stradonitz-Nummer: Proband 1, Vater 2n, Mutter 2n+1. */
  kekule: number
  /** Generation, Proband = 0. */
  generation: number
}

/**
 * Sammelt Vorfahren nach Kekulé. Mehrfach vorkommende Personen erhalten
 * mehrere Nummern – genau das ist Ahnenschwund und soll sichtbar bleiben.
 */
export function ancestorsWithKekule(db: Database, rootId: ID, maxGen = 12): AncestorNode[] {
  const out: AncestorNode[] = []
  const queue: AncestorNode[] = [{ personId: rootId, kekule: 1, generation: 0 }]
  // Sicherung gegen fehlerhafte Daten mit Zyklen
  const guard = new Set<string>()
  while (queue.length) {
    const node = queue.shift()!
    const key = `${node.personId}:${node.kekule}`
    if (guard.has(key)) continue
    guard.add(key)
    out.push(node)
    if (node.generation >= maxGen) continue
    const { father, mother } = parentsOf(db, node.personId)
    if (father) queue.push({ personId: father.id, kekule: node.kekule * 2, generation: node.generation + 1 })
    if (mother) queue.push({ personId: mother.id, kekule: node.kekule * 2 + 1, generation: node.generation + 1 })
  }
  return out
}

/** Alle Vorfahren als Menge, jede Person genau einmal, mit kürzestem Abstand. */
export function ancestorSet(db: Database, rootId: ID, maxGen = 40): Map<ID, number> {
  const dist = new Map<ID, number>()
  const queue: [ID, number][] = [[rootId, 0]]
  while (queue.length) {
    const [id, gen] = queue.shift()!
    if (dist.has(id) && dist.get(id)! <= gen) continue
    dist.set(id, gen)
    if (gen >= maxGen) continue
    const { father, mother } = parentsOf(db, id)
    if (father) queue.push([father.id, gen + 1])
    if (mother) queue.push([mother.id, gen + 1])
  }
  return dist
}

export function descendantSet(db: Database, rootId: ID, maxGen = 40): Map<ID, number> {
  const dist = new Map<ID, number>()
  const queue: [ID, number][] = [[rootId, 0]]
  while (queue.length) {
    const [id, gen] = queue.shift()!
    if (dist.has(id) && dist.get(id)! <= gen) continue
    dist.set(id, gen)
    if (gen >= maxGen) continue
    const p = db.persons[id]
    if (!p) continue
    for (const fid of p.spouseIn) {
      const f = db.families[fid]
      if (!f) continue
      for (const c of f.children) queue.push([c.personId, gen + 1])
    }
  }
  return dist
}

// ---------------------------------------------------------------------------
// Ahnenschwund
// ---------------------------------------------------------------------------

export interface ImplexReport {
  generations: {
    generation: number
    /** Theoretisch mögliche Ahnenstellen: 2^n. */
    possible: number
    /** Tatsächlich besetzte Stellen. */
    filled: number
    /** Verschiedene Personen auf diesen Stellen. */
    distinct: number
    /** Anteil des Ahnenschwunds in Prozent. */
    implexPercent: number
  }[]
  /** Personen, die mehrfach als Ahne auftreten. */
  duplicates: { personId: ID; positions: number[] }[]
  totalFilled: number
  totalDistinct: number
}

/**
 * Ahnenschwund („Implex“): Wenn Verwandte einander heiraten, besetzt dieselbe
 * Person mehrere Ahnenstellen. Der Wert ist für die Bewertung eines
 * Stammbaums aussagekräftiger als die reine Personenzahl.
 */
export function implexReport(db: Database, rootId: ID, maxGen = 12): ImplexReport {
  const nodes = ancestorsWithKekule(db, rootId, maxGen)
  const byGen = new Map<number, AncestorNode[]>()
  for (const n of nodes) {
    if (!byGen.has(n.generation)) byGen.set(n.generation, [])
    byGen.get(n.generation)!.push(n)
  }
  const generations = [...byGen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([generation, list]) => {
      const distinct = new Set(list.map((n) => n.personId)).size
      const possible = Math.pow(2, generation)
      return {
        generation,
        possible,
        filled: list.length,
        distinct,
        implexPercent: list.length ? Math.round(((list.length - distinct) / list.length) * 1000) / 10 : 0,
      }
    })

  const positions = new Map<ID, number[]>()
  for (const n of nodes) {
    if (!positions.has(n.personId)) positions.set(n.personId, [])
    positions.get(n.personId)!.push(n.kekule)
  }
  const duplicates = [...positions.entries()]
    .filter(([, pos]) => pos.length > 1)
    .map(([personId, pos]) => ({ personId, positions: pos.sort((a, b) => a - b) }))
    .sort((a, b) => b.positions.length - a.positions.length)

  return {
    generations,
    duplicates,
    totalFilled: nodes.length,
    totalDistinct: new Set(nodes.map((n) => n.personId)).size,
  }
}

// ---------------------------------------------------------------------------
// Verwandtschaftsrechner
// ---------------------------------------------------------------------------

export interface Relationship {
  /** Deutsche Bezeichnung, z. B. „Cousine 2. Grades“. */
  label: string
  /** Generationsabstand von A zum gemeinsamen Vorfahren. */
  upA: number
  /** Generationsabstand von B zum gemeinsamen Vorfahren. */
  upB: number
  commonAncestors: ID[]
  /** Verwandtschaftskoeffizient nach Wright. */
  coefficient: number
  /** Kürzester Pfad als Personenkette. */
  path: ID[]
  /** true, wenn nur angeheiratet. */
  byMarriage?: boolean
}

/**
 * Bestimmt die Verwandtschaft zweier Personen über den nächsten gemeinsamen
 * Vorfahren. Liefert die im Deutschen übliche Bezeichnung.
 */
export function relationship(db: Database, aId: ID, bId: ID): Relationship | null {
  if (aId === bId) {
    return { label: 'dieselbe Person', upA: 0, upB: 0, commonAncestors: [aId], coefficient: 1, path: [aId] }
  }

  const ancA = ancestorSet(db, aId)
  const ancB = ancestorSet(db, bId)

  let best: { id: ID; upA: number; upB: number } | null = null
  const commons: ID[] = []
  for (const [id, da] of ancA) {
    const dbst = ancB.get(id)
    if (dbst === undefined) continue
    commons.push(id)
    if (!best || da + dbst < best.upA + best.upB || (da + dbst === best.upA + best.upB && Math.abs(da - dbst) < Math.abs(best.upA - best.upB))) {
      best = { id, upA: da, upB: dbst }
    }
  }

  if (!best) {
    const m = marriageRelation(db, aId, bId)
    if (m) return m
    return null
  }

  // Nur der nächstgelegene gemeinsame Vorfahre und dessen Partner zählen
  const minSum = best.upA + best.upB
  const nearest = commons.filter((id) => (ancA.get(id)! + ancB.get(id)!) === minSum)

  const coefficient = wrightCoefficient(db, aId, bId)
  const path = shortestPath(db, aId, bId) ?? []

  return {
    label: germanRelationLabel(db, best.upA, best.upB, bId),
    upA: best.upA,
    upB: best.upB,
    commonAncestors: nearest,
    coefficient,
    path,
  }
}

/** Prüft, ob zwei Personen nur über eine Ehe verbunden sind. */
function marriageRelation(db: Database, aId: ID, bId: ID): Relationship | null {
  const a = db.persons[aId]
  if (!a) return null
  for (const fid of a.spouseIn) {
    const f = db.families[fid]
    if (!f) continue
    if (f.partner1 === bId || f.partner2 === bId) {
      return {
        label: f.unionType === 'married' ? 'Ehepartner' : 'Partner',
        upA: 0, upB: 0, commonAncestors: [], coefficient: 0,
        path: [aId, bId], byMarriage: true,
      }
    }
  }
  // Angeheiratet über den Partner
  for (const fid of a.spouseIn) {
    const f = db.families[fid]
    if (!f) continue
    const otherId = f.partner1 === aId ? f.partner2 : f.partner1
    if (!otherId) continue
    const r = relationship(db, otherId, bId)
    if (r && !r.byMarriage) {
      return { ...r, label: `${r.label} des Partners (angeheiratet)`, byMarriage: true, coefficient: 0 }
    }
  }
  return null
}

const ORDINAL_DE = ['', 'Ur', 'Urur', 'Ururur', 'Urururur']

function greatPrefix(n: number): string {
  if (n <= 0) return ''
  if (n < ORDINAL_DE.length) return ORDINAL_DE[n]
  return `Ur(${n})`
}

/** Deutsche Verwandtschaftsbezeichnung aus den Generationsabständen. */
export function germanRelationLabel(db: Database, upA: number, upB: number, bId: ID): string {
  const sexB = db.persons[bId]?.sex
  const male = sexB === 'M'
  const female = sexB === 'F'

  // B ist Vorfahre von A
  if (upB === 0) {
    if (upA === 1) return male ? 'Vater' : female ? 'Mutter' : 'Elternteil'
    if (upA === 2) return male ? 'Großvater' : female ? 'Großmutter' : 'Großelternteil'
    const p = greatPrefix(upA - 2)
    return male ? `${p}großvater` : female ? `${p}großmutter` : `${p}großelternteil`
  }
  // B ist Nachkomme von A
  if (upA === 0) {
    if (upB === 1) return male ? 'Sohn' : female ? 'Tochter' : 'Kind'
    if (upB === 2) return male ? 'Enkel' : female ? 'Enkelin' : 'Enkelkind'
    const p = greatPrefix(upB - 2)
    return male ? `${p}enkel` : female ? `${p}enkelin` : `${p}enkelkind`
  }
  // Geschwister
  if (upA === 1 && upB === 1) return male ? 'Bruder' : female ? 'Schwester' : 'Geschwister'
  // Onkel/Tante und Neffe/Nichte
  if (upA === 1) {
    const p = greatPrefix(upB - 2)
    if (upB === 2) return male ? 'Neffe' : female ? 'Nichte' : 'Geschwisterkind'
    return male ? `${p}großneffe` : female ? `${p}großnichte` : `${p}großneffe/-nichte`
  }
  if (upB === 1) {
    if (upA === 2) return male ? 'Onkel' : female ? 'Tante' : 'Onkel/Tante'
    const p = greatPrefix(upA - 2)
    return male ? `${p}großonkel` : female ? `${p}großtante` : `${p}großonkel/-tante`
  }
  // Cousins: Grad = min(upA, upB) − 1, Entfernung = |upA − upB|
  const degree = Math.min(upA, upB) - 1
  const removed = Math.abs(upA - upB)
  const base = male ? 'Cousin' : female ? 'Cousine' : 'Cousin/Cousine'
  const gradeText = `${base} ${degree}. Grades`
  if (removed === 0) return gradeText
  return `${gradeText}, ${removed} Grad entfernt`
}

/**
 * Verwandtschaftskoeffizient nach Wright: Summe über alle Pfade
 * (1/2)^(Weglänge), begrenzt auf zwölf Generationen.
 */
export function wrightCoefficient(db: Database, aId: ID, bId: ID, maxGen = 12): number {
  const pathsA = ancestorPaths(db, aId, maxGen)
  const pathsB = ancestorPaths(db, bId, maxGen)

  const commons = [...pathsA.keys()].filter((id) => pathsB.has(id))

  // Nur die jüngsten gemeinsamen Vorfahren zählen. Deren eigene Vorfahren
  // ergäben Wege, die dieselbe Person zweimal durchlaufen – bei Vater und Kind
  // käme sonst ein Wert über eins heraus.
  const redundant = new Set<ID>()
  for (const other of commons) {
    const anc = ancestorSet(db, other, maxGen)
    for (const ca of commons) {
      if (ca !== other && anc.has(ca)) redundant.add(ca)
    }
  }

  let sum = 0
  for (const id of commons) {
    if (redundant.has(id)) continue
    const distsA = pathsA.get(id)!
    const distsB = pathsB.get(id)!
    for (const da of distsA) {
      for (const dbs of distsB) {
        if (da === 0 && dbs === 0) continue
        sum += Math.pow(0.5, da + dbs)
      }
    }
  }
  return Math.round(sum * 100000) / 100000
}

/** Alle Weglängen zu allen Vorfahren – Mehrfachwege bleiben erhalten. */
function ancestorPaths(db: Database, rootId: ID, maxGen: number): Map<ID, number[]> {
  const out = new Map<ID, number[]>()
  const walk = (id: ID, gen: number) => {
    if (gen > maxGen) return
    if (!out.has(id)) out.set(id, [])
    out.get(id)!.push(gen)
    const { father, mother } = parentsOf(db, id)
    if (father) walk(father.id, gen + 1)
    if (mother) walk(mother.id, gen + 1)
  }
  walk(rootId, 0)
  return out
}

/** Kürzester Weg zwischen zwei Personen über Eltern-, Kind- und Ehekanten. */
export function shortestPath(db: Database, aId: ID, bId: ID): ID[] | null {
  const prev = new Map<ID, ID | null>([[aId, null]])
  const queue: ID[] = [aId]
  while (queue.length) {
    const cur = queue.shift()!
    if (cur === bId) {
      const path: ID[] = []
      let node: ID | null = cur
      while (node) { path.unshift(node); node = prev.get(node) ?? null }
      return path
    }
    for (const n of neighbours(db, cur)) {
      if (prev.has(n)) continue
      prev.set(n, cur)
      queue.push(n)
    }
  }
  return null
}

function neighbours(db: Database, id: ID): ID[] {
  const p = db.persons[id]
  if (!p) return []
  const out: ID[] = []
  for (const fid of p.childOf) {
    const f = db.families[fid]
    if (!f) continue
    if (f.partner1) out.push(f.partner1)
    if (f.partner2) out.push(f.partner2)
  }
  for (const fid of p.spouseIn) {
    const f = db.families[fid]
    if (!f) continue
    const other = f.partner1 === id ? f.partner2 : f.partner1
    if (other) out.push(other)
    for (const c of f.children) out.push(c.personId)
  }
  return out
}

/**
 * Inzuchtkoeffizient eines Kindes: der Verwandtschaftskoeffizient seiner
 * Eltern, halbiert. Kirchenrechtlich waren Ehen bis zum vierten Grad
 * dispensbedürftig – in vielen Dörfern der Regelfall.
 */
export function inbreedingCoefficient(db: Database, childId: ID): number | null {
  const { father, mother } = parentsOf(db, childId)
  if (!father || !mother) return null
  return Math.round((wrightCoefficient(db, father.id, mother.id) / 2) * 100000) / 100000
}

/** Kekulé-Nummer als Text mit Angabe der Ahnenlinie („väterlicherseits“). */
export function kekuleLine(kekule: number): string {
  if (kekule === 1) return 'Proband'
  const bits = kekule.toString(2).slice(1)
  return bits.split('').map((b) => (b === '0' ? 'V' : 'M')).join('')
}

/** Erzeugt eine Liste aller Personen ohne bekannte Eltern – die Forschungsfront. */
export function endOfLine(db: Database, rootId: ID, maxGen = 15): { person: Person; kekule: number; generation: number }[] {
  const nodes = ancestorsWithKekule(db, rootId, maxGen)
  const out: { person: Person; kekule: number; generation: number }[] = []
  for (const n of nodes) {
    const { father, mother } = parentsOf(db, n.personId)
    if (father && mother) continue
    const person = db.persons[n.personId]
    if (person) out.push({ person, kekule: n.kekule, generation: n.generation })
  }
  return out.sort((a, b) => b.generation - a.generation || a.kekule - b.kekule)
}
