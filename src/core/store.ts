/**
 * Anwendungszustand.
 *
 * Änderungen laufen ausnahmslos über `apply`. Das hält Rückgängig/Wiederholen
 * und die automatische Ablage an einer Stelle zusammen – bei einem Datenmodell
 * mit so vielen Querverweisen ist alles andere fehleranfällig.
 */

import { create } from 'zustand'
import { loadLast, saveTree } from './db'
import { newFamily, newPerson } from './model'
import { emptyDatabase } from './types'
import type {
  Arms, Database, Family, ID, MediaItem, Person, Place, Repository,
  ResearchLogEntry, ResearchTask, Source,
} from './types'

export type ViewKey =
  | 'dashboard' | 'people' | 'person' | 'pedigree' | 'fan' | 'descendants'
  | 'hourglass' | 'timeline' | 'map' | 'stats' | 'sources' | 'places'
  | 'media' | 'tasks' | 'log' | 'validate' | 'duplicates' | 'relations'
  | 'heraldry' | 'armorial' | 'reports' | 'print' | 'settings' | 'gedcom'

export interface Settings {
  /** Daten lebender Personen in Diagrammen und Exporten verbergen. */
  privacyMode: boolean
  /** Generationen in der Ahnentafel. */
  pedigreeGenerations: number
  fanGenerations: number
  descendantGenerations: number
  dateFormatLong: boolean
  theme: 'light' | 'dark' | 'system'
  /** Anzeige der Kekulé-Nummern in Diagrammen. */
  showKekule: boolean
  showLifespans: boolean
  showArms: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  privacyMode: true,
  pedigreeGenerations: 5,
  fanGenerations: 6,
  descendantGenerations: 4,
  dateFormatLong: false,
  theme: 'system',
  showKekule: true,
  showLifespans: true,
  showArms: true,
}

interface HistoryEntry {
  label: string
  db: Database
}

interface State {
  db: Database
  view: ViewKey
  selectedPerson?: ID
  selectedFamily?: ID
  selectedArms?: ID
  settings: Settings
  past: HistoryEntry[]
  future: HistoryEntry[]
  dirty: boolean
  ready: boolean
  toast?: { text: string; kind: 'info' | 'error' | 'success' }

  init: () => Promise<void>
  apply: (label: string, fn: (db: Database) => Database) => void
  replaceDatabase: (db: Database, label: string) => void
  undo: () => void
  redo: () => void
  save: () => Promise<void>
  setView: (v: ViewKey) => void
  selectPerson: (id: ID | undefined, view?: ViewKey) => void
  selectFamily: (id: ID | undefined) => void
  selectArms: (id: ID | undefined) => void
  setSettings: (s: Partial<Settings>) => void
  notify: (text: string, kind?: 'info' | 'error' | 'success') => void

  // Bequemlichkeitsoperationen
  addPerson: (partial?: Partial<Person>) => ID
  updatePerson: (id: ID, patch: Partial<Person>) => void
  deletePerson: (id: ID) => void
  addFamily: (partial?: Partial<Family>) => ID
  updateFamily: (id: ID, patch: Partial<Family>) => void
  deleteFamily: (id: ID) => void
  linkChild: (familyId: ID, personId: ID) => void
  unlinkChild: (familyId: ID, personId: ID) => void
  setPartner: (familyId: ID, slot: 1 | 2, personId: ID | undefined) => void
  upsertSource: (s: Source) => void
  upsertRepository: (r: Repository) => void
  upsertPlace: (p: Place) => void
  upsertMedia: (m: MediaItem) => void
  upsertArms: (a: Arms) => void
  deleteRecord: (kind: 'sources' | 'repositories' | 'places' | 'media' | 'arms' | 'tasks' | 'log', id: ID) => void
  upsertTask: (t: ResearchTask) => void
  upsertLog: (l: ResearchLogEntry) => void
}

const HISTORY_LIMIT = 60

let saveTimer: ReturnType<typeof setTimeout> | null = null

