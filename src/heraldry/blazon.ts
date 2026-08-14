/**
 * Blasonierung.
 *
 * Zwei Richtungen: Aus einem Beschreibungstext wird ein Wappen erzeugt
 * (`parseBlazon`), und aus einem Wappen wird ein Beschreibungstext
 * (`writeBlazon`). Beides für Deutsch und Englisch.
 *
 * Die Blasonierung ist die eigentliche Rechtsform des Wappens: Verbindlich ist
 * nicht die Zeichnung, sondern ihre Beschreibung. Wer eine alte Beschreibung
 * aus einem Wappenbrief abtippt, soll unmittelbar sehen, was dort steht.
 */

import type {
  Attitude, BlazonSpec, Charge, Division, DivisionType, LineStyle, Ordinary,
  OrdinaryType, Tincture,
} from '../core/types'
import { lookupCharge, CHARGE_MAP } from './charges'
import { lookupTincture, TINCTURES } from './tinctures'

// ---------------------------------------------------------------------------
// Wortlisten
// ---------------------------------------------------------------------------

const DIVISION_WORDS: [RegExp, DivisionType][] = [
  [/^(?:mehrfach\s+)?geständert|^gyronny/, 'gyronny'],
  [/^geschacht|^schachbrettartig|^chequy|^checky/, 'checky'],
  [/^geweckt|^gerautet|^lozengy/, 'lozengy'],
  [/^schräggeviert|^per\s+saltire/, 'perSaltire'],
  [/^geviert|^quadriert|^quarterly/, 'quarterly'],
  [/^(?:mehrfach|\d+fach)\s+geteilt|^gestreift|^barry|^balkenweise\s+geteilt/, 'barry'],
  [/^(?:mehrfach|\d+fach)\s+gespalten|^paly|^pfahlweise\s+gespalten/, 'paly'],
  [/^schrägrechts\s+gestreift|^bendy/, 'bendy'],
  [/^gespalten\s+in\s+drei|^dreimal\s+gespalten|^tierced\s+per\s+pale/, 'tiercedPerPale'],
  [/^geteilt\s+in\s+drei|^dreimal\s+geteilt|^tierced\s+per\s+fess/, 'tiercedPerFess'],
  [/^sparrenweise\s+geteilt|^per\s+chevron/, 'perChevron'],
  [/^schräglinks\s+geteilt|^schräglinksgeteilt|^per\s+bend\s+sinister/, 'perBendSinister'],
  [/^schrägrechts\s+geteilt|^schräggeteilt|^schrägrechtsgeteilt|^per\s+bend/, 'perBend'],
  [/^gespalten|^per\s+pale/, 'perPale'],
  [/^geteilt|^per\s+fess/, 'perFess'],
]

const ORDINARY_WORDS: [string[], OrdinaryType][] = [
  [['schildhaupt', 'chief'], 'chief'],
  [['schildfuß', 'schildfuss', 'base'], 'base'],
  [['freiviertel', 'canton'], 'canton'],
  [['andreaskreuz', 'schrägkreuz', 'schragen', 'saltire'], 'saltire'],
  [['tatzenkreuz'], 'crossHumetty'],
  [['kreuz', 'cross'], 'cross'],
  [['göpel', 'goepel', 'deichsel', 'pall'], 'pall'],
  [['sparren', 'chevron'], 'chevron'],
  [['turnierkragen', 'label'], 'label'],
  [['innenbord', 'orle'], 'orle'],
  [['bord', 'schildrand', 'bordüre', 'bordure'], 'bordure'],
  [['spitze', 'pile', 'keil'], 'pile'],
  [['herzschild', 'mittelschild', 'inescutcheon'], 'inescutcheon'],
  [['schrägrechtsbalken', 'schrägbalken', 'bend'], 'bend'],
  [['schräglinksbalken', 'bend sinister'], 'bendSinister'],
  [['balken', 'querbalken', 'fess', 'fesse'], 'fess'],
  [['pfahl', 'pale'], 'pale'],
  [['leiste', 'bar'], 'bar'],
  [['faden', 'barrulet'], 'barrulet'],
  [['stab', 'baton'], 'baton'],
]

const LINE_WORDS: [string[], LineStyle][] = [
  [['gewellt', 'wellenförmig', 'wellig', 'wavy', 'undy'], 'wavy'],
  [['eingebogen', 'engrailed'], 'engrailed'],
  [['ausgebogen', 'invected'], 'invected'],
  [['gezackt', 'gezahnt', 'indented'], 'indented'],
  [['gezinnt', 'zinnenschnitt', 'embattled'], 'embattled'],
  [['wolkenförmig', 'wolkenschnitt', 'nebuly'], 'nebuly'],
  [['geschwalbenschwanzt', 'dovetailed'], 'dovetailed'],
  [['astwerkartig', 'raguly'], 'raguly'],
  [['krückenförmig', 'potenty'], 'potenty'],
  [['gezinkt', 'dancetty'], 'dancetty'],
]

