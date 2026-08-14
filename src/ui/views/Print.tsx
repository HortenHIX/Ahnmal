/**
 * Druckwerkstatt.
 *
 * Die Ausgabe entsteht über die Druckfunktion des Browsers, in der sich
 * „Als PDF sichern“ wählen lässt. Das ist keine Notlösung: So bleiben Text
 * auswählbar, Schriften eingebettet und die Wappen echte Vektorgrafik. Eine
 * selbst erzeugte Rasterdatei wäre am Bildschirm entstanden und beim
 * Vergrößern zerfallen – bei einem Ahnentafel-Poster ist das der Unterschied
 * zwischen brauchbar und wertlos.
 */

import { useEffect, useMemo, useState } from 'react'
import { formatDate, formatDateWithPreposition } from '../../core/dates'
import {
  ATTRIBUTE_LABELS, birthEvent, childrenOf, deathEvent, displayName, eventLabel,
  isProbablyLiving, lifespan, listName, parentsOf, placeLabel, primaryName, spousesOf,
} from '../../core/model'
import { ancestorsWithKekule, kekuleLine } from '../../core/relations'
import { useStore } from '../../core/store'
import type { Arms, Database, Family, ID, Person } from '../../core/types'
import { CoatOfArms } from '../../heraldry/render'
import { Empty, Field, PersonPicker } from '../components'
import { FanSVG, PedigreeSVG } from './Charts'

// ---------------------------------------------------------------------------
// Papier
// ---------------------------------------------------------------------------

interface PaperSize {
  key: string
  label: string
  /** Breite und Höhe im Hochformat, in Millimetern. */
  w: number
  h: number
}

const PAPERS: PaperSize[] = [
  { key: 'A4', label: 'A4 (210 × 297 mm)', w: 210, h: 297 },
  { key: 'A3', label: 'A3 (297 × 420 mm)', w: 297, h: 420 },
  { key: 'A2', label: 'A2 (420 × 594 mm)', w: 420, h: 594 },
  { key: 'Letter', label: 'Letter (216 × 279 mm)', w: 216, h: 279 },
]

type Orientation = 'portrait' | 'landscape'

type DocKind =
  | 'ahnentafelPoster' | 'faecherPoster' | 'ahnenliste' | 'nachkommenliste'
  | 'personenblatt' | 'familienbogen' | 'wappenblatt'

const DOC_LABELS: Record<DocKind, string> = {
  ahnentafelPoster: 'Ahnentafel als Poster',
  faecherPoster: 'Fächerdiagramm als Poster',
  ahnenliste: 'Ahnenliste nach Kekulé',
  nachkommenliste: 'Nachkommenliste',
  personenblatt: 'Personenblatt',
  familienbogen: 'Familienbogen',
  wappenblatt: 'Wappenblatt',
}

/** Sinnvolle Voreinstellung je Dokumentart. */
const DOC_DEFAULTS: Record<DocKind, { paper: string; orientation: Orientation }> = {
  ahnentafelPoster: { paper: 'A3', orientation: 'landscape' },
  faecherPoster: { paper: 'A3', orientation: 'portrait' },
  ahnenliste: { paper: 'A4', orientation: 'portrait' },
  nachkommenliste: { paper: 'A4', orientation: 'portrait' },
  personenblatt: { paper: 'A4', orientation: 'portrait' },
  familienbogen: { paper: 'A4', orientation: 'portrait' },
  wappenblatt: { paper: 'A4', orientation: 'portrait' },
}

/**
 * Setzt die Seitengröße für den Druck. Ohne diese Regel druckt der Browser
 * immer auf das zuletzt eingestellte Format, und ein A3-Poster erscheint
 * verkleinert mitten auf einem A4-Blatt.
 */
