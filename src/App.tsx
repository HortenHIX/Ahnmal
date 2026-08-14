/**
 * Anwendungsrahmen: Navigation, Kopfleiste, Tastaturkürzel.
 */

import { useEffect } from 'react'
import { buildSampleTree } from './core/sample'
import { useStore } from './core/store'
import type { ViewKey } from './core/store'
import { summarize, validate } from './core/validate'
import { Modal } from './ui/components'
import { StatisticsView, MapView } from './ui/views/Analysis'
import {
  DescendantChart, FanChart, HourglassChart, PedigreeChart, TimelineView,
} from './ui/views/Charts'
import { Dashboard } from './ui/views/Dashboard'
import { GedcomView, ReportsView, SettingsView } from './ui/views/Data'
import { ArmorialView, HeraldryStudio } from './ui/views/Heraldry'
import { PeopleList, PersonView } from './ui/views/People'
import { PrintView } from './ui/views/Print'
import { MediaView, PlacesView, SourcesView } from './ui/views/Records'
import {
  DuplicatesView, RelationsView, ResearchLogView, TasksView, ValidationView,
} from './ui/views/Research'

interface NavEntry {
  key: ViewKey
  label: string
  icon: string
}

const NAV: { group: string; items: NavEntry[] }[] = [
  {
    group: 'Bestand',
    items: [
      { key: 'dashboard', label: 'Übersicht', icon: '⌂' },
      { key: 'people', label: 'Personen', icon: '☰' },
      { key: 'person', label: 'Personenblatt', icon: '👤' },
    ],
  },
  {
    group: 'Diagramme',
    items: [
      { key: 'pedigree', label: 'Ahnentafel', icon: '⌃' },
      { key: 'fan', label: 'Fächer', icon: '◔' },
      { key: 'descendants', label: 'Nachkommen', icon: '⌄' },
      { key: 'hourglass', label: 'Sanduhr', icon: '⧗' },
      { key: 'timeline', label: 'Zeitstrahl', icon: '⟼' },
      { key: 'map', label: 'Ortskarte', icon: '⌖' },
    ],
  },
  {
    group: 'Belege',
    items: [
      { key: 'sources', label: 'Quellen', icon: '❡' },
      { key: 'places', label: 'Orte', icon: '⌂' },
      { key: 'media', label: 'Medien', icon: '▣' },
    ],
  },
  {
    group: 'Forschung',
    items: [
      { key: 'validate', label: 'Prüfung', icon: '⚠' },
      { key: 'duplicates', label: 'Dubletten', icon: '⧉' },
      { key: 'relations', label: 'Verwandtschaft', icon: '⚭' },
      { key: 'tasks', label: 'Aufgaben', icon: '✓' },
      { key: 'log', label: 'Protokoll', icon: '✎' },
      { key: 'stats', label: 'Auswertungen', icon: '▤' },
    ],
  },
  {
    group: 'Heraldik',
    items: [
      { key: 'heraldry', label: 'Wappenwerkstatt', icon: '⚜' },
      { key: 'armorial', label: 'Wappenrolle', icon: '⛨' },
    ],
  },
  {
    group: 'Ausgabe',
    items: [
      { key: 'print', label: 'Druckwerkstatt', icon: '🖶' },
      { key: 'reports', label: 'Berichte', icon: '❐' },
      { key: 'gedcom', label: 'Datenaustausch', icon: '⇅' },
      { key: 'settings', label: 'Einstellungen', icon: '⚙' },
    ],
  },
]

const TITLES: Record<ViewKey, string> = {
  dashboard: 'Übersicht', people: 'Personen', person: 'Personenblatt',
  pedigree: 'Ahnentafel', fan: 'Fächerdiagramm', descendants: 'Nachkommen',
  hourglass: 'Sanduhr', timeline: 'Zeitstrahl', map: 'Ortskarte',
  stats: 'Auswertungen', sources: 'Quellen', places: 'Orte', media: 'Medien',
  tasks: 'Aufgaben', log: 'Forschungsprotokoll', validate: 'Plausibilitätsprüfung',
  duplicates: 'Dublettensuche', relations: 'Verwandtschaftsrechner',
  heraldry: 'Wappenwerkstatt', armorial: 'Wappenrolle', reports: 'Berichte',
  print: 'Druckwerkstatt', gedcom: 'Datenaustausch', settings: 'Einstellungen',
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 34" aria-hidden="true">
      <path d="M2 2h28v16c0 8-14 14-14 14S2 26 2 18z" fill="var(--accent)" />
      <path d="M2 2h28v16c0 8-14 14-14 14S2 26 2 18z" fill="none" stroke="var(--gold)" strokeWidth="2.4" />
      <path d="M16 8l2.4 5.6 6 .5-4.6 4 1.4 5.9-5.2-3.2-5.2 3.2 1.4-5.9-4.6-4 6-.5z" fill="var(--gold)" />
    </svg>
  )
}

