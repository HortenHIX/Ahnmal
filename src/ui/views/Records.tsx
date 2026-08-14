/**
 * Quellen, Archive, Orte und Medien.
 *
 * Die Quellenverwaltung ist bewusst näher an der Archivpraxis gebaut als an
 * einem allgemeinen Literaturverzeichnis: Ein Kirchenbuch hat eine Signatur,
 * einen abgedeckten Zeitraum und ein Archiv, in dem es liegt.
 */

import { useMemo, useState } from 'react'
import { readFileAsDataURL } from '../../core/db'
import { uid } from '../../core/ids'
import { displayName, fullPlaceName } from '../../core/model'
import { useStore } from '../../core/store'
import type { MediaItem, Place, Repository, Source } from '../../core/types'
import { ConfirmButton, Empty, Field, Modal } from '../components'

// ---------------------------------------------------------------------------

export function SourcesView() {
  const db = useStore((s) => s.db)
  const upsertSource = useStore((s) => s.upsertSource)
  const upsertRepository = useStore((s) => s.upsertRepository)
  const deleteRecord = useStore((s) => s.deleteRecord)
  const [selected, setSelected] = useState<string | undefined>()
  const [query, setQuery] = useState('')
  const [showRepos, setShowRepos] = useState(false)

  const sources = useMemo(() => {
    const q = query.toLowerCase()
    return Object.values(db.sources)
      .filter((s) => !q || s.title.toLowerCase().includes(q) || (s.callNumber ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, 'de'))
  }, [db.sources, query])

  /** Zählt, wie oft eine Quelle im Bestand belegt ist. */
  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1)
    for (const p of Object.values(db.persons)) {
      for (const c of p.citations) bump(c.sourceId)
      for (const e of p.events) for (const c of e.citations ?? []) bump(c.sourceId)
      for (const a of p.attributes) for (const c of a.citations ?? []) bump(c.sourceId)
    }
    for (const f of Object.values(db.families)) {
      for (const c of f.citations) bump(c.sourceId)
      for (const e of f.events) for (const c of e.citations ?? []) bump(c.sourceId)
    }
    return counts
  }, [db])

  const current = selected ? db.sources[selected] : undefined

  const create = () => {
    const s: Source = {
      id: uid('s'), title: 'Neue Quelle', mediaIds: [], notes: [],
      created: Date.now(), changed: Date.now(),
    }
    upsertSource(s)
    setSelected(s.id)
  }

  const createRepo = () => {
    const r: Repository = {
      id: uid('r'), name: 'Neues Archiv', notes: [], created: Date.now(), changed: Date.now(),
    }
    upsertRepository(r)
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Quellen</h1>
        <p>{sources.length} Quellen in {Object.keys(db.repositories).length} Archiven</p>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => setShowRepos(true)}>Archive verwalten</button>
        <button className="btn primary" onClick={create}>Neue Quelle</button>
      </div>

      <div className="split">
        <div className="panel">
          <div className="toolbar">
            <input type="search" placeholder="Titel oder Signatur …" value={query}
              onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 300 }} />
          </div>
          <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
            <table className="data">
              <thead>
                <tr><th>Titel</th><th>Art</th><th>Signatur</th><th>Zeitraum</th><th>Belege</th></tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className={selected === s.id ? 'selected' : undefined} onClick={() => setSelected(s.id)}>
                    <td style={{ fontWeight: 600 }}>{s.title}</td>
                    <td style={{ color: 'var(--ink-soft)' }}>{s.kind ?? ''}</td>
                    <td style={{ color: 'var(--ink-soft)' }}>{s.callNumber ?? ''}</td>
                    <td style={{ color: 'var(--ink-soft)' }}>
                      {s.coversFrom ? `${s.coversFrom}–${s.coversTo ?? ''}` : ''}
                    </td>
                    <td><span className="tag">{usage.get(s.id) ?? 0}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sources.length && <Empty title="Keine Quellen erfasst" />}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>{current ? 'Quelle bearbeiten' : 'Keine Auswahl'}</h3></div>
          <div className="panel-body">
            {!current ? (
              <p style={{ color: 'var(--ink-faint)' }}>Wählen Sie links eine Quelle.</p>
            ) : (
              <>
                <Field label="Titel">
                  <input type="text" value={current.title} onChange={(e) => upsertSource({ ...current, title: e.target.value })} />
                </Field>
                <Field label="Art" hint="Kirchenbuch, Standesamtsregister, Zählliste, Urkunde">
                  <input type="text" value={current.kind ?? ''} onChange={(e) => upsertSource({ ...current, kind: e.target.value })} />
                </Field>
                <Field label="Verfasser oder führende Stelle">
                  <input type="text" value={current.author ?? ''} onChange={(e) => upsertSource({ ...current, author: e.target.value })} />
                </Field>
                <Field label="Archiv">
                  <select
                    value={current.repositoryId ?? ''}
                    onChange={(e) => upsertSource({ ...current, repositoryId: e.target.value || undefined })}
                  >
                    <option value="">kein Archiv zugeordnet</option>
                    {Object.values(db.repositories).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </Field>
                <Field label="Signatur">
                  <input type="text" value={current.callNumber ?? ''} onChange={(e) => upsertSource({ ...current, callNumber: e.target.value })} />
                </Field>
                <div className="grid2">
                  <Field label="Zeitraum von">
                    <input
                      type="number" value={current.coversFrom ?? ''}
                      onChange={(e) => upsertSource({ ...current, coversFrom: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </Field>
                  <Field label="bis">
                    <input
                      type="number" value={current.coversTo ?? ''}
                      onChange={(e) => upsertSource({ ...current, coversTo: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </Field>
                </div>
                <Field label="Netzadresse">
                  <input type="url" value={current.url ?? ''} onChange={(e) => upsertSource({ ...current, url: e.target.value })} />
                </Field>
                <Field label="Wörtlicher Auszug">
                  <textarea value={current.text ?? ''} onChange={(e) => upsertSource({ ...current, text: e.target.value })} />
                </Field>
                <ConfirmButton
                  label="Quelle löschen"
                  message={`„${current.title}“ wird gelöscht. Bereits gesetzte Belege verlieren ihren Bezug.`}
                  onConfirm={() => { deleteRecord('sources', current.id); setSelected(undefined) }}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {showRepos && (
        <Modal title="Archive" onClose={() => setShowRepos(false)} wide
          footer={<button className="btn primary" onClick={createRepo}>Neues Archiv</button>}>
          <div className="stack">
            {!Object.keys(db.repositories).length && <p style={{ color: 'var(--ink-faint)' }}>Noch keine Archive erfasst.</p>}
            {Object.values(db.repositories).map((r) => (
              <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10 }}>
                <div className="row">
                  <Field label="Name">
                    <input type="text" value={r.name} onChange={(e) => upsertRepository({ ...r, name: e.target.value })} />
                  </Field>
                  <ConfirmButton
                    label="✕" message={`Das Archiv „${r.name}“ wird gelöscht.`}
                    onConfirm={() => deleteRecord('repositories', r.id)}
                  />
                </div>
                <Field label="Anschrift">
                  <input type="text" value={r.address ?? ''} onChange={(e) => upsertRepository({ ...r, address: e.target.value })} />
                </Field>
                <div className="grid2">
                  <Field label="Netzadresse">
                    <input type="url" value={r.url ?? ''} onChange={(e) => upsertRepository({ ...r, url: e.target.value })} />
                  </Field>
                  <Field label="E-Mail">
                    <input type="email" value={r.email ?? ''} onChange={(e) => upsertRepository({ ...r, email: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

export function PlacesView() {
  const db = useStore((s) => s.db)
  const upsertPlace = useStore((s) => s.upsertPlace)
  const deleteRecord = useStore((s) => s.deleteRecord)
  const [selected, setSelected] = useState<string | undefined>()
  const [query, setQuery] = useState('')

  /** Erfasst zusätzlich die Orte, die nur als Text an Ereignissen hängen. */
  const looseTexts = useMemo(() => {
    const counts = new Map<string, number>()
    const add = (t?: string) => { if (t) counts.set(t, (counts.get(t) ?? 0) + 1) }
    for (const p of Object.values(db.persons)) {
      for (const e of p.events) add(e.placeText)
      for (const a of p.attributes) add(a.placeText)
    }
    for (const f of Object.values(db.families)) for (const e of f.events) add(e.placeText)
    const known = new Set(Object.values(db.places).map((p) => fullPlaceName(p)))
    return [...counts.entries()].filter(([t]) => !known.has(t)).sort((a, b) => b[1] - a[1])
  }, [db])

  const places = useMemo(() => {
    const q = query.toLowerCase()
    return Object.values(db.places)
      .filter((p) => !q || fullPlaceName(p).toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [db.places, query])

  const current = selected ? db.places[selected] : undefined

  const adopt = (text: string) => {
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean)
    const p: Place = {
      id: uid('pl'), name: parts[0] ?? text, hierarchy: parts.slice(1), notes: [],
      created: Date.now(), changed: Date.now(),
    }
    upsertPlace(p)
    setSelected(p.id)
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Orte</h1>
        <p>{places.length} erfasst, {looseTexts.length} nur als Text vorhanden</p>
      </div>

      <div className="split">
        <div className="stack">
          <div className="panel">
            <div className="toolbar">
              <input type="search" placeholder="Ort suchen …" value={query}
                onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 300 }} />
            </div>
            <div className="list-scroll">
              <table className="data">
                <thead><tr><th>Ort</th><th>Koordinaten</th></tr></thead>
                <tbody>
                  {places.map((p) => (
                    <tr key={p.id} className={selected === p.id ? 'selected' : undefined} onClick={() => setSelected(p.id)}>
                      <td>{fullPlaceName(p)}</td>
                      <td style={{ color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums' }}>
                        {p.lat !== undefined ? `${p.lat.toFixed(4)}, ${p.lng?.toFixed(4)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!places.length && <Empty title="Keine Ortsdatensätze" />}
            </div>
          </div>

          {looseTexts.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h3>Ortsangaben ohne Datensatz</h3></div>
              <div className="panel-body list-scroll">
                <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 0 }}>
                  Diese Ortsangaben stehen bislang nur als Text an Ereignissen. Als eigener
                  Datensatz lassen sie sich mit Koordinaten und früheren Namen versehen.
                </p>
                {looseTexts.slice(0, 60).map(([t, n]) => (
                  <button
                    key={t} className="btn ghost"
                    style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}
                    onClick={() => adopt(t)}
                  >
                    <span>{t}</span>
                    <span className="tag">{n}×</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><h3>{current ? 'Ort bearbeiten' : 'Keine Auswahl'}</h3></div>
          <div className="panel-body">
            {!current ? (
              <p style={{ color: 'var(--ink-faint)' }}>Wählen Sie links einen Ort.</p>
            ) : (
              <>
                <Field label="Name">
                  <input type="text" value={current.name} onChange={(e) => upsertPlace({ ...current, name: e.target.value })} />
                </Field>
                <Field label="Übergeordnet" hint="Kreis, Land, Staat – mit Komma trennen">
                  <input
                    type="text" value={(current.hierarchy ?? []).join(', ')}
                    onChange={(e) => upsertPlace({
                      ...current, hierarchy: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })}
                  />
                </Field>
                <div className="grid2">
                  <Field label="Breitengrad">
                    <input
                      type="number" step="0.000001" value={current.lat ?? ''}
                      onChange={(e) => upsertPlace({ ...current, lat: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </Field>
                  <Field label="Längengrad">
                    <input
                      type="number" step="0.000001" value={current.lng ?? ''}
                      onChange={(e) => upsertPlace({ ...current, lng: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </Field>
                </div>
                <Field label="Frühere Namen" hint="wichtig bei Gebietsänderungen">
                  <input
                    type="text"
                    value={(current.altNames ?? []).map((a) => a.name).join(', ')}
                    onChange={(e) => upsertPlace({
                      ...current,
                      altNames: e.target.value.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name })),
                    })}
                  />
                </Field>
                <ConfirmButton
                  label="Ort löschen" message={`„${current.name}“ wird gelöscht.`}
                  onConfirm={() => { deleteRecord('places', current.id); setSelected(undefined) }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function MediaView() {
  const db = useStore((s) => s.db)
  const upsertMedia = useStore((s) => s.upsertMedia)
  const deleteRecord = useStore((s) => s.deleteRecord)
  const notify = useStore((s) => s.notify)

  const items = useMemo(
    () => Object.values(db.media).sort((a, b) => b.created - a.created),
    [db.media],
  )

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      if (file.size > 8 * 1024 * 1024) {
        notify(`„${file.name}“ ist größer als 8 MB und wurde übergangen.`, 'error')
        continue
      }
      const data = await readFileAsDataURL(file)
      const m: MediaItem = {
        id: uid('m'), title: file.name, mime: file.type || 'application/octet-stream',
        data, notes: [], created: Date.now(), changed: Date.now(),
      }
      upsertMedia(m)
    }
    notify('Medien übernommen.', 'success')
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Medien</h1>
        <p>{items.length} Dateien. Alles bleibt auf diesem Rechner.</p>
        <div style={{ flex: 1 }} />
        <label className="btn primary">
          Dateien hinzufügen
          <input type="file" multiple accept="image/*,application/pdf" style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)} />
        </label>
      </div>

      {!items.length && (
        <Empty title="Keine Medien">
          Fügen Sie Fotos, Urkundenabbildungen oder Kirchenbuchseiten hinzu. Dateien bis 8 MB
          werden in die Ablage des Browsers übernommen.
        </Empty>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
        {items.map((m) => (
          <div key={m.id} className="panel">
            <div style={{ height: 150, background: 'var(--bg-sunken)', borderRadius: '10px 10px 0 0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {m.mime.startsWith('image/') && m.data ? (
                <img src={m.data} alt={m.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ color: 'var(--ink-faint)', fontSize: 32 }}>📄</span>
              )}
            </div>
            <div className="panel-body">
              <Field label="Titel">
                <input type="text" value={m.title} onChange={(e) => upsertMedia({ ...m, title: e.target.value })} />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{m.mime}</span>
                <ConfirmButton
                  label="✕" message={`„${m.title}“ wird gelöscht.`}
                  onConfirm={() => deleteRecord('media', m.id)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export { displayName }
