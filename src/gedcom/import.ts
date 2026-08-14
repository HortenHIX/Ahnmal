/**
 * GEDCOM-Import.
 *
 * Übernimmt Personen, Familien, Quellen, Archive, Orte, Medien und Notizen.
 * Was sich nicht in das Modell abbilden lässt, landet als Notiz am Datensatz –
 * lieber unpassend abgelegt als verloren.
 */

import { parseDate } from '../core/dates'
import { uid } from '../core/ids'
import { emptyDatabase } from '../core/types'
import type {
  AttributeType, Citation, Database, EventType, GAttribute, GEvent, ID,
  MediaItem, PedigreeLink, Person, PersonName, Place, Sex, Source, UnionType,
} from '../core/types'
import { child, childrenWith, deref, parseGedcom, value } from './parse'
import type { GedLine } from './parse'

const PERSON_EVENTS: EventType[] = [
  'BIRT', 'CHR', 'DEAT', 'BURI', 'CREM', 'ADOP', 'BAPM', 'BARM', 'BASM', 'BLES',
  'CONF', 'FCOM', 'ORDN', 'NATU', 'EMIG', 'IMMI', 'CENS', 'PROB', 'WILL',
  'GRAD', 'RETI', 'EVEN',
]

const FAMILY_EVENTS: EventType[] = [
  'MARR', 'MARB', 'MARC', 'MARL', 'MARS', 'ENGA', 'DIV', 'DIVF', 'ANUL', 'CENS', 'EVEN',
]

const ATTRIBUTES: AttributeType[] = [
  'OCCU', 'RESI', 'RELI', 'NATI', 'EDUC', 'TITL', 'PROP', 'CAST', 'DSCR',
  'IDNO', 'SSN', 'NCHI', 'NMR', 'FACT',
]

export interface ImportReport {
  db: Database
  counts: {
    persons: number; families: number; sources: number; repositories: number
    places: number; media: number; notes: number
  }
  warnings: string[]
  /** Programm, das die Datei erzeugt hat – hilft beim Deuten von Eigenheiten. */
  producer?: string
  gedcomVersion?: string
}

