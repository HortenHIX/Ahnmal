/**
 * Zustand der Browserablage.
 *
 * Eine Ablage im Browser ist bequem, aber nicht selbstverständlich dauerhaft:
 * Ohne ausdrückliche Anforderung darf der Browser sie bei Platzmangel räumen,
 * und Safari auf iPhone und iPad löscht Websitedaten nach etwa einer Woche
 * ohne Besuch der Seite. Wer einen über Jahre gewachsenen Stammbaum darin
 * hält, muss das wissen – deshalb wird es hier ermittelt und angezeigt statt
 * verschwiegen.
 */

export type PersistenceState = 'persistent' | 'best-effort' | 'unavailable'

export interface StorageReport {
  persistence: PersistenceState
  /** Belegter Platz in Byte, soweit der Browser ihn nennt. */
  usage?: number
  /** Zugeteiltes Kontingent in Byte. */
  quota?: number
  /** Warnungen zur Plattform, die die Nutzerin kennen sollte. */
  warnings: string[]
}

/**
 * Fordert dauerhaften Speicher an. Firefox fragt dabei nach, Chrome entscheidet
 * selbsttätig anhand der Nutzung. Der Aufruf ist gefahrlos wiederholbar.
 */
export async function requestPersistence(): Promise<PersistenceState> {
  if (!navigator.storage?.persist || !navigator.storage.persisted) return 'unavailable'
  try {
    if (await navigator.storage.persisted()) return 'persistent'
    return (await navigator.storage.persist()) ? 'persistent' : 'best-effort'
  } catch {
    return 'unavailable'
  }
}

/** Erkennt Safari auf iPhone und iPad – dort ist die Ablage nicht verlässlich. */
export function isIosSafari(ua = navigator.userAgent, maxTouch = navigator.maxTouchPoints ?? 0): boolean {
  const iDevice = /iPad|iPhone|iPod/.test(ua)
  // iPadOS meldet sich seit Fassung 13 als Macintosh; erkennbar an der Berührungsfähigkeit
  const iPadDesktopMode = /Macintosh/.test(ua) && maxTouch > 1
  if (!iDevice && !iPadDesktopMode) return false
  // Auf iOS benutzen alle Browser die Engine von Safari, die Einschränkung gilt daher überall
  return true
}

export function isPrivateWindowLikely(quota?: number): boolean {
  // Im privaten Modus vergeben Browser ein auffällig kleines Kontingent
  return quota !== undefined && quota > 0 && quota < 150 * 1024 * 1024
}

export async function inspectStorage(): Promise<StorageReport> {
  const warnings: string[] = []
  const persistence = await requestPersistence()

  let usage: number | undefined
  let quota: number | undefined
  try {
    const est = await navigator.storage?.estimate?.()
    usage = est?.usage
    quota = est?.quota
  } catch {
    // Manche Browser verweigern die Auskunft; das ist kein Fehler
  }

  if (persistence === 'best-effort') {
    warnings.push(
      'Der Browser hat dauerhaften Speicher nicht zugesagt. Bei Platzmangel darf er die '
      + 'Ablage räumen. Legen Sie regelmäßig eine Sicherung an.',
    )
  }
  if (persistence === 'unavailable') {
    warnings.push(
      'Dieser Browser lässt sich nicht zu dauerhaftem Speicher befragen. Sicherungen sind '
      + 'hier besonders wichtig.',
    )
  }
  if (isIosSafari()) {
    warnings.push(
      'Auf iPhone und iPad löscht das Betriebssystem Websitedaten nach etwa sieben Tagen '
      + 'ohne Besuch der Seite. Arbeiten Sie dort nur mit Sicherungen, nicht als einzige Ablage.',
    )
  }
  if (isPrivateWindowLikely(quota)) {
    warnings.push(
      'Das Speicherkontingent ist auffällig klein. Das deutet auf ein privates Fenster hin – '
      + 'dort wird beim Schließen alles verworfen.',
    )
  }

  return { persistence, usage, quota, warnings }
}

export function formatBytes(n: number | undefined): string {
  if (n === undefined) return 'unbekannt'
  if (n < 1024) return `${n} B`
  const units = ['kB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

// ---------------------------------------------------------------------------
// Erinnerung an fällige Sicherungen
// ---------------------------------------------------------------------------

const BACKUP_KEY = 'wappenbrief.lastBackup'

export function markBackupDone(at = Date.now()): void {
  try { localStorage.setItem(BACKUP_KEY, String(at)) } catch { /* Speicher gesperrt */ }
}

export function lastBackupAt(): number | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    return raw ? Number(raw) || null : null
  } catch {
    return null
  }
}

/**
 * Entscheidet, ob zu einer Sicherung geraten werden soll.
 *
 * Bei verbundener Arbeitsdatei entfällt die Erinnerung: Dann liegt der Bestand
 * ohnehin als Datei vor, und der Sync-Ordner übernimmt die Vervielfältigung.
 */
export function isBackupDue(
  lastAt: number | null,
  now: number,
  hasWorkFile: boolean,
  personCount: number,
  maxAgeDays = 14,
): boolean {
  if (hasWorkFile) return false
  // Ein leerer oder eben erst angelegter Bestand ist nicht sicherungswürdig
  if (personCount < 5) return false
  if (lastAt === null) return true
  return now - lastAt > maxAgeDays * 24 * 60 * 60 * 1000
}
