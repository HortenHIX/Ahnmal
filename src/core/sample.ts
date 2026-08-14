/**
 * Beispielbestand.
 *
 * Eine erfundene Familie aus der Baar mit dem Datenbild, das man in
 * süddeutschen Kirchenbüchern tatsächlich vorfindet: lückenhafte Angaben,
 * Zweitehen nach Kindbettfieber, hohe Kindersterblichkeit, Berufe im
 * Handwerk. So lässt sich das Programm gleich mit etwas Realistischem prüfen.
 */

import { parseDate } from './dates'
import { uid } from './ids'
import { emptyDatabase } from './types'
import type { Arms, Database, GEvent, ID, Person, Sex } from './types'
import { parseBlazon } from '../heraldry/blazon'

interface Seed {
  key: string
  given: string
  surname: string
  sex: Sex
  birth?: string
  birthPlace?: string
  death?: string
  deathPlace?: string
  occupation?: string
  note?: string
}

const PLACE = 'Hüfingen, Baar, Baden'
const PLACE2 = 'Bräunlingen, Baar, Baden'
const PLACE3 = 'Donaueschingen, Baar, Baden'

const SEEDS: Seed[] = [
  { key: 'hans1', given: 'Hans Jakob', surname: 'Wegerer', sex: 'M', birth: 'um 1698', birthPlace: PLACE, death: '12.03.1761', deathPlace: PLACE, occupation: 'Hufschmied' },
  { key: 'maria1', given: 'Anna Maria', surname: 'Blattner', sex: 'F', birth: '04.02.1702', birthPlace: PLACE2, death: '19.11.1748', deathPlace: PLACE, note: 'Gestorben im Kindbett nach der Geburt des jüngsten Sohnes.' },
  { key: 'kath1', given: 'Katharina', surname: 'Störr', sex: 'F', birth: 'um 1715', birthPlace: PLACE3, death: 'nach 1770', note: 'Zweite Ehefrau; Sterbedatum bislang nicht ermittelt.' },

  { key: 'josef', given: 'Josef Anton', surname: 'Wegerer', sex: 'M', birth: '18.09.1728', birthPlace: PLACE, death: '07.01.1794', deathPlace: PLACE, occupation: 'Hufschmied und Zunftmeister' },
  { key: 'magd', given: 'Maria Magdalena', surname: 'Wegerer', sex: 'F', birth: '22.06.1731', birthPlace: PLACE, death: '30.06.1731', deathPlace: PLACE, note: 'Acht Tage alt geworden.' },
  { key: 'franz', given: 'Franz Xaver', surname: 'Wegerer', sex: 'M', birth: '11.04.1734', birthPlace: PLACE, death: '1802', deathPlace: PLACE3, occupation: 'Wagner' },
  { key: 'theres', given: 'Maria Theresia', surname: 'Wegerer', sex: 'F', birth: '02.12.1737', birthPlace: PLACE, death: '14.08.1801', deathPlace: PLACE2 },
  { key: 'ignaz', given: 'Ignaz', surname: 'Wegerer', sex: 'M', birth: '15.11.1748', birthPlace: PLACE, death: '20.11.1748', deathPlace: PLACE },

  { key: 'agathe', given: 'Agathe', surname: 'Fehrenbach', sex: 'F', birth: '30.01.1733', birthPlace: PLACE2, death: '25.02.1799', deathPlace: PLACE },
  { key: 'lorenz', given: 'Johann Lorenz', surname: 'Wegerer', sex: 'M', birth: '09.08.1759', birthPlace: PLACE, death: '03.05.1827', deathPlace: PLACE, occupation: 'Hufschmied' },
  { key: 'creszenz', given: 'Maria Creszentia', surname: 'Wegerer', sex: 'F', birth: '17.03.1762', birthPlace: PLACE, death: '1763', deathPlace: PLACE },
  { key: 'karl', given: 'Karl Josef', surname: 'Wegerer', sex: 'M', birth: '28.10.1765', birthPlace: PLACE, death: '1841', deathPlace: PLACE3, occupation: 'Krämer' },

  { key: 'barbara', given: 'Barbara', surname: 'Hall', sex: 'F', birth: '12.05.1764', birthPlace: PLACE3, death: '08.09.1835', deathPlace: PLACE },
  { key: 'anton2', given: 'Anton', surname: 'Wegerer', sex: 'M', birth: '21.02.1790', birthPlace: PLACE, death: '16.07.1856', deathPlace: PLACE, occupation: 'Hufschmied und Bürgermeister' },
  { key: 'ursula', given: 'Ursula', surname: 'Wegerer', sex: 'F', birth: '04.09.1793', birthPlace: PLACE, death: '1871', deathPlace: PLACE2 },

  { key: 'fehr1', given: 'Michael', surname: 'Fehrenbach', sex: 'M', birth: 'um 1700', birthPlace: PLACE2, death: '1768', deathPlace: PLACE2, occupation: 'Bauer' },
  { key: 'fehr2', given: 'Anna', surname: 'Ganter', sex: 'F', birth: 'um 1706', death: 'vor 1770' },
  { key: 'blatt1', given: 'Jakob', surname: 'Blattner', sex: 'M', birth: 'um 1670', death: '1729', deathPlace: PLACE2, occupation: 'Müller' },
  { key: 'blatt2', given: 'Margaretha', surname: 'Schleicher', sex: 'F', birth: 'um 1676', death: '1738', deathPlace: PLACE2 },
]

