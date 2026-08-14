import { describe, expect, it } from 'vitest'
import { findDuplicates, levenshtein, mergePersons, similarity } from '../src/core/duplicates'
import { coloniaPhonetic, displayName, isProbablyLiving, listName } from '../src/core/model'
import {
  ancestorsWithKekule, implexReport, inbreedingCoefficient, kekuleLine,
  relationship, wrightCoefficient,
} from '../src/core/relations'
import { buildSampleTree } from '../src/core/sample'
import { validate } from '../src/core/validate'
import { emptyDatabase } from '../src/core/types'
import type { Database, ID, Sex } from '../src/core/types'
import { exportGedcom } from '../src/gedcom/export'
import { importGedcom } from '../src/gedcom/import'
import { parseGedcom } from '../src/gedcom/parse'

// ---------------------------------------------------------------------------
// Kleiner Testbestand, von Hand aufgebaut
// ---------------------------------------------------------------------------

function makeTree() {
  const db = emptyDatabase('Test')
  let n = 0
  const add = (given: string, surname: string, sex: Sex, birth?: number, death?: number): ID => {
    const id = `p${n++}`
    db.persons[id] = {
      id,
      names: [{ id: `n${n}`, given, surname, type: 'birth', primary: true }],
      sex,
      events: [
        ...(birth ? [{ id: `e${n}b`, type: 'BIRT' as const, date: { modifier: 'exact' as const, from: { year: birth } } }] : []),
        ...(death ? [{ id: `e${n}d`, type: 'DEAT' as const, date: { modifier: 'exact' as const, from: { year: death } } }] : []),
      ],
      attributes: [], childOf: [], spouseIn: [], mediaIds: [], citations: [], notes: [],
      created: 0, changed: 0,
    }
    return id
  }
  const family = (a: ID | undefined, b: ID | undefined, children: ID[]): ID => {
    const id = `f${n++}`
    db.families[id] = {
      id, partner1: a, partner2: b, unionType: 'married',
      children: children.map((c) => ({ personId: c })),
      events: [], mediaIds: [], citations: [], notes: [], created: 0, changed: 0,
    }
    for (const p of [a, b]) if (p) db.persons[p].spouseIn.push(id)
    for (const c of children) db.persons[c].childOf.push(id)
    return id
  }
  return { db, add, family }
}

describe('Kekulé-Nummerierung', () => {
  it('vergibt Vater 2n und Mutter 2n+1', () => {
    const { db, add, family } = makeTree()
    const kind = add('Kind', 'Muster', 'M', 1800)
    const vater = add('Vater', 'Muster', 'M', 1770)
    const mutter = add('Mutter', 'Muster', 'F', 1775)
    const opa = add('Opa', 'Muster', 'M', 1740)
    family(vater, mutter, [kind])
    family(opa, undefined, [vater])

    const nodes = ancestorsWithKekule(db, kind, 5)
    const byId = new Map(nodes.map((x) => [x.personId, x.kekule]))
    expect(byId.get(kind)).toBe(1)
    expect(byId.get(vater)).toBe(2)
    expect(byId.get(mutter)).toBe(3)
    expect(byId.get(opa)).toBe(4)
  })

  it('übersetzt die Nummer in die Ahnenlinie', () => {
    expect(kekuleLine(1)).toBe('Proband')
    expect(kekuleLine(2)).toBe('V')
    expect(kekuleLine(3)).toBe('M')
    expect(kekuleLine(5)).toBe('VM')
  })

  it('läuft bei fehlerhaften Ringschlüssen nicht endlos', () => {
    const { db, add, family } = makeTree()
    const a = add('A', 'X', 'M')
    const b = add('B', 'X', 'M')
    family(b, undefined, [a])
    family(a, undefined, [b]) // A ist sein eigener Großvater
    const nodes = ancestorsWithKekule(db, a, 6)
    expect(nodes.length).toBeLessThan(200)
  })
})