const SETTINGS_KEY = 'wappenbrief.settings'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export const useStore = create<State>((set, get) => ({
  db: emptyDatabase(),
  view: 'dashboard',
  settings: loadSettings(),
  past: [],
  future: [],
  dirty: false,
  ready: false,

  async init() {
    const db = await loadLast()
    set({ db, ready: true, selectedPerson: db.meta.rootPersonId })
  },

  apply(label, fn) {
    const { db, past } = get()
    const next = fn(db)
    if (next === db) return
    next.meta = { ...next.meta, changed: Date.now() }
    set({
      db: next,
      past: [...past.slice(-HISTORY_LIMIT + 1), { label, db }],
      future: [],
      dirty: true,
    })
    scheduleSave(get)
  },

  replaceDatabase(db, label) {
    const prev = get().db
    // Die bisherige Auswahl gibt es im neuen Bestand meist nicht mehr; ohne
    // Nachführen stünde das Personenblatt leer da
    const current = get().selectedPerson
    const selectedPerson = current && db.persons[current]
      ? current
      : db.meta.rootPersonId ?? Object.keys(db.persons)[0]
    set({
      db,
      selectedPerson,
      selectedFamily: undefined,
      selectedArms: undefined,
      past: [...get().past.slice(-HISTORY_LIMIT + 1), { label, db: prev }],
      future: [],
      dirty: true,
    })
    scheduleSave(get)
  },

  undo() {
    const { past, future, db } = get()
    if (!past.length) return
    const last = past[past.length - 1]
    set({ db: last.db, past: past.slice(0, -1), future: [{ label: last.label, db }, ...future], dirty: true })
    scheduleSave(get)
  },

  redo() {
    const { past, future, db } = get()
    if (!future.length) return
    const next = future[0]
    set({ db: next.db, future: future.slice(1), past: [...past, { label: next.label, db }], dirty: true })
    scheduleSave(get)
  },

  async save() {
    await saveTree(get().db)
    set({ dirty: false })
  },

  setView(view) { set({ view }) },

  selectPerson(id, view) {
    set({ selectedPerson: id, ...(view ? { view } : {}) })
  },

  selectFamily(id) { set({ selectedFamily: id }) },
  selectArms(id) { set({ selectedArms: id }) },

  setSettings(s) {
    const settings = { ...get().settings, ...s }
    set({ settings })
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* Speicher voll oder gesperrt */ }
  },

  notify(text, kind = 'info') {
    set({ toast: { text, kind } })
    setTimeout(() => {
      if (get().toast?.text === text) set({ toast: undefined })
    }, 4000)
  },

  // -------------------------------------------------------------------------

  addPerson(partial = {}) {
    const p = newPerson(partial)
    get().apply('Person angelegt', (db) => ({ ...db, persons: { ...db.persons, [p.id]: p } }))
    return p.id
  },

  updatePerson(id, patch) {
    get().apply('Person bearbeitet', (db) => {
      const cur = db.persons[id]
      if (!cur) return db
      return { ...db, persons: { ...db.persons, [id]: { ...cur, ...patch, changed: Date.now() } } }
    })
  },

  deletePerson(id) {
    get().apply('Person gelöscht', (db) => {
      const persons = { ...db.persons }
      delete persons[id]
      const families = { ...db.families }
      for (const f of Object.values(families)) {
        let nf = f
        if (f.partner1 === id) nf = { ...nf, partner1: undefined }
        if (f.partner2 === id) nf = { ...nf, partner2: undefined }
        if (f.children.some((c) => c.personId === id)) {
          nf = { ...nf, children: nf.children.filter((c) => c.personId !== id) }
        }
        if (nf !== f) families[f.id] = nf
      }
      // Familien, von denen nichts übrig bleibt, verschwinden mit
      for (const f of Object.values(families)) {
        if (!f.partner1 && !f.partner2 && f.children.length === 0) delete families[f.id]
      }
      for (const p of Object.values(persons)) {
        const childOf = p.childOf.filter((fid) => families[fid])
        const spouseIn = p.spouseIn.filter((fid) => families[fid])
        if (childOf.length !== p.childOf.length || spouseIn.length !== p.spouseIn.length) {
          persons[p.id] = { ...p, childOf, spouseIn }
        }
      }
      const meta = db.meta.rootPersonId === id ? { ...db.meta, rootPersonId: undefined } : db.meta
      return { ...db, persons, families, meta }
    })
    if (get().selectedPerson === id) set({ selectedPerson: undefined })
  },

  addFamily(partial = {}) {
    const f = newFamily(partial)
    get().apply('Familie angelegt', (db) => {
      const persons = { ...db.persons }
      for (const pid of [f.partner1, f.partner2]) {
        if (pid && persons[pid]) {
          persons[pid] = { ...persons[pid], spouseIn: [...new Set([...persons[pid].spouseIn, f.id])] }
        }
      }
      for (const c of f.children) {
        if (persons[c.personId]) {
          persons[c.personId] = { ...persons[c.personId], childOf: [...new Set([...persons[c.personId].childOf, f.id])] }
        }
      }
      return { ...db, persons, families: { ...db.families, [f.id]: f } }
    })
    return f.id
  },

  updateFamily(id, patch) {
    get().apply('Familie bearbeitet', (db) => {
      const cur = db.families[id]
      if (!cur) return db
      return { ...db, families: { ...db.families, [id]: { ...cur, ...patch, changed: Date.now() } } }
    })
  },

  deleteFamily(id) {
    get().apply('Familie gelöscht', (db) => {
      const families = { ...db.families }
      delete families[id]
      const persons = { ...db.persons }
      for (const p of Object.values(persons)) {
        if (p.childOf.includes(id) || p.spouseIn.includes(id)) {
          persons[p.id] = {
            ...p,
            childOf: p.childOf.filter((f) => f !== id),
            spouseIn: p.spouseIn.filter((f) => f !== id),
          }
        }
      }
      return { ...db, families, persons }
    })
  },

  linkChild(familyId, personId) {
    get().apply('Kind zugeordnet', (db) => {
      const f = db.families[familyId]
      const p = db.persons[personId]
      if (!f || !p || f.children.some((c) => c.personId === personId)) return db
      return {
        ...db,
        families: { ...db.families, [familyId]: { ...f, children: [...f.children, { personId }], changed: Date.now() } },
        persons: { ...db.persons, [personId]: { ...p, childOf: [...new Set([...p.childOf, familyId])], changed: Date.now() } },
      }
    })
  },

  unlinkChild(familyId, personId) {
    get().apply('Kindzuordnung gelöst', (db) => {
      const f = db.families[familyId]
      const p = db.persons[personId]
      if (!f || !p) return db
      return {
        ...db,
        families: { ...db.families, [familyId]: { ...f, children: f.children.filter((c) => c.personId !== personId), changed: Date.now() } },
        persons: { ...db.persons, [personId]: { ...p, childOf: p.childOf.filter((x) => x !== familyId), changed: Date.now() } },
      }
    })
  },

  setPartner(familyId, slot, personId) {
    get().apply('Partner zugeordnet', (db) => {
      const f = db.families[familyId]
      if (!f) return db
      const key = slot === 1 ? 'partner1' : 'partner2'
      const oldId = f[key]
      const persons = { ...db.persons }
      if (oldId && persons[oldId]) {
        persons[oldId] = { ...persons[oldId], spouseIn: persons[oldId].spouseIn.filter((x) => x !== familyId) }
      }
      if (personId && persons[personId]) {
        persons[personId] = { ...persons[personId], spouseIn: [...new Set([...persons[personId].spouseIn, familyId])] }
      }
      return {
        ...db,
        persons,
        families: { ...db.families, [familyId]: { ...f, [key]: personId, changed: Date.now() } },
      }
    })
  },

  upsertSource(s) {
    get().apply('Quelle gespeichert', (db) => ({ ...db, sources: { ...db.sources, [s.id]: { ...s, changed: Date.now() } } }))
  },
  upsertRepository(r) {
    get().apply('Archiv gespeichert', (db) => ({ ...db, repositories: { ...db.repositories, [r.id]: { ...r, changed: Date.now() } } }))
  },
  upsertPlace(p) {
    get().apply('Ort gespeichert', (db) => ({ ...db, places: { ...db.places, [p.id]: { ...p, changed: Date.now() } } }))
  },
  upsertMedia(m) {
    get().apply('Medium gespeichert', (db) => ({ ...db, media: { ...db.media, [m.id]: { ...m, changed: Date.now() } } }))
  },
  upsertArms(a) {
    get().apply('Wappen gespeichert', (db) => ({ ...db, arms: { ...db.arms, [a.id]: { ...a, changed: Date.now() } } }))
  },
  upsertTask(t) {
    get().apply('Aufgabe gespeichert', (db) => ({ ...db, tasks: { ...db.tasks, [t.id]: { ...t, changed: Date.now() } } }))
  },
  upsertLog(l) {
    get().apply('Protokolleintrag gespeichert', (db) => ({ ...db, log: { ...db.log, [l.id]: l } }))
  },

  deleteRecord(kind, id) {
    get().apply('Datensatz gelöscht', (db) => {
      const bucket = { ...(db[kind] as Record<ID, unknown>) }
      delete bucket[id]
      return { ...db, [kind]: bucket } as Database
    })
  },
}))

function scheduleSave(get: () => State) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    get().save().catch(() => {
      get().notify('Die Ablage im Browser ist nicht verfügbar. Bitte über „Sichern“ eine Datei anlegen.', 'error')
    })
  }, 800)
}
