import { describe, expect, it } from 'vitest'
import { isBackupDue, isIosSafari, isPrivateWindowLikely, formatBytes } from '../src/core/storage'
import { buildSampleTree } from '../src/core/sample'
import {
  checkForExternalChange, chooseCopy, isExternalChange, readWorkFile, writeWorkFile,
} from '../src/core/workfile'
import type { WorkFileHandle } from '../src/core/workfile'

describe('Welche Fassung gilt', () => {
  it('nimmt die neuere Fassung', () => {
    expect(chooseCopy(1000, 2000)).toBe('useFile')
    expect(chooseCopy(2000, 1000)).toBe('useLocal')
  })

  it('erkennt Gleichstand', () => {
    expect(chooseCopy(1500, 1500)).toBe('identical')
  })

  it('richtet sich nach dem Bestand, nicht nach der Dateizeit', () => {
    // Ein Abgleichdienst schreibt die Datei neu, ohne den Inhalt zu ändern.
    // Verglichen wird deshalb der Änderungszeitpunkt im Bestand selbst.
    const localChanged = 5000
    const fileChanged = 5000
    expect(chooseCopy(localChanged, fileChanged)).toBe('identical')
  })
})

describe('Fremde Änderung an der Arbeitsdatei', () => {
  it('meldet eine spätere Änderungszeit', () => {
    expect(isExternalChange(1_000_000, 1_010_000)).toBe(true)
  })

  it('übersieht den eigenen Schreibvorgang innerhalb der Toleranz', () => {
    // Das Schreiben selbst setzt die Dateizeit ein wenig nach oben
    expect(isExternalChange(1_000_000, 1_001_500)).toBe(false)
  })

  it('meldet nichts, solange die Datei noch nie gelesen wurde', () => {
    expect(isExternalChange(null, 1_000_000)).toBe(false)
  })

  it('meldet nichts bei unveränderter oder älterer Zeit', () => {
    expect(isExternalChange(1_000_000, 1_000_000)).toBe(false)
    expect(isExternalChange(1_000_000, 999_000)).toBe(false)
  })
})

describe('Erinnerung an eine Sicherung', () => {
  const tag = 24 * 60 * 60 * 1000
  const jetzt = 1_700_000_000_000

  it('mahnt, wenn noch nie gesichert wurde', () => {
    expect(isBackupDue(null, jetzt, false, 40)).toBe(true)
  })

  it('mahnt nach mehr als zwei Wochen', () => {
    expect(isBackupDue(jetzt - 15 * tag, jetzt, false, 40)).toBe(true)
    expect(isBackupDue(jetzt - 5 * tag, jetzt, false, 40)).toBe(false)
  })

  it('schweigt bei verbundener Arbeitsdatei', () => {
    // Dann liegt der Bestand ohnehin als Datei vor
    expect(isBackupDue(null, jetzt, true, 400)).toBe(false)
  })

  it('schweigt bei einem fast leeren Bestand', () => {
    expect(isBackupDue(null, jetzt, false, 2)).toBe(false)
  })
})

describe('Plattformerkennung', () => {
  it('erkennt iPhone und iPad', () => {
    expect(isIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true)
    expect(isIosSafari('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 5)).toBe(true)
  })

  it('erkennt ein iPad, das sich als Macintosh ausgibt', () => {
    // Seit iPadOS 13 meldet sich das Gerät als Macintosh; nur die
    // Berührungsfähigkeit verrät es
    expect(isIosSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
  })

  it('hält einen echten Mac nicht dafür', () => {
    expect(isIosSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
  })

  it('hält Windows nicht dafür', () => {
    expect(isIosSafari('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe(false)
  })

  it('erkennt ein auffällig kleines Kontingent als privates Fenster', () => {
    expect(isPrivateWindowLikely(50 * 1024 * 1024)).toBe(true)
    expect(isPrivateWindowLikely(2 * 1024 * 1024 * 1024)).toBe(false)
    expect(isPrivateWindowLikely(undefined)).toBe(false)
  })
})

describe('Größenangaben', () => {
  it('rechnet in lesbare Einheiten um', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 kB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(undefined)).toBe('unbekannt')
  })
})

// ---------------------------------------------------------------------------
// Die Dateischicht mit einem nachgebildeten Dateizeiger
// ---------------------------------------------------------------------------

/** Bildet einen FileSystemFileHandle im Arbeitsspeicher nach. */
function fakeHandle(initial = '') {
  let content = initial
  let modified = 1_000_000
  const handle = {
    name: 'stammbaum.json',
    async getFile() {
      return new File([content], 'stammbaum.json', { lastModified: modified })
    },
    async createWritable() {
      let buffer = ''
      return {
        async write(chunk: string) { buffer += chunk },
        async close() { content = buffer; modified += 10_000 },
      }
    },
    /** Nur für die Prüfläufe: Änderung durch ein anderes Gerät nachstellen. */
    touchExternally(text: string) { content = text; modified += 60_000 },
    get raw() { return content },
  }
  return handle as unknown as WorkFileHandle & { touchExternally(t: string): void; raw: string }
}

describe('Lesen und Schreiben der Arbeitsdatei', () => {
  it('schreibt einen Bestand und liest ihn unverändert zurück', async () => {
    const handle = fakeHandle()
    const original = buildSampleTree()

    const modified = await writeWorkFile(handle, original)
    expect(modified).toBeGreaterThan(0)

    const { db, modified: readModified } = await readWorkFile(handle)
    expect(readModified).toBe(modified)
    expect(Object.keys(db.persons).length).toBe(Object.keys(original.persons).length)
    expect(Object.keys(db.arms).length).toBe(Object.keys(original.arms).length)
    expect(db.meta.name).toBe(original.meta.name)
    // Anders als GEDCOM überträgt die Arbeitsdatei auch Aufgaben und Protokoll
    expect(Object.keys(db.tasks).length).toBe(Object.keys(original.tasks).length)
    expect(Object.keys(db.log).length).toBe(Object.keys(original.log).length)
  })

  it('deutet den eigenen Schreibvorgang nicht als fremde Änderung', async () => {
    const handle = fakeHandle()
    const written = await writeWorkFile(handle, buildSampleTree())
    const { changed } = await checkForExternalChange(handle, written)
    expect(changed).toBe(false)
  })

  it('erkennt die Änderung durch ein anderes Gerät', async () => {
    const handle = fakeHandle()
    const written = await writeWorkFile(handle, buildSampleTree())

    const fremd = buildSampleTree()
    fremd.meta.name = 'Vom anderen Gerät'
    handle.touchExternally(JSON.stringify({ format: 'wappenbrief', version: 1, tree: fremd }))

    const { changed } = await checkForExternalChange(handle, written)
    expect(changed).toBe(true)

    const { db } = await readWorkFile(handle)
    expect(db.meta.name).toBe('Vom anderen Gerät')
  })

  it('weist eine Datei ab, die kein Bestand ist', async () => {
    const handle = fakeHandle('{"etwas":"anderes"}')
    await expect(readWorkFile(handle)).rejects.toThrow(/Stammbaum/)
  })
})
