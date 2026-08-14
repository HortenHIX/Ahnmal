/**
 * Arbeitsdatei.
 *
 * Statt den Bestand nur in der Browserablage zu halten, arbeitet das Programm
 * auf Wunsch unmittelbar auf einer Datei – am sinnvollsten in einem Ordner, den
 * ein Dienst wie Dropbox, OneDrive oder Nextcloud abgleicht. Damit lässt sich
 * von mehreren Geräten arbeiten, ohne dass die Daten über einen fremden Server
 * laufen: Den Abgleich übernimmt der Ordner, nicht dieses Programm.
 *
 * Nötig dafür ist die File System Access API. Chrome und Edge haben sie, Firefox
 * und Safari nicht; dort bleibt es beim Sichern und Einlesen von Hand.
 */

import { clearHandle, importJSON, loadHandle, saveHandle } from './db'
import { exportJSON } from './db'
import type { Database } from './types'

// ---------------------------------------------------------------------------
// Typen, die die Standardbibliothek noch nicht führt
// ---------------------------------------------------------------------------

type HandlePermission = 'granted' | 'denied' | 'prompt'

interface PermissionCapableHandle {
  queryPermission?(d?: { mode?: 'read' | 'readwrite' }): Promise<HandlePermission>
  requestPermission?(d?: { mode?: 'read' | 'readwrite' }): Promise<HandlePermission>
}

export type WorkFileHandle = FileSystemFileHandle & PermissionCapableHandle

interface PickerOptions {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
  excludeAcceptAllOption?: boolean
  id?: string
}

declare global {
  interface Window {
    showSaveFilePicker?: (o?: PickerOptions) => Promise<WorkFileHandle>
    showOpenFilePicker?: (o?: PickerOptions & { multiple?: boolean }) => Promise<WorkFileHandle[]>
  }
}

const HANDLE_KEY = 'workfile'

const FILE_TYPES: PickerOptions['types'] = [
  { description: 'Wappenbrief-Bestand', accept: { 'application/json': ['.json'] } },
]

export function isWorkFileSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.showSaveFilePicker === 'function'
    && typeof window.showOpenFilePicker === 'function'
}

// ---------------------------------------------------------------------------
// Entscheidungen – rein und damit prüfbar
// ---------------------------------------------------------------------------

export type CopyChoice = 'useFile' | 'useLocal' | 'identical'

/**
 * Welche Fassung gilt, wenn Browserablage und Arbeitsdatei sich unterscheiden?
 *
 * Verglichen wird der Änderungszeitpunkt im Bestand selbst, nicht der der
 * Datei. Ein Abgleichdienst schreibt die Datei neu, ohne den Inhalt zu ändern;
 * die Dateizeit wäre daher irreführend.
 */
export function chooseCopy(localChanged: number, fileChanged: number): CopyChoice {
  if (fileChanged > localChanged) return 'useFile'
  if (localChanged > fileChanged) return 'useLocal'
  return 'identical'
}

/**
 * Hat ein anderes Gerät die Datei angefasst, seit wir sie zuletzt gelesen oder
 * geschrieben haben? Die Toleranz fängt die Ungenauigkeit von Dateizeiten und
 * den eigenen Schreibvorgang ab.
 */
export function isExternalChange(
  lastKnownModified: number | null,
  currentModified: number,
  toleranceMs = 2000,
): boolean {
  if (lastKnownModified === null) return false
  return currentModified > lastKnownModified + toleranceMs
}

// ---------------------------------------------------------------------------
// Zugriff
// ---------------------------------------------------------------------------

export async function permissionOf(handle: WorkFileHandle, write = true): Promise<HandlePermission> {
  if (!handle.queryPermission) return 'granted'
  try {
    return await handle.queryPermission({ mode: write ? 'readwrite' : 'read' })
  } catch {
    return 'prompt'
  }
}

/** Muss aus einer Benutzeraktion heraus aufgerufen werden, sonst lehnt der Browser ab. */
export async function askPermission(handle: WorkFileHandle, write = true): Promise<HandlePermission> {
  if (!handle.requestPermission) return 'granted'
  try {
    return await handle.requestPermission({ mode: write ? 'readwrite' : 'read' })
  } catch {
    return 'denied'
  }
}

export async function rememberHandle(handle: WorkFileHandle): Promise<void> {
  await saveHandle(HANDLE_KEY, handle)
}

export async function restoreHandle(): Promise<WorkFileHandle | null> {
  return loadHandle<WorkFileHandle>(HANDLE_KEY)
}

export async function forgetHandle(): Promise<void> {
  await clearHandle(HANDLE_KEY)
}

// ---------------------------------------------------------------------------
// Lesen und Schreiben
// ---------------------------------------------------------------------------

export interface ReadResult {
  db: Database
  modified: number
}

export async function readWorkFile(handle: WorkFileHandle): Promise<ReadResult> {
  const file = await handle.getFile()
  const text = await file.text()
  return { db: importJSON(text), modified: file.lastModified }
}

/**
 * Schreibt den Bestand in die Datei und gibt die neue Änderungszeit zurück.
 * Der Zeitstempel wird nach dem Schreiben frisch gelesen, damit der eigene
 * Vorgang nicht später als fremde Änderung gedeutet wird.
 */
export async function writeWorkFile(handle: WorkFileHandle, db: Database): Promise<number> {
  const stream = await handle.createWritable()
  try {
    await stream.write(exportJSON(db))
  } finally {
    await stream.close()
  }
  const file = await handle.getFile()
  return file.lastModified
}

/** Prüft, ob die Datei seit dem letzten Zugriff von außen verändert wurde. */
export async function checkForExternalChange(
  handle: WorkFileHandle,
  lastKnownModified: number | null,
): Promise<{ changed: boolean; modified: number }> {
  const file = await handle.getFile()
  return { changed: isExternalChange(lastKnownModified, file.lastModified), modified: file.lastModified }
}

// ---------------------------------------------------------------------------
// Anlegen und Öffnen
// ---------------------------------------------------------------------------

/** Legt eine neue Arbeitsdatei an. Muss aus einer Benutzeraktion kommen. */
export async function createWorkFile(suggestedName: string): Promise<WorkFileHandle | null> {
  if (!window.showSaveFilePicker) return null
  const safe = suggestedName.replace(/[^\w äöüÄÖÜß-]/g, '').trim() || 'stammbaum'
  const handle = await window.showSaveFilePicker({
    suggestedName: `${safe}.json`,
    types: FILE_TYPES,
    id: 'wappenbrief-workfile',
  })
  await rememberHandle(handle)
  return handle
}

/** Öffnet eine bestehende Arbeitsdatei. Muss aus einer Benutzeraktion kommen. */
export async function openWorkFile(): Promise<WorkFileHandle | null> {
  if (!window.showOpenFilePicker) return null
  const [handle] = await window.showOpenFilePicker({
    types: FILE_TYPES,
    multiple: false,
    id: 'wappenbrief-workfile',
  })
  if (!handle) return null
  await rememberHandle(handle)
  return handle
}
