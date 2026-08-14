/**
 * Personenliste und Personenblatt.
 *
 * Das Personenblatt ist der Ort, an dem die meiste Arbeitszeit vergeht. Es ist
 * daher als Formular ohne Umwege gebaut: alles Wesentliche auf einer Seite,
 * Ereignisse einzeln aufklappbar, Familienbande direkt verknüpfbar.
 */

import { useMemo, useState } from 'react'
import { formatDate } from '../../core/dates'
import { uid } from '../../core/ids'
import {
  ATTRIBUTE_LABELS, EVENT_LABELS, SEX_LABELS, birthEvent, birthYear, childrenOf,
  deathEvent, deathYear, displayName, eventLabel, isProbablyLiving, lifespan,
  listName, newEvent, normalizeName, parentsOf, siblingsOf, sortByBirth,
  spousesOf, surnameOf,
} from '../../core/model'
import { inbreedingCoefficient } from '../../core/relations'
import { useStore } from '../../core/store'
import type {
  AttributeType, Citation, EventType, GAttribute, GEvent, ID, Person, PersonName, Sex,
} from '../../core/types'
import { CoatOfArms } from '../../heraldry/render'
import {
  ConfirmButton, DateField, Empty, Field, Modal, NameCell, PersonPicker, PlaceField, Th,
} from '../components'

// ---------------------------------------------------------------------------
// Liste
// ---------------------------------------------------------------------------

type Col = 'name' | 'birth' | 'death' | 'age' | 'place' | 'changed'

