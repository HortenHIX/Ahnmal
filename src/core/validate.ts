/**
 * Plausibilitätsprüfung.
 *
 * Die Regeln orientieren sich an dem, was in Kirchenbüchern und Standesamts-
 * registern tatsächlich vorkommt. Grenzwerte sind absichtlich großzügig: eine
 * Mutter mit 48 Jahren ist selten, aber belegt – eine mit 8 Jahren ist ein
 * Erfassungsfehler.
 */

import { dateEarliest, dateLatest, dateValue, formatDate } from './dates'
import { birthEvent, deathEvent, displayName, eventLabel, parentsOf } from './model'
import type { Database, ID, Person } from './types'

export type IssueSeverity = 'error' | 'warning' | 'hint'

export interface Issue {
  id: string
  severity: IssueSeverity
  rule: string
  message: string
  personId?: ID
  familyId?: ID
  /** Zweite betroffene Person, etwa bei Eltern-Kind-Widersprüchen. */
  otherId?: ID
}

export interface ValidationLimits {
  maxAge: number
  minParentAge: number
  maxMotherAge: number
  maxFatherAge: number
  minMarriageAge: number
  maxSpouseAgeGap: number
  minSiblingGapMonths: number
}

export const DEFAULT_LIMITS: ValidationLimits = {
  maxAge: 110,
  minParentAge: 13,
  maxMotherAge: 50,
  maxFatherAge: 75,
  minMarriageAge: 14,
  maxSpouseAgeGap: 40,
  minSiblingGapMonths: 9,
}

export function validate(db: Database, limits: ValidationLimits = DEFAULT_LIMITS): Issue[] {
  const issues: Issue[] = []
  let n = 0
  const add = (i: Omit<Issue, 'id'>) => issues.push({ ...i, id: `v${n++}` })

  for (const p of Object.values(db.persons)) {
    checkPerson(db, p, limits, add)
  }
  for (const f of Object.values(db.families)) {
    checkFamily(db, f, limits, add)
  }
  checkCycles(db, add)

  const order: Record<IssueSeverity, number> = { error: 0, warning: 1, hint: 2 }
  return issues.sort((a, b) => order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule))
}

