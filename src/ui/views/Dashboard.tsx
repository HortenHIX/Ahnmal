/**
 * Startseite.
 *
 * Zeigt nicht nur Zahlen, sondern was als Nächstes zu tun ist: offene
 * Ahnenlinien, unbelegte Angaben, Widersprüche. Ein Stammbaum ist nie fertig;
 * die Startseite soll den nächsten sinnvollen Schritt vorschlagen.
 */

import { useMemo } from 'react'
import { displayName, isProbablyLiving, lifespan } from '../../core/model'
import { endOfLine, implexReport } from '../../core/relations'
import { useStore } from '../../core/store'
import { summarize, validate } from '../../core/validate'
import { CoatOfArms } from '../../heraldry/render'
import { Empty } from '../components'

export function Dashboard() {
  const db = useStore((s) => s.db)
  const selectPerson = useStore((s) => s.selectPerson)
  const setView = useStore((s) => s.setView)

  const stats = useMemo(() => {
    const persons = Object.values(db.persons)
    const withBirth = persons.filter((p) => p.events.some((e) => e.type === 'BIRT' || e.type === 'CHR')).length
    const sourced = persons.filter(
      (p) => p.citations.length > 0 || p.events.some((e) => (e.citations?.length ?? 0) > 0),
    ).length
    const living = persons.filter((p) => isProbablyLiving(p)).length
    return {
      persons: persons.length,
      families: Object.keys(db.families).length,
      sources: Object.keys(db.sources).length,
      places: Object.keys(db.places).length,
      arms: Object.keys(db.arms).length,
      withBirth,
      sourced,
      living,
      openTasks: Object.values(db.tasks).filter((t) => t.status !== 'done' && t.status !== 'dropped').length,
    }
  }, [db])

  const issues = useMemo(() => summarize(validate(db)), [db])

  const root = db.meta.rootPersonId ? db.persons[db.meta.rootPersonId] : undefined

  const frontier = useMemo(() => (root ? endOfLine(db, root.id, 10).slice(0, 12) : []), [db, root])
  const implex = useMemo(() => (root ? implexReport(db, root.id, 10) : null), [db, root])

  const recent = useMemo(
    () => Object.values(db.persons).sort((a, b) => b.changed - a.changed).slice(0, 8),
    [db.persons],
  )

  if (!stats.persons) {
    return (
      <div className="view">
        <Empty title="Noch kein Bestand">
          <p>Beginnen Sie mit einer GEDCOM-Datei aus einem anderen Programm oder legen Sie die erste Person an.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
            <button className="btn primary" onClick={() => setView('gedcom')}>GEDCOM einlesen</button>
            <button className="btn" onClick={() => setView('people')}>Person anlegen</button>
          </div>
        </Empty>
      </div>
    )
  }

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

  return (
    <div className="view">
      <div className="view-head">
        <h1>{db.meta.name}</h1>
        {db.meta.description && <p>{db.meta.description}</p>}
      </div>

      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <button className="stat" onClick={() => setView('people')} style={{ cursor: 'pointer', textAlign: 'left' }}>
          <div className="n">{stats.persons}</div>
          <div className="l">Personen</div>
          <div className="sub">{stats.living} vermutlich lebend</div>
        </button>
        <div className="stat">
          <div className="n">{stats.families}</div>
          <div className="l">Familien</div>
        </div>
        <button className="stat" onClick={() => setView('sources')} style={{ cursor: 'pointer', textAlign: 'left' }}>
          <div className="n">{stats.sources}</div>
          <div className="l">Quellen</div>
          <div className="sub">{pct(stats.sourced, stats.persons)} % der Personen belegt</div>
        </button>
        <button className="stat" onClick={() => setView('validate')} style={{ cursor: 'pointer', textAlign: 'left' }}>
          <div className="n" style={{ color: issues.error ? 'var(--error)' : undefined }}>{issues.error}</div>
          <div className="l">Widersprüche</div>
          <div className="sub">{issues.warning} Hinweise, {issues.hint} Anmerkungen</div>
        </button>
        <button className="stat" onClick={() => setView('tasks')} style={{ cursor: 'pointer', textAlign: 'left' }}>
          <div className="n">{stats.openTasks}</div>
          <div className="l">offene Aufgaben</div>
        </button>
        <button className="stat" onClick={() => setView('armorial')} style={{ cursor: 'pointer', textAlign: 'left' }}>
          <div className="n">{stats.arms}</div>
          <div className="l">Wappen</div>
        </button>
      </div>

      <div className="split">
        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h3>Forschungsfront</h3>
              <span className="tag">{frontier.length} offene Linien</span>
            </div>
            <div className="panel-body">
              <p style={{ color: 'var(--ink-soft)', fontSize: 12.5, marginTop: 0 }}>
                Vorfahren, bei denen mindestens ein Elternteil fehlt – hier lohnt der nächste Archivbesuch.
                Die tiefsten Generationen stehen oben.
              </p>
              {!frontier.length && <p style={{ color: 'var(--ink-faint)' }}>Kein Proband gesetzt.</p>}
              <table className="data">
                <thead>
                  <tr><th>Kekulé</th><th>Name</th><th>Lebensdaten</th><th>Generation</th></tr>
                </thead>
                <tbody>
                  {frontier.map((f) => (
                    <tr key={`${f.kekule}`} onClick={() => selectPerson(f.person.id, 'person')}>
                      <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{f.kekule}</td>
                      <td>{displayName(f.person)}</td>
                      <td style={{ color: 'var(--ink-soft)' }}>{lifespan(f.person)}</td>
                      <td>{f.generation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {implex && implex.duplicates.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h3>Ahnenschwund</h3></div>
              <div className="panel-body">
                <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 0 }}>
                  {implex.duplicates.length} Personen besetzen mehrere Ahnenstellen. Das ist in
                  Dorfgemeinschaften normal und ein Zeichen sorgfältiger Forschung, kein Fehler.
                </p>
                <table className="data">
                  <thead><tr><th>Person</th><th>Ahnenstellen</th></tr></thead>
                  <tbody>
                    {implex.duplicates.slice(0, 6).map((d) => (
                      <tr key={d.personId} onClick={() => selectPerson(d.personId, 'person')}>
                        <td>{displayName(db.persons[d.personId])}</td>
                        <td style={{ color: 'var(--gold)' }}>{d.positions.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          {root && (
            <div className="panel">
              <div className="panel-head"><h3>Proband</h3></div>
              <div className="panel-body" style={{ textAlign: 'center' }}>
                {root.armsId && db.arms[root.armsId] && (
                  <CoatOfArms arms={db.arms[root.armsId]} size={130} full />
                )}
                <div style={{ fontWeight: 600, fontSize: 15, marginTop: 6 }}>{displayName(root)}</div>
                <div style={{ color: 'var(--ink-soft)' }}>{lifespan(root)}</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
                  <button className="btn small" onClick={() => selectPerson(root.id, 'pedigree')}>Ahnentafel</button>
                  <button className="btn small" onClick={() => selectPerson(root.id, 'fan')}>Fächer</button>
                </div>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-head"><h3>Zuletzt bearbeitet</h3></div>
            <div className="panel-body">
              {recent.map((p) => (
                <button
                  key={p.id}
                  className="btn ghost"
                  style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}
                  onClick={() => selectPerson(p.id, 'person')}
                >
                  <span>{displayName(p)}</span>
                  <span style={{ color: 'var(--ink-faint)', fontSize: 11.5 }}>
                    {new Date(p.changed).toLocaleDateString('de-DE')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
