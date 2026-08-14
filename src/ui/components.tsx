/** Wiederverwendete Bausteine der Oberfläche. */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { formatDate, parseDate } from '../core/dates'
import { displayName, lifespan, listName, normalizeName, primaryName } from '../core/model'
import { useStore } from '../core/store'
import type { Database, GDate, ID, Person, Sex } from '../core/types'

// ---------------------------------------------------------------------------

export function Field({
  label, hint, children, wide,
}: { label?: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="field" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Modal({
  title, children, onClose, footer, wide,
}: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={wide ? { maxWidth: 940 } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <div>{children}</div>}
    </div>
  )
}

export function Panel({
  title, actions, children, bodyStyle,
}: { title?: string; actions?: ReactNode; children: ReactNode; bodyStyle?: React.CSSProperties }) {
  return (
    <div className="panel">
      {(title || actions) && (
        <div className="panel-head">
          {title && <h3>{title}</h3>}
          {actions}
        </div>
      )}
      <div className="panel-body" style={bodyStyle}>{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * Eingabefeld für genealogische Datumsangaben. Zeigt unterhalb, wie die
 * Eingabe gedeutet wurde – so merkt man sofort, wenn „um 1720“ als Text statt
 * als Zirka-Angabe gelesen wurde.
 */
export function DateField({
  value, onChange, label = 'Datum',
}: { value?: GDate; onChange: (d: GDate | undefined) => void; label?: string }) {
  const [text, setText] = useState(() => (value ? formatDate(value) : ''))
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!touched) setText(value ? formatDate(value) : '')
  }, [value, touched])

  const parsed = useMemo(() => parseDate(text), [text])

  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="text"
        value={text}
        placeholder="14.08.1723 · um 1720 · vor 1750 · zwischen 1720 und 1725"
        onChange={(e) => { setTouched(true); setText(e.target.value) }}
        onBlur={() => { setTouched(false); onChange(parsed ?? undefined) }}
      />
      {text && (
        <span className="hint">
          {parsed
            ? parsed.modifier === 'phrase'
              ? `als Text übernommen: „${parsed.phrase}“`
              : `gelesen als: ${formatDate(parsed, true)}`
            : 'nicht deutbar – wird als Text gespeichert'}
        </span>
      )}
    </div>
  )
}

/** Ortsfeld mit Vorschlägen aus den bereits erfassten Orten. */
export function PlaceField({
  value, onChange, label = 'Ort',
}: { value?: string; onChange: (v: string) => void; label?: string }) {
  const db = useStore((s) => s.db)
  const id = useMemo(() => `places-${Math.random().toString(36).slice(2)}`, [])
  const options = useMemo(
    () => Object.values(db.places).map((p) => [p.name, ...(p.hierarchy ?? [])].filter(Boolean).join(', ')),
    [db.places],
  )
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="text"
        list={id}
        value={value ?? ''}
        placeholder="Hüfingen, Baden, Deutschland"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={id}>
        {options.slice(0, 400).map((o, i) => <option key={i} value={o} />)}
      </datalist>
    </div>
  )
}

// ---------------------------------------------------------------------------

export const SEX_SYMBOL: Record<Sex, string> = { M: '♂', F: '♀', U: '○', X: '⚧' }

export function PersonChip({
  person, onClick, root,
}: { person?: Person; onClick?: () => void; root?: boolean }) {
  if (!person) return <span style={{ color: 'var(--ink-faint)' }}>unbekannt</span>
  return (
    <button
      className={`person-card sex-${person.sex === 'F' ? 'F' : person.sex === 'M' ? 'M' : 'U'}${root ? ' root' : ''}`}
      onClick={onClick}
      style={{ textAlign: 'left', width: '100%' }}
    >
      <div className="nm">{displayName(person)}</div>
      <div className="dt">{lifespan(person)}</div>
    </button>
  )
}

/**
 * Personensuche. Sucht über alle Namensformen, nicht nur den Hauptnamen –
 * eine Frau erscheint in Quellen mal unter Geburts-, mal unter Ehenamen.
 */
