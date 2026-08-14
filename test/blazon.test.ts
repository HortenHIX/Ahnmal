import { describe, expect, it } from 'vitest'
import { checkBlazon, parseBlazon, tinctureFromWord, writeBlazon } from '../src/heraldry/blazon'
import { CHARGES, lookupCharge } from '../src/heraldry/charges'
import { isMetal, violatesTinctureRule } from '../src/heraldry/tinctures'

describe('Tinkturen erkennen', () => {
  it('erkennt Grundformen deutsch und englisch', () => {
    expect(tinctureFromWord('Gold')).toBe('or')
    expect(tinctureFromWord('Rot')).toBe('gules')
    expect(tinctureFromWord('azure')).toBe('azure')
    expect(tinctureFromWord('Silber')).toBe('argent')
  })

  it('erkennt gebeugte Formen', () => {
    // So stehen sie in jeder deutschen Blasonierung
    expect(tinctureFromWord('goldener')).toBe('or')
    expect(tinctureFromWord('silbernen')).toBe('argent')
    expect(tinctureFromWord('rote')).toBe('gules')
    expect(tinctureFromWord('schwarzem')).toBe('sable')
    expect(tinctureFromWord('grünes')).toBe('vert')
  })

  it('weist Unbekanntes ab', () => {
    expect(tinctureFromWord('Löwe')).toBeUndefined()
    expect(tinctureFromWord('')).toBeUndefined()
  })
})

describe('Farbregel', () => {
  it('beanstandet Metall auf Metall und Farbe auf Farbe', () => {
    expect(violatesTinctureRule('or', 'argent')).toBe(true)
    expect(violatesTinctureRule('gules', 'azure')).toBe(true)
  })

  it('lässt Metall auf Farbe zu', () => {
    expect(violatesTinctureRule('gules', 'or')).toBe(false)
    expect(violatesTinctureRule('argent', 'azure')).toBe(false)
  })

  it('nimmt Pelzwerk und Naturfarbe aus', () => {
    expect(violatesTinctureRule('ermine', 'argent')).toBe(false)
    expect(violatesTinctureRule('gules', 'proper')).toBe(false)
  })

  it('zählt Goldhermelin zu den Metallen', () => {
    expect(isMetal('erminois')).toBe(true)
    expect(isMetal('gules')).toBe(false)
  })
})

describe('Blasonierung lesen', () => {
  it('liest Feld und Figur', () => {
    const { spec } = parseBlazon('In Rot ein goldener Löwe')
    expect(spec.field).toBe('gules')
    expect(spec.charges).toHaveLength(1)
    expect(spec.charges[0]).toMatchObject({ key: 'lion', tincture: 'or', count: 1 })
  })

  it('liest Anzahlen als Zahlwort', () => {
    const { spec } = parseBlazon('In Blau drei goldene Lilien')
    expect(spec.charges[0]).toMatchObject({ key: 'fleurDeLis', tincture: 'or', count: 3 })
  })

  it('liest Teilungen mit beiden Farben', () => {
    const { spec } = parseBlazon('Geteilt von Gold und Schwarz')
    expect(spec.division?.type).toBe('perFess')
    expect(spec.division?.tinctures).toEqual(['or', 'sable'])
  })

  it('unterscheidet gespalten, geteilt und geviert', () => {
    expect(parseBlazon('Gespalten von Rot und Silber').spec.division?.type).toBe('perPale')
    expect(parseBlazon('Geviert von Rot und Silber').spec.division?.type).toBe('quarterly')
    expect(parseBlazon('Schräggeviert von Blau und Gold').spec.division?.type).toBe('perSaltire')
    expect(parseBlazon('Geständert von Silber und Schwarz').spec.division?.type).toBe('gyronny')
  })

  it('liest Heroldsbilder', () => {
    const { spec } = parseBlazon('In Silber ein roter Balken')
    expect(spec.ordinaries[0]).toMatchObject({ type: 'fess', tincture: 'gules' })
    expect(spec.field).toBe('argent')
  })

  it('liest Schnittlinien', () => {
    const { spec } = parseBlazon('In Silber ein blaues gewelltes Schildhaupt')
    expect(spec.ordinaries[0]).toMatchObject({ type: 'chief', tincture: 'azure', line: 'wavy' })
  })

  it('liest Stellung und Bewehrung', () => {
    const { spec } = parseBlazon('In Gold ein schwarzer Adler, rot bewehrt')
    expect(spec.charges[0]).toMatchObject({ key: 'eagle', tincture: 'sable', armedTincture: 'gules' })
  })

  it('erkennt den schreitenden Löwen als eigene Figur', () => {
    const { spec } = parseBlazon('In Rot ein goldener schreitender Löwe')
    expect(spec.charges[0].key).toBe('lionPassant')
  })

  it('liest englische Blasonierungen', () => {
    const { spec } = parseBlazon('Azure, three fleurs-de-lis or')
    expect(spec.field).toBe('azure')
    expect(spec.charges[0]).toMatchObject({ key: 'fleurDeLis', tincture: 'or', count: 3 })
  })

  it('meldet, was nicht verstanden wurde', () => {
    const res = parseBlazon('In Rot ein goldener Wolpertinger')
    expect(res.unresolved).toContain('Wolpertinger')
    expect(res.confidence).toBeLessThan(1)
  })

  it('kommt mit leerer Eingabe zurecht', () => {
    const res = parseBlazon('')
    expect(res.confidence).toBe(0)
    expect(res.spec.charges).toHaveLength(0)
  })
})