describe('Verwandtschaftsrechner', () => {
  const { db, add, family } = makeTree()
  const opa = add('Opa', 'Muster', 'M', 1740)
  const oma = add('Oma', 'Muster', 'F', 1745)
  const vater = add('Vater', 'Muster', 'M', 1770)
  const onkel = add('Onkel', 'Muster', 'M', 1772)
  const kind = add('Kind', 'Muster', 'M', 1800)
  const cousine = add('Cousine', 'Muster', 'F', 1802)
  family(opa, oma, [vater, onkel])
  family(vater, undefined, [kind])
  family(onkel, undefined, [cousine])

  it('benennt die direkte Linie', () => {
    expect(relationship(db, kind, vater)!.label).toBe('Vater')
    expect(relationship(db, kind, opa)!.label).toBe('Großvater')
    expect(relationship(db, opa, kind)!.label).toBe('Enkel')
  })

  it('benennt Geschwister und Seitenlinien', () => {
    expect(relationship(db, vater, onkel)!.label).toBe('Bruder')
    expect(relationship(db, kind, onkel)!.label).toBe('Onkel')
    expect(relationship(db, onkel, kind)!.label).toBe('Neffe')
    expect(relationship(db, kind, cousine)!.label).toBe('Cousine 1. Grades')
  })

  it('berechnet den Verwandtschaftskoeffizienten nach Wright', () => {
    // Geschwister teilen die Hälfte, Cousins ersten Grades ein Achtel
    expect(wrightCoefficient(db, vater, onkel)).toBeCloseTo(0.5, 2)
    expect(wrightCoefficient(db, kind, cousine)).toBeCloseTo(0.125, 3)
    expect(wrightCoefficient(db, kind, vater)).toBeCloseTo(0.5, 2)
  })

  it('gibt nichts zurück, wo keine Verbindung besteht', () => {
    const fremd = add('Fremd', 'Ander', 'M', 1800)
    expect(relationship(db, kind, fremd)).toBeNull()
  })

  it('berechnet den Inzuchtkoeffizienten bei Verwandtenehe', () => {
    const { db: d2, add: a2, family: f2 } = makeTree()
    const ur = a2('Ur', 'X', 'M')
    const ur2 = a2('Ur2', 'X', 'F')
    const s1 = a2('S1', 'X', 'M')
    const s2 = a2('S2', 'X', 'F')
    const c1 = a2('C1', 'X', 'M')
    const c2 = a2('C2', 'X', 'F')
    const kind2 = a2('Kind', 'X', 'M')
    f2(ur, ur2, [s1, s2])
    f2(s1, undefined, [c1])
    f2(s2, undefined, [c2])
    f2(c1, c2, [kind2])
    // Kind zweier Cousins ersten Grades: Inzuchtkoeffizient ein Sechzehntel
    expect(inbreedingCoefficient(d2, kind2)).toBeCloseTo(0.0625, 3)
  })
})

describe('Ahnenschwund', () => {
  it('zählt mehrfach besetzte Ahnenstellen', () => {
    const { db, add, family } = makeTree()
    const ur = add('Ur', 'X', 'M')
    const s1 = add('S1', 'X', 'M')
    const s2 = add('S2', 'X', 'F')
    const c1 = add('C1', 'X', 'M')
    const c2 = add('C2', 'X', 'F')
    const kind = add('Kind', 'X', 'M')
    family(ur, undefined, [s1, s2])
    family(s1, undefined, [c1])
    family(s2, undefined, [c2])
    family(c1, c2, [kind])

    const report = implexReport(db, kind, 6)
    expect(report.duplicates).toHaveLength(1)
    expect(report.duplicates[0].personId).toBe(ur)
    expect(report.duplicates[0].positions).toHaveLength(2)
  })
})