const ATTITUDE_WORDS: [string[], Attitude][] = [
  [['steigend', 'aufgerichtet', 'springend', 'aufsteigend', 'rampant'], 'rampant'],
  [['schreitend', 'gehend', 'passant'], 'passant'],
  [['stehend', 'statant'], 'statant'],
  [['sitzend', 'sejant'], 'sejant'],
  [['liegend', 'ruhend', 'couchant'], 'couchant'],
  [['hersehend', 'vorwärtssehend', 'guardant', 'gardant'], 'guardant'],
  [['widersehend', 'rückschauend', 'zurückblickend', 'regardant'], 'regardant'],
  [['linksgewendet', 'linksgekehrt', 'contourne', 'contourné', 'contourny'], 'contourne'],
  [['fliegend', 'volant'], 'volant'],
  [['ausgebreitet', 'displayed'], 'displayed'],
  [['aufliegend', 'erect', 'gestürzt'], 'erect'],
  [['abgerissen', 'erased'], 'erased'],
  [['abgeschnitten', 'couped'], 'couped'],
  // Wächst aus der Teilungslinie hervor – in geteilten Schilden sehr häufig
  [['wachsend', 'wachsender', 'wachsende', 'hervorwachsend', 'issuant', 'naissant'], 'issuant'],
]

/** Wörter, die eine Figur im oberen oder unteren Feld verorten. */
const POSITION_WORDS: [string[], 'chief' | 'base'][] = [
  [['oben', 'obenauf', 'chief'], 'chief'],
  [['unten', 'darunter', 'base'], 'base'],
]

const NUMBER_WORDS: Record<string, number> = {
  ein: 1, eine: 1, einem: 1, einer: 1, einen: 1, eins: 1, a: 1, an: 1, one: 1,
  zwei: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, fünf: 5, fuenf: 5, five: 5,
  sechs: 6, six: 6, sieben: 7, seven: 7, acht: 8, eight: 8, neun: 9, nine: 9,
  zehn: 10, ten: 10, elf: 11, eleven: 11, zwölf: 12, zwoelf: 12, twelve: 12,
  dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16,
}

const SHAPE_HINTS: [RegExp, number][] = []

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

/**
 * Findet die Tinktur auch in flektierter Form: „goldener“, „rotem“, „silbernen“
 * werden alle auf ihren Grundwortstamm zurückgeführt.
 */
export function tinctureFromWord(word: string): Tincture | undefined {
  const w = word.toLowerCase().replace(/[^a-zäöüß-]/g, '')
  if (!w) return undefined
  const direct = lookupTincture(w)
  if (direct) return direct
  // Deutsche Endungen abtragen, längste zuerst
  for (const suffix of ['ernen', 'erner', 'ernem', 'ernes', 'erne', 'enen', 'ener', 'enem', 'enes', 'ene', 'en', 'em', 'er', 'es', 'e', 'n']) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      const stem = w.slice(0, w.length - suffix.length)
      const t = lookupTincture(stem)
      if (t) return t
      // „goldenen“ → „gold“, „silbernen“ → „silber“
      const t2 = lookupTincture(stem.replace(/(ern|en)$/, ''))
      if (t2) return t2
    }
  }
  return undefined
}

function numberFromWord(word: string): number | undefined {
  const w = word.toLowerCase().replace(/[^a-zäöüß0-9]/g, '')
  if (/^\d+$/.test(w)) {
    const n = parseInt(w, 10)
    return n > 0 && n <= 60 ? n : undefined
  }
  return NUMBER_WORDS[w]
}

function findOrdinary(word: string): OrdinaryType | undefined {
  const w = word.toLowerCase().replace(/[^a-zäöüß ]/g, '')
  for (const [words, type] of ORDINARY_WORDS) {
    if (words.includes(w)) return type
    // Mehrzahl
    if (words.some((x) => w === x + 'e' || w === x + 'en' || w === x + 'n')) return type
  }
  return undefined
}

function findLine(word: string): LineStyle | undefined {
  const w = word.toLowerCase().replace(/[^a-zäöüß-]/g, '')
  for (const [words, line] of LINE_WORDS) if (words.includes(w)) return line
  // Auch die gebeugten Formen: „gewelltes Schildhaupt“, „gezinnter Balken“
  for (const suffix of ['es', 'em', 'en', 'er', 'e']) {
    if (!w.endsWith(suffix)) continue
    const stem = w.slice(0, w.length - suffix.length)
    for (const [words, line] of LINE_WORDS) if (words.includes(stem)) return line
  }
  return undefined
}