describe('Blasonierung schreiben', () => {
  it('beschreibt Feld und Figur auf Deutsch', () => {
    const { spec } = parseBlazon('In Rot ein goldener Löwe')
    expect(writeBlazon(spec, 'de')).toBe('In Rot, ein goldener Löwe.')
  })

  it('beugt bei Mehrzahl richtig', () => {
    const { spec } = parseBlazon('In Blau drei goldene Lilien')
    expect(writeBlazon(spec, 'de')).toContain('drei goldene Lilien')
  })

  it('beschreibt Teilungen', () => {
    const { spec } = parseBlazon('Geteilt von Gold und Schwarz')
    expect(writeBlazon(spec, 'de')).toBe('Geteilt von Gold und Schwarz.')
  })

  it('schreibt auch englisch', () => {
    const { spec } = parseBlazon('In Rot ein goldener Löwe')
    expect(writeBlazon(spec, 'en').toLowerCase()).toContain('lion')
    expect(writeBlazon(spec, 'en').toLowerCase()).toContain('gules')
  })

  it('übersteht den Umlauf Text → Wappen → Text → Wappen', () => {
    const inputs = [
      'In Rot ein goldener Löwe',
      'In Blau drei goldene Lilien',
      'Geteilt von Gold und Schwarz',
      'In Silber ein roter Balken',
      'In Gold ein schwarzer Adler',
    ]
    for (const input of inputs) {
      const first = parseBlazon(input).spec
      const second = parseBlazon(writeBlazon(first, 'de')).spec
      expect(second.field).toBe(first.field)
      expect(second.division?.type).toBe(first.division?.type)
      expect(second.charges.map((c) => [c.key, c.tincture, c.count]))
        .toEqual(first.charges.map((c) => [c.key, c.tincture, c.count]))
      expect(second.ordinaries.map((o) => [o.type, o.tincture]))
        .toEqual(first.ordinaries.map((o) => [o.type, o.tincture]))
    }
  })
})

describe('Wappen prüfen', () => {
  it('erkennt einen Verstoß gegen die Farbregel', () => {
    const { spec } = parseBlazon('In Rot ein blauer Löwe')
    const checks = checkBlazon(spec)
    expect(checks.some((c) => c.level === 'warning')).toBe(true)
  })

  it('lässt ein regelkonformes Wappen durchgehen', () => {
    const { spec } = parseBlazon('In Rot ein goldener Löwe')
    expect(checkBlazon(spec)[0].level).toBe('ok')
  })
})

describe('Figurenkatalog', () => {
  it('findet Figuren über deutsche und englische Namen', () => {
    expect(lookupCharge('Löwe')?.key).toBe('lion')
    expect(lookupCharge('eagle')?.key).toBe('eagle')
    expect(lookupCharge('Lilien')?.key).toBe('fleurDeLis')
    expect(lookupCharge('Dreiberg')?.key).toBe('dreiberg')
  })

  it('hat für jede Figur zeichenbare Pfade', () => {
    for (const c of CHARGES) {
      expect(c.paths.length, `${c.key} ohne Pfade`).toBeGreaterThan(0)
      for (const p of c.paths) {
        expect(p.d.length, `${c.key} mit leerem Pfad`).toBeGreaterThan(10)
        // Ein Pfad muss mit einem Setzbefehl beginnen
        expect(p.d.trim().startsWith('M'), `${c.key}: Pfad beginnt nicht mit M`).toBe(true)
      }
    }
  })

  it('vergibt Schlüssel nur einmal', () => {
    const keys = CHARGES.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('Wappen des Beispielbestands', () => {
  it('liest alle mitgelieferten Blasonierungen vollständig', () => {
    const blazons = [
      'In Rot ein goldener Hammer, begleitet von zwei silbernen Sternen',
      'In Blau ein silbernes Mühleisen',
      'Geteilt von Gold und Grün, oben ein wachsender schwarzer Bär, unten ein goldener Dreiberg',
    ]
    for (const b of blazons) {
      const res = parseBlazon(b)
      expect(res.unresolved, `nicht erkannt in „${b}“: ${res.unresolved.join(', ')}`).toEqual([])
      expect(res.spec.charges.length).toBeGreaterThan(0)
    }
  })

  it('setzt Farben auch bei mehreren Figuren richtig', () => {
    const { spec } = parseBlazon('In Rot ein goldener Hammer, begleitet von zwei silbernen Sternen')
    expect(spec.field).toBe('gules')
    expect(spec.charges).toHaveLength(2)
    expect(spec.charges[0]).toMatchObject({ key: 'hammer', tincture: 'or', count: 1 })
    expect(spec.charges[1]).toMatchObject({ key: 'mullet', tincture: 'argent', count: 2 })
  })
})