function checkPerson(
  db: Database,
  p: Person,
  limits: ValidationLimits,
  add: (i: Omit<Issue, 'id'>) => void,
) {
  const name = displayName(p)
  const birth = birthEvent(p)
  const death = deathEvent(p)
  const bv = dateValue(birth?.date)
  const dv = dateValue(death?.date)

  if (!p.names.length || (!p.names[0].given && !p.names[0].surname)) {
    add({ severity: 'hint', rule: 'Namen', message: `${name}: kein Name erfasst.`, personId: p.id })
  }

  if (bv !== null && dv !== null) {
    if (dv < bv) {
      add({
        severity: 'error', rule: 'Reihenfolge',
        message: `${name}: Tod (${formatDate(death!.date)}) liegt vor der Geburt (${formatDate(birth!.date)}).`,
        personId: p.id,
      })
    } else if (dv - bv > limits.maxAge) {
      add({
        severity: 'warning', rule: 'Lebensalter',
        message: `${name}: Lebensalter von ${Math.floor(dv - bv)} Jahren übersteigt den Grenzwert von ${limits.maxAge}.`,
        personId: p.id,
      })
    }
  }

  // Ereignisse dürfen nicht vor der Geburt oder nach dem Tod liegen
  for (const e of p.events) {
    if (e === birth || e === death) continue
    const ev = dateValue(e.date)
    if (ev === null) continue
    if (bv !== null && ev < bv - 0.75) {
      add({
        severity: 'warning', rule: 'Zeitfolge',
        message: `${name}: ${eventLabel(e)} (${formatDate(e.date)}) liegt vor der Geburt.`,
        personId: p.id,
      })
    }
    // Bestattung und Testamentseröffnung folgen dem Tod naturgemäß
    if (dv !== null && ev > dv + 1 && !['BURI', 'CREM', 'PROB'].includes(e.type)) {
      add({
        severity: 'warning', rule: 'Zeitfolge',
        message: `${name}: ${eventLabel(e)} (${formatDate(e.date)}) liegt nach dem Tod.`,
        personId: p.id,
      })
    }
  }

  // Taufe deutlich vor der Geburt ist ein sicherer Fehler
  const chr = p.events.find((e) => e.type === 'CHR' || e.type === 'BAPM')
  const birt = p.events.find((e) => e.type === 'BIRT')
  if (chr && birt) {
    const cv = dateValue(chr.date)
    const bvv = dateValue(birt.date)
    if (cv !== null && bvv !== null && cv < bvv - 0.02) {
      add({
        severity: 'error', rule: 'Reihenfolge',
        message: `${name}: Taufe (${formatDate(chr.date)}) vor der Geburt (${formatDate(birt.date)}).`,
        personId: p.id,
      })
    }
  }

  // Elternalter
  const { father, mother } = parentsOf(db, p.id)
  for (const [parent, kind, maxAge] of [
    [father, 'Vater', limits.maxFatherAge] as const,
    [mother, 'Mutter', limits.maxMotherAge] as const,
  ]) {
    if (!parent || bv === null) continue
    const pb = dateValue(birthEvent(parent)?.date)
    if (pb !== null) {
      const age = bv - pb
      if (age < limits.minParentAge) {
        add({
          severity: age < 8 ? 'error' : 'warning', rule: 'Elternalter',
          message: `${name}: ${kind} ${displayName(parent)} wäre bei der Geburt erst ${Math.floor(age)} Jahre alt gewesen.`,
          personId: p.id, otherId: parent.id,
        })
      } else if (age > maxAge) {
        add({
          severity: 'warning', rule: 'Elternalter',
          message: `${name}: ${kind} ${displayName(parent)} wäre bei der Geburt ${Math.floor(age)} Jahre alt gewesen.`,
          personId: p.id, otherId: parent.id,
        })
      }
    }
    // Kind nach dem Tod des Vaters ist möglich, nach dem der Mutter nicht
    const pd = dateLatest(deathEvent(parent)?.date)
    if (pd !== null) {
      const grace = kind === 'Vater' ? 0.85 : 0.01
      if (bv > pd + grace) {
        add({
          severity: 'error', rule: 'Elternalter',
          message: `${name}: geboren ${formatDate(birth?.date)}, ${kind} ${displayName(parent)} war bereits ${formatDate(deathEvent(parent)?.date)} verstorben.`,
          personId: p.id, otherId: parent.id,
        })
      }
    }
  }

  // Person ohne jede Datierung erschwert alle weiteren Prüfungen
  if (!birth && !death && p.events.length === 0) {
    add({
      severity: 'hint', rule: 'Datenlage',
      message: `${name}: kein einziges datiertes Ereignis erfasst.`,
      personId: p.id,
    })
  }

  // Quellenlosigkeit ist der häufigste Mangel in gewachsenen Datenbeständen
  const hasCitation = p.citations.length > 0 || p.events.some((e) => (e.citations?.length ?? 0) > 0)
  if (!hasCitation && (birth || death)) {
    add({
      severity: 'hint', rule: 'Belege',
      message: `${name}: Angaben ohne Quellenbeleg.`,
      personId: p.id,
    })
  }
}