function usePageRule(paper: PaperSize, orientation: Orientation, margin: number) {
  useEffect(() => {
    const el = document.createElement('style')
    const w = orientation === 'portrait' ? paper.w : paper.h
    const h = orientation === 'portrait' ? paper.h : paper.w
    el.textContent = `@page { size: ${w}mm ${h}mm; margin: ${margin}mm; }`
    document.head.appendChild(el)
    return () => { el.remove() }
  }, [paper, orientation, margin])
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

function Sheet({
  paper, orientation, margin, fixedHeight, children,
}: {
  paper: PaperSize
  orientation: Orientation
  margin: number
  /** Poster füllen genau eine Seite; Listen wachsen nach unten. */
  fixedHeight?: boolean
  children: React.ReactNode
}) {
  const w = (orientation === 'portrait' ? paper.w : paper.h) - 2 * margin
  const h = (orientation === 'portrait' ? paper.h : paper.w) - 2 * margin
  return (
    <div
      className="sheet"
      style={{
        width: `${w}mm`,
        [fixedHeight ? 'height' : 'minHeight']: `${h}mm`,
        padding: `${margin}mm`,
        boxSizing: 'content-box',
      }}
    >
      {children}
    </div>
  )
}

function Footer({ db, note }: { db: Database; note?: string }) {
  return (
    <div className="doc-footer">
      <span>{db.meta.name}{db.meta.researcher ? ` · ${db.meta.researcher}` : ''}</span>
      <span>{note}</span>
      <span>Erstellt am {new Date().toLocaleDateString('de-DE')} mit Wappenbrief</span>
    </div>
  )
}

/** Kurzform der Lebensdaten für Listen: „* 14.08.1723 Hüfingen † 1789“. */
function lifeLine(db: Database, p: Person, hidden: boolean): string {
  if (hidden) return '[Angaben zurückgehalten – Person lebt vermutlich]'
  const parts: string[] = []
  const b = birthEvent(p)
  const d = deathEvent(p)
  if (b) parts.push(`* ${formatDate(b.date)}${placeLabel(db, b) ? ` ${placeLabel(db, b)}` : ''}`)
  if (d) parts.push(`† ${formatDate(d.date)}${placeLabel(db, d) ? ` ${placeLabel(db, d)}` : ''}`)
  return parts.join('   ')
}

function sourcesOf(db: Database, p: Person): string[] {
  const ids = new Set<ID>()
  for (const c of p.citations) ids.add(c.sourceId)
  for (const e of p.events) for (const c of e.citations ?? []) ids.add(c.sourceId)
  return [...ids].map((id) => db.sources[id]?.title).filter(Boolean) as string[]
}

// ---------------------------------------------------------------------------
// Dokumente
// ---------------------------------------------------------------------------

interface DocProps {
  db: Database
  paper: PaperSize
  orientation: Orientation
  margin: number
  personId?: ID
  familyId?: ID
  armsId?: ID
  generations: number
  privacy: boolean
  showArms: boolean
  showSources: boolean
}

function AhnentafelPoster(props: DocProps) {
  const { db, personId, generations, privacy, showArms } = props
  const person = personId ? db.persons[personId] : undefined
  if (!person) return <Empty title="Keine Person gewählt" />
  const nodes = ancestorsWithKekule(db, person.id, generations - 1)

  return (
    <Sheet {...props} fixedHeight>
      <div className="poster">
        <div>
          <h1 className="doc-title">Ahnentafel {displayName(person)}</h1>
          <div className="doc-subtitle">
            {lifespan(person)} · {nodes.length} von {Math.pow(2, generations) - 1} Ahnenstellen besetzt
          </div>
          <hr className="doc-rule" />
        </div>
        <div className="poster-chart">
          <PedigreeSVG
            db={db}
            rootId={person.id}
            generations={generations}
            showKekule
            showArms={showArms}
            privacy={privacy}
            forPrint
          />
        </div>
        <Footer db={db} note="Nummerierung nach Kekulé von Stradonitz" />
      </div>
    </Sheet>
  )
}

function FaecherPoster(props: DocProps) {
  const { db, personId, generations, privacy } = props
  const person = personId ? db.persons[personId] : undefined
  if (!person) return <Empty title="Keine Person gewählt" />

  return (
    <Sheet {...props} fixedHeight>
      <div className="poster">
        <div>
          <h1 className="doc-title">Ahnenfächer {displayName(person)}</h1>
          <div className="doc-subtitle">{lifespan(person)}</div>
          <hr className="doc-rule" />
        </div>
        <div className="poster-chart">
          <FanSVG
            db={db}
            rootId={person.id}
            generations={generations}
            sweep={300}
            privacy={privacy}
            forPrint
          />
        </div>
        <Footer db={db} note="Väterliche Linien blau, mütterliche rot" />
      </div>
    </Sheet>
  )
}

function Ahnenliste(props: DocProps) {
  const { db, personId, generations, privacy, showSources } = props
  const person = personId ? db.persons[personId] : undefined
  if (!person) return <Empty title="Keine Person gewählt" />

  const nodes = ancestorsWithKekule(db, person.id, generations - 1)
    .sort((a, b) => a.kekule - b.kekule)

  const byGen = new Map<number, typeof nodes>()
  for (const n of nodes) {
    if (!byGen.has(n.generation)) byGen.set(n.generation, [])
    byGen.get(n.generation)!.push(n)
  }

  return (
    <Sheet {...props}>
      <h1 className="doc-title">Ahnenliste</h1>
      <div className="doc-subtitle">
        {displayName(person)} {lifespan(person)}
      </div>
      <hr className="doc-rule" />

      {[...byGen.entries()].sort((a, b) => a[0] - b[0]).map(([gen, list]) => (
        <section key={gen}>
          <h2 className="gen-heading">
            {gen === 0 ? 'Proband' : `${gen}. Generation`}
            <span style={{ float: 'right', fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#666' }}>
              {list.length} von {Math.pow(2, gen)}
            </span>
          </h2>
          {list.map((n) => {
            const p = db.persons[n.personId]
            if (!p) return null
            const hidden = privacy && isProbablyLiving(p)
            const sources = showSources ? sourcesOf(db, p) : []
            return (
              <div className="entry" key={n.kekule}>
                <div className="num">{n.kekule}</div>
                <div>
                  <div className="who">
                    {hidden ? `${primaryName(p)?.surname ?? 'Unbekannt'} (lebend)` : listName(p)}
                    {n.kekule > 1 && (
                      <span style={{ fontWeight: 400, color: '#666', fontSize: '8.5pt' }}>
                        {'  '}({kekuleLine(n.kekule)})
                      </span>
                    )}
                  </div>
                  <div className="line">{lifeLine(db, p, hidden)}</div>
                  {!hidden && p.attributes.map((a) => (
                    <div className="line" key={a.id}>
                      {ATTRIBUTE_LABELS[a.type] ?? a.type}: {a.value}
                    </div>
                  ))}
                  {!hidden && spousesOf(db, p.id).map(({ person: sp, family }, i) => {
                    const marr = family.events.find((e) => e.type === 'MARR')
                    return (
                      <div className="line" key={i}>
                        ⚭ {sp ? displayName(sp) : 'unbekannt'}
                        {marr?.date ? ` ${formatDateWithPreposition(marr.date)}` : ''}
                        {marr ? `${placeLabel(db, marr) ? ` in ${placeLabel(db, marr)}` : ''}` : ''}
                      </div>
                    )
                  })}
                  {sources.length > 0 && (
                    <div className="src">Quellen: {sources.join('; ')}</div>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      ))}

      <Footer db={db} note={`${nodes.length} Ahnenstellen`} />
    </Sheet>
  )
}

function Nachkommenliste(props: DocProps) {
  const { db, personId, generations, privacy, showSources } = props
  const person = personId ? db.persons[personId] : undefined
  if (!person) return <Empty title="Keine Person gewählt" />

  const rows: { marker: string; person: Person; depth: number; spouses: string[] }[] = []
  const walk = (id: ID, depth: number, marker: string, seen: Set<ID>) => {
    if (depth >= generations || seen.has(id)) return
    seen.add(id)
    const p = db.persons[id]
    if (!p) return
    const spouses = spousesOf(db, id).map(({ person: sp, family }) => {
      const marr = family.events.find((e) => e.type === 'MARR')
      return `⚭ ${sp ? displayName(sp) : 'unbekannt'}${marr?.date ? ` ${formatDate(marr.date)}` : ''}`
    })
    rows.push({ marker, person: p, depth, spouses })
    let i = 1
    for (const { family } of spousesOf(db, id)) {
      for (const c of family.children) {
        walk(c.personId, depth + 1, `${marker}${i}.`, seen)
        i++
      }
    }
  }
  walk(person.id, 0, '1.', new Set())

  return (
    <Sheet {...props}>
      <h1 className="doc-title">Nachkommenliste</h1>
      <div className="doc-subtitle">
        {displayName(person)} {lifespan(person)} · {rows.length - 1} Nachkommen
      </div>
      <hr className="doc-rule" />

      {rows.map((r, i) => {
        const hidden = privacy && isProbablyLiving(r.person)
        return (
          <div className="desc-entry" key={i} style={{ marginLeft: `${r.depth * 6}mm` }}>
            <span className="marker">{r.marker}</span>
            <strong>{hidden ? `${primaryName(r.person)?.surname ?? '?'} (lebend)` : displayName(r.person)}</strong>
            {!hidden && <> {lifeLine(db, r.person, false)}</>}
            {!hidden && r.spouses.map((s, k) => (
              <div className="spouse" key={k} style={{ marginLeft: '6mm' }}>{s}</div>
            ))}
            {showSources && !hidden && sourcesOf(db, r.person).length > 0 && (
              <div className="src" style={{ marginLeft: '6mm' }}>
                Quellen: {sourcesOf(db, r.person).join('; ')}
              </div>
            )}
          </div>
        )
      })}

      <Footer db={db} />
    </Sheet>
  )
}

function Personenblatt(props: DocProps) {
  const { db, personId, privacy, showArms, showSources } = props
  const person = personId ? db.persons[personId] : undefined
  if (!person) return <Empty title="Keine Person gewählt" />

  const hidden = privacy && isProbablyLiving(person)
  const { father, mother } = parentsOf(db, person.id)
  const kids = childrenOf(db, person.id)
  const arms = person.armsId ? db.arms[person.armsId] : undefined

  return (
    <Sheet {...props}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6mm' }}>
        <div style={{ flex: 1 }}>
          <h1 className="doc-title" style={{ textAlign: 'left' }}>{displayName(person)}</h1>
          <div className="doc-subtitle" style={{ textAlign: 'left' }}>{lifespan(person)}</div>
        </div>
        {showArms && arms && <CoatOfArms arms={arms} size={110} />}
      </div>
      <hr className="doc-rule" />

      {hidden ? (
        <p style={{ fontStyle: 'italic' }}>
          Die Angaben zu dieser Person werden zurückgehalten, weil sie vermutlich
          noch lebt. Der Datenschutzmodus lässt sich in den Einstellungen abschalten.
        </p>
      ) : (
        <>
          <div className="form-grid">
            <div>Geschlecht</div>
            <div>{person.sex === 'M' ? 'männlich' : person.sex === 'F' ? 'weiblich' : 'unbekannt'}</div>
            {person.names.length > 1 && (
              <>
                <div>Weitere Namen</div>
                <div>{person.names.slice(1).map((n) => [n.given, n.surname].filter(Boolean).join(' ')).join('; ')}</div>
              </>
            )}
            <div>Vater</div>
            <div>{father ? `${displayName(father)} ${lifespan(father)}` : '—'}</div>
            <div>Mutter</div>
            <div>{mother ? `${displayName(mother)} ${lifespan(mother)}` : '—'}</div>
          </div>

          <div className="form-section">Ereignisse</div>
          <table className="form-table">
            <thead>
              <tr><th style={{ width: '32mm' }}>Ereignis</th><th style={{ width: '34mm' }}>Datum</th><th>Ort</th></tr>
            </thead>
            <tbody>
              {person.events.length === 0 && (
                <tr><td colSpan={3} style={{ fontStyle: 'italic', color: '#666' }}>keine Ereignisse erfasst</td></tr>
              )}
              {person.events.map((e) => (
                <tr key={e.id}>
                  <td>{eventLabel(e)}</td>
                  <td>{formatDate(e.date, true)}</td>
                  <td>{placeLabel(db, e)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {person.attributes.length > 0 && (
            <>
              <div className="form-section">Eigenschaften</div>
              <table className="form-table">
                <tbody>
                  {person.attributes.map((a) => (
                    <tr key={a.id}>
                      <td style={{ width: '32mm', fontWeight: 600 }}>{ATTRIBUTE_LABELS[a.type] ?? a.type}</td>
                      <td>{a.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="form-section">Verbindungen und Kinder</div>
          <table className="form-table">
            <thead>
              <tr><th style={{ width: '52mm' }}>Partner</th><th style={{ width: '34mm' }}>Heirat</th><th>Kinder</th></tr>
            </thead>
            <tbody>
              {spousesOf(db, person.id).length === 0 && (
                <tr><td colSpan={3} style={{ fontStyle: 'italic', color: '#666' }}>keine Verbindung erfasst</td></tr>
              )}
              {spousesOf(db, person.id).map(({ person: sp, family }) => {
                const marr = family.events.find((e) => e.type === 'MARR')
                return (
                  <tr key={family.id}>
                    <td>{sp ? `${displayName(sp)} ${lifespan(sp)}` : 'unbekannt'}</td>
                    <td>{marr ? formatDate(marr.date) : ''}</td>
                    <td>
                      {family.children
                        .map((c) => db.persons[c.personId])
                        .filter(Boolean)
                        .map((c) => `${displayName(c!)} ${lifespan(c!)}`)
                        .join('; ') || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {kids.length > 0 && (
            <p style={{ fontSize: '8.5pt', color: '#666', marginTop: '1.5mm' }}>
              Insgesamt {kids.length} Kind{kids.length === 1 ? '' : 'er'}.
            </p>
          )}

          {showSources && sourcesOf(db, person).length > 0 && (
            <>
              <div className="form-section">Quellen</div>
              <ol style={{ fontSize: '9pt', margin: 0, paddingLeft: '6mm' }}>
                {sourcesOf(db, person).map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </>
          )}

          {person.notes.length > 0 && (
            <>
              <div className="form-section">Anmerkungen</div>
              {person.notes.map((n, i) => (
                <p key={i} style={{ fontSize: '9pt', margin: '0 0 2mm', whiteSpace: 'pre-wrap' }}>{n}</p>
              ))}
            </>
          )}
        </>
      )}

      <Footer db={db} />
    </Sheet>
  )
}

function Familienbogen(props: DocProps) {
  const { db, familyId, privacy, showSources } = props
  const family: Family | undefined = familyId ? db.families[familyId] : undefined
  if (!family) return <Empty title="Keine Familie gewählt" />

  const p1 = family.partner1 ? db.persons[family.partner1] : undefined
  const p2 = family.partner2 ? db.persons[family.partner2] : undefined
  const marr = family.events.find((e) => e.type === 'MARR')

  const Block = ({ p, rolle }: { p?: Person; rolle: string }) => {
    if (!p) {
      return (
        <>
          <div className="form-section">{rolle}</div>
          <p style={{ fontStyle: 'italic', color: '#666', fontSize: '9pt' }}>nicht erfasst</p>
        </>
      )
    }
    const hidden = privacy && isProbablyLiving(p)
    const { father, mother } = parentsOf(db, p.id)
    const b = birthEvent(p)
    const d = deathEvent(p)
    return (
      <>
        <div className="form-section">{rolle}</div>
        <div className="form-grid">
          <div>Name</div>
          <div style={{ fontWeight: 700 }}>{hidden ? `${primaryName(p)?.surname ?? '?'} (lebend)` : displayName(p)}</div>
          <div>Geboren</div>
          <div>{hidden ? '—' : b ? `${formatDate(b.date, true)}${placeLabel(db, b) ? `, ${placeLabel(db, b)}` : ''}` : '—'}</div>
          <div>Gestorben</div>
          <div>{hidden ? '—' : d ? `${formatDate(d.date, true)}${placeLabel(db, d) ? `, ${placeLabel(db, d)}` : ''}` : '—'}</div>
          <div>Beruf</div>
          <div>{hidden ? '—' : p.attributes.filter((a) => a.type === 'OCCU').map((a) => a.value).join(', ') || '—'}</div>
          <div>Vater</div>
          <div>{father ? displayName(father) : '—'}</div>
          <div>Mutter</div>
          <div>{mother ? displayName(mother) : '—'}</div>
        </div>
      </>
    )
  }

  return (
    <Sheet {...props}>
      <h1 className="doc-title">Familienbogen</h1>
      <div className="doc-subtitle">
        {p1 ? displayName(p1) : '?'} ⚭ {p2 ? displayName(p2) : '?'}
      </div>
      <hr className="doc-rule" />

      <Block p={p1} rolle="Ehemann" />
      <Block p={p2} rolle="Ehefrau" />

      <div className="form-section">Eheschließung</div>
      <div className="form-grid">
        <div>Datum</div>
        <div>{marr ? formatDate(marr.date, true) : '—'}</div>
        <div>Ort</div>
        <div>{marr ? placeLabel(db, marr) || '—' : '—'}</div>
        <div>Art</div>
        <div>
          {{
            married: 'verheiratet', unmarried: 'unverheiratet',
            engaged: 'verlobt', unknown: 'unbekannt',
          }[family.unionType]}
        </div>
      </div>

      <div className="form-section">Kinder</div>
      <table className="form-table">
        <thead>
          <tr>
            <th style={{ width: '8mm' }}>Nr.</th>
            <th>Name</th>
            <th style={{ width: '30mm' }}>geboren</th>
            <th style={{ width: '30mm' }}>gestorben</th>
            <th style={{ width: '14mm' }}>Alter</th>
          </tr>
        </thead>
        <tbody>
          {family.children.length === 0 && (
            <tr><td colSpan={5} style={{ fontStyle: 'italic', color: '#666' }}>keine Kinder erfasst</td></tr>
          )}
          {family.children.map((c, i) => {
            const k = db.persons[c.personId]
            if (!k) return null
            const hidden = privacy && isProbablyLiving(k)
            const b = birthEvent(k)
            const d = deathEvent(k)
            const by = b?.date?.from?.year
            const dy = d?.date?.from?.year
            return (
              <tr key={c.personId}>
                <td>{i + 1}</td>
                <td>{hidden ? `${primaryName(k)?.surname ?? '?'} (lebend)` : displayName(k)}</td>
                <td>{hidden ? '' : formatDate(b?.date)}</td>
                <td>{hidden ? '' : formatDate(d?.date)}</td>
                <td>{!hidden && by && dy ? dy - by : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {showSources && (
        <>
          <div className="form-section">Quellen</div>
          <ol style={{ fontSize: '9pt', margin: 0, paddingLeft: '6mm' }}>
            {[...new Set([
              ...family.citations.map((c) => db.sources[c.sourceId]?.title),
              ...family.events.flatMap((e) => (e.citations ?? []).map((c) => db.sources[c.sourceId]?.title)),
            ].filter(Boolean))].map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </>
      )}

      {family.notes.length > 0 && (
        <>
          <div className="form-section">Anmerkungen</div>
          {family.notes.map((n, i) => (
            <p key={i} style={{ fontSize: '9pt', margin: '0 0 2mm' }}>{n}</p>
          ))}
        </>
      )}

      <Footer db={db} />
    </Sheet>
  )
}

function Wappenblatt(props: DocProps) {
  const { db, armsId } = props
  const arms: Arms | undefined = armsId ? db.arms[armsId] : undefined
  if (!arms) return <Empty title="Kein Wappen gewählt" />

  const bearers = Object.values(db.persons).filter((p) => p.armsId === arms.id)

  return (
    <Sheet {...props} fixedHeight>
      <div className="arms-plate" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Das Wappen bekommt den freien Raum und wird über die Höhe
            eingepasst – nicht über die Breite, sonst überläuft das
            Vollwappen mit Helmzier die Seite nach unten. */}
        <div className="arms-plate-figure" style={{ flex: 1, minHeight: 0 }}>
          <CoatOfArms arms={arms} size={900} full title={arms.name} />
        </div>

        <h1 className="arms-name">{arms.name}</h1>
        <p className="arms-blazon">{arms.blazon}</p>
        <hr className="doc-rule thin" style={{ maxWidth: '80mm', margin: '0 auto 5mm', width: '100%' }} />

        <dl className="arms-meta">
          {arms.region && (<><dt>Herkunft</dt><dd>{arms.region}</dd></>)}
          {arms.attribution && (<><dt>Nachweis</dt><dd>{arms.attribution}</dd></>)}
          {arms.motto && (<><dt>Wahlspruch</dt><dd>{arms.motto}</dd></>)}
          {(arms.usedFrom || arms.usedTo) && (
            <><dt>Belegte Führung</dt><dd>{arms.usedFrom ?? '?'} – {arms.usedTo ?? '?'}</dd></>
          )}
          {bearers.length > 0 && (
            <>
              <dt>Geführt von</dt>
              <dd>{bearers.map((p) => `${displayName(p)} (${lifespan(p) || 'ohne Daten'})`).join(', ')}</dd>
            </>
          )}
          {arms.notes.length > 0 && (<><dt>Anmerkung</dt><dd>{arms.notes.join(' ')}</dd></>)}
        </dl>

        <div style={{ marginTop: 'auto' }}>
          <Footer db={db} note="Verbindlich ist die Blasonierung, nicht die Zeichnung" />
        </div>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Werkstatt
// ---------------------------------------------------------------------------

export function PrintView() {
  const db = useStore((s) => s.db)
  const settings = useStore((s) => s.settings)
  const selectedPerson = useStore((s) => s.selectedPerson)

  const [kind, setKind] = useState<DocKind>('ahnentafelPoster')
  const [paperKey, setPaperKey] = useState('A3')
  const [orientation, setOrientation] = useState<Orientation>('landscape')
  const [margin, setMargin] = useState(15)
  const [generations, setGenerations] = useState(5)
  const [zoom, setZoom] = useState(0.55)
  const [personId, setPersonId] = useState<ID | undefined>(selectedPerson ?? db.meta.rootPersonId)
  const [familyId, setFamilyId] = useState<ID | undefined>(Object.keys(db.families)[0])
  const [armsId, setArmsId] = useState<ID | undefined>(Object.keys(db.arms)[0])
  const [privacy, setPrivacy] = useState(settings.privacyMode)
  const [showArms, setShowArms] = useState(true)
  const [showSources, setShowSources] = useState(true)

  const paper = PAPERS.find((p) => p.key === paperKey) ?? PAPERS[0]
  usePageRule(paper, orientation, margin)

  /** Beim Wechsel der Dokumentart auf ein passendes Format umstellen. */
  const chooseKind = (k: DocKind) => {
    setKind(k)
    const d = DOC_DEFAULTS[k]
    setPaperKey(d.paper)
    setOrientation(d.orientation)
    setZoom(d.paper === 'A2' ? 0.35 : d.paper === 'A3' ? 0.45 : 0.62)
  }

  const families = useMemo(
    () => Object.values(db.families).map((f) => ({
      id: f.id,
      label: `${f.partner1 ? displayName(db.persons[f.partner1]) : '?'} ⚭ ${f.partner2 ? displayName(db.persons[f.partner2]) : '?'}`,
    })).sort((a, b) => a.label.localeCompare(b.label, 'de')),
    [db],
  )

  const docProps: DocProps = {
    db, paper, orientation, margin, personId, familyId, armsId,
    generations, privacy, showArms, showSources,
  }

  const document = () => {
    switch (kind) {
      case 'ahnentafelPoster': return <AhnentafelPoster {...docProps} />
      case 'faecherPoster': return <FaecherPoster {...docProps} />
      case 'ahnenliste': return <Ahnenliste {...docProps} />
      case 'nachkommenliste': return <Nachkommenliste {...docProps} />
      case 'personenblatt': return <Personenblatt {...docProps} />
      case 'familienbogen': return <Familienbogen {...docProps} />
      case 'wappenblatt': return <Wappenblatt {...docProps} />
    }
  }

  const needsPerson = ['ahnentafelPoster', 'faecherPoster', 'ahnenliste', 'nachkommenliste', 'personenblatt'].includes(kind)
  const needsGenerations = ['ahnentafelPoster', 'faecherPoster', 'ahnenliste', 'nachkommenliste'].includes(kind)

  if (!Object.keys(db.persons).length) {
    return <div className="view"><Empty title="Kein Bestand zum Drucken" /></div>
  }

  return (
    <div className="view">
      <div className="view-head no-print">
        <h1>Druckwerkstatt</h1>
        <p>Über „Drucken“ im Druckdialog „Als PDF sichern“ wählen.</p>
      </div>

      <div className="split">
        <div className="panel no-print" style={{ order: 2 }}>
          <div className="panel-head"><h3>Einrichten</h3></div>
          <div className="panel-body">
            <Field label="Dokument">
              <select value={kind} onChange={(e) => chooseKind(e.target.value as DocKind)}>
                {(Object.keys(DOC_LABELS) as DocKind[]).map((k) => (
                  <option key={k} value={k}>{DOC_LABELS[k]}</option>
                ))}
              </select>
            </Field>

            {needsPerson && <PersonPicker label="Bezugsperson" value={personId} onChange={setPersonId} />}

            {kind === 'familienbogen' && (
              <Field label="Familie">
                <select value={familyId ?? ''} onChange={(e) => setFamilyId(e.target.value || undefined)}>
                  {!families.length && <option value="">keine Familie erfasst</option>}
                  {families.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </Field>
            )}

            {kind === 'wappenblatt' && (
              <Field label="Wappen">
                <select value={armsId ?? ''} onChange={(e) => setArmsId(e.target.value || undefined)}>
                  {!Object.keys(db.arms).length && <option value="">kein Wappen erfasst</option>}
                  {Object.values(db.arms).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            )}

            {needsGenerations && (
              <Field label={`Generationen: ${generations}`}>
                <input type="range" min={2} max={kind === 'ahnentafelPoster' ? 8 : 12} value={generations}
                  onChange={(e) => setGenerations(Number(e.target.value))} />
              </Field>
            )}

            <div className="grid2">
              <Field label="Papier">
                <select value={paperKey} onChange={(e) => setPaperKey(e.target.value)}>
                  {PAPERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Ausrichtung">
                <select value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)}>
                  <option value="portrait">Hochformat</option>
                  <option value="landscape">Querformat</option>
                </select>
              </Field>
            </div>

            <Field label={`Seitenrand: ${margin} mm`}>
              <input type="range" min={8} max={30} value={margin}
                onChange={(e) => setMargin(Number(e.target.value))} />
            </Field>

            <label style={{ display: 'block', marginBottom: 5, fontSize: 13 }}>
              <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />{' '}
              Angaben lebender Personen zurückhalten
            </label>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 13 }}>
              <input type="checkbox" checked={showArms} onChange={(e) => setShowArms(e.target.checked)} /> Wappen zeigen
            </label>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
              <input type="checkbox" checked={showSources} onChange={(e) => setShowSources(e.target.checked)} /> Quellen anführen
            </label>

            <Field label={`Vorschau: ${Math.round(zoom * 100)} %`}>
              <input type="range" min={20} max={100} value={Math.round(zoom * 100)}
                onChange={(e) => setZoom(Number(e.target.value) / 100)} />
            </Field>

            <button className="btn primary" style={{ width: '100%' }} onClick={() => window.print()}>
              Drucken oder als PDF sichern
            </button>

            <p style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 0 }}>
              Im Druckdialog als Ziel „Als PDF speichern“ wählen. Das Papierformat ist
              bereits auf {paper.label.split(' ')[0]} {orientation === 'portrait' ? 'hoch' : 'quer'} gesetzt.
              Damit Wappen und Tabellenköpfe farbig erscheinen, muss die Einstellung
              „Hintergrundgrafiken“ aktiv sein.
            </p>
          </div>
        </div>

        <div style={{ order: 1, minWidth: 0, overflowX: 'auto' }}>
          {/* `zoom` statt `transform: scale` – nur so schrumpft auch der
              Platzbedarf, sonst überdeckt die Vorschau das Bedienfeld. */}
          <div className="print-preview" style={{ zoom }}>
            {document()}
          </div>
        </div>
      </div>
    </div>
  )
}
