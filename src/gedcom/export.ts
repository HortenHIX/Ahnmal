/**
 * GEDCOM-Export.
 *
 * Erzeugt GEDCOM 5.5.1 in UTF-8 – das Format, das jedes andere Programm liest.
 * Optional lassen sich Daten lebender Personen zurückhalten; wer einen Baum
 * weitergibt oder hochlädt, darf die Angaben lebender Verwandter nicht
 * mitschicken.
 */

import { dateToGedcom } from '../core/dates'
import { isProbablyLiving, primaryName } from '../core/model'
import type { Citation, Database, GEvent, ID, Person } from '../core/types'

export interface ExportOptions {
  /** Lebende Personen nur als „Lebend“ ohne Daten ausgeben. */
  privatizeLiving: boolean
  includeSources: boolean
  includeMedia: boolean
  includeNotes: boolean
  /** Nur die Vorfahren und Nachkommen dieser Person ausgeben. */
  limitToPersonIds?: Set<ID>
  submitter?: string
}

export const DEFAULT_EXPORT: ExportOptions = {
  privatizeLiving: true,
  includeSources: true,
  includeMedia: true,
  includeNotes: true,
}

class Writer {
  lines: string[] = []
  add(level: number, tag: string, value?: string, xref?: string) {
    const parts = [String(level)]
    if (xref) parts.push(xref)
    parts.push(tag)
    if (value !== undefined && value !== '') {
      // Mehrzeilige Werte werden über CONT fortgesetzt, lange über CONC
      const chunks = String(value).split('\n')
      parts.push(chunks[0].slice(0, 200))
      this.lines.push(parts.join(' '))
      for (let i = 0; i < chunks.length; i++) {
        const rest = i === 0 ? chunks[0].slice(200) : chunks[i]
        if (i > 0) this.lines.push(`${level + 1} CONT ${rest.slice(0, 200)}`)
        let tail = i > 0 ? rest.slice(200) : rest
        while (tail.length) {
          this.lines.push(`${level + 1} CONC ${tail.slice(0, 200)}`)
          tail = tail.slice(200)
        }
      }
      return
    }
    this.lines.push(parts.join(' '))
  }
  text(): string {
    return this.lines.join('\n') + '\n'
  }
}