function checkFamily(
  db: Database,
  f: Database['families'][string],
  limits: ValidationLimits,
  add: (i: Omit<Issue, 'id'>) => void,
) {
  const p1 = f.partner1 ? db.persons[f.partner1] : undefined
  const p2 = f.partner2 ? db.persons[f.partner2] : undefined
  const label = `${p1 ? displayName(p1) : '?'} ⚭ ${p2 ? displayName(p2) : '?'}`

  const marr = f.events.find((e) => e.type === 'MARR')
  const mv = dateValue(marr?.date)

  for (const p of [p1, p2]) {
    if (!p || mv === null) continue
    const pb = dateValue(birthEvent(p)?.date)
    if (pb !== null) {
      const age = mv - pb
      if (age < limits.minMarriageAge) {
        add({
          severity: age < 10 ? 'error' : 'warning', rule: 'Heiratsalter',
          message: `${label}: ${displayName(p)} wäre bei der Heirat erst ${Math.floor(age)} Jahre alt gewesen.`,
          familyId: f.id, personId: p.id,
        })
      }
    }
    const pdEarly = dateEarliest(deathEvent(p)?.date)
    if (pdEarly !== null && mv > pdEarly + 0.5) {
      add({
        severity: 'error', rule: 'Heirat',
        message: `${label}: Heirat ${formatDate(marr?.date)} nach dem Tod von ${displayName(p)}.`,
        familyId: f.id, personId: p.id,
      })
    }
  }

  if (p1 && p2) {
    const b1 = dateValue(birthEvent(p1)?.date)
    const b2 = dateValue(birthEvent(p2)?.date)
    if (b1 !== null && b2 !== null && Math.abs(b1 - b2) > limits.maxSpouseAgeGap) {
      add({
        severity: 'hint', rule: 'Altersunterschied',
        message: `${label}: Altersunterschied von ${Math.floor(Math.abs(b1 - b2))} Jahren.`,
        familyId: f.id,
      })
    }
    if (p1.id === p2.id) {
      add({ severity: 'error', rule: 'Familie', message: `${label}: Person mit sich selbst verheiratet.`, familyId: f.id })
    }
    if (p1.sex !== 'U' && p1.sex === p2.sex && f.unionType === 'married') {
      add({
        severity: 'hint', rule: 'Familie',
        message: `${label}: beide Partner mit gleichem Geschlecht erfasst – bitte prüfen, ob die Zuordnung stimmt.`,
        familyId: f.id,
      })
    }
  }

  // Kinder vor der Heirat sind zulässig, aber vermerkenswert
  const births = f.children
    .map((c) => ({ c, v: dateValue(birthEvent(db.persons[c.personId])?.date) }))
    .filter((x) => x.v !== null) as { c: { personId: ID }; v: number }[]

  if (mv !== null) {
    for (const { c, v } of births) {
      if (v < mv - 0.75) {
        add({
          severity: 'hint', rule: 'Vorehelich',
          message: `${label}: ${displayName(db.persons[c.personId])} wurde vor der Eheschließung geboren.`,
          familyId: f.id, personId: c.personId,
        })
      }
    }
  }

  // Geschwister mit zu geringem Geburtsabstand – außer bei Mehrlingen
  const sorted = [...births].sort((a, b) => a.v - b.v)
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i].v - sorted[i - 1].v) * 12
    if (gap > 0.6 && gap < limits.minSiblingGapMonths) {
      add({
        severity: 'warning', rule: 'Geburtsabstand',
        message: `${label}: nur ${Math.round(gap)} Monate zwischen ${displayName(db.persons[sorted[i - 1].c.personId])} und ${displayName(db.persons[sorted[i].c.personId])}.`,
        familyId: f.id, personId: sorted[i].c.personId,
      })
    }
  }

  // Doppelt eingetragene Kinder
  const seen = new Set<ID>()
  for (const c of f.children) {
    if (seen.has(c.personId)) {
      add({
        severity: 'error', rule: 'Familie',
        message: `${label}: ${displayName(db.persons[c.personId])} ist doppelt als Kind eingetragen.`,
        familyId: f.id, personId: c.personId,
      })
    }
    seen.add(c.personId)
  }

  if (!p1 && !p2 && f.children.length === 0) {
    add({ severity: 'hint', rule: 'Familie', message: 'Leere Familie ohne Partner und Kinder.', familyId: f.id })
  }
}

/** Findet Personen, die zu ihren eigenen Vorfahren gehören. */
function checkCycles(db: Database, add: (i: Omit<Issue, 'id'>) => void) {
  const state = new Map<ID, 0 | 1 | 2>()
  const visit = (id: ID, stack: ID[]): void => {
    const st = state.get(id)
    if (st === 2) return
    if (st === 1) {
      add({
        severity: 'error', rule: 'Ringschluss',
        message: `${displayName(db.persons[id])} ist über ${stack.length} Schritte ein eigener Vorfahre.`,
        personId: id,
      })
      return
    }
    state.set(id, 1)
    const { father, mother } = parentsOf(db, id)
    if (father) visit(father.id, [...stack, id])
    if (mother) visit(mother.id, [...stack, id])
    state.set(id, 2)
  }
  for (const id of Object.keys(db.persons)) visit(id, [])
}

export function summarize(issues: Issue[]) {
  return {
    error: issues.filter((i) => i.severity === 'error').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    hint: issues.filter((i) => i.severity === 'hint').length,
  }
}
