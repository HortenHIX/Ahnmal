/**
 * Wappenwerkstatt und Wappenrolle.
 *
 * Die Werkstatt arbeitet in beide Richtungen: Wer eine Blasonierung aus einem
 * Wappenbrief abtippt, sieht das Wappen entstehen; wer es zusammenklickt,
 * bekommt die fachgerechte Beschreibung dazu. Diese Beschreibung ist das
 * eigentlich Verbindliche – die Zeichnung ist nur eine mögliche Umsetzung.
 */

import { useEffect, useMemo, useState } from 'react'
import { downloadText } from '../../core/db'
import { uid } from '../../core/ids'
import { displayName } from '../../core/model'
import { useStore } from '../../core/store'
import type {
  Arms, BlazonSpec, Charge, Division, DivisionType, LineStyle, Ordinary,
  OrdinaryType, ShieldShape, Tincture,
} from '../../core/types'
import { checkBlazon, parseBlazon, writeBlazon } from '../../heraldry/blazon'
import { CATEGORY_LABELS, CHARGES, CHARGE_MAP, chargesByCategory } from '../../heraldry/charges'
import { CORONET_LABELS, CoatOfArms, HELM_LABELS } from '../../heraldry/render'
import { SHIELD_LABELS, SHIELD_PATHS } from '../../heraldry/shapes'
import { TINCTURES, TINCTURE_KEYS, violatesTinctureRule } from '../../heraldry/tinctures'
import { ConfirmButton, Empty, Field, Modal } from '../components'

// ---------------------------------------------------------------------------

const DIVISION_CHOICES: { key: DivisionType; label: string }[] = [
  { key: 'none', label: 'ungeteilt' },
  { key: 'perPale', label: 'gespalten' },
  { key: 'perFess', label: 'geteilt' },
  { key: 'perBend', label: 'schrägrechts geteilt' },
  { key: 'perBendSinister', label: 'schräglinks geteilt' },
  { key: 'quarterly', label: 'geviert' },
  { key: 'perSaltire', label: 'schräggeviert' },
  { key: 'perChevron', label: 'sparrenweise geteilt' },
  { key: 'gyronny', label: 'geständert' },
  { key: 'tiercedPerPale', label: 'gespalten in drei' },
  { key: 'tiercedPerFess', label: 'geteilt in drei' },
  { key: 'barry', label: 'mehrfach geteilt' },
  { key: 'paly', label: 'mehrfach gespalten' },
  { key: 'bendy', label: 'schrägrechts gestreift' },
  { key: 'checky', label: 'geschacht' },
  { key: 'lozengy', label: 'geweckt' },
  { key: 'chevronny', label: 'sparrenweise gestreift' },
]

const ORDINARY_CHOICES: { key: OrdinaryType; label: string }[] = [
  { key: 'fess', label: 'Balken' }, { key: 'pale', label: 'Pfahl' },
  { key: 'bend', label: 'Schrägbalken' }, { key: 'bendSinister', label: 'Schräglinksbalken' },
  { key: 'chevron', label: 'Sparren' }, { key: 'cross', label: 'Kreuz' },
  { key: 'saltire', label: 'Schrägkreuz' }, { key: 'chief', label: 'Schildhaupt' },
  { key: 'base', label: 'Schildfuß' }, { key: 'pile', label: 'Spitze' },
  { key: 'bordure', label: 'Bord' }, { key: 'orle', label: 'Innenbord' },
  { key: 'canton', label: 'Freiviertel' }, { key: 'pall', label: 'Göpel' },
  { key: 'label', label: 'Turnierkragen' }, { key: 'bar', label: 'Leisten' },
  { key: 'chevronel', label: 'Sparrenleisten' }, { key: 'flaunches', label: 'Flanken' },
  { key: 'fret', label: 'Flechtwerk' }, { key: 'crossHumetty', label: 'schwebendes Kreuz' },
]