export function PersonPicker({
  value, onChange, label = 'Person', exclude, allowEmpty = true,
}: {
  value?: ID
  onChange: (id: ID | undefined) => void
  label?: string
  exclude?: ID[]
  allowEmpty?: boolean
}) {
  const db = useStore((s) => s.db)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const results = useMemo(() => {
    const q = normalizeName(query)
    const list = Object.values(db.persons).filter((p) => !exclude?.includes(p.id))
    if (!q) return list.slice(0, 40)
    return list
      .filter((p) => p.names.some((n) => normalizeName([n.given, n.surname, n.nickname].filter(Boolean).join(' ')).includes(q)))
      .slice(0, 60)
  }, [db.persons, query, exclude])

  const current = value ? db.persons[value] : undefined

  return (
    <div className="field" ref={boxRef} style={{ position: 'relative' }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="search"
          value={open ? query : current ? `${listName(current)} ${lifespan(current)}` : ''}
          placeholder="Namen eingeben …"
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={(e) => setQuery(e.target.value)}
        />
        {allowEmpty && current && (
          <button className="btn small" onClick={() => onChange(undefined)} title="Zuordnung lösen">✕</button>
        )}
      </div>
      {open && (
        <div
          className="panel"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, maxHeight: 280, overflowY: 'auto', marginTop: 2 }}
        >
          {results.length === 0 && <div style={{ padding: 10, color: 'var(--ink-faint)' }}>Keine Treffer.</div>}
          {results.map((p) => (
            <button
              key={p.id}
              className="btn ghost"
              style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 0 }}
              onClick={() => { onChange(p.id); setOpen(false) }}
            >
              <span style={{ opacity: 0.6, marginRight: 5 }}>{SEX_SYMBOL[p.sex]}</span>
              {listName(p)} <span style={{ color: 'var(--ink-faint)' }}>{lifespan(p)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

/** Zeigt einen Namen und springt bei Klick zur Person. */
export function PersonLink({ id, db }: { id?: ID; db: Database }) {
  const selectPerson = useStore((s) => s.selectPerson)
  const p = id ? db.persons[id] : undefined
  if (!p) return <span style={{ color: 'var(--ink-faint)' }}>unbekannt</span>
  return (
    <button
      className="btn ghost small"
      style={{ padding: '0 2px', color: 'var(--accent)' }}
      onClick={() => selectPerson(p.id, 'person')}
    >
      {displayName(p)}
    </button>
  )
}

/** Sortierbare Tabellenüberschrift. */
export function Th<T extends string>({
  col, label, sort, setSort, align,
}: {
  col: T
  label: string
  sort: { col: T; dir: 1 | -1 }
  setSort: (s: { col: T; dir: 1 | -1 }) => void
  align?: 'right'
}) {
  const active = sort.col === col
  return (
    <th
      style={{ textAlign: align ?? 'left' }}
      onClick={() => setSort({ col, dir: active && sort.dir === 1 ? -1 : 1 })}
    >
      {label}
      {active && <span style={{ marginLeft: 4 }}>{sort.dir === 1 ? '▲' : '▼'}</span>}
    </th>
  )
}

/** Bestätigungsdialog für alles, was Daten unwiederbringlich entfernt. */
export function ConfirmButton({
  label, message, onConfirm, className = 'btn danger small',
}: { label: string; message: string; onConfirm: () => void; className?: string }) {
  const [asking, setAsking] = useState(false)
  return (
    <>
      <button className={className} onClick={() => setAsking(true)}>{label}</button>
      {asking && (
        <Modal
          title="Wirklich löschen?"
          onClose={() => setAsking(false)}
          footer={
            <>
              <button className="btn" onClick={() => setAsking(false)}>Abbrechen</button>
              <button className="btn primary" onClick={() => { onConfirm(); setAsking(false) }}>Löschen</button>
            </>
          }
        >
          <p>{message}</p>
          <p style={{ color: 'var(--ink-faint)', fontSize: 12 }}>
            Rückgängig machen ist über Strg+Z möglich, solange das Programm geöffnet bleibt.
          </p>
        </Modal>
      )}
    </>
  )
}

/** Kleiner Namenszusatz für Listen: Geschlechtssymbol und Lebensdaten. */
export function NameCell({ person }: { person: Person }) {
  const n = primaryName(person)
  return (
    <>
      <span style={{ opacity: 0.55, marginRight: 6 }}>{SEX_SYMBOL[person.sex]}</span>
      <span style={{ fontWeight: 600 }}>{n?.surname ?? '—'}</span>
      {n?.given ? `, ${n.given}` : ''}
    </>
  )
}