export function App() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const db = useStore((s) => s.db)
  const ready = useStore((s) => s.ready)
  const dirty = useStore((s) => s.dirty)
  const toast = useStore((s) => s.toast)
  const settings = useStore((s) => s.settings)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const past = useStore((s) => s.past)
  const future = useStore((s) => s.future)
  const init = useStore((s) => s.init)
  const replaceDatabase = useStore((s) => s.replaceDatabase)
  const workFile = useStore((s) => s.workFile)
  const backupDue = useStore((s) => s.backupDue)
  const checkWorkFile = useStore((s) => s.checkWorkFile)
  const resolveConflict = useStore((s) => s.resolveConflict)

  useEffect(() => { init() }, [init])

  /**
   * Nach Änderungen von anderen Geräten sehen. Ein Abgleichdienst braucht ein
   * paar Sekunden, bis er eine Datei durchgereicht hat; häufiger als alle
   * zwanzig Sekunden zu prüfen bringt daher nichts. Zusätzlich wird geprüft,
   * sobald das Fenster wieder in den Vordergrund kommt – das ist der Moment,
   * in dem man von einem anderen Gerät zurückkehrt.
   */
  useEffect(() => {
    if (!workFile.handle || workFile.permission !== 'granted') return
    const timer = setInterval(() => { void checkWorkFile() }, 20000)
    const onFocus = () => { void checkWorkFile() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [workFile.handle, workFile.permission, checkWorkFile])

  // Beim ersten Start ohne Bestand das Beispiel anbieten, damit die Oberfläche
  // nicht leer und unverständlich dasteht
  useEffect(() => {
    if (ready && Object.keys(db.persons).length === 0 && !db.meta.description) {
      replaceDatabase(buildSampleTree(), 'Beispielbestand')
    }
  }, [ready, db.persons, db.meta.description, replaceDatabase])

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo(); else undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
      if (typing) return
      // Schnellwahl ohne Umschalttaste
      const map: Record<string, ViewKey> = {
        p: 'people', a: 'pedigree', f: 'fan', n: 'descendants',
        w: 'heraldry', r: 'armorial', q: 'sources', s: 'stats', u: 'dashboard',
      }
      if (map[e.key.toLowerCase()]) { setView(map[e.key.toLowerCase()]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, setView])

  const issueCount = summarize(validate(db)).error

  const body = () => {
    switch (view) {
      case 'dashboard': return <Dashboard />
      case 'people': return <PeopleList />
      case 'person': return <PersonView />
      case 'pedigree': return <PedigreeChart />
      case 'fan': return <FanChart />
      case 'descendants': return <DescendantChart />
      case 'hourglass': return <HourglassChart />
      case 'timeline': return <TimelineView />
      case 'map': return <MapView />
      case 'stats': return <StatisticsView />
      case 'sources': return <SourcesView />
      case 'places': return <PlacesView />
      case 'media': return <MediaView />
      case 'tasks': return <TasksView />
      case 'log': return <ResearchLogView />
      case 'validate': return <ValidationView />
      case 'duplicates': return <DuplicatesView />
      case 'relations': return <RelationsView />
      case 'heraldry': return <HeraldryStudio />
      case 'armorial': return <ArmorialView />
      case 'reports': return <ReportsView />
      case 'print': return <PrintView />
      case 'gedcom': return <GedcomView />
      case 'settings': return <SettingsView />
      default: return <Dashboard />
    }
  }

  const badge = (key: ViewKey): string | undefined => {
    switch (key) {
      case 'people': return String(Object.keys(db.persons).length)
      case 'sources': return String(Object.keys(db.sources).length)
      case 'armorial': return String(Object.keys(db.arms).length)
      case 'validate': return issueCount ? String(issueCount) : undefined
      case 'tasks': {
        const n = Object.values(db.tasks).filter((t) => t.status !== 'done' && t.status !== 'dropped').length
        return n ? String(n) : undefined
      }
      default: return undefined
    }
  }

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-faint)' }}>
        Bestand wird geladen …
      </div>
    )
  }

  return (
    <div className="app">
      <div className="brand">
        <BrandMark />
        <span className="brand-name">Wappenbrief</span>
      </div>

      <div className="topbar">
        <span className="topbar-title">{TITLES[view]}</span>
        <span className="tag">{db.meta.name}</span>
        <div className="topbar-spacer" />
        <button className="btn ghost small" disabled={!past.length} onClick={undo} title="Rückgängig (Strg+Z)">
          ↶ Rückgängig
        </button>
        <button className="btn ghost small" disabled={!future.length} onClick={redo} title="Wiederholen (Strg+Umschalt+Z)">
          ↷ Wiederholen
        </button>
        {backupDue && (
          <button
            className="tag warn"
            style={{ border: 0, cursor: 'pointer' }}
            title="Seit mehr als zwei Wochen wurde keine Sicherungsdatei angelegt."
            onClick={() => setView('gedcom')}
          >
            Sicherung fällig
          </button>
        )}

        {workFile.handle && (
          <button
            className={`tag ${workFile.conflict ? 'error' : workFile.permission === 'granted' ? 'ok' : 'warn'}`}
            style={{ border: 0, cursor: 'pointer', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={
              workFile.conflict
                ? 'Die Arbeitsdatei wurde von außen geändert – bitte entscheiden, welche Fassung gilt.'
                : workFile.permission === 'granted'
                  ? `Arbeitsdatei: ${workFile.name}`
                  : 'Der Zugriff auf die Arbeitsdatei muss erneut erteilt werden.'
            }
            onClick={() => setView('settings')}
          >
            {workFile.conflict
              ? '⚠ Datei abweichend'
              : workFile.permission === 'granted'
                ? `${workFile.writing ? '↻' : '⛁'} ${workFile.name}`
                : '⚠ Zugriff nötig'}
          </button>
        )}

        <span className="tag" title="Der Bestand wird selbsttätig in der Ablage des Browsers gesichert.">
          {dirty ? 'wird gesichert …' : 'gesichert'}
        </span>
      </div>

      <nav className="nav">
        {NAV.map((group) => (
          <div className="nav-group" key={group.group}>
            <div className="nav-group-title">{group.group}</div>
            {group.items.map((item) => (
              <button
                key={item.key}
                className={`nav-item${view === item.key ? ' active' : ''}`}
                onClick={() => setView(item.key)}
              >
                <span className="icon">{item.icon}</span>
                <span>{item.label}</span>
                {badge(item.key) && (
                  <span className="badge" style={item.key === 'validate' ? { background: 'var(--error-soft)', color: 'var(--error)' } : undefined}>
                    {badge(item.key)}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
        <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--ink-faint)', lineHeight: 1.5 }}>
          Alle Daten bleiben auf diesem Rechner.
        </div>
      </nav>

      <main className="main">{body()}</main>

      {workFile.conflict && (
        <Modal
          title="Die Arbeitsdatei weicht ab"
          onClose={() => { /* Ein Konflikt muss entschieden werden */ }}
          footer={
            <>
              <button className="btn" onClick={() => resolveConflict('useLocal')}>
                Hiesige Fassung behalten
              </button>
              <button className="btn primary" onClick={() => resolveConflict('useFile')}>
                Fassung aus der Datei übernehmen
              </button>
            </>
          }
        >
          <p>
            Ein anderes Gerät hat die Arbeitsdatei geändert, während hier ebenfalls gearbeitet
            wurde. Damit nichts stillschweigend verlorengeht, muss entschieden werden, welche
            Fassung gilt.
          </p>
          <dl className="kv" style={{ margin: '14px 0' }}>
            <dt>Hier</dt>
            <dd>
              {Object.keys(db.persons).length} Personen, zuletzt geändert{' '}
              {new Date(db.meta.changed).toLocaleString('de-DE')}
            </dd>
            <dt>In der Datei</dt>
            <dd>
              {Object.keys(workFile.conflict.fileDb.persons).length} Personen, zuletzt geändert{' '}
              {new Date(workFile.conflict.fileDb.meta.changed).toLocaleString('de-DE')}
            </dd>
          </dl>
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
            Die verworfene Fassung lässt sich nicht wiederherstellen. Wenn beide Seiten
            gearbeitet haben, legen Sie vorher über „Datenaustausch“ eine Sicherung an –
            danach lassen sich die Bestände über die Dublettensuche zusammenführen.
          </p>
        </Modal>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  )
}
