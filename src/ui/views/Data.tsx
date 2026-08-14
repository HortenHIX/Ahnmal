/**
 * Datenaustausch, Berichte und Einstellungen.
 */

import { useMemo, useRef, useState } from 'react'
import { deleteTree, downloadText, exportJSON, importJSON, listTrees, loadTree, readFile } from '../../core/db'
import { formatDate, formatDateWithPreposition } from '../../core/dates'
import {
  ATTRIBUTE_LABELS, birthEvent, childrenOf, deathEvent, displayName, eventLabel,
  isProbablyLiving, lifespan, parentsOf, spousesOf,
} from '../../core/model'
import { ancestorsWithKekule, kekuleLine } from '../../core/relations'
import { buildSampleTree } from '../../core/sample'
import { useStore } from '../../core/store'
import { emptyDatabase } from '../../core/types'
import type { ID } from '../../core/types'
import { DEFAULT_EXPORT, exportGedcom } from '../../gedcom/export'
import { importGedcom } from '../../gedcom/import'
import { decodeGedcomBuffer } from '../../gedcom/parse'
import { ConfirmButton, Empty, Field, Modal, PersonPicker } from '../components'
import type { ImportReport } from '../../gedcom/import'

// ---------------------------------------------------------------------------

export function GedcomView() {
  const db = useStore((s) => s.db)
  const replaceDatabase = useStore((s) => s.replaceDatabase)
  const apply = useStore((s) => s.apply)
  const notify = useStore((s) => s.notify)
  const fileRef = useRef<HTMLInputElement>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [mode, setMode] = useState<'replace' | 'merge'>('replace')
  const [opts, setOpts] = useState({ ...DEFAULT_EXPORT })

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer()
      const text = decodeGedcomBuffer(buf)
      const res = importGedcom(text, file.name.replace(/\.ged$/i, ''))
      setReport(res)
    } catch (err) {
      notify(`Die Datei konnte nicht gelesen werden: ${(err as Error).message}`, 'error')
    }
  }

  const acceptImport = () => {
    if (!report) return
    if (mode === 'replace') {
      replaceDatabase(report.db, 'GEDCOM eingelesen')
    } else {
      // Zusammenführen: die eingelesenen Sätze behalten ihre eigenen Kennungen
      apply('GEDCOM hinzugefügt', (cur) => ({
        ...cur,
        persons: { ...cur.persons, ...report.db.persons },
        families: { ...cur.families, ...report.db.families },
        sources: { ...cur.sources, ...report.db.sources },
        repositories: { ...cur.repositories, ...report.db.repositories },
        places: { ...cur.places, ...report.db.places },
        media: { ...cur.media, ...report.db.media },
      }))
    }
    notify(`${report.counts.persons} Personen übernommen.`, 'success')
    setReport(null)
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Datenaustausch</h1>
        <p>GEDCOM ist das gemeinsame Format aller Genealogieprogramme.</p>
      </div>

      <div className="grid2" style={{ gap: 14, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head"><h3>Einlesen</h3></div>
          <div className="panel-body">
            <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
              Gelesen werden GEDCOM 5.5, 5.5.1 und 7.0. Die Kodierung – UTF-8, ANSI oder das
              ältere ANSEL – wird selbsttätig erkannt, damit Umlaute erhalten bleiben.
            </p>
            <input
              ref={fileRef} type="file" accept=".ged,.gedcom,text/plain"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <button className="btn primary" onClick={() => fileRef.current?.click()}>
              GEDCOM-Datei wählen
            </button>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <h4>Sicherung einlesen</h4>
              <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
                Eine JSON-Sicherung enthält den vollständigen Bestand ohne die Einschränkungen
                von GEDCOM – einschließlich Wappen, Aufgaben und Forschungsprotokoll.
              </p>
              <label className="btn">
                JSON-Sicherung wählen
                <input
                  type="file" accept="application/json,.json" style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      const next = importJSON(await readFile(f))
                      replaceDatabase(next, 'Sicherung eingelesen')
                      notify('Sicherung eingelesen.', 'success')
                    } catch (err) {
                      notify((err as Error).message, 'error')
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Ausgeben</h3></div>
          <div className="panel-body">
            <label style={{ display: 'block', marginBottom: 6 }}>
              <input
                type="checkbox" checked={opts.privatizeLiving}
                onChange={(e) => setOpts({ ...opts, privatizeLiving: e.target.checked })}
              />{' '}
              Angaben lebender Personen zurückhalten
            </label>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 0 }}>
              Dringend empfohlen, sobald die Datei weitergegeben oder hochgeladen wird.
              Für Daten lebender Personen gilt die Datenschutz-Grundverordnung.
            </p>
            <label style={{ display: 'block', marginBottom: 4 }}>
              <input type="checkbox" checked={opts.includeSources}
                onChange={(e) => setOpts({ ...opts, includeSources: e.target.checked })} /> Quellen mitgeben
            </label>
            <label style={{ display: 'block', marginBottom: 4 }}>
              <input type="checkbox" checked={opts.includeMedia}
                onChange={(e) => setOpts({ ...opts, includeMedia: e.target.checked })} /> Medienverweise mitgeben
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <input type="checkbox" checked={opts.includeNotes}
                onChange={(e) => setOpts({ ...opts, includeNotes: e.target.checked })} /> Notizen mitgeben
            </label>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn primary"
                onClick={() => {
                  downloadText(`${db.meta.name}.ged`, exportGedcom(db, opts), 'text/plain;charset=utf-8')
                  notify('GEDCOM-Datei erzeugt.', 'success')
                }}
              >
                GEDCOM 5.5.1 sichern
              </button>
              <button
                className="btn"
                onClick={() => {
                  downloadText(`${db.meta.name}.json`, exportJSON(db), 'application/json')
                  notify('Vollständige Sicherung erzeugt.', 'success')
                }}
              >
                Vollsicherung (JSON)
              </button>
            </div>
          </div>
        </div>
      </div>

      {report && (
        <Modal
          title="Einlesen bestätigen"
          onClose={() => setReport(null)}
          wide
          footer={
            <>
              <button className="btn" onClick={() => setReport(null)}>Abbrechen</button>
              <button className="btn primary" onClick={acceptImport}>Übernehmen</button>
            </>
          }
        >
          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <div className="stat"><div className="n">{report.counts.persons}</div><div className="l">Personen</div></div>
            <div className="stat"><div className="n">{report.counts.families}</div><div className="l">Familien</div></div>
            <div className="stat"><div className="n">{report.counts.sources}</div><div className="l">Quellen</div></div>
            <div className="stat"><div className="n">{report.counts.places}</div><div className="l">Orte</div></div>
            <div className="stat"><div className="n">{report.counts.media}</div><div className="l">Medien</div></div>
          </div>

          <dl className="kv" style={{ marginBottom: 14 }}>
            <dt>Erzeugendes Programm</dt><dd>{report.producer ?? 'nicht angegeben'}</dd>
            <dt>GEDCOM-Fassung</dt><dd>{report.gedcomVersion ?? 'nicht angegeben'}</dd>
          </dl>

          <Field label="Wie soll eingelesen werden?">
            <select value={mode} onChange={(e) => setMode(e.target.value as 'replace' | 'merge')}>
              <option value="replace">Bisherigen Bestand ersetzen</option>
              <option value="merge">Zum bisherigen Bestand hinzufügen</option>
            </select>
          </Field>
          {mode === 'merge' && (
            <p style={{ fontSize: 12.5, color: 'var(--warn)' }}>
              Beim Hinzufügen entstehen häufig Dubletten. Prüfen Sie danach die Dublettensuche.
            </p>
          )}

          {report.warnings.length > 0 && (
            <>
              <h4 style={{ marginTop: 14 }}>Hinweise beim Lesen ({report.warnings.length})</h4>
              <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: 12, background: 'var(--bg-sunken)', padding: 10, borderRadius: 6 }}>
                {report.warnings.slice(0, 60).map((w, i) => <div key={i}>{w}</div>)}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Berichte
// ---------------------------------------------------------------------------

type ReportKind = 'ahnenliste' | 'nachkommen' | 'personenblatt' | 'ortsliste' | 'quellenliste'

export function ReportsView() {
  const db = useStore((s) => s.db)
  const [kind, setKind] = useState<ReportKind>('ahnenliste')
  const [personId, setPersonId] = useState<ID | undefined>(db.meta.rootPersonId)
  const [generations, setGenerations] = useState(6)
  const settings = useStore((s) => s.settings)

  const person = personId ? db.persons[personId] : undefined

  const text = useMemo(() => {
    if (kind === 'ortsliste') {
      const counts = new Map<string, number>()
      for (const p of Object.values(db.persons)) {
        for (const e of p.events) if (e.placeText) counts.set(e.placeText, (counts.get(e.placeText) ?? 0) + 1)
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([n, c]) => `${n} — ${c} Ereignisse`)
        .join('\n')
    }
    if (kind === 'quellenliste') {
      return Object.values(db.sources)
        .sort((a, b) => a.title.localeCompare(b.title, 'de'))
        .map((s) => {
          const repo = s.repositoryId ? db.repositories[s.repositoryId] : undefined
          return [
            s.title,
            s.author && `  Verfasser: ${s.author}`,
            s.kind && `  Art: ${s.kind}`,
            repo && `  Archiv: ${repo.name}`,
            s.callNumber && `  Signatur: ${s.callNumber}`,
            s.coversFrom && `  Zeitraum: ${s.coversFrom}–${s.coversTo ?? ''}`,
          ].filter(Boolean).join('\n')
        })
        .join('\n\n')
    }
    if (!person) return 'Bitte eine Person auswählen.'

    if (kind === 'ahnenliste') {
      const nodes = ancestorsWithKekule(db, person.id, generations - 1)
      const lines = [
        `Ahnenliste ${displayName(person)}`,
        '='.repeat(60),
        '',
      ]
      let lastGen = -1
      for (const n of nodes.sort((a, b) => a.kekule - b.kekule)) {
        const p = db.persons[n.personId]
        if (!p) continue
        if (n.generation !== lastGen) {
          lines.push('', `— ${n.generation}. Generation —`, '')
          lastGen = n.generation
        }
        const hidden = settings.privacyMode && isProbablyLiving(p)
        const b = birthEvent(p)
        const d = deathEvent(p)
        lines.push(
          `${n.kekule}  ${hidden ? '[Angaben zurückgehalten]' : displayName(p)}`
          + (n.kekule > 1 ? `  (${kekuleLine(n.kekule)})` : ''),
        )
        if (!hidden) {
          if (b) lines.push(`      * ${formatDate(b.date, true)}${b.placeText ? `, ${b.placeText}` : ''}`)
          if (d) lines.push(`      † ${formatDate(d.date, true)}${d.placeText ? `, ${d.placeText}` : ''}`)
          for (const a of p.attributes) {
            lines.push(`      ${ATTRIBUTE_LABELS[a.type] ?? a.type}: ${a.value}`)
          }
        }
      }
      return lines.join('\n')
    }

    if (kind === 'nachkommen') {
      const lines = [`Nachkommenliste ${displayName(person)}`, '='.repeat(60), '']
      const walk = (id: ID, depth: number, prefix: string, seen: Set<ID>) => {
        if (depth > generations || seen.has(id)) return
        seen.add(id)
        const p = db.persons[id]
        if (!p) return
        const hidden = settings.privacyMode && isProbablyLiving(p)
        lines.push(`${'  '.repeat(depth)}${prefix} ${hidden ? '[zurückgehalten]' : `${displayName(p)} ${lifespan(p)}`}`)
        let i = 1
        for (const { person: sp, family } of spousesOf(db, id)) {
          const marr = family.events.find((e) => e.type === 'MARR')
          lines.push(
            `${'  '.repeat(depth + 1)}⚭ ${sp ? displayName(sp) : 'unbekannt'}`
            + (marr?.date ? ` ${formatDateWithPreposition(marr.date, true)}` : ''),
          )
          for (const c of family.children) {
            walk(c.personId, depth + 1, `${prefix}${i}.`, seen)
            i++
          }
        }
      }
      walk(person.id, 0, '1.', new Set())
      return lines.join('\n')
    }

    // Personenblatt
    const { father, mother } = parentsOf(db, person.id)
    const lines = [
      displayName(person),
      '='.repeat(60),
      '',
      `Geschlecht: ${person.sex === 'M' ? 'männlich' : person.sex === 'F' ? 'weiblich' : 'unbekannt'}`,
      '',
      'Ereignisse:',
      ...person.events.map((e) =>
        `  ${eventLabel(e).padEnd(14)} ${formatDate(e.date, true)}${e.placeText ? `, ${e.placeText}` : ''}`),
      '',
      'Eltern:',
      `  Vater: ${father ? `${displayName(father)} ${lifespan(father)}` : 'unbekannt'}`,
      `  Mutter: ${mother ? `${displayName(mother)} ${lifespan(mother)}` : 'unbekannt'}`,
      '',
      'Verbindungen:',
      ...spousesOf(db, person.id).map(({ person: sp, family }) => {
        const marr = family.events.find((e) => e.type === 'MARR')
        return `  ⚭ ${sp ? displayName(sp) : 'unbekannt'}${marr?.date ? ` ${formatDateWithPreposition(marr.date, true)}` : ''}`
      }),
      '',
      'Kinder:',
      ...childrenOf(db, person.id).map((c) => `  ${displayName(c)} ${lifespan(c)}`),
      '',
      'Quellen:',
      ...person.citations.map((c) => `  ${db.sources[c.sourceId]?.title ?? '?'}${c.page ? `, ${c.page}` : ''}`),
      ...(person.notes.length ? ['', 'Notizen:', ...person.notes.map((n) => `  ${n}`)] : []),
    ]
    return lines.join('\n')
  }, [db, kind, person, generations, settings.privacyMode])

  return (
    <div className="view">
      <div className="view-head">
        <h1>Berichte</h1>
        <p>Textfassungen zum Ausdrucken, Weitergeben oder Einfügen in einen Aufsatz.</p>
      </div>

      <div className="split">
        <div className="panel">
          <div className="toolbar">
            <button className="btn small" onClick={() => window.print()}>Drucken</button>
            <button
              className="btn small"
              onClick={() => downloadText(`${kind}.txt`, text, 'text/plain;charset=utf-8')}
            >
              Als Textdatei sichern
            </button>
            <button
              className="btn small"
              onClick={() => navigator.clipboard?.writeText(text)}
            >
              In die Zwischenablage
            </button>
          </div>
          <div className="panel-body">
            <pre style={{
              fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap',
              margin: 0, maxHeight: 'calc(100vh - 240px)', overflowY: 'auto',
            }}>
              {text}
            </pre>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Bericht wählen</h3></div>
          <div className="panel-body">
            <Field label="Art">
              <select value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
                <option value="ahnenliste">Ahnenliste (nach Kekulé)</option>
                <option value="nachkommen">Nachkommenliste</option>
                <option value="personenblatt">Personenblatt</option>
                <option value="ortsliste">Ortsliste</option>
                <option value="quellenliste">Quellenverzeichnis</option>
              </select>
            </Field>
            {(kind === 'ahnenliste' || kind === 'nachkommen' || kind === 'personenblatt') && (
              <PersonPicker label="Bezugsperson" value={personId} onChange={setPersonId} />
            )}
            {(kind === 'ahnenliste' || kind === 'nachkommen') && (
              <Field label={`Generationen: ${generations}`}>
                <input type="range" min={2} max={12} value={generations}
                  onChange={(e) => setGenerations(Number(e.target.value))} />
              </Field>
            )}
            {settings.privacyMode && (
              <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                Der Datenschutzmodus ist eingeschaltet: Angaben zu vermutlich lebenden Personen
                werden im Bericht zurückgehalten.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

export function SettingsView() {
  const db = useStore((s) => s.db)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const apply = useStore((s) => s.apply)
  const replaceDatabase = useStore((s) => s.replaceDatabase)
  const notify = useStore((s) => s.notify)
  const [trees, setTrees] = useState<{ id: string; name: string; changed: number }[]>([])

  const refresh = async () => setTrees(await listTrees())

  return (
    <div className="view">
      <div className="view-head">
        <h1>Einstellungen</h1>
      </div>

      <div className="grid2" style={{ gap: 14, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head"><h3>Bestand</h3></div>
          <div className="panel-body">
            <Field label="Bezeichnung">
              <input
                type="text" value={db.meta.name}
                onChange={(e) => apply('Name geändert', (d) => ({ ...d, meta: { ...d.meta, name: e.target.value } }))}
              />
            </Field>
            <Field label="Beschreibung">
              <textarea
                value={db.meta.description ?? ''}
                onChange={(e) => apply('Beschreibung geändert', (d) => ({ ...d, meta: { ...d.meta, description: e.target.value } }))}
              />
            </Field>
            <Field label="Forscherin oder Forscher" hint="wird in die GEDCOM-Ausgabe übernommen">
              <input
                type="text" value={db.meta.researcher ?? ''}
                onChange={(e) => apply('Forscher geändert', (d) => ({ ...d, meta: { ...d.meta, researcher: e.target.value } }))}
              />
            </Field>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Darstellung</h3></div>
          <div className="panel-body">
            <Field label="Farbschema">
              <select value={settings.theme} onChange={(e) => setSettings({ theme: e.target.value as 'light' | 'dark' | 'system' })}>
                <option value="system">wie das Betriebssystem</option>
                <option value="light">hell</option>
                <option value="dark">dunkel</option>
              </select>
            </Field>
            <label style={{ display: 'block', marginBottom: 6 }}>
              <input type="checkbox" checked={settings.showKekule}
                onChange={(e) => setSettings({ showKekule: e.target.checked })} /> Kekulé-Nummern in Diagrammen
            </label>
            <label style={{ display: 'block', marginBottom: 6 }}>
              <input type="checkbox" checked={settings.showArms}
                onChange={(e) => setSettings({ showArms: e.target.checked })} /> Wappen in Diagrammen
            </label>
            <label style={{ display: 'block', marginBottom: 6 }}>
              <input type="checkbox" checked={settings.dateFormatLong}
                onChange={(e) => setSettings({ dateFormatLong: e.target.checked })} /> Datum ausgeschrieben
            </label>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Datenschutz</h3></div>
          <div className="panel-body">
            <label style={{ display: 'block', marginBottom: 8 }}>
              <input type="checkbox" checked={settings.privacyMode}
                onChange={(e) => setSettings({ privacyMode: e.target.checked })} />{' '}
              <strong>Angaben lebender Personen verbergen</strong>
            </label>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              Bei eingeschaltetem Datenschutzmodus erscheinen vermutlich lebende Personen in
              Diagrammen und Berichten nur mit dem Familiennamen. Als lebend gilt, wer kein
              Sterbedatum hat und dessen jüngstes Ereignis weniger als 105 Jahre zurückliegt.
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              Der gesamte Bestand liegt ausschließlich in der Ablage dieses Browsers. Es besteht
              keine Verbindung zu einem Server, und es werden keine Daten übertragen – auch nicht
              zu Kartendiensten. Für eine Sicherung außerhalb des Browsers erzeugen Sie unter
              „Datenaustausch“ eine Datei.
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Gespeicherte Bestände</h3>
            <button className="btn small" onClick={refresh}>Aktualisieren</button>
          </div>
          <div className="panel-body">
            {!trees.length && (
              <p style={{ color: 'var(--ink-faint)' }}>Auf „Aktualisieren“ klicken, um die Ablage zu lesen.</p>
            )}
            {trees.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span style={{ flex: 1 }}>{t.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                  {new Date(t.changed).toLocaleString('de-DE')}
                </span>
                <button
                  className="btn small"
                  onClick={async () => {
                    const loaded = await loadTree(t.id)
                    if (loaded) { replaceDatabase(loaded, 'Bestand gewechselt'); notify('Bestand geladen.', 'success') }
                  }}
                >
                  Öffnen
                </button>
                {t.id !== db.meta.id && (
                  <ConfirmButton
                    label="✕" message={`Der Bestand „${t.name}“ wird aus der Ablage entfernt.`}
                    onConfirm={async () => { await deleteTree(t.id); refresh() }}
                  />
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                className="btn"
                onClick={() => { replaceDatabase(buildSampleTree(), 'Beispiel geladen'); notify('Beispielbestand geladen.', 'success') }}
              >
                Beispielbestand laden
              </button>
              <ConfirmButton
                className="btn danger"
                label="Neuer, leerer Bestand"
                message="Ein leerer Bestand wird angelegt. Der bisherige bleibt in der Ablage erhalten, sofern er gespeichert wurde."
                onConfirm={() => replaceDatabase(emptyDatabase(), 'Neuer Bestand')}
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Über das Programm</h3></div>
          <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--ink-soft)' }}>
            <p>
              <strong>Wappenbrief</strong> verbindet Ahnenforschung und Heraldik in einem
              Werkzeug. Der genealogische Teil deckt ab, was Programme dieser Art können:
              Personen und Familien, Ereignisse, Quellen, Diagramme, GEDCOM in beide Richtungen,
              Plausibilitätsprüfung und Dublettensuche.
            </p>
            <p>
              Der heraldische Teil geht darüber hinaus: Blasonierungen werden gelesen und
              erzeugt, Wappen aus Tinkturen, Teilungen, Heroldsbildern und {' '}
              gemeinen Figuren gezeichnet und auf die heraldischen Regeln geprüft.
            </p>
            <p style={{ marginBottom: 0 }}>
              Alles läuft im Browser, ohne Server und ohne Datenübertragung.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export { Empty }