export function importGedcom(text: string, treeName?: string): ImportReport {
  const { records, warnings } = parseGedcom(text)
  const db = emptyDatabase(treeName ?? 'Import')

  // Kennung aus der Datei → interne Kennung
  const personIds = new Map<string, ID>()
  const familyIds = new Map<string, ID>()
  const sourceIds = new Map<string, ID>()
  const repoIds = new Map<string, ID>()
  const mediaIds = new Map<string, ID>()
  const noteTexts = new Map<string, string>()
  const placeCache = new Map<string, ID>()

  const head = records.find((r) => r.tag === 'HEAD')
  const producer = value(child(head, 'SOUR'), 'NAME') ?? child(head, 'SOUR')?.value
  const gedcomVersion = value(child(head, 'GEDC'), 'VERS')
  const headTreeName = value(head, 'FILE')
  if (headTreeName && !treeName) db.meta.name = headTreeName.replace(/\.ged$/i, '')
  const submitter = records.find((r) => r.tag === 'SUBM')
  if (submitter) db.meta.researcher = value(submitter, 'NAME')

  // Erster Durchgang: Kennungen vergeben, damit Verweise auflösbar sind
  for (const r of records) {
    const key = deref(r.xref)
    if (!key) continue
    switch (r.tag) {
      case 'INDI': personIds.set(key, uid('p')); break
      case 'FAM': familyIds.set(key, uid('f')); break
      case 'SOUR': sourceIds.set(key, uid('s')); break
      case 'REPO': repoIds.set(key, uid('r')); break
      case 'OBJE': mediaIds.set(key, uid('m')); break
      case 'NOTE': noteTexts.set(key, r.value); break
      default: break
    }
  }

  const resolveNote = (node: GedLine): string[] =>
    childrenWith(node, 'NOTE').map((n) => {
      const ref = deref(n.value)
      if (ref && noteTexts.has(ref)) return noteTexts.get(ref)!
      return n.value
    }).filter(Boolean)

  const resolvePlace = (node: GedLine | undefined): { placeId?: ID; placeText?: string } => {
    const pl = child(node, 'PLAC')
    if (!pl || !pl.value.trim()) return {}
    const text = pl.value.trim()
    const existing = placeCache.get(text)
    const map = child(pl, 'MAP')
    const lat = parseCoord(value(map, 'LATI'))
    const lng = parseCoord(value(map, 'LONG'))
    if (existing) {
      // Koordinaten nachtragen, falls sie erst an einem späteren Ereignis stehen
      const place = db.places[existing]
      if (place && lat !== undefined && place.lat === undefined) {
        place.lat = lat
        place.lng = lng
      }
      return { placeId: existing, placeText: text }
    }
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean)
    const id = uid('pl')
    const place: Place = {
      id,
      name: parts[0] ?? text,
      hierarchy: parts.slice(1),
      notes: resolveNote(pl),
      created: Date.now(),
      changed: Date.now(),
    }
    if (lat !== undefined) place.lat = lat
    if (lng !== undefined) place.lng = lng
    db.places[id] = place
    placeCache.set(text, id)
    return { placeId: id, placeText: text }
  }

  const resolveCitations = (node: GedLine): Citation[] => {
    const out: Citation[] = []
    for (const s of childrenWith(node, 'SOUR')) {
      const ref = deref(s.value)
      const sid = ref ? sourceIds.get(ref) : undefined
      if (!sid) {
        // Quellenangabe im Fließtext ohne eigenen Satz – als Quelle anlegen
        if (s.value.trim()) {
          const id = uid('s')
          db.sources[id] = {
            id, title: s.value.trim().slice(0, 200), mediaIds: [], notes: [],
            created: Date.now(), changed: Date.now(),
          }
          out.push({ id: uid('c'), sourceId: id, page: value(s, 'PAGE'), text: value(child(s, 'DATA'), 'TEXT') })
        }
        continue
      }
      const quay = value(s, 'QUAY')
      const c: Citation = {
        id: uid('c'),
        sourceId: sid,
        page: value(s, 'PAGE'),
        text: value(child(s, 'DATA'), 'TEXT') ?? value(s, 'TEXT'),
        date: parseDate(value(child(s, 'DATA'), 'DATE')) ?? undefined,
        mediaIds: childrenWith(s, 'OBJE').map((o) => mediaIds.get(deref(o.value) ?? '')).filter(Boolean) as ID[],
      }
      if (quay && /^[0-3]$/.test(quay)) c.confidence = Number(quay) as 0 | 1 | 2 | 3
      const notes = resolveNote(s)
      if (notes.length) c.note = notes.join('\n')
      out.push(c)
    }
    return out
  }

  const resolveMediaRefs = (node: GedLine): ID[] => {
    const out: ID[] = []
    for (const o of childrenWith(node, 'OBJE')) {
      const ref = deref(o.value)
      if (ref && mediaIds.has(ref)) { out.push(mediaIds.get(ref)!); continue }
      // Eingebettetes Medium ohne eigenen Satz
      const file = value(o, 'FILE')
      if (!file) continue
      const id = uid('m')
      db.media[id] = {
        id,
        title: value(o, 'TITL') ?? file.split(/[\\/]/).pop() ?? 'Medium',
        mime: guessMime(file),
        path: file,
        notes: resolveNote(o),
        created: Date.now(), changed: Date.now(),
      }
      out.push(id)
    }
    return out
  }

  const buildEvent = (node: GedLine, type: EventType): GEvent => {
    const e: GEvent = {
      id: uid('e'),
      type,
      date: parseDate(value(node, 'DATE')) ?? undefined,
      ...resolvePlace(node),
      description: node.value.trim() && node.value.trim() !== 'Y' ? node.value.trim() : undefined,
      agency: value(node, 'AGNC'),
      cause: value(node, 'CAUS'),
      age: value(node, 'AGE'),
      citations: resolveCitations(node),
      mediaIds: resolveMediaRefs(node),
    }
    if (type === 'EVEN') e.label = value(node, 'TYPE') ?? (node.value.trim() || 'Ereignis')
    const notes = resolveNote(node)
    if (notes.length) e.note = notes.join('\n')
    // Paten und Trauzeugen stehen je nach Programm in ASSO oder _WITN
    const witnesses = [...childrenWith(node, 'ASSO', '_ASSO', '_WITN')].map((w) => {
      const ref = deref(w.value)
      const pid = ref ? personIds.get(ref) : undefined
      return { personId: pid, name: pid ? undefined : w.value.trim() || undefined, role: value(w, 'RELA') ?? 'Zeuge' }
    })
    if (witnesses.length) e.witnesses = witnesses
    return e
  }

  // Zweiter Durchgang: Inhalte übernehmen
  for (const r of records) {
    const key = deref(r.xref)
    switch (r.tag) {
      case 'REPO': {
        if (!key) break
        const id = repoIds.get(key)!
        const addr = child(r, 'ADDR')
        db.repositories[id] = {
          id, xref: r.xref, name: value(r, 'NAME') ?? 'Archiv',
          address: [addr?.value, value(addr, 'ADR1'), value(addr, 'ADR2'), value(addr, 'CITY'), value(addr, 'POST'), value(addr, 'CTRY')]
            .filter(Boolean).join(', ') || undefined,
          phone: value(r, 'PHON'), email: value(r, 'EMAIL'), url: value(r, 'WWW'),
          notes: resolveNote(r), created: Date.now(), changed: Date.now(),
        }
        break
      }
      case 'OBJE': {
        if (!key) break
        const id = mediaIds.get(key)!
        const fileNode = child(r, 'FILE')
        const file = fileNode?.value ?? ''
        const m: MediaItem = {
          id, xref: r.xref,
          title: value(r, 'TITL') ?? value(fileNode, 'TITL') ?? file.split(/[\\/]/).pop() ?? 'Medium',
          mime: guessMime(file || value(child(fileNode, 'FORM'), '') || ''),
          path: file || undefined,
          notes: resolveNote(r), created: Date.now(), changed: Date.now(),
        }
        db.media[id] = m
        break
      }
      default: break
    }
  }

  for (const r of records) {
    const key = deref(r.xref)
    if (r.tag !== 'SOUR' || !key) continue
    const id = sourceIds.get(key)!
    const data = child(r, 'DATA')
    const repoRef = child(r, 'REPO')
    const src: Source = {
      id, xref: r.xref,
      title: value(r, 'TITL') ?? value(r, 'ABBR') ?? 'Quelle',
      author: value(r, 'AUTH'),
      publication: value(r, 'PUBL'),
      text: value(r, 'TEXT') ?? value(data, 'TEXT'),
      repositoryId: repoIds.get(deref(repoRef?.value) ?? ''),
      callNumber: value(repoRef, 'CALN'),
      url: value(r, 'WWW'),
      mediaIds: resolveMediaRefs(r),
      notes: resolveNote(r),
      created: Date.now(), changed: Date.now(),
    }
    // Zeitraum aus DATA/EVEN/DATE ableiten, soweit vorhanden
    const evenDate = parseDate(value(child(data, 'EVEN'), 'DATE'))
    if (evenDate?.from?.year) src.coversFrom = evenDate.from.year
    if (evenDate?.to?.year) src.coversTo = evenDate.to.year
    db.sources[id] = src
  }

  for (const r of records) {
    const key = deref(r.xref)
    if (r.tag !== 'INDI' || !key) continue
    const id = personIds.get(key)!
    const person: Person = {
      id, xref: r.xref,
      names: [], sex: readSex(value(r, 'SEX')),
      events: [], attributes: [], childOf: [], spouseIn: [],
      mediaIds: resolveMediaRefs(r),
      citations: resolveCitations(r),
      notes: resolveNote(r),
      created: Date.now(), changed: Date.now(),
    }

    for (const n of childrenWith(r, 'NAME')) {
      person.names.push(readName(n, resolveCitations))
    }
    if (!person.names.length) person.names.push({ id: uid('n'), type: 'birth', primary: true })
    person.names[0].primary = true

    for (const c of r.children) {
      if (PERSON_EVENTS.includes(c.tag as EventType)) {
        person.events.push(buildEvent(c, c.tag as EventType))
      } else if (ATTRIBUTES.includes(c.tag as AttributeType)) {
        const attr: GAttribute = {
          id: uid('a'), type: c.tag as AttributeType, value: c.value.trim(),
          date: parseDate(value(c, 'DATE')) ?? undefined,
          ...resolvePlace(c),
          citations: resolveCitations(c),
        }
        const notes = resolveNote(c)
        if (notes.length) attr.note = notes.join('\n')
        person.attributes.push(attr)
      } else if (c.tag === '_UID' || c.tag === 'RIN' || c.tag === 'REFN') {
        // Programmeigene Kennungen als Notiz sichern
        if (c.value.trim()) person.notes.push(`${c.tag}: ${c.value.trim()}`)
      }
    }

    db.persons[id] = person
  }

  for (const r of records) {
    const key = deref(r.xref)
    if (r.tag !== 'FAM' || !key) continue
    const id = familyIds.get(key)!
    const husb = personIds.get(deref(value(r, 'HUSB')) ?? '')
    const wife = personIds.get(deref(value(r, 'WIFE')) ?? '')

    const events = r.children
      .filter((c) => FAMILY_EVENTS.includes(c.tag as EventType))
      .map((c) => buildEvent(c, c.tag as EventType))

    const children = childrenWith(r, 'CHIL')
      .map((c) => personIds.get(deref(c.value) ?? ''))
      .filter(Boolean)
      .map((pid) => ({ personId: pid as ID }))

    db.families[id] = {
      id, xref: r.xref,
      partner1: husb, partner2: wife,
      unionType: readUnionType(r, events),
      children,
      events,
      mediaIds: resolveMediaRefs(r),
      citations: resolveCitations(r),
      notes: resolveNote(r),
      created: Date.now(), changed: Date.now(),
    }

    for (const pid of [husb, wife]) {
      if (pid && db.persons[pid]) db.persons[pid].spouseIn.push(id)
    }
    for (const c of children) {
      if (db.persons[c.personId]) db.persons[c.personId].childOf.push(id)
    }
  }

  // Art der Kindschaft aus den FAMC-Zeilen der Person nachtragen
  for (const r of records) {
    const key = deref(r.xref)
    if (r.tag !== 'INDI' || !key) continue
    const pid = personIds.get(key)!
    for (const famc of childrenWith(r, 'FAMC')) {
      const fid = familyIds.get(deref(famc.value) ?? '')
      if (!fid) continue
      const fam = db.families[fid]
      if (!fam) continue
      const ref = fam.children.find((c) => c.personId === pid)
      const pedi = (value(famc, 'PEDI') ?? '').toLowerCase()
      if (ref && pedi) {
        const rel = readPedigree(pedi)
        ref.fatherRel = rel
        ref.motherRel = rel
      }
      // Kind, das nur über FAMC verknüpft ist, in die Familie aufnehmen
      if (!ref) {
        fam.children.push({ personId: pid })
        if (!db.persons[pid].childOf.includes(fid)) db.persons[pid].childOf.push(fid)
      }
    }
  }

  // Wurzelperson: die Person mit den meisten erfassten Vorfahren
  db.meta.rootPersonId = pickRoot(db)

  return {
    db,
    counts: {
      persons: Object.keys(db.persons).length,
      families: Object.keys(db.families).length,
      sources: Object.keys(db.sources).length,
      repositories: Object.keys(db.repositories).length,
      places: Object.keys(db.places).length,
      media: Object.keys(db.media).length,
      notes: noteTexts.size,
    },
    warnings,
    producer,
    gedcomVersion,
  }
}