describe('Plausibilitätsprüfung', () => {
  it('erkennt Tod vor Geburt', () => {
    const { db, add } = makeTree()
    add('Unmöglich', 'Fall', 'M', 1800, 1780)
    const issues = validate(db)
    expect(issues.some((i) => i.severity === 'error' && i.rule === 'Reihenfolge')).toBe(true)
  })

  it('erkennt eine zu junge Mutter', () => {
    const { db, add, family } = makeTree()
    const mutter = add('Zu jung', 'Fall', 'F', 1790)
    const kind = add('Kind', 'Fall', 'M', 1798)
    family(undefined, mutter, [kind])
    const issues = validate(db)
    expect(issues.some((i) => i.rule === 'Elternalter')).toBe(true)
  })

  it('erkennt ein Kind nach dem Tod der Mutter', () => {
    const { db, add, family } = makeTree()
    const mutter = add('Mutter', 'Fall', 'F', 1750, 1780)
    const kind = add('Kind', 'Fall', 'M', 1790)
    family(undefined, mutter, [kind])
    expect(validate(db).some((i) => i.severity === 'error' && i.rule === 'Elternalter')).toBe(true)
  })

  it('lässt ein nachgeborenes Kind des Vaters zu', () => {
    const { db, add, family } = makeTree()
    const vater = add('Vater', 'Fall', 'M', 1750, 1790)
    const kind = add('Kind', 'Fall', 'M', 1790)
    family(vater, undefined, [kind])
    const errors = validate(db).filter((i) => i.severity === 'error' && i.rule === 'Elternalter')
    expect(errors).toHaveLength(0)
  })

  it('erkennt einen Ringschluss', () => {
    const { db, add, family } = makeTree()
    const a = add('A', 'X', 'M')
    const b = add('B', 'X', 'M')
    family(b, undefined, [a])
    family(a, undefined, [b])
    expect(validate(db).some((i) => i.rule === 'Ringschluss')).toBe(true)
  })

  it('beanstandet einen sauberen Bestand nicht', () => {
    const { db, add, family } = makeTree()
    const vater = add('Vater', 'X', 'M', 1750, 1810)
    const mutter = add('Mutter', 'X', 'F', 1755, 1800)
    const kind = add('Kind', 'X', 'M', 1780, 1850)
    family(vater, mutter, [kind])
    expect(validate(db).filter((i) => i.severity === 'error')).toHaveLength(0)
  })
})

describe('Namensvergleich', () => {
  it('bildet die Kölner Phonetik', () => {
    // Die häufigsten Schreibvarianten desselben Namens
    expect(coloniaPhonetic('Meyer')).toBe(coloniaPhonetic('Maier'))
    expect(coloniaPhonetic('Meyer')).toBe(coloniaPhonetic('Mayr'))
    expect(coloniaPhonetic('Schmidt')).toBe(coloniaPhonetic('Schmitt'))
  })

  it('unterscheidet unterschiedliche Namen', () => {
    expect(coloniaPhonetic('Meyer')).not.toBe(coloniaPhonetic('Bauer'))
  })

  it('misst Ähnlichkeit', () => {
    expect(levenshtein('Müller', 'Müller')).toBe(0)
    expect(levenshtein('Müller', 'Miller')).toBe(1)
    expect(similarity('Müller', 'Mueller')).toBeGreaterThan(0.8)
  })
})

describe('Dublettensuche', () => {
  it('findet dieselbe Person in zwei Fassungen', () => {
    const { db, add } = makeTree()
    add('Johann Georg', 'Meyer', 'M', 1750, 1820)
    add('Georg', 'Maier', 'M', 1750, 1820)
    const found = findDuplicates(db, 55)
    expect(found.length).toBeGreaterThan(0)
  })

  it('hält verschiedene Personen auseinander', () => {
    const { db, add } = makeTree()
    add('Johann', 'Meyer', 'M', 1750, 1820)
    add('Anna', 'Bauer', 'F', 1810, 1880)
    expect(findDuplicates(db, 60)).toHaveLength(0)
  })

  it('schließt unterschiedliches Geschlecht aus', () => {
    const { db, add } = makeTree()
    add('Maria', 'Meyer', 'F', 1750, 1820)
    add('Maria', 'Meyer', 'M', 1750, 1820)
    expect(findDuplicates(db, 50)).toHaveLength(0)
  })

  it('führt zwei Datensätze zusammen und hängt die Familien um', () => {
    const { db, add, family } = makeTree()
    const a = add('Johann', 'Meyer', 'M', 1750)
    const b = add('Johann', 'Meyer', 'M', 1750)
    const kindA = add('Kind A', 'Meyer', 'M', 1780)
    const kindB = add('Kind B', 'Meyer', 'F', 1782)
    family(a, undefined, [kindA])
    family(b, undefined, [kindB])

    const res = mergePersons(db, a, b)
    expect(res.db.persons[b]).toBeUndefined()
    expect(res.db.persons[a].spouseIn).toHaveLength(2)
    // Beide Kinder hängen jetzt an der behaltenen Person
    const kinder = Object.values(res.db.families).flatMap((f) => f.children.map((c) => c.personId))
    expect(kinder).toContain(kindA)
    expect(kinder).toContain(kindB)
  })
})

