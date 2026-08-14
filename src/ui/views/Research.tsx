/**
 * Forschungswerkzeuge: Prüfung, Dubletten, Verwandtschaftsrechner,
 * Aufgabenliste und Forschungsprotokoll.
 *
 * Das Protokoll ist das am meisten unterschätzte Werkzeug der Genealogie: Wer
 * nicht festhält, wo er vergeblich gesucht hat, sucht dort in zwei Jahren
 * wieder.
 */

import { useMemo, useState } from 'react'
import { uid } from '../../core/ids'
import { displayName, lifespan, listName } from '../../core/model'
import { findDuplicates, mergePersons } from '../../core/duplicates'
import { relationship, wrightCoefficient } from '../../core/relations'
import { useStore } from '../../core/store'
import { DEFAULT_LIMITS, validate } from '../../core/validate'
import type { ResearchLogEntry, ResearchTask, TaskPriority, TaskStatus } from '../../core/types'
import { ConfirmButton, Empty, Field, PersonPicker } from '../components'

// ---------------------------------------------------------------------------

export function ValidationView() {
  const db = useStore((s) => s.db)
  const selectPerson = useStore((s) => s.selectPerson)
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'hint'>('all')
  const [rule, setRule] = useState('')

  const issues = useMemo(() => validate(db, DEFAULT_LIMITS), [db])
  const rules = useMemo(() => [...new Set(issues.map((i) => i.rule))].sort(), [issues])

  const shown = issues.filter(
    (i) => (filter === 'all' || i.severity === filter) && (!rule || i.rule === rule),
  )

  const counts = {
    error: issues.filter((i) => i.severity === 'error').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    hint: issues.filter((i) => i.severity === 'hint').length,
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Plausibilitätsprüfung</h1>
        <p>Widersprüche und Auffälligkeiten im Bestand</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="n" style={{ color: counts.error ? 'var(--error)' : undefined }}>{counts.error}</div>
          <div className="l">Widersprüche</div>
          <div className="sub">sicher fehlerhaft</div>
        </div>
        <div className="stat">
          <div className="n" style={{ color: counts.warning ? 'var(--warn)' : undefined }}>{counts.warning}</div>
          <div className="l">Auffälligkeiten</div>
          <div className="sub">möglich, aber selten</div>
        </div>
        <div className="stat">
          <div className="n">{counts.hint}</div>
          <div className="l">Anmerkungen</div>
          <div className="sub">Hinweise zur Datenqualität</div>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          {(['all', 'error', 'warning', 'hint'] as const).map((f) => (
            <button key={f} className={`btn ${filter === f ? 'primary' : 'ghost'} small`} onClick={() => setFilter(f)}>
              {{ all: 'alle', error: 'Widersprüche', warning: 'Auffälligkeiten', hint: 'Anmerkungen' }[f]}
            </button>
          ))}
          <select value={rule} onChange={(e) => setRule(e.target.value)} style={{ width: 'auto' }}>
            <option value="">alle Regeln</option>
            {rules.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{shown.length} Einträge</span>
        </div>
        <div style={{ maxHeight: 'calc(100vh - 330px)', overflowY: 'auto' }}>
          {!shown.length && <Empty title="Nichts zu beanstanden" />}
          {shown.map((i) => (
            <div
              key={i.id}
              className="issue"
              onClick={() => i.personId && selectPerson(i.personId, 'person')}
            >
              <span className={`sev ${i.severity}`} />
              <div style={{ flex: 1 }}>
                <div>{i.message}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{i.rule}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function DuplicatesView() {
  const db = useStore((s) => s.db)
  const replaceDatabase = useStore((s) => s.replaceDatabase)
  const selectPerson = useStore((s) => s.selectPerson)
  const notify = useStore((s) => s.notify)
  const [threshold, setThreshold] = useState(65)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const candidates = useMemo(() => findDuplicates(db, threshold), [db, threshold])
  const shown = candidates.filter((c) => !dismissed.has(`${c.a}|${c.b}`))

  const merge = (keepId: string, dropId: string) => {
    const res = mergePersons(db, keepId, dropId)
    replaceDatabase(res.db, 'Personen zusammengeführt')
    notify('Die Personen wurden zusammengeführt.', 'success')
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Dublettensuche</h1>
        <p>Vergleicht Namen phonetisch, Datumsangaben und die Eltern.</p>
      </div>

      <div className="panel">
        <div className="toolbar">
          <label>
            Mindestähnlichkeit
            <input type="range" min={45} max={95} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
            {threshold} %
          </label>
          <div style={{ flex: 1 }} />
          <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{shown.length} Vorschläge</span>
        </div>
        <div className="panel-body stack">
          {!shown.length && (
            <Empty title="Keine Dubletten gefunden">
              Bei niedrigerer Mindestähnlichkeit werden auch schwächere Übereinstimmungen angezeigt.
            </Empty>
          )}
          {shown.slice(0, 60).map((c) => {
            const a = db.persons[c.a]
            const b = db.persons[c.b]
            if (!a || !b) return null
            return (
              <div key={`${c.a}|${c.b}`} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span className={`tag ${c.score >= 85 ? 'error' : c.score >= 70 ? 'warn' : ''}`}>
                    {c.score} % Übereinstimmung
                  </span>
                  <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{c.reasons.join(' · ')}</span>
                  <div style={{ flex: 1 }} />
                  <button className="btn small" onClick={() => setDismissed(new Set([...dismissed, `${c.a}|${c.b}`]))}>
                    Keine Dublette
                  </button>
                </div>
                <div className="grid2">
                  {[a, b].map((p, i) => (
                    <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10 }}>
                      <button className="btn ghost small" style={{ fontWeight: 600 }} onClick={() => selectPerson(p.id, 'person')}>
                        {displayName(p)}
                      </button>
                      <div style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{lifespan(p)}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                        {p.events.length} Ereignisse, {p.citations.length} Belege
                      </div>
                      <ConfirmButton
                        className="btn small"
                        label={`Diese behalten${i === 0 ? '' : ''}`}
                        message={`„${displayName(p)}“ bleibt bestehen und übernimmt alle Angaben von „${displayName(i === 0 ? b : a)}“. Der andere Datensatz wird entfernt.`}
                        onConfirm={() => merge(p.id, i === 0 ? b.id : a.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function RelationsView() {
  const db = useStore((s) => s.db)
  const selectPerson = useStore((s) => s.selectPerson)
  const rootId = useStore((s) => s.selectedPerson) ?? db.meta.rootPersonId
  const [a, setA] = useState<string | undefined>(rootId)
  const [b, setB] = useState<string | undefined>(undefined)

  const result = useMemo(() => (a && b ? relationship(db, a, b) : null), [db, a, b])
  const coefficient = useMemo(() => (a && b ? wrightCoefficient(db, a, b) : 0), [db, a, b])

  return (
    <div className="view">
      <div className="view-head">
        <h1>Verwandtschaftsrechner</h1>
        <p>Bestimmt Verwandtschaftsgrad, gemeinsame Vorfahren und den Verwandtschaftskoeffizienten.</p>
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-body">
            <div className="grid2">
              <PersonPicker label="Erste Person" value={a} onChange={setA} />
              <PersonPicker label="Zweite Person" value={b} onChange={setB} />
            </div>

            {!a || !b ? (
              <p style={{ color: 'var(--ink-faint)' }}>Bitte zwei Personen auswählen.</p>
            ) : !result ? (
              <Empty title="Keine Verwandtschaft feststellbar">
                Zwischen diesen Personen besteht im erfassten Bestand keine Verbindung.
              </Empty>
            ) : (
              <div>
                <h2 style={{ color: 'var(--accent)', margin: '12px 0' }}>
                  {displayName(db.persons[b])} ist {result.label} von {displayName(db.persons[a])}
                </h2>
                <dl className="kv">
                  <dt>Generationsabstand</dt>
                  <dd>{result.upA} bzw. {result.upB} Schritte zum gemeinsamen Vorfahren</dd>
                  <dt>Verwandtschaftskoeffizient</dt>
                  <dd>
                    {(coefficient * 100).toFixed(3)} %
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                      Anteil gemeinsamer Erbanlagen nach Wright. Geschwister 50 %, Cousinen ersten Grades 12,5 %.
                    </div>
                  </dd>
                  <dt>Gemeinsame Vorfahren</dt>
                  <dd>
                    {result.commonAncestors.length
                      ? result.commonAncestors.map((id) => (
                        <button key={id} className="btn ghost small" onClick={() => selectPerson(id, 'person')}>
                          {displayName(db.persons[id])}
                        </button>
                      ))
                      : '—'}
                  </dd>
                </dl>

                {result.path.length > 1 && (
                  <>
                    <h3 style={{ marginTop: 16 }}>Kürzester Weg</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                      {result.path.map((id, i) => (
                        <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {i > 0 && <span style={{ color: 'var(--ink-faint)' }}>→</span>}
                          <button className="btn small" onClick={() => selectPerson(id, 'person')}>
                            {displayName(db.persons[id])}
                          </button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Zur Einordnung</h3></div>
          <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
            <p>
              Das kanonische Recht der katholischen Kirche verbot Ehen bis zum vierten Grad
              der Seitenverwandtschaft. In Dörfern mit begrenztem Heiratskreis war eine
              Dispens daher der Normalfall – die Dispensakten der Bistümer sind eine
              hervorragende, oft übersehene Quelle.
            </p>
            <p>
              Ein hoher Verwandtschaftskoeffizient zwischen Eheleuten ist deshalb kein
              Hinweis auf einen Erfassungsfehler, sondern auf eine geschlossene
              Heiratsgemeinschaft.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'offen', active: 'in Arbeit', waiting: 'wartet', done: 'erledigt', dropped: 'verworfen',
}

export function TasksView() {
  const db = useStore((s) => s.db)
  const upsertTask = useStore((s) => s.upsertTask)
  const deleteRecord = useStore((s) => s.deleteRecord)
  const selectPerson = useStore((s) => s.selectPerson)
  const [showDone, setShowDone] = useState(false)

  const tasks = useMemo(() => {
    const order: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 }
    return Object.values(db.tasks)
      .filter((t) => showDone || (t.status !== 'done' && t.status !== 'dropped'))
      .sort((a, b) => order[a.priority] - order[b.priority] || b.changed - a.changed)
  }, [db.tasks, showDone])

  const create = () => {
    const t: ResearchTask = {
      id: uid('t'), title: 'Neue Aufgabe', status: 'open', priority: 'normal',
      created: Date.now(), changed: Date.now(),
    }
    upsertTask(t)
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Forschungsaufgaben</h1>
        <p>{tasks.length} Einträge</p>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Erledigte zeigen
        </label>
        <button className="btn primary" onClick={create}>Neue Aufgabe</button>
      </div>

      <div className="stack">
        {!tasks.length && <Empty title="Keine offenen Aufgaben" />}
        {tasks.map((t) => (
          <div key={t.id} className="panel">
            <div className="panel-body">
              <div className="row" style={{ marginBottom: 8 }}>
                <Field label="Aufgabe">
                  <input type="text" value={t.title} onChange={(e) => upsertTask({ ...t, title: e.target.value })} />
                </Field>
                <Field label="Stand">
                  <select value={t.status} onChange={(e) => upsertTask({ ...t, status: e.target.value as TaskStatus })}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Vorrang">
                  <select value={t.priority} onChange={(e) => upsertTask({ ...t, priority: e.target.value as TaskPriority })}>
                    <option value="high">hoch</option>
                    <option value="normal">mittel</option>
                    <option value="low">niedrig</option>
                  </select>
                </Field>
                <ConfirmButton
                  label="Löschen" message={`Die Aufgabe „${t.title}“ wird gelöscht.`}
                  onConfirm={() => deleteRecord('tasks', t.id)}
                />
              </div>
              <Field label="Einzelheiten">
                <textarea value={t.detail ?? ''} onChange={(e) => upsertTask({ ...t, detail: e.target.value })} />
              </Field>
              {t.personId && db.persons[t.personId] && (
                <button className="btn small" onClick={() => selectPerson(t.personId!, 'person')}>
                  betrifft {displayName(db.persons[t.personId])}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function ResearchLogView() {
  const db = useStore((s) => s.db)
  const upsertLog = useStore((s) => s.upsertLog)
  const deleteRecord = useStore((s) => s.deleteRecord)

  const entries = useMemo(
    () => Object.values(db.log).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [db.log],
  )

  const create = () => {
    const e: ResearchLogEntry = {
      id: uid('l'),
      date: new Date().toISOString().slice(0, 10),
      sourceSearched: '',
      result: '',
      created: Date.now(),
    }
    upsertLog(e)
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Forschungsprotokoll</h1>
        <p>Auch die vergebliche Suche ist ein Ergebnis. Wer sie nicht festhält, wiederholt sie.</p>
        <div style={{ flex: 1 }} />
        <button className="btn primary" onClick={create}>Neuer Eintrag</button>
      </div>

      <div className="stack">
        {!entries.length && (
          <Empty title="Noch keine Einträge">
            Halten Sie fest, welche Quelle Sie mit welchem Suchbegriff durchgesehen haben – und
            was dabei herauskam, auch wenn es nichts war.
          </Empty>
        )}
        {entries.map((e) => (
          <div key={e.id} className="panel">
            <div className="panel-body">
              <div className="row" style={{ marginBottom: 8 }}>
                <Field label="Datum">
                  <input type="date" value={e.date} onChange={(ev) => upsertLog({ ...e, date: ev.target.value })} />
                </Field>
                <Field label="Archiv">
                  <input type="text" value={e.repository ?? ''} onChange={(ev) => upsertLog({ ...e, repository: ev.target.value })} />
                </Field>
                <Field label="Ergebnislos">
                  <select
                    value={e.negative ? 'yes' : 'no'}
                    onChange={(ev) => upsertLog({ ...e, negative: ev.target.value === 'yes' })}
                  >
                    <option value="no">mit Fund</option>
                    <option value="yes">ohne Fund</option>
                  </select>
                </Field>
                <ConfirmButton
                  label="Löschen" message="Der Protokolleintrag wird gelöscht."
                  onConfirm={() => deleteRecord('log', e.id)}
                />
              </div>
              <div className="grid2">
                <Field label="Durchgesehene Quelle">
                  <input type="text" value={e.sourceSearched} onChange={(ev) => upsertLog({ ...e, sourceSearched: ev.target.value })} />
                </Field>
                <Field label="Suchbegriffe" hint="alle geprüften Schreibvarianten">
                  <input type="text" value={e.searchTerms ?? ''} onChange={(ev) => upsertLog({ ...e, searchTerms: ev.target.value })} />
                </Field>
              </div>
              <Field label="Ziel der Suche">
                <input type="text" value={e.objective ?? ''} onChange={(ev) => upsertLog({ ...e, objective: ev.target.value })} />
              </Field>
              <Field label="Ergebnis">
                <textarea value={e.result} onChange={(ev) => upsertLog({ ...e, result: ev.target.value })} />
              </Field>
              {e.negative && <span className="tag warn">ohne Fund – nicht erneut suchen</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export { listName }