// ---------------------------------------------------------------------------

function readName(n: GedLine, cites: (node: GedLine) => Citation[]): PersonName {
  const name: PersonName = { id: uid('n'), type: readNameType(value(n, 'TYPE')) }
  // Aufgeteilte Form hat Vorrang, weil sie eindeutig ist
  const given = value(n, 'GIVN')
  const surn = value(n, 'SURN')
  if (given || surn) {
    name.given = given
    name.surname = surn
  } else {
    // Klassische Schrägstrichform: Johann /Müller/
    const m = n.value.match(/^([^/]*)\/([^/]*)\/(.*)$/)
    if (m) {
      name.given = m[1].trim() || undefined
      name.surname = m[2].trim() || undefined
      const rest = m[3].trim()
      if (rest) name.suffix = rest
    } else if (n.value.trim()) {
      name.given = n.value.trim()
    }
  }
  name.prefix = value(n, 'NPFX')
  name.surnamePrefix = value(n, 'SPFX')
  name.suffix = name.suffix ?? value(n, 'NSFX')
  name.nickname = value(n, 'NICK')
  const c = cites(n)
  if (c.length) name.citations = c
  return name
}

function readNameType(t: string | undefined): PersonName['type'] {
  switch ((t ?? '').toLowerCase()) {
    case 'birth': return 'birth'
    case 'married': return 'married'
    case 'religious': return 'religious'
    case 'aka': case 'also known as': return 'aka'
    case 'immigrant': return 'immigrant'
    default: return t ? 'aka' : 'birth'
  }
}

