/**
 * Diagramme.
 *
 * Ahnentafel, Fächerdiagramm, Nachkommenliste und Sanduhr. Alle Ansichten
 * arbeiten mit demselben Kartenformat und sind so aufgebaut, dass sie sich
 * über die Druckfunktion des Browsers sauber auf Papier bringen lassen.
 */

import { useMemo, useRef, useState } from 'react'
import { downloadText } from '../../core/db'
import {
  birthYear, deathYear, displayName, isProbablyLiving, lifespan, primaryName,
} from '../../core/model'
import { ancestorsWithKekule } from '../../core/relations'
import { useStore } from '../../core/store'
import type { Database, ID, Person } from '../../core/types'
import { CoatOfArms } from '../../heraldry/render'
import { Empty } from '../components'

// ---------------------------------------------------------------------------

function useRoot(): Person | undefined {
  const db = useStore((s) => s.db)
  const selected = useStore((s) => s.selectedPerson)
  const id = selected ?? db.meta.rootPersonId
  return id ? db.persons[id] : Object.values(db.persons)[0]
}

/** Blendet Angaben lebender Personen aus, wenn der Datenschutzmodus aktiv ist. */
function labelFor(p: Person, privacy: boolean): { name: string; dates: string; hidden: boolean } {
  if (privacy && isProbablyLiving(p)) {
    const n = primaryName(p)
    return { name: `${n?.surname ?? 'Lebend'} (lebend)`, dates: '', hidden: true }
  }
  return { name: displayName(p), dates: lifespan(p), hidden: false }
}

function ExportButtons({ svgRef, name }: { svgRef: React.RefObject<SVGSVGElement | null>; name: string }) {
  const notify = useStore((s) => s.notify)
  return (
    <>
      <button
        className="btn small"
        onClick={() => {
          const svg = svgRef.current
          if (!svg) return
          const clone = svg.cloneNode(true) as SVGSVGElement
          clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
          downloadText(`${name}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`, 'image/svg+xml')
          notify('Diagramm als SVG gesichert.', 'success')
        }}
      >
        SVG sichern
      </button>
      <button className="btn small" onClick={() => window.print()}>Drucken</button>
    </>
  )
}

// ---------------------------------------------------------------------------
// Ahnentafel
// ---------------------------------------------------------------------------

const BOX_W = 178
const BOX_H = 46

export interface PedigreeSVGProps {
  db: Database
  rootId: ID
  generations: number
  showKekule?: boolean
  showArms?: boolean
  privacy?: boolean
  /** Für Papier: helle Flächen und schwarze Schrift statt Oberflächenfarben. */
  forPrint?: boolean
  svgRef?: React.Ref<SVGSVGElement>
  onSelect?: (id: ID) => void
}

/**
 * Die Ahnentafel als reines SVG, ohne Bedienelemente. So lässt sie sich sowohl
 * in der Ansicht als auch in der Druckwerkstatt verwenden, ohne den Aufbau
 * zweimal zu pflegen.
 */