export function exportGedcom(db: Database, opts: ExportOptions = DEFAULT_EXPORT): string {
  const w = new Writer()

  const include = (id: ID) => !opts.limitToPersonIds || opts.limitToPersonIds.has(id)

  // Kennungen vergeben
  const pref = new Map<ID, string>()
  const fref = new Map<ID, string>()
  const sref = new Map<ID, string>()
  const rref = new Map<ID, string>()
  const oref = new Map<ID, string>()

  let n = 1
  for (const p of Object.values(db.persons)) { if (include(p.id)) pref.set(p.id, `@I${n++}@`) }
  n = 1
  for (const f of Object.values(db.families)) {
    const partners = [f.partner1, f.partner2].filter(Boolean) as ID[]
    const kids = f.children.map((c) => c.personId)
    if ([...partners, ...kids].some(include)) fref.set(f.id, `@F${n++}@`)
  }
  n = 1
  if (opts.includeSources) {
    for (const s of Object.values(db.sources)) sref.set(s.id, `@S${n++}@`)
    n = 1
    for (const r of Object.values(db.repositories)) rref.set(r.id, `@R${n++}@`)
  }
  n = 1
  if (opts.includeMedia) {
    for (const m of Object.values(db.media)) oref.set(m.id, `@O${n++}@`)
  }

  // Kopf
  w.add(0, 'HEAD')
  w.add(1, 'SOUR', 'WAPPENBRIEF')
  w.add(2, 'NAME', 'Wappenbrief – Ahnenforschung und Heraldik')
  w.add(2, 'VERS', '1.0')
  w.add(1, 'DEST', 'ANY')
  w.add(1, 'DATE', formatToday())
  w.add(2, 'TIME', new Date().toTimeString().slice(0, 8))
  w.add(1, 'SUBM', '@SUB1@')
  w.add(1, 'FILE', `${sanitize(db.meta.name)}.ged`)
  w.add(1, 'GEDC')
  w.add(2, 'VERS', '5.5.1')
  w.add(2, 'FORM', 'LINEAGE-LINKED')
  w.add(1, 'CHAR', 'UTF-8')
  if (db.meta.description) w.add(1, 'NOTE', db.meta.description)

  w.add(0, 'SUBM', undefined, '@SUB1@')
  w.add(1, 'NAME', opts.submitter ?? db.meta.researcher ?? 'Unbekannt')

  // Personen
  for (const p of Object.values(db.persons)) {
    const xr = pref.get(p.id)
    if (!xr) continue
    const hide = opts.privatizeLiving && isProbablyLiving(p)
    w.add(0, 'INDI', undefined, xr)
    writePerson(w, db, p, hide, { sref, oref, opts })
    for (const fid of p.childOf) {
      const fx = fref.get(fid)
      if (!fx) continue
      w.add(1, 'FAMC', fx)
      const rel = db.families[fid]?.children.find((c) => c.personId === p.id)?.fatherRel
      if (rel && rel !== 'birth' && rel !== 'unknown') w.add(2, 'PEDI', rel)
    }
    for (const fid of p.spouseIn) {
      const fx = fref.get(fid)
      if (fx) w.add(1, 'FAMS', fx)
    }
    w.add(1, 'CHAN')
    w.add(2, 'DATE', formatToday(p.changed))
  }

  // Familien
  for (const f of Object.values(db.families)) {
    const xr = fref.get(f.id)
    if (!xr) continue
    w.add(0, 'FAM', undefined, xr)
    const p1 = f.partner1 ? db.persons[f.partner1] : undefined
    const p2 = f.partner2 ? db.persons[f.partner2] : undefined
    // GEDCOM kennt nur HUSB und WIFE; die Zuordnung folgt dem Geschlecht
    const husb = p1?.sex === 'F' ? p2 : p1
    const wife = p1?.sex === 'F' ? p1 : p2
    if (husb && pref.get(husb.id)) w.add(1, 'HUSB', pref.get(husb.id))
    if (wife && pref.get(wife.id)) w.add(1, 'WIFE', pref.get(wife.id))
    for (const c of f.children) {
      const cx = pref.get(c.personId)
      if (cx) w.add(1, 'CHIL', cx)
    }
    const hideFamily = opts.privatizeLiving && [p1, p2].some((p) => p && isProbablyLiving(p))
    if (!hideFamily) {
      for (const e of f.events) writeEvent(w, db, e, 1, { sref, oref, opts })
    }
    if (opts.includeNotes) for (const note of f.notes) w.add(1, 'NOTE', note)
    if (opts.includeSources) for (const c of f.citations) writeCitation(w, c, 1, sref, oref)
  }

  // Quellen
  if (opts.includeSources) {
    for (const s of Object.values(db.sources)) {
      const xr = sref.get(s.id)
      if (!xr) continue
      w.add(0, 'SOUR', undefined, xr)
      if (s.title) w.add(1, 'TITL', s.title)
      if (s.author) w.add(1, 'AUTH', s.author)
      if (s.publication) w.add(1, 'PUBL', s.publication)
      if (s.text) w.add(1, 'TEXT', s.text)
      if (s.url) w.add(1, 'WWW', s.url)
      if (s.repositoryId && rref.get(s.repositoryId)) {
        w.add(1, 'REPO', rref.get(s.repositoryId))
        if (s.callNumber) w.add(2, 'CALN', s.callNumber)
      }
      if (opts.includeNotes) for (const note of s.notes) w.add(1, 'NOTE', note)
      if (opts.includeMedia) for (const m of s.mediaIds) { if (oref.get(m)) w.add(1, 'OBJE', oref.get(m)) }
    }

    for (const r of Object.values(db.repositories)) {
      const xr = rref.get(r.id)
      if (!xr) continue
      w.add(0, 'REPO', undefined, xr)
      w.add(1, 'NAME', r.name)
      if (r.address) w.add(1, 'ADDR', r.address)
      if (r.phone) w.add(1, 'PHON', r.phone)
      if (r.email) w.add(1, 'EMAIL', r.email)
      if (r.url) w.add(1, 'WWW', r.url)
      if (opts.includeNotes) for (const note of r.notes) w.add(1, 'NOTE', note)
    }
  }

  // Medien
  if (opts.includeMedia) {
    for (const m of Object.values(db.media)) {
      const xr = oref.get(m.id)
      if (!xr) continue
      w.add(0, 'OBJE', undefined, xr)
      w.add(1, 'FILE', m.path ?? `${sanitize(m.title)}`)
      w.add(2, 'FORM', m.mime.split('/')[1] ?? 'jpg')
      w.add(2, 'TITL', m.title)
      if (opts.includeNotes) for (const note of m.notes) w.add(1, 'NOTE', note)
    }
  }

  w.add(0, 'TRLR')
  return w.text()
}

interface Ctx {
  sref: Map<ID, string>
  oref: Map<ID, string>
  opts: ExportOptions
}

