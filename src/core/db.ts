/**
 * Ablage im Browser.
 *
 * Der gesamte Bestand liegt in IndexedDB auf dem Rechner der Nutzerin. Es gibt
 * keinen Server und keine Übertragung nach außen – bei Personendaten lebender
 * Verwandter ist das keine Vorliebe, sondern eine Anforderung.
 */

import { emptyDatabase } from './types'
import type { Database } from './types'

const DB_NAME = 'wappenbrief'
// Fassung 2 ergänzt die Ablage für den Zeiger auf die Arbeitsdatei
const DB_VERSION = 2
const STORE = 'trees'
const BLOBS = 'blobs'
const HANDLES = 'handles'

let handle: IDBDatabase | null = null

function open(): Promise<IDBDatabase> {
  if (handle) return Promise.resolve(handle)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' })
      if (!d.objectStoreNames.contains(BLOBS)) d.createObjectStore(BLOBS)
      if (!d.objectStoreNames.contains(HANDLES)) d.createObjectStore(HANDLES)
    }
    req.onsuccess = () => { handle = req.result; resolve(req.result) }
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export interface StoredTree {
  id: string
  name: string
  changed: number
  data: Database
}

export async function listTrees(): Promise<{ id: string; name: string; changed: number }[]> {
  try {
    const all = await tx<StoredTree[]>(STORE, 'readonly', (s) => s.getAll() as IDBRequest<StoredTree[]>)
    return all
      .map((t) => ({ id: t.id, name: t.name, changed: t.changed }))
      .sort((a, b) => b.changed - a.changed)
  } catch {
    return []
  }
}

export async function loadTree(id: string): Promise<Database | null> {
  try {
    const rec = await tx<StoredTree | undefined>(STORE, 'readonly', (s) => s.get(id) as IDBRequest<StoredTree | undefined>)
    return rec?.data ?? null
  } catch {
    return null
  }
}

export async function saveTree(db: Database): Promise<void> {
  const rec: StoredTree = { id: db.meta.id, name: db.meta.name, changed: Date.now(), data: db }
  await tx(STORE, 'readwrite', (s) => s.put(rec))
}

export async function deleteTree(id: string): Promise<void> {
  await tx(STORE, 'readwrite', (s) => s.delete(id))
}

/**
 * Lädt den zuletzt bearbeiteten Bestand oder legt einen leeren an.
 * Fällt IndexedDB aus (privater Modus mancher Browser), wird ohne Ablage
 * weitergearbeitet, statt den Start zu verweigern.
 */
export async function loadLast(): Promise<Database> {
  const trees = await listTrees()
  if (!trees.length) return emptyDatabase()
  return (await loadTree(trees[0].id)) ?? emptyDatabase()
}

// ---------------------------------------------------------------------------
// Zeiger auf die Arbeitsdatei
// ---------------------------------------------------------------------------

/**
 * Dateizeiger lassen sich in IndexedDB ablegen und überleben damit das
 * Schließen des Browsers. Die Zugriffserlaubnis überlebt nicht mit – sie wird
 * beim nächsten Start neu erfragt.
 */
export async function saveHandle(key: string, handle: unknown): Promise<void> {
  await tx(HANDLES, 'readwrite', (s) => s.put(handle as never, key))
}

export async function loadHandle<T>(key: string): Promise<T | null> {
  try {
    const v = await tx<T | undefined>(HANDLES, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>)
    return v ?? null
  } catch {
    return null
  }
}

export async function clearHandle(key: string): Promise<void> {
  try {
    await tx(HANDLES, 'readwrite', (s) => s.delete(key))
  } catch {
    // Fehlt die Ablage, ist auch nichts zu löschen
  }
}

// ---------------------------------------------------------------------------
// Dateien
// ---------------------------------------------------------------------------

/** Sicherung als JSON – das vollständige Modell ohne Informationsverlust. */
export function exportJSON(db: Database): string {
  return JSON.stringify({ format: 'wappenbrief', version: 1, exported: new Date().toISOString(), tree: db }, null, 2)
}

export function importJSON(text: string): Database {
  const raw = JSON.parse(text)
  const tree = raw?.tree ?? raw
  if (!tree || typeof tree !== 'object' || !tree.persons) {
    throw new Error('Die Datei enthält keinen erkennbaren Stammbaum.')
  }
  const base = emptyDatabase()
  return {
    ...base,
    ...tree,
    meta: { ...base.meta, ...tree.meta },
  }
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    // GEDCOM aus alten Programmen ist häufig ANSI oder ANSEL kodiert;
    // der Importer erkennt das an der Kopfzeile und rechnet um.
    r.readAsText(file, 'utf-8')
  })
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}