export function PedigreeSVG({
  db, rootId, generations, showKekule = true, showArms = true, privacy = true,
  forPrint = false, svgRef, onSelect,
}: PedigreeSVGProps) {
  const nodes = useMemo(
    () => ancestorsWithKekule(db, rootId, generations - 1),
    [db, rootId, generations],
  )

  const rows = Math.pow(2, generations - 1)
  const vgap = 12
  const height = rows * (BOX_H + vgap)
  const width = generations * (BOX_W + 54)

  const ink = forPrint ? '#1a1a1a' : 'var(--ink)'
  const inkSoft = forPrint ? '#555' : 'var(--ink-soft)'
  const line = forPrint ? '#999' : 'var(--line-strong)'
  const paper = forPrint ? '#ffffff' : 'var(--bg-panel)'
  const gold = forPrint ? '#8a6a12' : 'var(--gold)'

  const position = (kekule: number, generation: number) => {
    const indexInGen = kekule - Math.pow(2, generation)
    const slots = Math.pow(2, generation)
    return {
      x: generation * (BOX_W + 54) + 8,
      y: (height * (indexInGen + 0.5)) / slots - BOX_H / 2,
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height + 20}`}
      width={forPrint ? '100%' : width}
      height={forPrint ? undefined : height + 20}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', minWidth: forPrint ? undefined : '100%' }}
    >
      <rect width={width} height={height + 20} fill={paper} />
      {/* Verbindungslinien zuerst, damit sie hinter den Karten liegen */}
      {nodes.map((n) => {
        if (n.generation === 0) return null
        const child = nodes.find((m) => m.kekule === Math.floor(n.kekule / 2))
        if (!child) return null
        const a = position(child.kekule, child.generation)
        const b = position(n.kekule, n.generation)
        const x1 = a.x + BOX_W
        const y1 = a.y + BOX_H / 2
        const x2 = b.x
        const y2 = b.y + BOX_H / 2
        const mid = x1 + 26
        return (
          <path
            key={`l${n.kekule}`}
            d={`M${x1} ${y1} H${mid} V${y2} H${x2}`}
            fill="none"
            stroke={line}
            strokeWidth={1.4}
          />
        )
      })}

      {nodes.map((n) => {
        const p = db.persons[n.personId]
        if (!p) return null
        const { x, y } = position(n.kekule, n.generation)
        const { name, dates } = labelFor(p, privacy)
        const sexColour = p.sex === 'F'
          ? (forPrint ? '#8b1a1a' : 'var(--accent)')
          : p.sex === 'M' ? (forPrint ? '#20487a' : 'var(--blue)') : line
        const arms = p.armsId ? db.arms[p.armsId] : undefined
        return (
          <g
            key={`${n.kekule}`}
            transform={`translate(${x} ${y})`}
            style={onSelect ? { cursor: 'pointer' } : undefined}
            onClick={onSelect ? () => onSelect(p.id) : undefined}
          >
            <rect width={BOX_W} height={BOX_H} rx={5} fill={paper} stroke={line} strokeWidth={1} />
            <rect width={3.5} height={BOX_H} rx={2} fill={sexColour} />
            {showArms && arms && (
              <g transform={`translate(${BOX_W - 30} 6) scale(0.9)`}>
                <CoatOfArms arms={arms} size={26} relief={false} />
              </g>
            )}
            <text x={11} y={19} fontSize={12.5} fontWeight={600} fill={ink}>
              {(() => {
                // Neben dem Wappenschild bleibt weniger Platz für den Namen
                const limit = showArms && arms ? 20 : 25
                return name.length > limit ? name.slice(0, limit - 1) + '…' : name
              })()}
            </text>
            <text x={11} y={34} fontSize={11} fill={inkSoft}>
              {showKekule && <tspan fill={gold} fontWeight={700}>{n.kekule} </tspan>}
              {dates}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function PedigreeChart() {
  const db = useStore((s) => s.db)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const selectPerson = useStore((s) => s.selectPerson)
  const root = useRoot()
  const svgRef = useRef<SVGSVGElement>(null)

  const gens = settings.pedigreeGenerations

  const filled = useMemo(
    () => (root ? ancestorsWithKekule(db, root.id, gens - 1).length : 0),
    [db, root, gens],
  )

  if (!root) return <Empty title="Keine Person ausgewählt">Legen Sie zuerst eine Person an.</Empty>

  return (
    <div className="view">
      <div className="view-head">
        <h1>Ahnentafel</h1>
        <p>Nummerierung nach Kekulé von Stradonitz: Vater 2n, Mutter 2n+1.</p>
      </div>

      <div className="chart-wrap">
        <div className="toolbar">
          <strong>{displayName(root)}</strong>
          <label>
            Generationen
            <input
              type="range" min={2} max={9} value={gens}
              onChange={(e) => setSettings({ pedigreeGenerations: Number(e.target.value) })}
            />
            {gens}
          </label>
          <label>
            <input
              type="checkbox" checked={settings.showKekule}
              onChange={(e) => setSettings({ showKekule: e.target.checked })}
            />
            Kekulé-Nummern
          </label>
          <div className="topbar-spacer" style={{ flex: 1 }} />
          <ExportButtons svgRef={svgRef} name={`Ahnentafel ${displayName(root)}`} />
        </div>

        <PedigreeSVG
          db={db}
          rootId={root.id}
          generations={gens}
          showKekule={settings.showKekule}
          showArms={settings.showArms}
          privacy={settings.privacyMode}
          svgRef={svgRef}
          onSelect={(id) => selectPerson(id, 'person')}
        />
      </div>

      <p style={{ color: 'var(--ink-faint)', fontSize: 12, marginTop: 10 }}>
        {filled} von {Math.pow(2, gens) - 1} möglichen Ahnenstellen besetzt.
        Fehlende Vorfahren zeigen an, wo weiter zu forschen ist.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fächerdiagramm
// ---------------------------------------------------------------------------

export interface FanSVGProps {
  db: Database
  rootId: ID
  generations: number
  sweep?: number
  privacy?: boolean
  forPrint?: boolean
  svgRef?: React.Ref<SVGSVGElement>
  onSelect?: (id: ID) => void
}

/** Das Fächerdiagramm als reines SVG – für die Ansicht und für den Druck. */
export function FanSVG({
  db, rootId, generations: gens, sweep = 270, privacy = true,
  forPrint = false, svgRef, onSelect,
}: FanSVGProps) {
  const nodes = useMemo(() => ancestorsWithKekule(db, rootId, gens - 1), [db, rootId, gens])

  const size = 760
  const cx = size / 2
  const cy = size / 2
  const innerR = 42
  const ringW = (size / 2 - innerR - 14) / Math.max(1, gens - 1)
  const startAngle = -90 - sweep / 2

  const arcPath = (g: number, index: number, slots: number) => {
    const r0 = innerR + (g - 1) * ringW
    const r1 = r0 + ringW
    const a0 = ((startAngle + (sweep * index) / slots) * Math.PI) / 180
    const a1 = ((startAngle + (sweep * (index + 1)) / slots) * Math.PI) / 180
    const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`
    const large = (a1 - a0) > Math.PI ? 1 : 0
    return `M${p(r0, a0)} A${r0} ${r0} 0 ${large} 1 ${p(r0, a1)} L${p(r1, a1)} A${r1} ${r1} 0 ${large} 0 ${p(r1, a0)} Z`
  }

  const ink = forPrint ? '#1a1a1a' : 'var(--ink)'
  const inkSoft = forPrint ? '#555' : 'var(--ink-soft)'
  const paper = forPrint ? '#ffffff' : 'var(--bg-panel)'

  /** Farbe nach Ahnenlinie: väterlich kühl, mütterlich warm. */
  const colourFor = (kekule: number, generation: number) => {
    if (generation === 0) return forPrint ? '#f5eeda' : 'var(--gold-soft)'
    const paternal = kekule < Math.pow(2, generation) * 1.5
    const depth = 1 - generation / (gens + 1)
    const pct = paternal ? 18 + depth * 26 : 16 + depth * 24
    if (forPrint) {
      // Im Druck ohne color-mix rechnen, damit auch ältere Druckwege stimmen
      const mix = (a: [number, number, number], p: number) =>
        `rgb(${a.map((v) => Math.round(255 + (v - 255) * (p / 100))).join(' ')})`
      return paternal ? mix([32, 72, 122], pct) : mix([139, 26, 26], pct)
    }
    return paternal
      ? `color-mix(in srgb, var(--blue) ${pct}%, var(--bg-panel))`
      : `color-mix(in srgb, var(--accent) ${pct}%, var(--bg-panel))`
  }

  return (
    <svg
      ref={svgRef}
      width={forPrint ? '100%' : size}
      height={forPrint ? undefined : size}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}
    >
      <rect width={size} height={size} fill={paper} />
      {nodes.map((n) => {
        const p = db.persons[n.personId]
        if (!p) return null
        const { name, dates } = labelFor(p, privacy)

        if (n.generation === 0) {
          return (
            <g
              key="root"
              style={onSelect ? { cursor: 'pointer' } : undefined}
              onClick={onSelect ? () => onSelect(p.id) : undefined}
            >
              <circle cx={cx} cy={cy} r={innerR} fill={colourFor(1, 0)} stroke={forPrint ? '#8a6a12' : 'var(--gold)'} strokeWidth={1.5} />
              <text x={cx} y={cy - 2} textAnchor="middle" fontSize={11} fontWeight={700} fill={ink}>
                {(primaryName(p)?.surname ?? '').slice(0, 12)}
              </text>
              <text x={cx} y={cy + 11} textAnchor="middle" fontSize={9.5} fill={inkSoft}>
                {(primaryName(p)?.given ?? '').split(' ')[0]}
              </text>
            </g>
          )
        }

            const slots = Math.pow(2, n.generation)
            const index = n.kekule - slots
            const midAngle = startAngle + (sweep * (index + 0.5)) / slots
            const rMid = innerR + (n.generation - 1) * ringW + ringW / 2
            const rad = (midAngle * Math.PI) / 180
            const tx = cx + rMid * Math.cos(rad)
            const ty = cy + rMid * Math.sin(rad)

            // In den inneren Ringen ist der Bogen lang und der Ring schmal –
            // dort läuft die Schrift am Bogen entlang. Weiter außen kehrt sich
            // das Verhältnis um, und die Schrift läuft radial nach außen.
            const tangential = n.generation <= 2
            let rot = tangential ? midAngle + 90 : midAngle
            if (rot > 90) rot -= 180
            else if (rot < -90) rot += 180

            const fontSize = n.generation > 5 ? 7.5 : n.generation > 3 ? 8.5 : 10
            const arcLength = (2 * Math.PI * rMid * (sweep / slots)) / 360
            const available = (tangential ? arcLength : ringW) - 8
            const maxChars = Math.max(4, Math.floor(available / (fontSize * 0.53)))
            const short = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name
            const showDates = !!dates && n.generation < 6 && (tangential ? arcLength > 46 : ringW > 40)

        return (
          <g
            key={n.kekule}
            style={onSelect ? { cursor: 'pointer' } : undefined}
            onClick={onSelect ? () => onSelect(p.id) : undefined}
          >
            <path
              d={arcPath(n.generation, index, slots)}
              fill={colourFor(n.kekule, n.generation)}
              stroke={paper}
              strokeWidth={1.5}
            />
            <g transform={`translate(${tx} ${ty}) rotate(${rot})`}>
              <text textAnchor="middle" fontSize={fontSize} fontWeight={600} fill={ink} y={showDates ? -2 : 3}>
                {short}
              </text>
              {showDates && (
                <text textAnchor="middle" fontSize={fontSize - 2} fill={inkSoft} y={9}>{dates}</text>
              )}
            </g>
          </g>
        )
      })}
    </svg>
  )
}