function readSex(s: string | undefined): Sex {
  switch ((s ?? '').toUpperCase()) {
    case 'M': return 'M'
    case 'F': return 'F'
    case 'X': return 'X'
    default: return 'U'
  }
}

function readPedigree(p: string): PedigreeLink {
  switch (p) {
    case 'adopted': return 'adopted'
    case 'foster': return 'foster'
    case 'step': return 'step'
    case 'sealing': return 'sealing'
    case 'birth': return 'birth'
    default: return 'unknown'
  }
}

function readUnionType(r: GedLine, events: GEvent[]): UnionType {
  if (events.some((e) => e.type === 'MARR')) return 'married'
  if (events.some((e) => e.type === 'ENGA')) return 'engaged'
  const rel = value(r, '_MSTAT') ?? value(r, '_STAT') ?? ''
  if (/unmarried|nicht verheiratet|ledig/i.test(rel)) return 'unmarried'
  return 'unknown'
}

function parseCoord(v: string | undefined): number | undefined {
  if (!v) return undefined
  const m = v.trim().match(/^([NSEWnsew])?\s*(-?[\d.]+)$/)
  if (!m) return undefined
  const num = parseFloat(m[2])
  if (!Number.isFinite(num)) return undefined
  const hemi = (m[1] ?? '').toUpperCase()
  return hemi === 'S' || hemi === 'W' ? -num : num
}

function guessMime(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', webp: 'image/webp',
    pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4', txt: 'text/plain',
  }
  return map[ext] ?? 'application/octet-stream'
}

/** Wählt die Person mit der tiefsten bekannten Ahnenreihe als Ausgangspunkt. */
function pickRoot(db: Database): ID | undefined {
  let best: { id: ID; count: number } | null = null
  for (const p of Object.values(db.persons)) {
    // Günstige Näherung: Zahl der Ereignisse plus Elternverknüpfung
    const score = p.childOf.length * 3 + p.events.length + p.citations.length
    if (!best || score > best.count) best = { id: p.id, count: score }
  }
  return best?.id
}