const LINE_CHOICES: { key: LineStyle; label: string }[] = [
  { key: 'straight', label: 'gerade' }, { key: 'wavy', label: 'gewellt' },
  { key: 'engrailed', label: 'eingebogen' }, { key: 'invected', label: 'ausgebogen' },
  { key: 'indented', label: 'gezackt' }, { key: 'dancetty', label: 'grob gezackt' },
  { key: 'embattled', label: 'gezinnt' }, { key: 'nebuly', label: 'wolkenförmig' },
  { key: 'dovetailed', label: 'geschwalbenschwanzt' }, { key: 'raguly', label: 'astwerkartig' },
  { key: 'potenty', label: 'krückenförmig' },
]

// ---------------------------------------------------------------------------

function TincturePicker({
  value, onChange, label, against,
}: { value: Tincture; onChange: (t: Tincture) => void; label: string; against?: Tincture }) {
  const groups: [string, Tincture[]][] = [
    ['Metalle', TINCTURE_KEYS.filter((t) => TINCTURES[t].class === 'metal')],
    ['Farben', TINCTURE_KEYS.filter((t) => TINCTURES[t].class === 'colour')],
    ['Pelzwerk', TINCTURE_KEYS.filter((t) => TINCTURES[t].class === 'fur')],
    ['seltene Farben', TINCTURE_KEYS.filter((t) => TINCTURES[t].class === 'stain' || TINCTURES[t].class === 'proper')],
  ]
  return (
    <div className="field">
      <label>{label}</label>
      {groups.map(([name, list]) => (
        <div key={name} style={{ marginBottom: 5 }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginBottom: 2 }}>{name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 36px)', gap: 4 }}>
            {list.map((t) => {
              const def = TINCTURES[t]
              const clash = against ? violatesTinctureRule(against, t) : false
              return (
                <button
                  key={t}
                  className={`tincture-swatch${value === t ? ' sel' : ''}`}
                  // Pelzwerk wird mit dem echten Muster gezeigt; die fünf Feh-Arten
                  // sind sonst nicht auseinanderzuhalten
                  style={def.class === 'fur' ? { overflow: 'hidden', background: 'transparent' } : { background: def.fill }}
                  title={`${def.german}${clash ? ' — Verstoß gegen die Farbregel' : ''}`}
                  onClick={() => onChange(t)}
                >
                  {def.class === 'fur' && (
                    <span style={{ display: 'block', margin: -3 }}>
                      <CoatOfArms
                        arms={{ spec: { field: t, ordinaries: [], charges: [] }, shape: 'square' }}
                        size={32}
                        relief={false}
                      />
                    </span>
                  )}
                  {clash && (
                    <span style={{ position: 'absolute', top: -2, right: -2, fontSize: 9, color: 'var(--warn)' }}>!</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <span className="hint">{TINCTURES[value].german}</span>
    </div>
  )
}

function ChargePickerGrid({ onPick }: { onPick: (key: string) => void }) {
  const [query, setQuery] = useState('')
  const byCat = useMemo(() => chargesByCategory(), [])
  const q = query.toLowerCase().trim()

  return (
    <div>
      <input
        type="search" placeholder="Figur suchen …" value={query}
        onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 10 }}
      />
      {Object.entries(byCat).map(([cat, list]) => {
        const filtered = q
          ? list.filter((c) => c.german.toLowerCase().includes(q) || c.aliases.some((a) => a.includes(q)))
          : list
        if (!filtered.length) return null
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', marginBottom: 5 }}>
              {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(74px, 1fr))', gap: 6 }}>
              {filtered.map((c) => (
                <button
                  key={c.key}
                  className="btn"
                  style={{ flexDirection: 'column', padding: 4, height: 84, gap: 1 }}
                  onClick={() => onPick(c.key)}
                  title={c.german}
                >
                  <svg viewBox="0 0 100 100" width={44} height={44}>
                    {c.paths.filter((p) => p.role !== 'line').map((p, i) => (
                      <path key={i} d={p.d} fill={p.fixed ?? 'var(--ink)'} fillRule="evenodd" />
                    ))}
                  </svg>
                  <span style={{ fontSize: 9.5, lineHeight: 1.1, textAlign: 'center' }}>{c.german}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------

const BLANK: BlazonSpec = { field: 'argent', ordinaries: [], charges: [] }

export function HeraldryStudio() {
  const db = useStore((s) => s.db)
  const upsertArms = useStore((s) => s.upsertArms)
  const selectedArms = useStore((s) => s.selectedArms)
  const selectArms = useStore((s) => s.selectArms)
  const notify = useStore((s) => s.notify)

  const existing = selectedArms ? db.arms[selectedArms] : undefined

  const [spec, setSpec] = useState<BlazonSpec>(existing?.spec ?? BLANK)
  const [shape, setShape] = useState<ShieldShape>(existing?.shape ?? 'heater')
  const [name, setName] = useState(existing?.name ?? '')
  const [motto, setMotto] = useState(existing?.motto ?? '')
  const [crest, setCrest] = useState<Arms['crest']>(
    existing?.crest ?? { helmType: 'tilting', mantlingOuter: 'gules', mantlingInner: 'argent', torse: ['argent', 'gules'] },
  )
  const [blazonInput, setBlazonInput] = useState(existing?.blazon ?? '')
  const [tab, setTab] = useState<'schild' | 'heroldsbilder' | 'figuren' | 'helm' | 'text'>('schild')
  const [chargePicker, setChargePicker] = useState(false)
  const [full, setFull] = useState(true)
  const [hatched, setHatched] = useState(false)

  // Auswahl aus der Wappenrolle in die Werkstatt übernehmen
  useEffect(() => {
    if (!existing) return
    setSpec(existing.spec)
    setShape(existing.shape)
    setName(existing.name)
    setMotto(existing.motto ?? '')
    setCrest(existing.crest ?? { helmType: 'tilting', mantlingOuter: 'gules', mantlingInner: 'argent' })
    setBlazonInput(existing.blazon)
  }, [existing])

  const generated = useMemo(() => writeBlazon(spec, 'de'), [spec])
  const generatedEn = useMemo(() => writeBlazon(spec, 'en'), [spec])
  const checks = useMemo(() => checkBlazon(spec), [spec])

  const applyBlazon = () => {
    const res = parseBlazon(blazonInput)
    setSpec(res.spec)
    if (res.warnings.length) {
      notify(res.warnings[0], res.confidence < 0.5 ? 'error' : 'info')
    } else {
      notify(`Blasonierung gelesen (${Math.round(res.confidence * 100)} % der Wörter erkannt).`, 'success')
    }
  }

  const save = () => {
    if (!name.trim()) { notify('Bitte einen Namen für das Wappen angeben.', 'error'); return }
    const arms: Arms = {
      id: existing?.id ?? uid('w'),
      name: name.trim(),
      blazon: generated,
      blazonLang: 'de',
      spec,
      shape,
      crest,
      motto: motto || undefined,
      region: existing?.region,
      attribution: existing?.attribution,
      notes: existing?.notes ?? [],
      created: existing?.created ?? Date.now(),
      changed: Date.now(),
    }
    upsertArms(arms)
    selectArms(arms.id)
    notify('Wappen in der Wappenrolle gespeichert.', 'success')
  }

  const setDivision = (type: DivisionType) => {
    if (type === 'none') { setSpec({ ...spec, division: undefined }); return }
    const needed = type === 'tiercedPerPale' || type === 'tiercedPerFess' ? 3 : 2
    const prev = spec.division?.tinctures ?? []
    const tinctures: Tincture[] = []
    for (let i = 0; i < needed; i++) {
      tinctures.push(prev[i] ?? (i === 0 ? spec.field : i === 1 ? 'gules' : 'or'))
    }
    const division: Division = { ...spec.division, type, tinctures }
    setSpec({ ...spec, division, field: tinctures[0] })
  }

  return (
    <div className="view">
      <div className="view-head">
        <h1>Wappenwerkstatt</h1>
        <p>Blasonierung lesen, Wappen bauen, Beschreibung erzeugen.</p>
        <div style={{ flex: 1 }} />
        {existing && (
          <button className="btn" onClick={() => { selectArms(undefined); setSpec(BLANK); setName(''); setBlazonInput('') }}>
            Neues Wappen
          </button>
        )}
        <button className="btn primary" onClick={save}>
          {existing ? 'Änderungen speichern' : 'In Wappenrolle aufnehmen'}
        </button>
      </div>

      <div className="split">
        <div className="panel">
          <div className="toolbar">
            {(['schild', 'heroldsbilder', 'figuren', 'helm', 'text'] as const).map((t) => (
              <button key={t} className={`btn ${tab === t ? 'primary' : 'ghost'} small`} onClick={() => setTab(t)}>
                {{ schild: 'Schild', heroldsbilder: 'Heroldsbilder', figuren: 'Figuren', helm: 'Helm & Zier', text: 'Blasonierung' }[t]}
              </button>
            ))}
          </div>

          <div className="panel-body">
            {tab === 'schild' && (
              <div className="stack">
                <Field label="Schildform">
                  <select value={shape} onChange={(e) => setShape(e.target.value as ShieldShape)}>
                    {(Object.keys(SHIELD_PATHS) as ShieldShape[]).map((s) => (
                      <option key={s} value={s}>{SHIELD_LABELS[s]}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Teilung">
                  <select value={spec.division?.type ?? 'none'} onChange={(e) => setDivision(e.target.value as DivisionType)}>
                    {DIVISION_CHOICES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </Field>

                {spec.division ? (
                  <>
                    {['barry', 'paly', 'bendy', 'checky', 'lozengy', 'chevronny'].includes(spec.division.type) && (
                      <Field label={`Anzahl der Plätze: ${spec.division.count ?? 6}`}>
                        <input
                          type="range" min={2} max={16}
                          value={spec.division.count ?? 6}
                          onChange={(e) => setSpec({
                            ...spec,
                            division: { ...spec.division!, count: Number(e.target.value) },
                          })}
                        />
                      </Field>
                    )}
                    <Field label="Schnittlinie">
                      <select
                        value={spec.division.line ?? 'straight'}
                        onChange={(e) => setSpec({
                          ...spec, division: { ...spec.division!, line: e.target.value as LineStyle },
                        })}
                      >
                        {LINE_CHOICES.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                      </select>
                    </Field>
                    {spec.division.tinctures.map((t, i) => (
                      <TincturePicker
                        key={i}
                        label={`Feld ${i + 1}`}
                        value={t}
                        onChange={(nt) => {
                          const tinctures = spec.division!.tinctures.map((x, j) => (j === i ? nt : x))
                          setSpec({ ...spec, division: { ...spec.division!, tinctures }, field: tinctures[0] })
                        }}
                      />
                    ))}
                  </>
                ) : (
                  <TincturePicker
                    label="Schildfarbe"
                    value={spec.field}
                    onChange={(t) => setSpec({ ...spec, field: t })}
                  />
                )}
              </div>
            )}

            {tab === 'heroldsbilder' && (
              <div className="stack">
                <Field label="Heroldsbild hinzufügen">
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return
                      const o: Ordinary = {
                        type: e.target.value as OrdinaryType,
                        tincture: TINCTURES[spec.field].class === 'metal' ? 'gules' : 'or',
                      }
                      setSpec({ ...spec, ordinaries: [...spec.ordinaries, o] })
                    }}
                  >
                    <option value="">auswählen …</option>
                    {ORDINARY_CHOICES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </Field>

                {!spec.ordinaries.length && (
                  <p style={{ color: 'var(--ink-faint)' }}>
                    Heroldsbilder sind die geometrischen Grundfiguren – Balken, Pfahl, Kreuz.
                    Sie gelten als die ältesten und vornehmsten Wappenbilder.
                  </p>
                )}

                {spec.ordinaries.map((o, i) => (
                  <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <strong style={{ flex: 1 }}>
                        {ORDINARY_CHOICES.find((c) => c.key === o.type)?.label ?? o.type}
                      </strong>
                      <button
                        className="btn small danger"
                        onClick={() => setSpec({ ...spec, ordinaries: spec.ordinaries.filter((_, j) => j !== i) })}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid2">
                      <Field label="Schnittlinie">
                        <select
                          value={o.line ?? 'straight'}
                          onChange={(e) => setSpec({
                            ...spec,
                            ordinaries: spec.ordinaries.map((x, j) => j === i ? { ...x, line: e.target.value as LineStyle } : x),
                          })}
                        >
                          {LINE_CHOICES.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                        </select>
                      </Field>
                      {['bar', 'chevronel', 'pallet', 'bendlet'].includes(o.type) && (
                        <Field label={`Anzahl: ${o.count ?? 2}`}>
                          <input
                            type="range" min={1} max={5} value={o.count ?? 2}
                            onChange={(e) => setSpec({
                              ...spec,
                              ordinaries: spec.ordinaries.map((x, j) => j === i ? { ...x, count: Number(e.target.value) } : x),
                            })}
                          />
                        </Field>
                      )}
                    </div>
                    <TincturePicker
                      label="Farbe"
                      value={o.tincture}
                      against={spec.field}
                      onChange={(t) => setSpec({
                        ...spec,
                        ordinaries: spec.ordinaries.map((x, j) => (j === i ? { ...x, tincture: t } : x)),
                      })}
                    />
                  </div>
                ))}
              </div>
            )}

            {tab === 'figuren' && (
              <div className="stack">
                <button className="btn primary" onClick={() => setChargePicker(true)}>Figur hinzufügen</button>

                {!spec.charges.length && (
                  <p style={{ color: 'var(--ink-faint)' }}>
                    Gemeine Figuren sind Tiere, Pflanzen und Gegenstände. Sie tragen meist den
                    eigentlichen Hinweis auf Name, Beruf oder Herkunft der Familie.
                  </p>
                )}

                {spec.charges.map((c, i) => {
                  const def = CHARGE_MAP[c.key]
                  const patch = (p: Partial<Charge>) =>
                    setSpec({ ...spec, charges: spec.charges.map((x, j) => (j === i ? { ...x, ...p } : x)) })
                  return (
                    <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <svg viewBox="0 0 100 100" width={28} height={28}>
                          {def?.paths.filter((p) => p.role !== 'line').map((p, k) => (
                            <path key={k} d={p.d} fill="var(--ink)" fillRule="evenodd" />
                          ))}
                        </svg>
                        <strong style={{ flex: 1 }}>{def?.german ?? c.key}</strong>
                        <button
                          className="btn small danger"
                          onClick={() => setSpec({ ...spec, charges: spec.charges.filter((_, j) => j !== i) })}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid2">
                        <Field label={`Anzahl: ${c.count}`}>
                          <input type="range" min={1} max={12} value={c.count}
                            onChange={(e) => patch({ count: Number(e.target.value) })} />
                        </Field>
                        <Field label="Stellung">
                          <select
                            value={c.attitudes?.[0] ?? ''}
                            onChange={(e) => patch({ attitudes: e.target.value ? [e.target.value as never] : undefined })}
                          >
                            <option value="">wie im Katalog</option>
                            <option value="contourne">linksgewendet</option>
                            <option value="inverted">gestürzt</option>
                          </select>
                        </Field>
                      </div>
                      <TincturePicker
                        label="Farbe" value={c.tincture} against={spec.field}
                        onChange={(t) => patch({ tincture: t })}
                      />
                      <Field label="Bewehrung" hint="Zunge, Krallen, Schnabel in abweichender Farbe">
                        <select
                          value={c.armedTincture ?? ''}
                          onChange={(e) => patch({ armedTincture: (e.target.value || undefined) as Tincture })}
                        >
                          <option value="">wie die Figur</option>
                          {TINCTURE_KEYS.map((t) => <option key={t} value={t}>{TINCTURES[t].german}</option>)}
                        </select>
                      </Field>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'helm' && crest && (
              <div className="stack">
                <Field label="Helm">
                  <select
                    value={crest.helmType ?? 'tilting'}
                    onChange={(e) => setCrest({ ...crest, helmType: e.target.value as never })}
                  >
                    {Object.entries(HELM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Rangkrone" hint="Nur führen, wer sie nachweislich führen darf.">
                  <select
                    value={crest.coronet ?? 'none'}
                    onChange={(e) => setCrest({ ...crest, coronet: e.target.value as never })}
                  >
                    {Object.entries(CORONET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Helmzier">
                  <select
                    value={crest.key ?? ''}
                    onChange={(e) => setCrest({ ...crest, key: e.target.value || undefined })}
                  >
                    <option value="">keine</option>
                    {CHARGES.map((c) => <option key={c.key} value={c.key}>{c.german}</option>)}
                  </select>
                </Field>
                {crest.key && (
                  <Field label="Farbe der Helmzier">
                    <select
                      value={crest.tincture ?? 'or'}
                      onChange={(e) => setCrest({ ...crest, tincture: e.target.value as Tincture })}
                    >
                      {TINCTURE_KEYS.map((t) => <option key={t} value={t}>{TINCTURES[t].german}</option>)}
                    </select>
                  </Field>
                )}
                <div className="grid2">
                  <Field label="Helmdecke außen">
                    <select
                      value={crest.mantlingOuter ?? 'gules'}
                      onChange={(e) => setCrest({ ...crest, mantlingOuter: e.target.value as Tincture })}
                    >
                      {TINCTURE_KEYS.map((t) => <option key={t} value={t}>{TINCTURES[t].german}</option>)}
                    </select>
                  </Field>
                  <Field label="Helmdecke innen">
                    <select
                      value={crest.mantlingInner ?? 'argent'}
                      onChange={(e) => setCrest({ ...crest, mantlingInner: e.target.value as Tincture })}
                    >
                      {TINCTURE_KEYS.map((t) => <option key={t} value={t}>{TINCTURES[t].german}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Wahlspruch">
                  <input type="text" value={motto} onChange={(e) => setMotto(e.target.value)} placeholder="TREU UND FEST" />
                </Field>
                <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  Die Helmdecke wird herkömmlich außen in der Hauptfarbe und innen im Metall
                  des Schildes geführt. Der Stechhelm gilt als bürgerlicher Helm, der Spangenhelm
                  war dem Adel vorbehalten.
                </p>
              </div>
            )}

            {tab === 'text' && (
              <div className="stack">
                <Field
                  label="Blasonierung eingeben"
                  hint="Deutsch oder Englisch. Beispiel: In Rot ein goldener steigender Löwe, blau bewehrt"
                >
                  <textarea
                    value={blazonInput}
                    rows={4}
                    onChange={(e) => setBlazonInput(e.target.value)}
                    placeholder="Geteilt von Gold und Schwarz, oben ein wachsender roter Löwe"
                  />
                </Field>
                <button className="btn primary" onClick={applyBlazon}>Beschreibung umsetzen</button>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>
                    Erzeugte Blasonierung (deutsch)
                  </label>
                  <p className="blazon-text" style={{ background: 'var(--bg-sunken)', padding: 10, borderRadius: 6 }}>
                    {generated}
                  </p>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)' }}>englisch</label>
                  <p className="blazon-text" style={{ background: 'var(--bg-sunken)', padding: 10, borderRadius: 6 }}>
                    {generatedEn}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h3>Vorschau</h3>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> volles Wappen
              </label>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={hatched} onChange={(e) => setHatched(e.target.checked)} /> Schraffur
              </label>
            </div>
            <div className="panel-body" style={{ textAlign: 'center', background: hatched ? '#fff' : undefined }}>
              <CoatOfArms
                arms={{ spec, shape, crest, motto }}
                size={full ? 280 : 220}
                full={full}
                hatched={hatched}
                title={name || 'Wappenentwurf'}
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Angaben</h3></div>
            <div className="panel-body">
              <Field label="Name des Wappens" hint="meist der Familienname">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Wegerer" />
              </Field>
              <button
                className="btn small"
                onClick={() => {
                  const svg = document.querySelector('.panel-body svg')
                  if (!svg) return
                  const clone = svg.cloneNode(true) as SVGSVGElement
                  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
                  downloadText(
                    `Wappen ${name || 'Entwurf'}.svg`,
                    `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`,
                    'image/svg+xml',
                  )
                }}
              >
                Als SVG sichern
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Regelprüfung</h3></div>
            <div className="panel-body">
              {checks.map((c, i) => (
                <div key={i} className={`tag ${c.level === 'ok' ? 'ok' : 'warn'}`} style={{ display: 'block', marginBottom: 6, padding: '5px 9px', lineHeight: 1.4 }}>
                  {c.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {chargePicker && (
        <Modal title="Figur wählen" onClose={() => setChargePicker(false)} wide>
          <ChargePickerGrid
            onPick={(key) => {
              setSpec({
                ...spec,
                charges: [...spec.charges, {
                  key,
                  tincture: TINCTURES[spec.field].class === 'metal' ? 'gules' : 'or',
                  count: 1,
                }],
              })
              setChargePicker(false)
            }}
          />
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Wappenrolle
// ---------------------------------------------------------------------------

export function ArmorialView() {
  const db = useStore((s) => s.db)
  const selectArms = useStore((s) => s.selectArms)
  const setView = useStore((s) => s.setView)
  const deleteRecord = useStore((s) => s.deleteRecord)
  const upsertArms = useStore((s) => s.upsertArms)
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.toLowerCase().trim()
    const all = Object.values(db.arms).sort((a, b) => a.name.localeCompare(b.name, 'de'))
    if (!q) return all
    return all.filter((a) =>
      a.name.toLowerCase().includes(q)
      || a.blazon.toLowerCase().includes(q)
      || (a.region ?? '').toLowerCase().includes(q))
  }, [db.arms, query])

  const bearers = (armsId: string) =>
    Object.values(db.persons).filter((p) => p.armsId === armsId)

  return (
    <div className="view">
      <div className="view-head">
        <h1>Wappenrolle</h1>
        <p>{Object.keys(db.arms).length} Wappen erfasst</p>
        <div style={{ flex: 1 }} />
        <button
          className="btn primary"
          onClick={() => { selectArms(undefined); setView('heraldry') }}
        >
          Neues Wappen
        </button>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="toolbar">
          <input
            type="search" placeholder="Name, Blasonierung oder Region suchen …"
            value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 360 }}
          />
        </div>
      </div>

      {!list.length && (
        <Empty title="Keine Wappen">
          Legen Sie in der Wappenwerkstatt ein Wappen an oder tippen Sie eine überlieferte
          Blasonierung ein.
        </Empty>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
        {list.map((a) => (
          <div key={a.id} className="panel">
            <div className="panel-body" style={{ textAlign: 'center' }}>
              <CoatOfArms arms={a} size={160} full title={a.name} />
              <h3 style={{ marginTop: 8 }}>{a.name}</h3>
              <p className="blazon-text" style={{ fontSize: 12.5, minHeight: 44 }}>{a.blazon}</p>
              {a.region && <div className="tag">{a.region}</div>}
              {a.attribution && (
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 5 }}>{a.attribution}</div>
              )}
              {bearers(a.id).length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 6 }}>
                  geführt von {bearers(a.id).length} Person{bearers(a.id).length === 1 ? '' : 'en'}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
                <button className="btn small" onClick={() => { selectArms(a.id); setView('heraldry') }}>
                  Bearbeiten
                </button>
                <button
                  className="btn small"
                  title="Ein Allianzwappen vereint zwei Wappen in einem gespaltenen Schild."
                  onClick={() => {
                    const other = Object.values(db.arms).find((x) => x.id !== a.id)
                    if (!other) return
                    const marshalled: Arms = {
                      id: uid('w'),
                      name: `${a.name} / ${other.name}`,
                      blazon: `Gespalten: vorne ${a.blazon.replace(/\.$/, '')}, hinten ${other.blazon.replace(/\.$/, '')}.`,
                      blazonLang: 'de',
                      spec: {
                        field: a.spec.field,
                        division: { type: 'perPale', tinctures: [a.spec.field, other.spec.field] },
                        ordinaries: [],
                        charges: [
                          ...a.spec.charges.map((c) => ({ ...c, count: 1, scale: 0.5, dx: -46 })),
                          ...other.spec.charges.map((c) => ({ ...c, count: 1, scale: 0.5, dx: 46 })),
                        ],
                      },
                      shape: 'heater',
                      notes: ['Allianzwappen, erzeugt aus zwei Einzelwappen.'],
                      created: Date.now(), changed: Date.now(),
                    }
                    upsertArms(marshalled)
                    selectArms(marshalled.id)
                    setView('heraldry')
                  }}
                >
                  Allianzwappen
                </button>
                <ConfirmButton
                  label="✕"
                  message={`Das Wappen „${a.name}“ wird gelöscht.`}
                  onConfirm={() => deleteRecord('arms', a.id)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {list.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h3>Träger</h3></div>
          <div className="panel-body">
            <table className="data">
              <thead><tr><th>Wappen</th><th>geführt von</th></tr></thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td>{bearers(a.id).map((p) => displayName(p)).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