interface FamSeed {
  key: string
  a?: string
  b?: string
  marriage?: string
  marriagePlace?: string
  children: string[]
  note?: string
}

const FAMILIES: FamSeed[] = [
  { key: 'f1', a: 'hans1', b: 'maria1', marriage: '26.01.1727', marriagePlace: PLACE, children: ['josef', 'magd', 'franz', 'theres', 'ignaz'] },
  { key: 'f2', a: 'hans1', b: 'kath1', marriage: '11.05.1749', marriagePlace: PLACE, children: [], note: 'Zweite Ehe, ein halbes Jahr nach dem Tod der ersten Frau. In Handwerkerhaushalten die Regel, nicht die Ausnahme.' },
  { key: 'f3', a: 'josef', b: 'agathe', marriage: '14.02.1758', marriagePlace: PLACE, children: ['lorenz', 'creszenz', 'karl'] },
  { key: 'f4', a: 'lorenz', b: 'barbara', marriage: '09.11.1789', marriagePlace: PLACE, children: ['anton2', 'ursula'] },
  { key: 'f5', a: 'fehr1', b: 'fehr2', marriage: 'um 1730', children: ['agathe'] },
  { key: 'f6', a: 'blatt1', b: 'blatt2', marriage: 'um 1698', children: ['maria1'] },
]

function ev(type: GEvent['type'], date?: string, place?: string): GEvent | null {
  if (!date && !place) return null
  const e: GEvent = { id: uid('e'), type }
  const d = parseDate(date)
  if (d) e.date = d
  if (place) e.placeText = place
  return e
}

