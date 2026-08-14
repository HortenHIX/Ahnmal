/**
 * Auswertungen und Ortskarte.
 *
 * Die Auswertungen beantworten Fragen, die sich in einer Liste nicht sehen
 * lassen: Wann wurde geheiratet, wie viele Kinder erreichten das Erwachsenen-
 * alter, wo häufen sich die Orte, wie gut ist der Bestand belegt.
 */

import { useMemo } from 'react'
import { dateValue, yearsBetween } from '../../core/dates'
import {
  birthEvent, birthYear, deathEvent, deathYear, displayName, fullPlaceName, surnameOf,
} from '../../core/model'
import { useStore } from '../../core/store'
import type { Database } from '../../core/types'
import { Empty } from '../components'

// ---------------------------------------------------------------------------

function Bars({
  data, max, colour = 'var(--accent)', format,
}: {
  data: { label: string; value: number }[]
  max?: number
  colour?: string
  format?: (v: number) => string
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value))
  return (
    <div>
      {data.map((d) => (
        <div key={d.label} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 52px', gap: 8, alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', textAlign: 'right' }}>{d.label}</span>
          <div style={{ background: 'var(--bg-sunken)', borderRadius: 3, height: 15 }}>
            <div style={{ width: `${(d.value / top) * 100}%`, background: colour, height: '100%', borderRadius: 3, minWidth: d.value ? 2 : 0 }} />
          </div>
          <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            {format ? format(d.value) : d.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function computeStats(db: Database) {
  const persons = Object.values(db.persons)
  const families = Object.values(db.families)

  // Geburten je Jahrzehnt
  const decades = new Map<number, number>()
  for (const p of persons) {
    const y = birthYear(p)
    if (y === null) continue
    const d = Math.floor(y / 10) * 10
    decades.set(d, (decades.get(d) ?? 0) + 1)
  }

  // Erreichtes Lebensalter
  const ages: number[] = []
  for (const p of persons) {
    const a = yearsBetween(birthEvent(p)?.date, deathEvent(p)?.date)
    if (a !== null && a >= 0 && a < 120) ages.push(a)
  }
  const ageBuckets = [
    { label: 'unter 1 Jahr', from: 0, to: 1 },
    { label: '1–4 Jahre', from: 1, to: 5 },
    { label: '5–14 Jahre', from: 5, to: 15 },
    { label: '15–29 Jahre', from: 15, to: 30 },
    { label: '30–49 Jahre', from: 30, to: 50 },
    { label: '50–69 Jahre', from: 50, to: 70 },
    { label: '70–84 Jahre', from: 70, to: 85 },
    { label: '85 und älter', from: 85, to: 200 },
  ].map((b) => ({ label: b.label, value: ages.filter((a) => a >= b.from && a < b.to).length }))

  // Heiratsalter
  const marriageAges: { m: number[]; f: number[] } = { m: [], f: [] }
  for (const f of families) {
    const marr = f.events.find((e) => e.type === 'MARR')
    const mv = dateValue(marr?.date)
    if (mv === null) continue
    for (const pid of [f.partner1, f.partner2]) {
      const p = pid ? db.persons[pid] : undefined
      if (!p) continue
      const b = dateValue(birthEvent(p)?.date)
      if (b === null) continue
      const age = mv - b
      if (age < 12 || age > 70) continue
      if (p.sex === 'F') marriageAges.f.push(age)
      else marriageAges.m.push(age)
    }
  }

  // Kinderzahl je Familie
  const childCounts = families.filter((f) => f.partner1 || f.partner2).map((f) => f.children.length)
  const childBuckets = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    label: n === 8 ? '8 und mehr' : `${n} Kinder`,
    value: childCounts.filter((c) => (n === 8 ? c >= 8 : c === n)).length,
  }))

  // Geburtsmonate – zeigt die landwirtschaftlich bedingte Saisonalität
  const months = Array.from({ length: 12 }, () => 0)
  for (const p of persons) {
    const m = birthEvent(p)?.date?.from?.month
    if (m) months[m - 1]++
  }

  // Häufigste Namen und Orte
  const surnames = new Map<string, number>()
  for (const p of persons) {
    const s = surnameOf(p)
    if (s) surnames.set(s, (surnames.get(s) ?? 0) + 1)
  }
  const givenNames = new Map<string, number>()
  for (const p of persons) {
    const g = p.names[0]?.given
    if (!g) continue
    // Rufname ist oft der zweite Vorname; alle zählen
    for (const part of g.split(/\s+/)) {
      if (part.length > 2) givenNames.set(part, (givenNames.get(part) ?? 0) + 1)
    }
  }
  const places = new Map<string, number>()
  for (const p of persons) {
    for (const e of p.events) if (e.placeText) places.set(e.placeText, (places.get(e.placeText) ?? 0) + 1)
  }

  const sourced = persons.filter(
    (p) => p.citations.length > 0 || p.events.some((e) => (e.citations?.length ?? 0) > 0),
  ).length

  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
  const median = (a: number[]) => {
    if (!a.length) return 0
    const s = [...a].sort((x, y) => x - y)
    return s[Math.floor(s.length / 2)]
  }

  return {
    persons, families,
    decades: [...decades.entries()].sort((a, b) => a[0] - b[0]),
    ages, ageBuckets,
    medianAge: median(ages),
    medianAdultAge: median(ages.filter((a) => a >= 15)),
    marriageAges,
    meanMarriageM: mean(marriageAges.m),
    meanMarriageF: mean(marriageAges.f),
    childBuckets,
    meanChildren: mean(childCounts.filter(() => true)),
    months,
    surnames: [...surnames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    givenNames: [...givenNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    places: [...places.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    sourced,
    infantMortality: ages.length
      ? ages.filter((a) => a < 5).length / ages.length
      : 0,
  }
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export function StatisticsView() {
  const db = useStore((s) => s.db)
  const st = useMemo(() => computeStats(db), [db])

  if (!st.persons.length) return <Empty title="Kein Bestand" />

  return (
    <div className="view">
      <div className="view-head">
        <h1>Auswertungen</h1>
        <p>Was die Zahlen über die Familie sagen.</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="n">{st.medianAge}</div>
          <div className="l">Median-Lebensalter</div>
          <div className="sub">{st.ages.length} Personen mit beiden Daten</div>
        </div>
        <div className="stat">
          <div className="n">{st.medianAdultAge}</div>
          <div className="l">Median ab 15 Jahren</div>
          <div className="sub">ohne Kindersterblichkeit</div>
        </div>
        <div className="stat">
          <div className="n">{Math.round(st.infantMortality * 100)} %</div>
          <div className="l">vor dem 5. Jahr gestorben</div>
          <div className="sub">bezogen auf datierte Todesfälle</div>
        </div>
        <div className="stat">
          <div className="n">{st.meanChildren.toFixed(1)}</div>
          <div className="l">Kinder je Familie</div>
        </div>
        <div className="stat">
          <div className="n">{st.meanMarriageM ? st.meanMarriageM.toFixed(0) : '—'}</div>
          <div className="l">Heiratsalter Männer</div>
          <div className="sub">Frauen: {st.meanMarriageF ? st.meanMarriageF.toFixed(0) : '—'}</div>
        </div>
        <div className="stat">
          <div className="n">{Math.round((st.sourced / st.persons.length) * 100)} %</div>
          <div className="l">mit Quellenbeleg</div>
        </div>
      </div>

      <div className="grid2" style={{ gap: 14, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head"><h3>Geburten je Jahrzehnt</h3></div>
          <div className="panel-body">
            {st.decades.length ? (
              <Bars data={st.decades.map(([d, n]) => ({ label: `${d}er`, value: n }))} colour="var(--blue)" />
            ) : <p style={{ color: 'var(--ink-faint)' }}>Keine datierten Geburten.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Erreichtes Lebensalter</h3></div>
          <div className="panel-body">
            <Bars data={st.ageBuckets} colour="var(--accent)" />
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 0 }}>
              Die hohe Zahl früh verstorbener Kinder ist für die Zeit vor 1900 normal und
              spricht für vollständig erfasste Kirchenbucheinträge.
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Kinderzahl je Familie</h3></div>
          <div className="panel-body">
            <Bars data={st.childBuckets} colour="var(--green)" />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Geburtsmonate</h3></div>
          <div className="panel-body">
            <Bars data={st.months.map((v, i) => ({ label: MONTH_SHORT[i], value: v }))} colour="var(--gold)" />
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 0 }}>
              In bäuerlichen Gemeinden häufen sich die Geburten im Frühjahr – die Empfängnis
              fiel in die arbeitsarme Zeit nach der Ernte.
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Häufigste Familiennamen</h3></div>
          <div className="panel-body">
            <Bars data={st.surnames.map(([n, v]) => ({ label: n, value: v }))} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Häufigste Vornamen</h3></div>
          <div className="panel-body">
            <Bars data={st.givenNames.map(([n, v]) => ({ label: n, value: v }))} colour="var(--blue)" />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Häufigste Orte</h3></div>
          <div className="panel-body">
            <Bars data={st.places.map(([n, v]) => ({ label: n.split(',')[0], value: v }))} colour="var(--green)" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ortskarte
// ---------------------------------------------------------------------------

/**
 * Zeigt die verorteten Ereignisse als Streuung. Bewusst ohne Kartendienst:
 * Ein solcher Dienst würde bei jedem Aufruf die Wohnorte lebender Verwandter
 * an einen fremden Server melden.
 */
export function MapView() {
  const db = useStore((s) => s.db)
  const selectPerson = useStore((s) => s.selectPerson)

  const points = useMemo(() => {
    const out: { name: string; lat: number; lng: number; count: number; personIds: string[] }[] = []
    for (const pl of Object.values(db.places)) {
      if (pl.lat === undefined || pl.lng === undefined) continue
      const full = fullPlaceName(pl)
      const personIds: string[] = []
      for (const p of Object.values(db.persons)) {
        if (p.events.some((e) => e.placeId === pl.id || e.placeText === full)) personIds.push(p.id)
      }
      out.push({ name: pl.name, lat: pl.lat, lng: pl.lng, count: personIds.length, personIds })
    }
    return out
  }, [db])

  const withoutCoords = useMemo(
    () => Object.values(db.places).filter((p) => p.lat === undefined).length,
    [db.places],
  )

  if (!points.length) {
    return (
      <div className="view">
        <div className="view-head"><h1>Ortskarte</h1></div>
        <Empty title="Keine Koordinaten erfasst">
          <p>
            Tragen Sie unter „Orte“ Breiten- und Längengrad ein, dann erscheinen die Orte hier.
            {withoutCoords > 0 && ` ${withoutCoords} Orte warten auf Koordinaten.`}
          </p>
          <p style={{ fontSize: 12 }}>
            Es wird bewusst kein Kartendienst eingebunden: Der würde bei jedem Aufruf die
            Wohnorte lebender Verwandter an einen fremden Server übermitteln.
          </p>
        </Empty>
      </div>
    )
  }

  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const pad = 0.25
  const minLat = Math.min(...lats) - pad
  const maxLat = Math.max(...lats) + pad
  const minLng = Math.min(...lngs) - pad
  const maxLng = Math.max(...lngs) + pad

  const W = 900
  const H = 560
  // Breitengrade werden zum Pol hin gestaucht; für kleine Ausschnitte genügt
  // die Korrektur mit dem Kosinus der mittleren Breite
  const scaleX = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180)
  const x = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * W
  const y = (lat: number) => H - ((lat - minLat) / (maxLat - minLat)) * H
  const maxCount = Math.max(1, ...points.map((p) => p.count))

  return (
    <div className="view">
      <div className="view-head">
        <h1>Ortskarte</h1>
        <p>{points.length} verortete Orte{withoutCoords ? `, ${withoutCoords} ohne Koordinaten` : ''}</p>
      </div>
      <div className="chart-wrap">
        <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
          <rect width={W} height={H} fill="var(--bg-sunken)" />
          {/* Gradnetz */}
          {Array.from({ length: 7 }, (_, i) => {
            const lat = minLat + ((maxLat - minLat) * i) / 6
            const lng = minLng + ((maxLng - minLng) * i) / 6
            return (
              <g key={i}>
                <line x1={0} y1={y(lat)} x2={W} y2={y(lat)} stroke="var(--line)" strokeWidth={1} />
                <line x1={x(lng)} y1={0} x2={x(lng)} y2={H} stroke="var(--line)" strokeWidth={1} />
                <text x={3} y={y(lat) - 3} fontSize={9.5} fill="var(--ink-faint)">{lat.toFixed(2)}°N</text>
                <text x={x(lng) + 3} y={H - 4} fontSize={9.5} fill="var(--ink-faint)">{lng.toFixed(2)}°O</text>
              </g>
            )
          })}
          {points.map((p) => {
            const r = 6 + (p.count / maxCount) * 22
            return (
              <g key={p.name} style={{ cursor: p.personIds.length ? 'pointer' : 'default' }}
                onClick={() => p.personIds[0] && selectPerson(p.personIds[0], 'person')}>
                <circle cx={x(p.lng)} cy={y(p.lat)} r={r} fill="var(--accent)" opacity={0.28} />
                <circle cx={x(p.lng)} cy={y(p.lat)} r={4} fill="var(--accent)" />
                <text x={x(p.lng)} y={y(p.lat) - r - 5} fontSize={11.5} textAnchor="middle" fontWeight={600} fill="var(--ink)">
                  {p.name}
                </text>
                <text x={x(p.lng)} y={y(p.lat) + r + 12} fontSize={10} textAnchor="middle" fill="var(--ink-soft)">
                  {p.count} Person{p.count === 1 ? '' : 'en'}
                </text>
              </g>
            )
          })}
          <text x={W - 6} y={14} fontSize={10} textAnchor="end" fill="var(--ink-faint)">
            Streuungsdarstellung, verzerrungskorrigiert (Faktor {scaleX.toFixed(2)})
          </text>
        </svg>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 8 }}>
        Die Kreisfläche entspricht der Zahl der Personen mit Ereignissen an diesem Ort.
        Es werden keine Daten an Kartendienste übertragen.
      </p>
    </div>
  )
}

export { displayName, deathYear }