function writePerson(w: Writer, db: Database, p: Person, hide: boolean, ctx: Ctx) {
  const nm = primaryName(p)
  if (hide) {
    // Nur der Familienname bleibt stehen, damit die Struktur lesbar ist
    w.add(1, 'NAME', `Lebend /${nm?.surname ?? ''}/`)
    w.add(1, 'SEX', p.sex)
    w.add(1, 'NOTE', 'Angaben zurückgehalten: Person lebt vermutlich noch.')
    return
  }
  for (const name of p.names) {
    const g = name.given ?? ''
    const s = name.surname ?? ''
    w.add(1, 'NAME', `${g} /${s}/${name.suffix ? ' ' + name.suffix : ''}`.trim())
    if (name.type !== 'birth') w.add(2, 'TYPE', name.type)
    if (name.prefix) w.add(2, 'NPFX', name.prefix)
    if (name.given) w.add(2, 'GIVN', name.given)
    if (name.surnamePrefix) w.add(2, 'SPFX', name.surnamePrefix)
    if (name.surname) w.add(2, 'SURN', name.surname)
    if (name.suffix) w.add(2, 'NSFX', name.suffix)
    if (name.nickname) w.add(2, 'NICK', name.nickname)
  }
  w.add(1, 'SEX', p.sex)
  for (const e of p.events) writeEvent(w, db, e, 1, ctx)
  for (const a of p.attributes) {
    w.add(1, a.type, a.value)
    if (a.date) w.add(2, 'DATE', dateToGedcom(a.date))
    const place = a.placeText ?? (a.placeId ? db.places[a.placeId]?.name : undefined)
    if (place) w.add(2, 'PLAC', place)
    if (ctx.opts.includeSources) for (const c of a.citations ?? []) writeCitation(w, c, 2, ctx.sref, ctx.oref)
  }
  if (ctx.opts.includeNotes) for (const note of p.notes) w.add(1, 'NOTE', note)
  if (ctx.opts.includeSources) for (const c of p.citations) writeCitation(w, c, 1, ctx.sref, ctx.oref)
  if (ctx.opts.includeMedia) for (const m of p.mediaIds) { if (ctx.oref.get(m)) w.add(1, 'OBJE', ctx.oref.get(m)) }
}

function writeEvent(w: Writer, db: Database, e: GEvent, level: number, ctx: Ctx) {
  w.add(level, e.type, e.description ?? (e.date || e.placeId || e.placeText ? undefined : 'Y'))
  if (e.type === 'EVEN' && e.label) w.add(level + 1, 'TYPE', e.label)
  if (e.date) w.add(level + 1, 'DATE', dateToGedcom(e.date))
  const place = e.placeText ?? (e.placeId ? fullPlace(db, e.placeId) : undefined)
  if (place) {
    w.add(level + 1, 'PLAC', place)
    const pl = e.placeId ? db.places[e.placeId] : undefined
    if (pl?.lat !== undefined && pl.lng !== undefined) {
      w.add(level + 2, 'MAP')
      w.add(level + 3, 'LATI', `${pl.lat >= 0 ? 'N' : 'S'}${Math.abs(pl.lat).toFixed(6)}`)
      w.add(level + 3, 'LONG', `${pl.lng >= 0 ? 'E' : 'W'}${Math.abs(pl.lng).toFixed(6)}`)
    }
  }
  if (e.age) w.add(level + 1, 'AGE', e.age)
  if (e.agency) w.add(level + 1, 'AGNC', e.agency)
  if (e.cause) w.add(level + 1, 'CAUS', e.cause)
  if (ctx.opts.includeNotes && e.note) w.add(level + 1, 'NOTE', e.note)
  if (ctx.opts.includeSources) for (const c of e.citations ?? []) writeCitation(w, c, level + 1, ctx.sref, ctx.oref)
  if (ctx.opts.includeMedia) for (const m of e.mediaIds ?? []) { if (ctx.oref.get(m)) w.add(level + 1, 'OBJE', ctx.oref.get(m)) }
}

function writeCitation(w: Writer, c: Citation, level: number, sref: Map<ID, string>, oref: Map<ID, string>) {
  const xr = sref.get(c.sourceId)
  if (!xr) return
  w.add(level, 'SOUR', xr)
  if (c.page) w.add(level + 1, 'PAGE', c.page)
  if (c.date || c.text) {
    w.add(level + 1, 'DATA')
    if (c.date) w.add(level + 2, 'DATE', dateToGedcom(c.date))
    if (c.text) w.add(level + 2, 'TEXT', c.text)
  }
  if (c.confidence !== undefined) w.add(level + 1, 'QUAY', String(c.confidence))
  if (c.note) w.add(level + 1, 'NOTE', c.note)
  for (const m of c.mediaIds ?? []) { if (oref.get(m)) w.add(level + 1, 'OBJE', oref.get(m)) }
}

function fullPlace(db: Database, id: ID): string | undefined {
  const pl = db.places[id]
  if (!pl) return undefined
  return [pl.name, ...(pl.hierarchy ?? [])].filter(Boolean).join(', ')
}

function formatToday(ts?: number): string {
  const d = ts ? new Date(ts) : new Date()
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function sanitize(s: string): string {
  return s.replace(/[^\w äöüÄÖÜß-]/g, '').trim() || 'stammbaum'
}