export function buildSampleTree(): Database {
  const db = emptyDatabase('Wegerer aus Hüfingen (Beispiel)')
  db.meta.description =
    'Ein erfundener Beispielbestand aus der Baar. Er zeigt, wie Kirchenbuchdaten '
    + 'typischerweise aussehen: unvollständig, mit Zweitehen und hoher Kindersterblichkeit.'
  db.meta.researcher = 'Beispiel'

  // Archiv und Quellen
  const repoId = uid('r')
  db.repositories[repoId] = {
    id: repoId,
    name: 'Erzbischöfliches Archiv Freiburg',
    address: 'Schoferstraße 2, 79098 Freiburg im Breisgau',
    url: 'https://www.ebfr.de',
    notes: ['Zuständig für die katholischen Kirchenbücher der Erzdiözese.'],
    created: Date.now(), changed: Date.now(),
  }

  const srcTauf = uid('s')
  db.sources[srcTauf] = {
    id: srcTauf,
    title: 'Katholisches Taufbuch Hüfingen 1690–1780',
    kind: 'Kirchenbuch',
    author: 'Pfarramt St. Verena Hüfingen',
    repositoryId: repoId,
    callNumber: 'KB Hüfingen 3',
    coversFrom: 1690, coversTo: 1780,
    mediaIds: [], notes: [],
    created: Date.now(), changed: Date.now(),
  }
  const srcEhe = uid('s')
  db.sources[srcEhe] = {
    id: srcEhe,
    title: 'Katholisches Ehebuch Hüfingen 1690–1810',
    kind: 'Kirchenbuch',
    repositoryId: repoId,
    callNumber: 'KB Hüfingen 7',
    coversFrom: 1690, coversTo: 1810,
    mediaIds: [], notes: [],
    created: Date.now(), changed: Date.now(),
  }
  const srcTot = uid('s')
  db.sources[srcTot] = {
    id: srcTot,
    title: 'Katholisches Sterbebuch Hüfingen 1690–1830',
    kind: 'Kirchenbuch',
    repositoryId: repoId,
    callNumber: 'KB Hüfingen 11',
    coversFrom: 1690, coversTo: 1830,
    mediaIds: [], notes: [],
    created: Date.now(), changed: Date.now(),
  }

  // Personen
  const ids = new Map<string, ID>()
  for (const s of SEEDS) {
    const id = uid('p')
    ids.set(s.key, id)
    const events: GEvent[] = []
    const b = ev('BIRT', s.birth, s.birthPlace)
    if (b) { b.citations = [{ id: uid('c'), sourceId: srcTauf, confidence: 3 }]; events.push(b) }
    const d = ev('DEAT', s.death, s.deathPlace)
    if (d) { d.citations = [{ id: uid('c'), sourceId: srcTot, confidence: 2 }]; events.push(d) }

    const person: Person = {
      id,
      names: [{ id: uid('n'), given: s.given, surname: s.surname, type: 'birth', primary: true }],
      sex: s.sex,
      events,
      attributes: s.occupation
        ? [{ id: uid('a'), type: 'OCCU', value: s.occupation }]
        : [],
      childOf: [], spouseIn: [], mediaIds: [], citations: [],
      notes: s.note ? [s.note] : [],
      created: Date.now(), changed: Date.now(),
    }
    db.persons[id] = person
  }

  // Familien
  for (const f of FAMILIES) {
    const id = uid('f')
    const a = f.a ? ids.get(f.a) : undefined
    const b = f.b ? ids.get(f.b) : undefined
    const events: GEvent[] = []
    const m = ev('MARR', f.marriage, f.marriagePlace)
    if (m) { m.citations = [{ id: uid('c'), sourceId: srcEhe, confidence: 3 }]; events.push(m) }

    db.families[id] = {
      id,
      partner1: a, partner2: b,
      unionType: 'married',
      children: f.children.map((c) => ({ personId: ids.get(c)! })).filter((c) => c.personId),
      events,
      mediaIds: [], citations: [],
      notes: f.note ? [f.note] : [],
      created: Date.now(), changed: Date.now(),
    }
    for (const pid of [a, b]) if (pid) db.persons[pid].spouseIn.push(id)
    for (const c of f.children) {
      const cid = ids.get(c)
      if (cid) db.persons[cid].childOf.push(id)
    }
  }

  db.meta.rootPersonId = ids.get('anton2')

  // Wappen
  const armsList: { name: string; blazon: string; region: string; attribution: string }[] = [
    {
      name: 'Wegerer',
      blazon: 'In Rot ein goldener Hammer, begleitet von zwei silbernen Sternen',
      region: 'Baar, Baden',
      attribution: 'Petschaft am Zunftbrief der Schmiedezunft, 1763',
    },
    {
      name: 'Blattner',
      blazon: 'In Blau ein silbernes Mühleisen',
      region: 'Bräunlingen',
      attribution: 'Grabplatte auf dem alten Friedhof',
    },
    {
      name: 'Fehrenbach',
      blazon: 'Geteilt von Gold und Grün, oben ein wachsender schwarzer Bär, unten ein goldener Dreiberg',
      region: 'Schwarzwald-Baar',
      attribution: 'Siebmachers Wappenbuch, Bürgerliche Wappen',
    },
  ]

  for (const a of armsList) {
    const id = uid('w')
    const { spec } = parseBlazon(a.blazon)
    const arms: Arms = {
      id,
      name: a.name,
      blazon: a.blazon,
      blazonLang: 'de',
      spec,
      shape: 'heater',
      crest: {
        helmType: 'tilting',
        mantlingOuter: spec.division?.tinctures[0] ?? spec.field,
        mantlingInner: 'argent',
        torse: [spec.charges[0]?.tincture ?? 'or', spec.field],
        key: spec.charges[0]?.key,
        tincture: spec.charges[0]?.tincture,
      },
      region: a.region,
      attribution: a.attribution,
      notes: [],
      created: Date.now(), changed: Date.now(),
    }
    db.arms[id] = arms
  }

  // Das Familienwappen den Trägern des Namens zuordnen
  const wegererArms = Object.values(db.arms).find((a) => a.name === 'Wegerer')
  if (wegererArms) {
    for (const p of Object.values(db.persons)) {
      if (p.names[0]?.surname === 'Wegerer') p.armsId = wegererArms.id
    }
  }

  // Forschungsaufgaben
  const t1 = uid('t')
  db.tasks[t1] = {
    id: t1,
    title: 'Sterbeeintrag Katharina Störr suchen',
    detail: 'Zweite Ehefrau von Hans Jakob Wegerer. Im Sterbebuch Hüfingen ab 1770 nicht gefunden – '
      + 'möglicherweise bei Verwandten in Donaueschingen verstorben.',
    status: 'open', priority: 'high',
    personId: ids.get('kath1'),
    created: Date.now(), changed: Date.now(),
  }
  const t2 = uid('t')
  db.tasks[t2] = {
    id: t2,
    title: 'Eltern von Jakob Blattner ermitteln',
    detail: 'Geboren um 1670, damit vor Beginn des erhaltenen Taufbuchs. Umweg über die Mühlenakten prüfen.',
    status: 'open', priority: 'normal',
    personId: ids.get('blatt1'),
    created: Date.now(), changed: Date.now(),
  }

  const l1 = uid('l')
  db.log[l1] = {
    id: l1,
    date: '2024-11-08',
    repository: 'Erzbischöfliches Archiv Freiburg',
    sourceSearched: 'Sterbebuch Hüfingen 1690–1830, Jahrgänge 1770–1790',
    objective: 'Sterbeeintrag der Katharina Störr',
    searchTerms: 'Störr, Stör, Sterr, Wegerer',
    result: 'Kein Eintrag gefunden. Die Jahrgänge sind vollständig und gut lesbar.',
    negative: true,
    personId: ids.get('kath1'),
    created: Date.now(),
  }

  return db
}