export function FanChart() {
  const db = useStore((s) => s.db)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const selectPerson = useStore((s) => s.selectPerson)
  const root = useRoot()
  const svgRef = useRef<SVGSVGElement>(null)
  const [sweep, setSweep] = useState(270)

  if (!root) return <Empty title="Keine Person ausgewählt" />

  return (
    <div className="view">
      <div className="view-head">
        <h1>Fächerdiagramm</h1>
        <p>Väterliche Linien blau, mütterliche rot – Lücken werden sofort sichtbar.</p>
      </div>

      <div className="chart-wrap">
        <div className="toolbar">
          <strong>{displayName(root)}</strong>
          <label>
            Generationen
            <input type="range" min={3} max={9} value={settings.fanGenerations}
              onChange={(e) => setSettings({ fanGenerations: Number(e.target.value) })} />
            {settings.fanGenerations}
          </label>
          <label>
            Öffnung
            <input type="range" min={180} max={360} step={15} value={sweep}
              onChange={(e) => setSweep(Number(e.target.value))} />
            {sweep}°
          </label>
          <div style={{ flex: 1 }} />
          <ExportButtons svgRef={svgRef} name={`Fächer ${displayName(root)}`} />
        </div>

        <FanSVG
          db={db}
          rootId={root.id}
          generations={settings.fanGenerations}
          sweep={sweep}
          privacy={settings.privacyMode}
          svgRef={svgRef}
          onSelect={(id) => selectPerson(id, 'person')}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nachkommen
// ---------------------------------------------------------------------------

interface DescNode {
  person: Person
  depth: number
  spouses: { person?: Person; marriage?: string }[]
  children: DescNode[]
}

function buildDescendants(db: Database, id: ID, depth: number, max: number, seen: Set<ID>): DescNode | null {
  const person = db.persons[id]
  if (!person || seen.has(id)) return null
  seen.add(id)
  const spouses: DescNode['spouses'] = []
  const children: DescNode[] = []
  if (depth < max) {
    for (const fid of person.spouseIn) {
      const f = db.families[fid]
      if (!f) continue
      const otherId = f.partner1 === id ? f.partner2 : f.partner1
      spouses.push({ person: otherId ? db.persons[otherId] : undefined })
      for (const c of f.children) {
        const node = buildDescendants(db, c.personId, depth + 1, max, seen)
        if (node) children.push(node)
      }
    }
  }
  return { person, depth, spouses, children }
}

function DescRow({ node, privacy }: { node: DescNode; privacy: boolean }) {
  const selectPerson = useStore((s) => s.selectPerson)
  const [open, setOpen] = useState(node.depth < 3)
  const { name, dates } = labelFor(node.person, privacy)
  const hasKids = node.children.length > 0

  return (
    <li style={{ listStyle: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
        <button
          className="btn ghost small"
          style={{ width: 20, visibility: hasKids ? 'visible' : 'hidden', padding: 0 }}
          onClick={() => setOpen(!open)}
        >
          {open ? '▾' : '▸'}
        </button>
        <button className="btn ghost small" style={{ fontWeight: 600 }} onClick={() => selectPerson(node.person.id, 'person')}>
          {name}
        </button>
        <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{dates}</span>
        {node.spouses.map((s, i) => (
          <span key={i} style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            ⚭ {s.person ? displayName(s.person) : 'unbekannt'}
          </span>
        ))}
        {hasKids && <span className="tag">{node.children.length} Kinder</span>}
      </div>
      {open && hasKids && (
        <ul style={{ margin: 0, paddingLeft: 22, borderLeft: '1px solid var(--line)' }}>
          {node.children.map((c) => <DescRow key={c.person.id} node={c} privacy={privacy} />)}
        </ul>
      )}
    </li>
  )
}

export function DescendantChart() {
  const db = useStore((s) => s.db)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const root = useRoot()

  const tree = useMemo(
    () => (root ? buildDescendants(db, root.id, 0, settings.descendantGenerations, new Set()) : null),
    [db, root, settings.descendantGenerations],
  )

  if (!root || !tree) return <Empty title="Keine Person ausgewählt" />

  const count = (n: DescNode): number => 1 + n.children.reduce((s, c) => s + count(c), 0)

  return (
    <div className="view">
      <div className="view-head">
        <h1>Nachkommen</h1>
        <p>{count(tree) - 1} Nachkommen in {settings.descendantGenerations} Generationen.</p>
      </div>
      <div className="panel">
        <div className="toolbar">
          <strong>{displayName(root)}</strong>
          <label>
            Generationen
            <input type="range" min={1} max={8} value={settings.descendantGenerations}
              onChange={(e) => setSettings({ descendantGenerations: Number(e.target.value) })} />
            {settings.descendantGenerations}
          </label>
          <div style={{ flex: 1 }} />
          <button className="btn small" onClick={() => window.print()}>Drucken</button>
        </div>
        <div className="panel-body">
          <ul style={{ margin: 0, padding: 0 }}>
            <DescRow node={tree} privacy={settings.privacyMode} />
          </ul>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sanduhr
// ---------------------------------------------------------------------------

export function HourglassChart() {
  const db = useStore((s) => s.db)
  const settings = useStore((s) => s.settings)
  const selectPerson = useStore((s) => s.selectPerson)
  const root = useRoot()
  const [up, setUp] = useState(3)
  const [down, setDown] = useState(3)

  if (!root) return <Empty title="Keine Person ausgewählt" />

  const ancestors = ancestorsWithKekule(db, root.id, up)
  const byGen = new Map<number, typeof ancestors>()
  for (const a of ancestors) {
    if (a.generation === 0) continue
    if (!byGen.has(a.generation)) byGen.set(a.generation, [])
    byGen.get(a.generation)!.push(a)
  }

  const descTree = buildDescendants(db, root.id, 0, down, new Set())

  const Card = ({ p }: { p: Person }) => {
    const { name, dates } = labelFor(p, settings.privacyMode)
    return (
      <button className={`person-card sex-${p.sex}`} onClick={() => selectPerson(p.id, 'person')} style={{ minWidth: 128 }}>
        <div className="nm">{name}</div>
        <div className="dt">{dates}</div>
      </button>
    )
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Sanduhr</h1>
        <p>Vorfahren nach oben, Nachkommen nach unten – die ganze Umgebung einer Person auf einen Blick.</p>
      </div>
      <div className="panel">
        <div className="toolbar">
          <strong>{displayName(root)}</strong>
          <label>Vorfahren <input type="range" min={1} max={6} value={up} onChange={(e) => setUp(Number(e.target.value))} />{up}</label>
          <label>Nachkommen <input type="range" min={1} max={5} value={down} onChange={(e) => setDown(Number(e.target.value))} />{down}</label>
        </div>
        <div className="panel-body">
          {[...byGen.entries()].sort((a, b) => b[0] - a[0]).map(([gen, list]) => (
            <div key={gen} style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ alignSelf: 'center', fontSize: 11, color: 'var(--ink-faint)', width: 70, textAlign: 'right' }}>
                {gen}. Generation
              </span>
              {list.map((a) => {
                const p = db.persons[a.personId]
                return p ? <Card key={a.kekule} p={p} /> : null
              })}
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
            <div style={{ outline: '2px solid var(--gold)', borderRadius: 8 }}>
              <Card p={root} />
            </div>
          </div>

          {descTree && (
            <ul style={{ margin: 0, padding: 0 }}>
              {descTree.children.map((c) => <DescRow key={c.person.id} node={c} privacy={settings.privacyMode} />)}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zeitstrahl
// ---------------------------------------------------------------------------

export function TimelineView() {
  const db = useStore((s) => s.db)
  const selectPerson = useStore((s) => s.selectPerson)
  const settings = useStore((s) => s.settings)
  const [filter, setFilter] = useState('')

  const people = useMemo(() => {
    const list = Object.values(db.persons)
      .map((p) => ({ p, b: birthYear(p), d: deathYear(p) }))
      .filter((x) => x.b !== null || x.d !== null)
      .sort((a, b) => (a.b ?? a.d ?? 0) - (b.b ?? b.d ?? 0))
    if (!filter) return list
    const q = filter.toLowerCase()
    return list.filter((x) => displayName(x.p).toLowerCase().includes(q))
  }, [db.persons, filter])

  if (!people.length) return <Empty title="Keine datierten Personen" />

  const minYear = Math.min(...people.map((x) => x.b ?? x.d ?? 2000)) - 5
  const maxYear = Math.max(...people.map((x) => x.d ?? x.b ?? 1900)) + 5
  const span = Math.max(1, maxYear - minYear)
  const rowH = 20
  const width = 1000
  const labelW = 210

  const decades: number[] = []
  for (let y = Math.ceil(minYear / 25) * 25; y < maxYear; y += 25) decades.push(y)

  return (
    <div className="view">
      <div className="view-head">
        <h1>Zeitstrahl</h1>
        <p>Lebensspannen im Vergleich. Wer hat wen noch erlebt?</p>
      </div>
      <div className="chart-wrap">
        <div className="toolbar">
          <input type="search" placeholder="Namen filtern …" value={filter}
            onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 260 }} />
          <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{people.length} Personen, {minYear}–{maxYear}</span>
        </div>
        <svg width={width + labelW} height={people.length * rowH + 40} style={{ display: 'block' }}>
          <rect width={width + labelW} height={people.length * rowH + 40} fill="var(--bg-panel)" />
          {decades.map((y) => {
            const x = labelW + ((y - minYear) / span) * width
            return (
              <g key={y}>
                <line x1={x} y1={20} x2={x} y2={people.length * rowH + 26} stroke="var(--line)" strokeWidth={1} />
                <text x={x} y={14} fontSize={10} fill="var(--ink-faint)" textAnchor="middle">{y}</text>
              </g>
            )
          })}
          {people.map((x, i) => {
            const y = 26 + i * rowH
            const b = x.b ?? x.d!
            const d = x.d ?? Math.min(b + 60, maxYear)
            const x1 = labelW + ((b - minYear) / span) * width
            const x2 = labelW + ((d - minYear) / span) * width
            const { name } = labelFor(x.p, settings.privacyMode)
            const estimated = x.d === null
            return (
              <g key={x.p.id} style={{ cursor: 'pointer' }} onClick={() => selectPerson(x.p.id, 'person')}>
                <text x={labelW - 8} y={y + 10} fontSize={11} textAnchor="end" fill="var(--ink)">
                  {name.length > 28 ? name.slice(0, 27) + '…' : name}
                </text>
                <rect
                  x={x1} y={y + 2} width={Math.max(3, x2 - x1)} height={rowH - 7} rx={3}
                  fill={x.p.sex === 'F' ? 'var(--accent)' : x.p.sex === 'M' ? 'var(--blue)' : 'var(--ink-faint)'}
                  opacity={estimated ? 0.35 : 0.8}
                  strokeDasharray={estimated ? '3 3' : undefined}
                  stroke={estimated ? 'var(--ink-faint)' : 'none'}
                />
              </g>
            )
          })}
        </svg>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 8 }}>
        Blasse Balken bedeuten ein geschätztes Lebensende, weil kein Sterbedatum erfasst ist.
      </p>
    </div>
  )
}

export { useRoot, labelFor }