function findAttitude(word: string): Attitude | undefined {
  const w = word.toLowerCase().replace(/[^a-zäöüß]/g, '')
  for (const [words, att] of ATTITUDE_WORDS) if (words.includes(w)) return att
  return undefined
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

export interface ParseBlazonResult {
  spec: BlazonSpec
  /** 0…1 – wie viel des Textes verstanden wurde. */
  confidence: number
  warnings: string[]
  /** Wörter, die nicht zugeordnet werden konnten. */
  unresolved: string[]
}

/**
 * Liest eine Blasonierung. Der Ansatz ist bewusst nachsichtig: Statt bei der
 * ersten Unregelmäßigkeit abzubrechen, wird so viel wie möglich erkannt und
 * das Übrige gemeldet. Historische Beschreibungen halten sich selten an eine
 * Norm.
 */
export function parseBlazon(text: string): ParseBlazonResult {
  const warnings: string[] = []
  const unresolved: string[] = []
  const spec: BlazonSpec = { field: 'argent', ordinaries: [], charges: [] }

  const clean = text
    .replace(/\s+/g, ' ')
    .replace(/[„“”"]/g, '')
    .trim()
  if (!clean) {
    return { spec, confidence: 0, warnings: ['Kein Text angegeben.'], unresolved }
  }

  const lower = clean.toLowerCase()
  let consumed = 0
  const totalWords = lower.split(/[\s,;.]+/).filter(Boolean).length

  // --- Teilung -------------------------------------------------------------
  let divisionType: DivisionType | undefined
  let divisionRest = lower
  for (const [re, type] of DIVISION_WORDS) {
    const m = lower.match(re)
    if (m && m.index === 0) {
      divisionType = type
      divisionRest = lower.slice(m[0].length)
      consumed += m[0].split(/\s+/).length
      break
    }
  }

  // Anzahl der Streifen: „siebenmal geteilt“, „barry of eight“
  let divisionCount: number | undefined
  const countMatch = lower.match(/(\d+|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s*(?:mal|fach)\s+(?:geteilt|gespalten|gestreift)/)
  if (countMatch) {
    const n = numberFromWord(countMatch[1])
    if (n) divisionCount = n + 1
    if (!divisionType) {
      divisionType = /gespalten/.test(countMatch[0]) ? 'paly' : 'barry'
      consumed += 2
    }
  }

  // --- Feldfarben ----------------------------------------------------------
  // Deutsch: „von Gold und Schwarz“ nach der Teilung, „In Rot“ ohne Teilung
  const tinctureList: Tincture[] = []
  const vonMatch = divisionRest.match(/^[,;]?\s*(?:von|of)\s+(.+?)(?=[,;.]|$)/)
  if (vonMatch) {
    for (const part of vonMatch[1].split(/\s+und\s+|\s+and\s+|\s*,\s*/)) {
      const t = tinctureFromWord(part.trim())
      if (t) { tinctureList.push(t); consumed += 1 }
    }
    consumed += 1
  }

  if (!tinctureList.length) {
    // „In Rot …“ oder englisch „Azure, …“ am Satzanfang
    const inMatch = lower.match(/(?:^|[,;]\s*)(?:in|auf)\s+([a-zäöüß]+)/)
    if (inMatch) {
      const t = tinctureFromWord(inMatch[1])
      if (t) { tinctureList.push(t); consumed += 2 }
    } else {
      const firstWord = lower.split(/[\s,;.]+/)[0]
      const t = tinctureFromWord(firstWord)
      if (t) { tinctureList.push(t); consumed += 1 }
    }
  }

  if (divisionType) {
    const needed = divisionType === 'tiercedPerFess' || divisionType === 'tiercedPerPale' ? 3 : 2
    const tinctures = tinctureList.length >= needed
      ? tinctureList.slice(0, Math.max(needed, divisionType === 'quarterly' ? 2 : needed))
      : [...tinctureList, ...defaultPair(tinctureList)].slice(0, needed)
    if (tinctureList.length < needed) {
      warnings.push('Für die Teilung fehlen Farbangaben; es wurden Vorgaben eingesetzt.')
    }
    const division: Division = { type: divisionType, tinctures }
    if (divisionCount) division.count = divisionCount
    const line = firstMatch(lower, findLine)
    if (line) { division.line = line; consumed += 1 }
    spec.division = division
    spec.field = tinctures[0]
  } else {
    spec.field = tinctureList[0] ?? 'argent'
    if (!tinctureList.length) warnings.push('Keine Feldfarbe erkannt; Silber angenommen.')
  }

  // --- Heroldsbilder und Figuren ------------------------------------------
  // Der Text wird in Sinnabschnitte zerlegt und Abschnitt für Abschnitt gelesen
  const segments = clean.split(/\s*[,;]\s*|\s+(?:sowie|und dazu)\s+/i)

  // Bewehrung und Krönung stehen fast immer in einem eigenen Nachsatz
  // („…, rot bewehrt und gekrönt“) und beziehen sich auf die Hauptfigur.
  const armedMatch = lower.match(/([a-zäöüß]+)\s+(?:bewehrt|gezungt|bezungt|armed|langued)/)
  const armed = armedMatch ? tinctureFromWord(armedMatch[1]) : undefined
  const crownedMatch = lower.match(/([a-zäöüß]+)\s+(?:gekrönt|crowned)/)
  const crowned = crownedMatch ? tinctureFromWord(crownedMatch[1]) : undefined

  for (const segment of segments) {
    const words = segment.split(/\s+/).filter(Boolean)
    if (!words.length) continue

    let pendingCount: number | undefined
    let pendingTincture: Tincture | undefined
    let pendingAttitudes: Attitude[] = []
    let pendingLine: LineStyle | undefined
    let pendingPosition: 'chief' | 'base' | undefined
    // Im Englischen folgt die Farbe der Figur („three fleurs-de-lis or“);
    // dann wird sie nachträglich zugewiesen.
    let lastPiece: Charge | Ordinary | undefined

    for (let i = 0; i < words.length; i++) {
      const raw = words[i]
      const w = raw.toLowerCase().replace(/[.:]$/, '')

      const num = numberFromWord(w)
      if (num !== undefined && !tinctureFromWord(w)) { pendingCount = num; consumed++; continue }

      const line = findLine(w)
      if (line) { pendingLine = line; consumed++; continue }

      const att = findAttitude(w)
      if (att) { pendingAttitudes.push(att); consumed++; continue }

      const pos = POSITION_WORDS.find(([words]) => words.includes(w))
      if (pos) { pendingPosition = pos[1]; consumed++; continue }

      const tinc = tinctureFromWord(w)
      if (tinc) {
        const next = (words[i + 1] ?? '').toLowerCase()
        const isQualifier = /^(?:bewehrt|gezungt|bezungt|gekrönt|armed|langued|crowned)$/.test(next)
        if (lastPiece && !isQualifier) {
          // nachgestellte Farbe: bezieht sich auf die zuletzt genannte Figur
          lastPiece.tincture = tinc
          lastPiece = undefined
        } else if (!isQualifier) {
          pendingTincture = tinc
        }
        consumed++
        continue
      }

      const ord = findOrdinary(w)
      if (ord) {
        const o: Ordinary = { type: ord, tincture: pendingTincture ?? contrastTo(spec.field) }
        if (pendingLine) o.line = pendingLine
        if (pendingCount && pendingCount > 1) o.count = pendingCount
        spec.ordinaries.push(o)
        lastPiece = pendingTincture ? undefined : o
        consumed++
        pendingCount = undefined
        pendingTincture = undefined
        pendingLine = undefined
        continue
      }

      const charge = lookupCharge(w)
      if (charge) {
        const c: Charge = {
          key: charge.key,
          tincture: pendingTincture ?? contrastTo(spec.field),
          count: pendingCount ?? 1,
        }
        if (pendingAttitudes.length) c.attitudes = [...pendingAttitudes]
        if (pendingPosition) c.position = pendingPosition
        if (armed) c.armedTincture = armed
        if (crowned) c.crownedTincture = crowned
        // „schreitender Löwe“ hat einen eigenen Katalogeintrag
        if (charge.key === 'lion' && pendingAttitudes.includes('passant')) c.key = 'lionPassant'
        spec.charges.push(c)
        lastPiece = pendingTincture ? undefined : c
        consumed++
        pendingCount = undefined
        pendingTincture = undefined
        pendingAttitudes = []
        pendingPosition = undefined
        continue
      }

      // Füllwörter zählen nicht als unverstanden
      if (/^(?:ein|eine|einem|einen|einer|der|die|das|den|dem|mit|von|und|in|auf|über|belegt|besetzt|begleitet|zwischen|vorne|hinten|a|an|and|of|on|the|with|between)$/.test(w)) {
        consumed++
        continue
      }
      if (/^(?:bewehrt|gezungt|bezungt|gekrönt|armed|langued|crowned)$/.test(w)) { consumed++; continue }
      // Das Teilungswort wurde bereits im Kopf der Beschreibung ausgewertet
      if (DIVISION_WORDS.some(([re]) => re.test(w))) { consumed++; continue }

      unresolved.push(raw)
    }
  }

  // Herzschild als eigenes Wappen abtrennen
  const heart = spec.ordinaries.findIndex((o) => o.type === 'inescutcheon')
  if (heart >= 0) {
    const o = spec.ordinaries[heart]
    spec.inescutcheon = { field: o.tincture, ordinaries: [], charges: [] }
    spec.ordinaries.splice(heart, 1)
  }

  if (!spec.ordinaries.length && !spec.charges.length && !spec.division) {
    warnings.push('Weder Teilung noch Figur erkannt – nur ein einfarbiges Feld.')
  }

  // Aussagekräftiger als das Zählen verarbeiteter Wörter ist der Anteil der
  // Wörter, die keiner Bedeutung zugeordnet werden konnten
  const confidence = totalWords
    ? Math.max(0, Math.min(1, (totalWords - new Set(unresolved).size) / totalWords))
    : 0
  if (unresolved.length) {
    warnings.push(`Nicht zugeordnet: ${[...new Set(unresolved)].join(', ')}`)
  }
  void consumed

  return { spec, confidence, warnings, unresolved }
}

function firstMatch<T>(text: string, fn: (w: string) => T | undefined): T | undefined {
  for (const w of text.split(/[\s,;.]+/)) {
    const r = fn(w)
    if (r) return r
  }
  return undefined
}

/** Ergänzt fehlende Farben regelkonform: auf Metall folgt Farbe. */
function defaultPair(given: Tincture[]): Tincture[] {
  const first = given[0]
  if (!first) return ['or', 'gules']
  return TINCTURES[first].class === 'metal' ? ['gules', 'azure'] : ['or', 'argent']
}

/** Wählt eine Tinktur, die sich vom Feld abhebt – hält die Farbregel ein. */
export function contrastTo(field: Tincture): Tincture {
  const cls = TINCTURES[field]?.class
  if (cls === 'metal' || field === 'erminois' || field === 'ermine') return 'gules'
  return 'or'
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

const DIVISION_DE: Record<DivisionType, string> = {
  none: '', perPale: 'Gespalten', perFess: 'Geteilt', perBend: 'Schrägrechts geteilt',
  perBendSinister: 'Schräglinks geteilt', quarterly: 'Geviert', perSaltire: 'Schräggeviert',
  perChevron: 'Sparrenweise geteilt', gyronny: 'Geständert', tiercedPerPale: 'Gespalten in drei Plätze',
  tiercedPerFess: 'Geteilt in drei Plätze', chevronny: 'Sparrenweise gestreift',
  barry: 'Mehrfach geteilt', paly: 'Mehrfach gespalten', bendy: 'Schrägrechts gestreift',
  bendySinister: 'Schräglinks gestreift', checky: 'Geschacht', lozengy: 'Geweckt',
  fusilly: 'Gerautet', papelonny: 'Geschuppt',
}

const DIVISION_EN: Record<DivisionType, string> = {
  none: '', perPale: 'Per pale', perFess: 'Per fess', perBend: 'Per bend',
  perBendSinister: 'Per bend sinister', quarterly: 'Quarterly', perSaltire: 'Per saltire',
  perChevron: 'Per chevron', gyronny: 'Gyronny', tiercedPerPale: 'Tierced per pale',
  tiercedPerFess: 'Tierced per fess', chevronny: 'Chevronny', barry: 'Barry',
  paly: 'Paly', bendy: 'Bendy', bendySinister: 'Bendy sinister', checky: 'Chequy',
  lozengy: 'Lozengy', fusilly: 'Fusilly', papelonny: 'Papelonny',
}

const ORDINARY_DE: Record<OrdinaryType, [string, string]> = {
  fess: ['Balken', 'Balken'], pale: ['Pfahl', 'Pfähle'], bend: ['Schrägbalken', 'Schrägbalken'],
  bendSinister: ['Schräglinksbalken', 'Schräglinksbalken'], chevron: ['Sparren', 'Sparren'],
  chevronReversed: ['gestürzter Sparren', 'gestürzte Sparren'], cross: ['Kreuz', 'Kreuze'],
  saltire: ['Schrägkreuz', 'Schrägkreuze'], chief: ['Schildhaupt', 'Schildhäupter'],
  base: ['Schildfuß', 'Schildfüße'], pile: ['Spitze', 'Spitzen'], bordure: ['Bord', 'Borde'],
  canton: ['Freiviertel', 'Freiviertel'], quarter: ['Viertel', 'Viertel'],
  orle: ['Innenbord', 'Innenborde'], tressure: ['Innenrand', 'Innenränder'],
  pall: ['Göpel', 'Göpel'], pallReversed: ['gestürzter Göpel', 'gestürzte Göpel'],
  label: ['Turnierkragen', 'Turnierkragen'], gyron: ['Ständer', 'Ständer'],
  flaunches: ['Flanken', 'Flanken'], fret: ['Flechtwerk', 'Flechtwerke'],
  shakefork: ['Deichsel', 'Deichseln'], bar: ['Leiste', 'Leisten'],
  barrulet: ['Faden', 'Fäden'], pallet: ['Pfahlleiste', 'Pfahlleisten'],
  endorse: ['Stab', 'Stäbe'], bendlet: ['Schrägleiste', 'Schrägleisten'],
  baton: ['Schrägstab', 'Schrägstäbe'], chevronel: ['Sparrenleiste', 'Sparrenleisten'],
  crossHumetty: ['schwebendes Kreuz', 'schwebende Kreuze'],
  inescutcheon: ['Herzschild', 'Herzschilde'],
}

const ORDINARY_EN: Record<OrdinaryType, string> = {
  fess: 'fess', pale: 'pale', bend: 'bend', bendSinister: 'bend sinister',
  chevron: 'chevron', chevronReversed: 'chevron reversed', cross: 'cross',
  saltire: 'saltire', chief: 'chief', base: 'base', pile: 'pile', bordure: 'bordure',
  canton: 'canton', quarter: 'quarter', orle: 'orle', tressure: 'tressure',
  pall: 'pall', pallReversed: 'pall reversed', label: 'label', gyron: 'gyron',
  flaunches: 'flaunches', fret: 'fret', shakefork: 'shakefork', bar: 'bar',
  barrulet: 'barrulet', pallet: 'pallet', endorse: 'endorse', bendlet: 'bendlet',
  baton: 'baton', chevronel: 'chevronel', crossHumetty: 'cross humetty',
  inescutcheon: 'inescutcheon',
}

const ATTITUDE_DE: Partial<Record<Attitude, string>> = {
  rampant: 'steigend', passant: 'schreitend', statant: 'stehend', salient: 'springend',
  sejant: 'sitzend', couchant: 'liegend', displayed: 'ausgebreitet', rising: 'auffliegend',
  volant: 'fliegend', close: 'geschlossen', guardant: 'hersehend', regardant: 'widersehend',
  contourne: 'linksgewendet', erect: 'aufgerichtet', inverted: 'gestürzt',
  fesswise: 'balkenweise', palewise: 'pfahlweise', bendwise: 'schrägbalkenweise',
  couped: 'abgeschnitten', erased: 'abgerissen', cabossed: 'von vorn',
  issuant: 'wachsend',
}

const NUMBER_DE = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf']

function numberWord(n: number): string {
  return NUMBER_DE[n] ?? String(n)
}

/** Beugt die Farbbezeichnung: „ein goldener Löwe“, „drei goldene Löwen“. */
function tinctureAdjective(t: Tincture, plural: boolean): string {
  const base: Record<string, [string, string]> = {
    or: ['goldener', 'goldene'], argent: ['silberner', 'silberne'],
    gules: ['roter', 'rote'], azure: ['blauer', 'blaue'], sable: ['schwarzer', 'schwarze'],
    vert: ['grüner', 'grüne'], purpure: ['purpurner', 'purpurne'],
    tenne: ['brauner', 'braune'], sanguine: ['blutroter', 'blutrote'],
    murrey: ['maulbeerfarbener', 'maulbeerfarbene'], cendree: ['grauer', 'graue'],
    carnation: ['fleischfarbener', 'fleischfarbene'],
    ermine: ['hermelinener', 'hermelinene'], ermines: ['gegenhermelinener', 'gegenhermelinene'],
    erminois: ['goldhermelinener', 'goldhermelinene'], pean: ['schwarzhermelinener', 'schwarzhermelinene'],
    vair: ['fehfarbener', 'fehfarbene'], counterVair: ['gegenfehfarbener', 'gegenfehfarbene'],
    vairEnPoint: ['sturzfehfarbener', 'sturzfehfarbene'],
    potent: ['krückenfehfarbener', 'krückenfehfarbene'],
    counterPotent: ['gegenkrückenfehfarbener', 'gegenkrückenfehfarbene'],
    proper: ['naturfarbener', 'naturfarbene'],
  }
  const pair = base[t] ?? ['', '']
  return plural ? pair[1] : pair[0]
}

/** Erzeugt eine deutsche Blasonierung aus dem Wappen. */
export function writeBlazon(spec: BlazonSpec, lang: 'de' | 'en' = 'de'): string {
  return lang === 'de' ? writeGerman(spec) : writeEnglish(spec)
}

function writeGerman(spec: BlazonSpec): string {
  const parts: string[] = []

  if (spec.division && spec.division.type !== 'none') {
    const d = spec.division
    const names = d.tinctures.map((t) => TINCTURES[t].german)
    let head = DIVISION_DE[d.type]
    if (d.count && ['barry', 'paly', 'bendy', 'bendySinister'].includes(d.type)) {
      head = `${numberWord(d.count - 1)}mal ${d.type === 'paly' ? 'gespalten' : 'geteilt'}`
      head = head.charAt(0).toUpperCase() + head.slice(1)
    }
    if (d.line && d.line !== 'straight') {
      const lineWord = LINE_WORDS.find(([, l]) => l === d.line)?.[0][0]
      if (lineWord) head += ` (${lineWord})`
    }
    parts.push(`${head} von ${joinGerman(names)}`)
  } else {
    parts.push(`In ${TINCTURES[spec.field].german}`)
  }

  const pieces: string[] = []

  for (const o of spec.ordinaries) {
    const n = o.count ?? 1
    const [sg, pl] = ORDINARY_DE[o.type] ?? [o.type, o.type]
    const noun = n > 1 ? pl : sg
    const adj = tinctureAdjective(o.tincture, n > 1)
    let s = n > 1 ? `${numberWord(n)} ${adj} ${noun}` : `ein ${adj} ${noun}`
    if (o.line && o.line !== 'straight') {
      const lineWord = LINE_WORDS.find(([, l]) => l === o.line)?.[0][0]
      if (lineWord) s += `, ${lineWord}`
    }
    pieces.push(s)
  }

  for (const c of spec.charges) {
    const def = CHARGE_MAP[c.key]
    const name = def?.german ?? c.key
    const plural = c.count > 1
    const noun = plural ? germanPlural(name) : name
    const adj = tinctureAdjective(c.tincture, plural)
    const atts = (c.attitudes ?? [])
      .map((a) => ATTITUDE_DE[a])
      .filter(Boolean)
      .join(', ')
    const place = c.position === 'chief' ? 'oben ' : c.position === 'base' ? 'unten ' : ''
    let s = plural
      ? `${place}${numberWord(c.count)} ${adj} ${atts ? atts + ' ' : ''}${noun}`
      : `${place}ein ${adj} ${atts ? atts + ' ' : ''}${noun}`
    if (c.armedTincture) s += `, ${TINCTURES[c.armedTincture].german} bewehrt`
    if (c.crownedTincture) s += `, ${TINCTURES[c.crownedTincture].german} gekrönt`
    pieces.push(s)
  }

  if (pieces.length) parts.push(joinGerman(pieces))

  if (spec.inescutcheon) {
    parts.push(`Herzschild: ${writeGerman(spec.inescutcheon).replace(/\.$/, '')}`)
  }

  let out = parts.join(', ')
  out = out.charAt(0).toUpperCase() + out.slice(1)
  return out.endsWith('.') ? out : out + '.'
}

function writeEnglish(spec: BlazonSpec): string {
  const parts: string[] = []
  if (spec.division && spec.division.type !== 'none') {
    const names = spec.division.tinctures.map((t) => TINCTURES[t].english.toLowerCase())
    let head = DIVISION_EN[spec.division.type]
    if (spec.division.count) head += ` of ${spec.division.count}`
    parts.push(`${head} ${names.join(' and ')}`)
  } else {
    parts.push(TINCTURES[spec.field].english)
  }
  for (const o of spec.ordinaries) {
    const n = o.count ?? 1
    const noun = ORDINARY_EN[o.type] ?? o.type
    parts.push(`${n > 1 ? n + ' ' + noun + 's' : 'a ' + noun} ${TINCTURES[o.tincture].english.toLowerCase()}`)
  }
  for (const c of spec.charges) {
    const def = CHARGE_MAP[c.key]
    const name = def?.english ?? c.key
    const atts = (c.attitudes ?? []).join(' ')
    parts.push(
      `${c.count > 1 ? c.count + ' ' + name + 's' : 'a ' + name}${atts ? ' ' + atts : ''} ${TINCTURES[c.tincture].english.toLowerCase()}`,
    )
  }
  const out = parts.join(', ')
  return out.charAt(0).toUpperCase() + out.slice(1) + '.'
}

function joinGerman(list: string[]): string {
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} und ${list[list.length - 1]}`
}

/** Grobe Mehrzahlbildung für die Figurennamen im Katalog. */
function germanPlural(name: string): string {
  const irregular: Record<string, string> = {
    'Löwe': 'Löwen', 'Adler': 'Adler', 'Greif': 'Greifen', 'Bär': 'Bären',
    'Eber': 'Eber', 'Pferd': 'Pferde', 'Widder': 'Widder', 'Schwan': 'Schwäne',
    'Fisch': 'Fische', 'Lilie': 'Lilien', 'Rose': 'Rosen', 'Stern': 'Sterne',
    'Turm': 'Türme', 'Burg': 'Burgen', 'Schlüssel': 'Schlüssel', 'Schwert': 'Schwerter',
    'Pfeil': 'Pfeile', 'Anker': 'Anker', 'Krone': 'Kronen', 'Herz': 'Herzen',
    'Rad': 'Räder', 'Hammer': 'Hämmer', 'Kleeblatt': 'Kleeblätter',
    'Eichenblatt': 'Eichenblätter', 'Lindenblatt': 'Lindenblätter', 'Baum': 'Bäume',
    'Hand': 'Hände', 'Buch': 'Bücher', 'Glocke': 'Glocken', 'Kelch': 'Kelche',
    'Muschel': 'Muscheln', 'Jakobsmuschel': 'Jakobsmuscheln', 'Hirschstange': 'Hirschstangen',
    'Mondsichel': 'Mondsicheln', 'Sonne': 'Sonnen', 'Kirche': 'Kirchen',
    'Merlette': 'Merletten', 'Einhorn': 'Einhörner', 'Traube': 'Trauben',
    'Waage': 'Waagen', 'Krummstab': 'Krummstäbe', 'Jagdhorn': 'Jagdhörner',
    'Mühleisen': 'Mühleisen', 'Dreiberg': 'Dreiberge', 'Tatzenkreuz': 'Tatzenkreuze',
    'Komet': 'Kometen', 'Vollmond': 'Vollmonde', 'Bischofsmütze': 'Bischofsmützen',
  }
  return irregular[name] ?? `${name}n`
}

void SHAPE_HINTS

// ---------------------------------------------------------------------------
// Prüfung
// ---------------------------------------------------------------------------

export interface BlazonCheck {
  level: 'ok' | 'warning' | 'error'
  message: string
}

/**
 * Prüft ein Wappen gegen die heraldischen Grundregeln. Verstöße sind kein
 * Fehler im engeren Sinne – es gibt bekannte Ausnahmen wie das Wappen des
 * Königreichs Jerusalem –, aber sie sollten bewusst gesetzt sein.
 */
export function checkBlazon(spec: BlazonSpec): BlazonCheck[] {
  const out: BlazonCheck[] = []
  const fieldTinctures = spec.division ? spec.division.tinctures : [spec.field]

  for (const o of spec.ordinaries) {
    for (const f of fieldTinctures) {
      if (violates(f, o.tincture)) {
        const [sg] = ORDINARY_DE[o.type] ?? [o.type]
        out.push({
          level: 'warning',
          message: `${sg} in ${TINCTURES[o.tincture].german} auf ${TINCTURES[f].german}: Farbe auf Farbe beziehungsweise Metall auf Metall verstößt gegen die heraldische Farbregel.`,
        })
        break
      }
    }
  }

  for (const c of spec.charges) {
    // Eine Figur auf einem Heroldsbild wird gegen dieses geprüft
    const ground = c.onOrdinary !== undefined && spec.ordinaries[c.onOrdinary]
      ? [spec.ordinaries[c.onOrdinary].tincture]
      : fieldTinctures
    // Über eine Teilung gelegte Figuren sind von der Regel ausgenommen
    if (ground.length > 1) continue
    for (const f of ground) {
      if (violates(f, c.tincture)) {
        const name = CHARGE_MAP[c.key]?.german ?? c.key
        out.push({
          level: 'warning',
          message: `${name} in ${TINCTURES[c.tincture].german} auf ${TINCTURES[f].german}: Verstoß gegen die Farbregel.`,
        })
        break
      }
    }
  }

  if (spec.charges.length + spec.ordinaries.length > 6) {
    out.push({
      level: 'warning',
      message: 'Sehr viele Bestandteile. Ein gutes Wappen bleibt auf zwanzig Schritt Entfernung lesbar.',
    })
  }

  if (!out.length) out.push({ level: 'ok', message: 'Keine Verstöße gegen die heraldischen Grundregeln.' })
  return out
}

function violates(a: Tincture, b: Tincture): boolean {
  if (a === 'proper' || b === 'proper') return false
  const ca = TINCTURES[a].class
  const cb = TINCTURES[b].class
  if (ca === 'fur' || cb === 'fur') return false
  const metalA = ca === 'metal'
  const metalB = cb === 'metal'
  if (metalA && metalB) return true
  if (!metalA && !metalB && (ca === 'colour' || ca === 'stain') && (cb === 'colour' || cb === 'stain')) return true
  return false
}