describe('Datenschutz', () => {
  it('hält ohne Sterbedatum und mit junger Geburt für lebend', () => {
    const { db, add } = makeTree()
    const p = add('Jung', 'Heute', 'M', new Date().getFullYear() - 30)
    expect(isProbablyLiving(db.persons[p])).toBe(true)
  })

  it('hält mit Sterbedatum für verstorben', () => {
    const { db, add } = makeTree()
    const p = add('Alt', 'Damals', 'M', 1800, 1870)
    expect(isProbablyLiving(db.persons[p])).toBe(false)
  })

  it('achtet die ausdrückliche Angabe', () => {
    const { db, add } = makeTree()
    const p = add('Alt', 'Damals', 'M', 1800)
    db.persons[p].living = false
    expect(isProbablyLiving(db.persons[p])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// GEDCOM
// ---------------------------------------------------------------------------

describe('GEDCOM lesen', () => {
  const sample = [
    '0 HEAD',
    '1 SOUR TESTPROG',
    '1 GEDC',
    '2 VERS 5.5.1',
    '1 CHAR UTF-8',
    '0 @I1@ INDI',
    '1 NAME Johann Georg /Müller/',
    '1 SEX M',
    '1 BIRT',
    '2 DATE 14 AUG 1723',
    '2 PLAC Hüfingen, Baden',
    '1 DEAT',
    '2 DATE ABT 1789',
    '1 OCCU Hufschmied',
    '1 FAMS @F1@',
    '0 @I2@ INDI',
    '1 NAME Anna Maria /Blattner/',
    '1 SEX F',
    '1 BIRT',
    '2 DATE 4 FEB 1730',
    '1 FAMS @F1@',
    '0 @I3@ INDI',
    '1 NAME Josef /Müller/',
    '1 SEX M',
    '1 FAMC @F1@',
    '0 @F1@ FAM',
    '1 HUSB @I1@',
    '1 WIFE @I2@',
    '1 CHIL @I3@',
    '1 MARR',
    '2 DATE 26 JAN 1750',
    '0 TRLR',
  ].join('\n')

  it('zerlegt die Datei in Sätze', () => {
    const { records, warnings } = parseGedcom(sample)
    expect(records.filter((r) => r.tag === 'INDI')).toHaveLength(3)
    expect(records.filter((r) => r.tag === 'FAM')).toHaveLength(1)
    expect(warnings).toHaveLength(0)
  })

  it('übernimmt Personen, Namen und Ereignisse', () => {
    const { db, counts } = importGedcom(sample)
    expect(counts.persons).toBe(3)
    expect(counts.families).toBe(1)

    const johann = Object.values(db.persons).find((p) => p.names[0].given === 'Johann Georg')!
    expect(johann.names[0].surname).toBe('Müller')
    expect(johann.sex).toBe('M')
    expect(johann.events.find((e) => e.type === 'BIRT')!.date!.from!.year).toBe(1723)
    expect(johann.events.find((e) => e.type === 'DEAT')!.date!.modifier).toBe('about')
    expect(johann.attributes[0]).toMatchObject({ type: 'OCCU', value: 'Hufschmied' })
  })

  it('stellt die Familienbande her', () => {
    const { db } = importGedcom(sample)
    const fam = Object.values(db.families)[0]
    expect(fam.children).toHaveLength(1)
    expect(fam.partner1).toBeDefined()
    expect(fam.partner2).toBeDefined()
    const kind = db.persons[fam.children[0].personId]
    expect(kind.childOf).toContain(fam.id)
  })

  it('legt Orte als eigene Datensätze an', () => {
    const { db } = importGedcom(sample)
    const ort = Object.values(db.places).find((p) => p.name === 'Hüfingen')
    expect(ort).toBeDefined()
    expect(ort!.hierarchy).toEqual(['Baden'])
  })

  it('erträgt fehlerhafte Zeilen, ohne aufzugeben', () => {
    const kaputt = sample.replace('1 SEX M', 'Unsinn ohne Ebene')
    const { records, warnings } = parseGedcom(kaputt)
    expect(records.filter((r) => r.tag === 'INDI')).toHaveLength(3)
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('fügt Fortsetzungszeilen zusammen', () => {
    const mitNotiz = [
      '0 HEAD', '1 CHAR UTF-8',
      '0 @I1@ INDI',
      '1 NAME Test /Fall/',
      '1 NOTE Erste Zeile',
      '2 CONT Zweite Zeile',
      '2 CONC  – angehängt',
      '0 TRLR',
    ].join('\n')
    const { db } = importGedcom(mitNotiz)
    const p = Object.values(db.persons)[0]
    expect(p.notes[0]).toBe('Erste Zeile\nZweite Zeile – angehängt')
  })
})

describe('GEDCOM schreiben', () => {
  it('erzeugt eine gültige Kopf- und Schlusszeile', () => {
    const db = buildSampleTree()
    const text = exportGedcom(db, {
      privatizeLiving: false, includeSources: true, includeMedia: true, includeNotes: true,
    })
    expect(text.startsWith('0 HEAD')).toBe(true)
    expect(text.trimEnd().endsWith('0 TRLR')).toBe(true)
    expect(text).toContain('2 VERS 5.5.1')
    expect(text).toContain('1 CHAR UTF-8')
  })

  it('übersteht den Umlauf Bestand → GEDCOM → Bestand', () => {
    const original = buildSampleTree()
    const text = exportGedcom(original, {
      privatizeLiving: false, includeSources: true, includeMedia: true, includeNotes: true,
    })
    const wieder = importGedcom(text).db

    expect(Object.keys(wieder.persons).length).toBe(Object.keys(original.persons).length)
    expect(Object.keys(wieder.families).length).toBe(Object.keys(original.families).length)

    const namenVorher = Object.values(original.persons).map((p) => displayName(p)).sort()
    const namenNachher = Object.values(wieder.persons).map((p) => displayName(p)).sort()
    expect(namenNachher).toEqual(namenVorher)

    // Die Geburtsjahre müssen unverändert durchkommen
    const jahre = (d: Database) => Object.values(d.persons)
      .map((p) => p.events.find((e) => e.type === 'BIRT')?.date?.from?.year)
      .filter(Boolean).sort()
    expect(jahre(wieder)).toEqual(jahre(original))
  })

  it('hält Angaben lebender Personen zurück', () => {
    const { db, add } = makeTree()
    add('Lebend', 'Heute', 'M', new Date().getFullYear() - 30)
    const text = exportGedcom(db, {
      privatizeLiving: true, includeSources: false, includeMedia: false, includeNotes: true,
    })
    expect(text).toContain('Lebend /Heute/')
    expect(text).not.toContain(String(new Date().getFullYear() - 30))
  })

  it('gibt Verstorbene vollständig aus', () => {
    const { db, add } = makeTree()
    add('Verstorben', 'Damals', 'M', 1800, 1870)
    const text = exportGedcom(db, {
      privatizeLiving: true, includeSources: false, includeMedia: false, includeNotes: true,
    })
    expect(text).toContain('Verstorben /Damals/')
    expect(text).toContain('1800')
  })
})

describe('Beispielbestand', () => {
  it('ist in sich schlüssig', () => {
    const db = buildSampleTree()
    expect(Object.keys(db.persons).length).toBeGreaterThan(10)
    expect(db.meta.rootPersonId).toBeDefined()

    // Jede Verknüpfung muss in beide Richtungen bestehen
    for (const p of Object.values(db.persons)) {
      for (const fid of p.childOf) {
        expect(db.families[fid], `Familie ${fid} fehlt`).toBeDefined()
        expect(db.families[fid].children.some((c) => c.personId === p.id)).toBe(true)
      }
      for (const fid of p.spouseIn) {
        expect(db.families[fid]).toBeDefined()
        expect([db.families[fid].partner1, db.families[fid].partner2]).toContain(p.id)
      }
    }
  })

  it('enthält keine Widersprüche', () => {
    const issues = validate(buildSampleTree()).filter((i) => i.severity === 'error')
    expect(issues.map((i) => i.message)).toEqual([])
  })

  it('liefert brauchbare Anzeigenamen', () => {
    const db = buildSampleTree()
    const p = db.persons[db.meta.rootPersonId!]
    expect(displayName(p)).toContain('Wegerer')
    expect(listName(p)).toMatch(/^Wegerer, /)
  })
})