export function PeopleList() {
  const db = useStore((s) => s.db)
  const selectPerson = useStore((s) => s.selectPerson)
  const addPerson = useStore((s) => s.addPerson)
  const selected = useStore((s) => s.selectedPerson)
  const [query, setQuery] = useState('')
  const [sex, setSex] = useState<'' | Sex>('')
  const [living, setLiving] = useState<'' | 'yes' | 'no'>('')
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 'name', dir: 1 })

  const rows = useMemo(() => {
    const q = normalizeName(query)
    let list = Object.values(db.persons)
    if (q) {
      list = list.filter((p) =>
        p.names.some((n) =>
          normalizeName([n.given, n.surnamePrefix, n.surname, n.nickname].filter(Boolean).join(' ')).includes(q)),
      )
    }
    if (sex) list = list.filter((p) => p.sex === sex)
    if (living) list = list.filter((p) => isProbablyLiving(p) === (living === 'yes'))

    const val = (p: Person): string | number => {
      switch (sort.col) {
        case 'name': return listName(p).toLowerCase()
        case 'birth': return birthYear(p) ?? 9999
        case 'death': return deathYear(p) ?? 9999
        case 'age': {
          const b = birthYear(p); const d = deathYear(p)
          return b !== null && d !== null ? d - b : -1
        }
        case 'place': return (birthEvent(p)?.placeText ?? '').toLowerCase()
        case 'changed': return p.changed
      }
    }
    return list.sort((a, b) => {
      const va = val(a); const vb = val(b)
      if (va === vb) return 0
      return (va < vb ? -1 : 1) * sort.dir
    })
  }, [db.persons, query, sex, living, sort])

  const surnames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of Object.values(db.persons)) {
      const s = surnameOf(p) || '(ohne Namen)'
      counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24)
  }, [db.persons])

  return (
    <div className="view">
      <div className="view-head">
        <h1>Personen</h1>
        <p>{rows.length} von {Object.keys(db.persons).length} angezeigt</p>
        <div style={{ flex: 1 }} />
        <button className="btn primary" onClick={() => selectPerson(addPerson(), 'person')}>
          Neue Person
        </button>
      </div>

      <div className="split">
        <div className="panel">
          <div className="toolbar">
            <input
              type="search" placeholder="Namen suchen …" value={query}
              onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 280 }}
            />
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex | '')} style={{ width: 'auto' }}>
              <option value="">alle Geschlechter</option>
              <option value="M">männlich</option>
              <option value="F">weiblich</option>
              <option value="U">unbekannt</option>
              <option value="X">divers</option>
            </select>
            <select value={living} onChange={(e) => setLiving(e.target.value as '' | 'yes' | 'no')} style={{ width: 'auto' }}>
              <option value="">alle</option>
              <option value="yes">lebt vermutlich</option>
              <option value="no">verstorben</option>
            </select>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  <Th col="name" label="Name" sort={sort} setSort={setSort} />
                  <Th col="birth" label="geboren" sort={sort} setSort={setSort} />
                  <Th col="death" label="gestorben" sort={sort} setSort={setSort} />
                  <Th col="age" label="Alter" sort={sort} setSort={setSort} align="right" />
                  <Th col="place" label="Geburtsort" sort={sort} setSort={setSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const b = birthYear(p); const d = deathYear(p)
                  return (
                    <tr
                      key={p.id}
                      className={selected === p.id ? 'selected' : undefined}
                      onClick={() => selectPerson(p.id, 'person')}
                    >
                      <td><NameCell person={p} /></td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(birthEvent(p)?.date)}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(deathEvent(p)?.date)}</td>
                      <td style={{ textAlign: 'right' }}>{b !== null && d !== null ? d - b : ''}</td>
                      <td style={{ color: 'var(--ink-soft)' }}>{birthEvent(p)?.placeText ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!rows.length && <Empty title="Keine Treffer" />}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Namensverteilung</h3></div>
          <div className="panel-body list-scroll">
            {surnames.map(([name, n]) => (
              <button
                key={name}
                className="btn ghost"
                style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}
                onClick={() => setQuery(name === '(ohne Namen)' ? '' : name)}
              >
                <span>{name}</span>
                <span className="tag">{n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Personenblatt
// ---------------------------------------------------------------------------

const PERSON_EVENT_CHOICES: EventType[] = [
  'BIRT', 'CHR', 'DEAT', 'BURI', 'CONF', 'FCOM', 'GRAD', 'EMIG', 'IMMI',
  'NATU', 'CENS', 'RETI', 'WILL', 'PROB', 'ORDN', 'ADOP', 'EVEN',
]

const ATTRIBUTE_CHOICES: AttributeType[] = ['OCCU', 'RESI', 'RELI', 'TITL', 'EDUC', 'PROP', 'CAST', 'DSCR', 'NCHI', 'FACT']

export function PersonView() {
  const db = useStore((s) => s.db)
  const id = useStore((s) => s.selectedPerson)
  const updatePerson = useStore((s) => s.updatePerson)
  const deletePerson = useStore((s) => s.deletePerson)
  const selectPerson = useStore((s) => s.selectPerson)
  const apply = useStore((s) => s.apply)
  const addFamily = useStore((s) => s.addFamily)
  const linkChild = useStore((s) => s.linkChild)
  const setPartner = useStore((s) => s.setPartner)
  const notify = useStore((s) => s.notify)
  const [tab, setTab] = useState<'daten' | 'familie' | 'quellen' | 'notizen' | 'wappen'>('daten')
  const [linking, setLinking] = useState<null | 'father' | 'mother' | 'spouse' | 'child'>(null)

  // Ohne ausdrückliche Auswahl wird der Proband gezeigt, damit die Ansicht
  // nach dem Öffnen nicht leer bleibt
  const person = (id ? db.persons[id] : undefined)
    ?? (db.meta.rootPersonId ? db.persons[db.meta.rootPersonId] : undefined)
    ?? Object.values(db.persons)[0]
  if (!person) return <Empty title="Noch keine Person erfasst">Legen Sie unter „Personen“ die erste Person an.</Empty>

  const { father, mother, family: childFamily } = parentsOf(db, person.id)
  const spouses = spousesOf(db, person.id)
  const kids = childrenOf(db, person.id)
  const sibs = siblingsOf(db, person.id)
  const arms = person.armsId ? db.arms[person.armsId] : undefined
  const inbreeding = inbreedingCoefficient(db, person.id)

  const patchName = (nameId: ID, patch: Partial<PersonName>) => {
    updatePerson(person.id, {
      names: person.names.map((n) => (n.id === nameId ? { ...n, ...patch } : n)),
    })
  }

  const patchEvent = (eventId: ID, patch: Partial<GEvent>) => {
    updatePerson(person.id, {
      events: person.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)),
    })
  }

  const addEvent = (type: EventType) => {
    updatePerson(person.id, { events: [...person.events, newEvent(type)] })
  }

  const removeEvent = (eventId: ID) => {
    updatePerson(person.id, { events: person.events.filter((e) => e.id !== eventId) })
  }

  /** Legt eine Elternfamilie an, falls noch keine besteht, und setzt den Elternteil. */
  const linkParent = (which: 'father' | 'mother', pid: ID | undefined) => {
    let fid = childFamily?.id
    if (!fid) {
      fid = addFamily({})
      linkChild(fid, person.id)
    }
    const fam = useStore.getState().db.families[fid]
    if (!fam) return
    // Der Vater kommt auf Platz 1, die Mutter auf Platz 2 – sofern frei
    const slot: 1 | 2 = which === 'father' ? 1 : 2
    setPartner(fid, slot, pid)
    setLinking(null)
  }

  const linkSpouse = (pid: ID | undefined) => {
    if (!pid) return
    const fid = addFamily({ partner1: person.id, partner2: pid })
    void fid
    setLinking(null)
    notify('Familie angelegt.', 'success')
  }

  const linkNewChild = (pid: ID | undefined) => {
    if (!pid) return
    let fid = person.spouseIn[0]
    if (!fid) fid = addFamily({ partner1: person.id })
    linkChild(fid, pid)
    setLinking(null)
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>{displayName(person)}</h1>
        <span className="tag">{lifespan(person)}</span>
        {isProbablyLiving(person) && <span className="tag warn">lebt vermutlich</span>}
        <div style={{ flex: 1 }} />
        <button className="btn small" onClick={() => selectPerson(person.id, 'pedigree')}>Ahnentafel</button>
        <button className="btn small" onClick={() => selectPerson(person.id, 'fan')}>Fächer</button>
        <button
          className="btn small"
          onClick={() => apply('Proband gesetzt', (d) => ({ ...d, meta: { ...d.meta, rootPersonId: person.id } }))}
        >
          Als Proband setzen
        </button>
        <ConfirmButton
          label="Löschen"
          message={`„${displayName(person)}“ und alle Verknüpfungen dieser Person werden entfernt.`}
          onConfirm={() => deletePerson(person.id)}
        />
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="toolbar">
          {(['daten', 'familie', 'quellen', 'notizen', 'wappen'] as const).map((t) => (
            <button
              key={t}
              className={`btn ${tab === t ? 'primary' : 'ghost'} small`}
              onClick={() => setTab(t)}
            >
              {{ daten: 'Daten', familie: 'Familie', quellen: 'Quellen', notizen: 'Notizen', wappen: 'Wappen' }[t]}
            </button>
          ))}
        </div>
      </div>

      {tab === 'daten' && (
        <div className="split">
          <div className="stack">
            <div className="panel">
              <div className="panel-head"><h3>Namen</h3>
                <button
                  className="btn small"
                  onClick={() => updatePerson(person.id, { names: [...person.names, { id: uid('n'), type: 'aka' }] })}
                >
                  Weiterer Name
                </button>
              </div>
              <div className="panel-body stack">
                {person.names.map((n) => (
                  <div key={n.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                    <div className="grid3">
                      <Field label="Vorname(n)">
                        <input type="text" value={n.given ?? ''} onChange={(e) => patchName(n.id, { given: e.target.value })} />
                      </Field>
                      <Field label="Namenspartikel" hint="von, van der, zu">
                        <input type="text" value={n.surnamePrefix ?? ''} onChange={(e) => patchName(n.id, { surnamePrefix: e.target.value })} />
                      </Field>
                      <Field label="Familienname">
                        <input type="text" value={n.surname ?? ''} onChange={(e) => patchName(n.id, { surname: e.target.value })} />
                      </Field>
                    </div>
                    <div className="grid3">
                      <Field label="Rufname">
                        <input type="text" value={n.nickname ?? ''} onChange={(e) => patchName(n.id, { nickname: e.target.value })} />
                      </Field>
                      <Field label="Art">
                        <select value={n.type} onChange={(e) => patchName(n.id, { type: e.target.value as PersonName['type'] })}>
                          <option value="birth">Geburtsname</option>
                          <option value="married">Ehename</option>
                          <option value="religious">Ordensname</option>
                          <option value="nobility">Adelsname</option>
                          <option value="aka">auch genannt</option>
                          <option value="immigrant">nach Einwanderung</option>
                        </select>
                      </Field>
                      <Field label=" ">
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!n.primary && (
                            <button
                              className="btn small"
                              onClick={() => updatePerson(person.id, {
                                names: person.names.map((x) => ({ ...x, primary: x.id === n.id })),
                              })}
                            >
                              Hauptname
                            </button>
                          )}
                          {person.names.length > 1 && (
                            <button
                              className="btn small danger"
                              onClick={() => updatePerson(person.id, { names: person.names.filter((x) => x.id !== n.id) })}
                            >
                              Entfernen
                            </button>
                          )}
                          {n.primary && <span className="tag gold">Hauptname</span>}
                        </div>
                      </Field>
                    </div>
                  </div>
                ))}
                <div className="grid3">
                  <Field label="Geschlecht">
                    <select value={person.sex} onChange={(e) => updatePerson(person.id, { sex: e.target.value as Sex })}>
                      {(Object.keys(SEX_LABELS) as Sex[]).map((s) => (
                        <option key={s} value={s}>{SEX_LABELS[s]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Lebt" hint="leer lassen für automatische Schätzung">
                    <select
                      value={person.living === undefined ? '' : person.living ? 'yes' : 'no'}
                      onChange={(e) => updatePerson(person.id, {
                        living: e.target.value === '' ? undefined : e.target.value === 'yes',
                      })}
                    >
                      <option value="">automatisch</option>
                      <option value="yes">ja</option>
                      <option value="no">nein</option>
                    </select>
                  </Field>
                  <Field label="Schlagworte" hint="mit Komma trennen">
                    <input
                      type="text"
                      value={(person.tags ?? []).join(', ')}
                      onChange={(e) => updatePerson(person.id, {
                        tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Ereignisse</h3>
                <select
                  value=""
                  style={{ width: 'auto' }}
                  onChange={(e) => { if (e.target.value) addEvent(e.target.value as EventType) }}
                >
                  <option value="">Ereignis hinzufügen …</option>
                  {PERSON_EVENT_CHOICES.map((t) => (
                    <option key={t} value={t}>{EVENT_LABELS[t] ?? t}</option>
                  ))}
                </select>
              </div>
              <div className="panel-body stack">
                {!person.events.length && <p style={{ color: 'var(--ink-faint)' }}>Noch keine Ereignisse erfasst.</p>}
                {person.events.map((e) => (
                  <EventEditor
                    key={e.id}
                    event={e}
                    onChange={(patch) => patchEvent(e.id, patch)}
                    onRemove={() => removeEvent(e.id)}
                  />
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Eigenschaften</h3>
                <select
                  value="" style={{ width: 'auto' }}
                  onChange={(e) => {
                    if (!e.target.value) return
                    updatePerson(person.id, {
                      attributes: [...person.attributes, { id: uid('a'), type: e.target.value as AttributeType, value: '' }],
                    })
                  }}
                >
                  <option value="">Eigenschaft hinzufügen …</option>
                  {ATTRIBUTE_CHOICES.map((t) => <option key={t} value={t}>{ATTRIBUTE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="panel-body stack">
                {!person.attributes.length && <p style={{ color: 'var(--ink-faint)' }}>Keine Eigenschaften erfasst.</p>}
                {person.attributes.map((a) => (
                  <div key={a.id} className="row">
                    <Field label={ATTRIBUTE_LABELS[a.type] ?? a.type}>
                      <input
                        type="text" value={a.value}
                        onChange={(ev) => updatePerson(person.id, {
                          attributes: person.attributes.map((x) => x.id === a.id ? { ...x, value: ev.target.value } : x),
                        })}
                      />
                    </Field>
                    <button
                      className="btn small danger"
                      onClick={() => updatePerson(person.id, { attributes: person.attributes.filter((x) => x.id !== a.id) })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="stack">
            {arms && (
              <div className="panel">
                <div className="panel-head"><h3>Wappen</h3></div>
                <div className="panel-body" style={{ textAlign: 'center' }}>
                  <CoatOfArms arms={arms} size={150} title={arms.name} />
                  <div style={{ fontWeight: 600, marginTop: 6 }}>{arms.name}</div>
                  <div className="blazon-text" style={{ fontSize: 12.5 }}>{arms.blazon}</div>
                </div>
              </div>
            )}

            <div className="panel">
              <div className="panel-head"><h3>Auf einen Blick</h3></div>
              <div className="panel-body">
                <dl className="kv">
                  <dt>Geburt</dt>
                  <dd>{birthEvent(person) ? `${formatDate(birthEvent(person)!.date, true)}${birthEvent(person)!.placeText ? `, ${birthEvent(person)!.placeText}` : ''}` : '—'}</dd>
                  <dt>Tod</dt>
                  <dd>{deathEvent(person) ? `${formatDate(deathEvent(person)!.date, true)}${deathEvent(person)!.placeText ? `, ${deathEvent(person)!.placeText}` : ''}` : '—'}</dd>
                  <dt>Vater</dt><dd>{father ? displayName(father) : '—'}</dd>
                  <dt>Mutter</dt><dd>{mother ? displayName(mother) : '—'}</dd>
                  <dt>Geschwister</dt><dd>{sibs.length}</dd>
                  <dt>Kinder</dt><dd>{kids.length}</dd>
                  {inbreeding !== null && inbreeding > 0 && (
                    <>
                      <dt>Inzuchtkoeffizient</dt>
                      <dd>
                        {(inbreeding * 100).toFixed(2)} %
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                          Die Eltern sind miteinander verwandt.
                        </div>
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'familie' && (
        <div className="stack">
          <div className="panel">
            <div className="panel-head"><h3>Eltern</h3></div>
            <div className="panel-body grid2">
              <div>
                <strong>Vater:</strong>{' '}
                {father ? (
                  <button className="btn ghost small" onClick={() => selectPerson(father.id, 'person')}>
                    {displayName(father)} {lifespan(father)}
                  </button>
                ) : '—'}
                <button className="btn small" style={{ marginLeft: 8 }} onClick={() => setLinking('father')}>
                  {father ? 'ändern' : 'zuordnen'}
                </button>
              </div>
              <div>
                <strong>Mutter:</strong>{' '}
                {mother ? (
                  <button className="btn ghost small" onClick={() => selectPerson(mother.id, 'person')}>
                    {displayName(mother)} {lifespan(mother)}
                  </button>
                ) : '—'}
                <button className="btn small" style={{ marginLeft: 8 }} onClick={() => setLinking('mother')}>
                  {mother ? 'ändern' : 'zuordnen'}
                </button>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Ehen und Partnerschaften</h3>
              <button className="btn small" onClick={() => setLinking('spouse')}>Partner zuordnen</button>
            </div>
            <div className="panel-body stack">
              {!spouses.length && <p style={{ color: 'var(--ink-faint)' }}>Keine Verbindung erfasst.</p>}
              {spouses.map(({ person: sp, family }) => (
                <FamilyBlock key={family.id} familyId={family.id} spouse={sp} />
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Kinder</h3>
              <button className="btn small" onClick={() => setLinking('child')}>Kind zuordnen</button>
            </div>
            <div className="panel-body">
              {!kids.length && <p style={{ color: 'var(--ink-faint)' }}>Keine Kinder erfasst.</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                {kids.map((k) => (
                  <button key={k.id} className={`person-card sex-${k.sex}`} onClick={() => selectPerson(k.id, 'person')}>
                    <div className="nm">{displayName(k)}</div>
                    <div className="dt">{lifespan(k)}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {sibs.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h3>Geschwister</h3></div>
              <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                {sortByBirth(sibs).map((k) => (
                  <button key={k.id} className={`person-card sex-${k.sex}`} onClick={() => selectPerson(k.id, 'person')}>
                    <div className="nm">{displayName(k)}</div>
                    <div className="dt">{lifespan(k)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'quellen' && <CitationsPanel person={person} />}

      {tab === 'notizen' && (
        <div className="panel">
          <div className="panel-head">
            <h3>Notizen</h3>
            <button className="btn small" onClick={() => updatePerson(person.id, { notes: [...person.notes, ''] })}>
              Notiz hinzufügen
            </button>
          </div>
          <div className="panel-body stack">
            {!person.notes.length && <p style={{ color: 'var(--ink-faint)' }}>Keine Notizen.</p>}
            {person.notes.map((note, i) => (
              <div key={i} className="row">
                <textarea
                  value={note}
                  style={{ flex: 1 }}
                  onChange={(e) => updatePerson(person.id, {
                    notes: person.notes.map((x, j) => (j === i ? e.target.value : x)),
                  })}
                />
                <button
                  className="btn small danger"
                  onClick={() => updatePerson(person.id, { notes: person.notes.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'wappen' && (
        <div className="panel">
          <div className="panel-head"><h3>Wappenzuordnung</h3></div>
          <div className="panel-body">
            <Field label="Wappen aus der Wappenrolle">
              <select
                value={person.armsId ?? ''}
                onChange={(e) => updatePerson(person.id, { armsId: e.target.value || undefined })}
              >
                <option value="">kein Wappen zugeordnet</option>
                {Object.values(db.arms).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            {arms ? (
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginTop: 12 }}>
                <CoatOfArms arms={arms} size={190} full title={arms.name} />
                <div>
                  <h3>{arms.name}</h3>
                  <p className="blazon-text">{arms.blazon}</p>
                  {arms.attribution && (
                    <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Nachweis: {arms.attribution}</p>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--ink-faint)' }}>
                Wappen werden in der Wappenrolle angelegt und können hier zugeordnet werden.
              </p>
            )}
          </div>
        </div>
      )}

      {linking && (
        <Modal title="Person zuordnen" onClose={() => setLinking(null)}>
          <PersonPicker
            label={
              linking === 'father' ? 'Vater' : linking === 'mother' ? 'Mutter'
                : linking === 'spouse' ? 'Partner' : 'Kind'
            }
            exclude={[person.id]}
            onChange={(pid) => {
              if (linking === 'father' || linking === 'mother') linkParent(linking, pid)
              else if (linking === 'spouse') linkSpouse(pid)
              else linkNewChild(pid)
            }}
          />
          <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            Ist die gesuchte Person noch nicht erfasst, legen Sie sie zuerst unter „Personen“ an.
          </p>
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function EventEditor({
  event, onChange, onRemove,
}: { event: GEvent; onChange: (p: Partial<GEvent>) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(!event.date && !event.placeText)
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
        <button className="btn ghost small" onClick={() => setOpen(!open)}>{open ? '▾' : '▸'}</button>
        <strong style={{ minWidth: 96 }}>{eventLabel(event)}</strong>
        <span style={{ color: 'var(--ink-soft)', fontSize: 12.5, flex: 1 }}>
          {[formatDate(event.date), event.placeText].filter(Boolean).join(', ')}
        </span>
        <button className="btn small danger" onClick={onRemove}>✕</button>
      </div>
      {open && (
        <div style={{ padding: '0 10px 10px' }}>
          {event.type === 'EVEN' && (
            <Field label="Bezeichnung">
              <input type="text" value={event.label ?? ''} onChange={(e) => onChange({ label: e.target.value })} />
            </Field>
          )}
          <div className="grid2">
            <DateField value={event.date} onChange={(d) => onChange({ date: d })} />
            <PlaceField value={event.placeText} onChange={(v) => onChange({ placeText: v })} />
          </div>
          <div className="grid3">
            <Field label="Alter" hint="wie in der Quelle vermerkt">
              <input type="text" value={event.age ?? ''} onChange={(e) => onChange({ age: e.target.value })} />
            </Field>
            <Field label="Ausführende Stelle" hint="Pfarramt, Standesamt">
              <input type="text" value={event.agency ?? ''} onChange={(e) => onChange({ agency: e.target.value })} />
            </Field>
            <Field label="Ursache">
              <input type="text" value={event.cause ?? ''} onChange={(e) => onChange({ cause: e.target.value })} />
            </Field>
          </div>
          <Field label="Anmerkung">
            <textarea value={event.note ?? ''} onChange={(e) => onChange({ note: e.target.value })} />
          </Field>
        </div>
      )}
    </div>
  )
}

function FamilyBlock({ familyId, spouse }: { familyId: ID; spouse?: Person }) {
  const db = useStore((s) => s.db)
  const updateFamily = useStore((s) => s.updateFamily)
  const deleteFamily = useStore((s) => s.deleteFamily)
  const selectPerson = useStore((s) => s.selectPerson)
  const family = db.families[familyId]
  if (!family) return null

  const marriage = family.events.find((e) => e.type === 'MARR')

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>⚭</span>
        {spouse ? (
          <button className="btn ghost small" style={{ fontWeight: 600 }} onClick={() => selectPerson(spouse.id, 'person')}>
            {displayName(spouse)} {lifespan(spouse)}
          </button>
        ) : <span style={{ color: 'var(--ink-faint)' }}>Partner unbekannt</span>}
        <div style={{ flex: 1 }} />
        <ConfirmButton
          label="Verbindung lösen"
          message="Die Familienverbindung wird aufgelöst. Die Personen selbst bleiben erhalten."
          onConfirm={() => deleteFamily(familyId)}
        />
      </div>
      <div className="grid2">
        <Field label="Art der Verbindung">
          <select
            value={family.unionType}
            onChange={(e) => updateFamily(familyId, { unionType: e.target.value as typeof family.unionType })}
          >
            <option value="married">verheiratet</option>
            <option value="unmarried">unverheiratet</option>
            <option value="engaged">verlobt</option>
            <option value="unknown">unbekannt</option>
          </select>
        </Field>
        <DateField
          label="Heirat"
          value={marriage?.date}
          onChange={(d) => {
            const events = marriage
              ? family.events.map((e) => (e.id === marriage.id ? { ...e, date: d } : e))
              : [...family.events, { ...newEvent('MARR'), date: d }]
            updateFamily(familyId, { events })
          }}
        />
      </div>
      <PlaceField
        label="Heiratsort"
        value={marriage?.placeText}
        onChange={(v) => {
          const events = marriage
            ? family.events.map((e) => (e.id === marriage.id ? { ...e, placeText: v } : e))
            : [...family.events, { ...newEvent('MARR'), placeText: v }]
          updateFamily(familyId, { events })
        }}
      />
      {family.children.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          {family.children.length} Kind{family.children.length === 1 ? '' : 'er'} aus dieser Verbindung
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function CitationsPanel({ person }: { person: Person }) {
  const db = useStore((s) => s.db)
  const updatePerson = useStore((s) => s.updatePerson)

  const allCitations: { where: string; citation: Citation }[] = [
    ...person.citations.map((c) => ({ where: 'Person', citation: c })),
    ...person.events.flatMap((e) => (e.citations ?? []).map((c) => ({ where: eventLabel(e), citation: c }))),
    ...person.attributes.flatMap((a: GAttribute) =>
      (a.citations ?? []).map((c) => ({ where: ATTRIBUTE_LABELS[a.type] ?? a.type, citation: c }))),
  ]

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Quellenbelege</h3>
        <select
          value="" style={{ width: 'auto' }}
          onChange={(e) => {
            if (!e.target.value) return
            updatePerson(person.id, {
              citations: [...person.citations, { id: uid('c'), sourceId: e.target.value, confidence: 2 }],
            })
          }}
        >
          <option value="">Beleg hinzufügen …</option>
          {Object.values(db.sources).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </div>
      <div className="panel-body">
        {!allCitations.length && (
          <p style={{ color: 'var(--ink-faint)' }}>
            Keine Belege. Angaben ohne Quelle sind Vermutungen – auch wenn sie stimmen.
          </p>
        )}
        <table className="data">
          <tbody>
            {allCitations.map(({ where, citation }) => {
              const src = db.sources[citation.sourceId]
              return (
                <tr key={citation.id}>
                  <td style={{ width: 110, color: 'var(--ink-faint)' }}>{where}</td>
                  <td>
                    <strong>{src?.title ?? 'unbekannte Quelle'}</strong>
                    {citation.page && <span style={{ color: 'var(--ink-soft)' }}> · {citation.page}</span>}
                    {citation.text && (
                      <div style={{ fontStyle: 'italic', fontSize: 12.5, color: 'var(--ink-soft)' }}>„{citation.text}“</div>
                    )}
                  </td>
                  <td style={{ width: 110 }}>
                    <span className={`tag ${(citation.confidence ?? 0) >= 3 ? 'ok' : (citation.confidence ?? 0) >= 2 ? '' : 'warn'}`}>
                      {['unzuverlässig', 'fraglich', 'wahrscheinlich', 'zweifelsfrei'][citation.confidence ?? 0]}
                    </span>
                  </td>
                  <td style={{ width: 40 }}>
                    {person.citations.some((c) => c.id === citation.id) && (
                      <button
                        className="btn small danger"
                        onClick={() => updatePerson(person.id, {
                          citations: person.citations.filter((c) => c.id !== citation.id),
                        })}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
