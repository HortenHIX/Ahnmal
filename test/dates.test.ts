import { describe, expect, it } from 'vitest'
import {
  dateEarliest, dateLatest, dateToGedcom, dateValue, formatDate, julianToGregorian,
  formatDateWithPreposition, parseDate, parsePoint, yearsBetween,
} from '../src/core/dates'

describe('Datumsangaben lesen', () => {
  it('liest deutsche Punktschreibweise', () => {
    const d = parseDate('14.08.1723')!
    expect(d.modifier).toBe('exact')
    expect(d.from).toMatchObject({ year: 1723, month: 8, day: 14 })
  })

  it('liest GEDCOM-Schreibweise', () => {
    expect(parseDate('14 AUG 1723')!.from).toMatchObject({ year: 1723, month: 8, day: 14 })
    expect(parseDate('ABT 1723')!.modifier).toBe('about')
    expect(parseDate('BEF 1800')!.modifier).toBe('before')
    expect(parseDate('AFT 1800')!.modifier).toBe('after')
  })

  it('liest deutsche Qualifizierer', () => {
    expect(parseDate('um 1723')!.modifier).toBe('about')
    expect(parseDate('vor 1800')!.modifier).toBe('before')
    expect(parseDate('nach 1800')!.modifier).toBe('after')
    expect(parseDate('geschätzt 1750')!.modifier).toBe('estimated')
  })

  it('liest Zeitspannen', () => {
    const bet = parseDate('zwischen 1720 und 1725')!
    expect(bet.modifier).toBe('between')
    expect(bet.from!.year).toBe(1720)
    expect(bet.to!.year).toBe(1725)

    const range = parseDate('FROM 1700 TO 1710')!
    expect(range.modifier).toBe('range')
    expect(range.from!.year).toBe(1700)
    expect(range.to!.year).toBe(1710)
  })

  it('liest ausgeschriebene und lateinische Monatsnamen', () => {
    expect(parseDate('3. März 1698')!.from).toMatchObject({ year: 1698, month: 3, day: 3 })
    // In Kirchenbüchern steht der Monat oft lateinisch
    expect(parsePoint('12 septembris 1701')).toMatchObject({ year: 1701, month: 9, day: 12 })
    expect(parsePoint('4 8bris 1699')).toMatchObject({ year: 1699, month: 10, day: 4 })
  })

  it('erkennt Doppeljahre der Zeit vor der Kalenderreform', () => {
    const d = parsePoint('1712/13')!
    expect(d.year).toBe(1712)
    expect(d.dualYear).toBe(1713)
  })

  it('behält unverständliche Angaben als Text', () => {
    const d = parseDate('am Tag nach Michaelis')!
    expect(d.modifier).toBe('phrase')
    expect(d.phrase).toContain('michaelis')
  })

  it('gibt bei leerer Eingabe nichts zurück', () => {
    expect(parseDate('')).toBeNull()
    expect(parseDate(undefined)).toBeNull()
  })
})

describe('Datumsangaben schreiben', () => {
  it('formatiert deutsch', () => {
    expect(formatDate(parseDate('14.08.1723'))).toBe('14.08.1723')
    expect(formatDate(parseDate('14.08.1723'), true)).toBe('14. August 1723')
    expect(formatDate(parseDate('um 1723'))).toBe('um 1723')
    expect(formatDate(parseDate('zwischen 1720 und 1725'))).toBe('zwischen 1720 und 1725')
  })

  it('erzeugt gültiges GEDCOM', () => {
    expect(dateToGedcom(parseDate('14.08.1723'))).toBe('14 AUG 1723')
    expect(dateToGedcom(parseDate('um 1723'))).toBe('ABT 1723')
    expect(dateToGedcom(parseDate('zwischen 1720 und 1725'))).toBe('BET 1720 AND 1725')
  })

  it('überlebt den Umlauf Text → Modell → GEDCOM → Modell', () => {
    for (const input of ['14.08.1723', 'um 1723', 'vor 1800', 'zwischen 1720 und 1725', 'März 1698']) {
      const first = parseDate(input)!
      const second = parseDate(dateToGedcom(first))!
      expect(second.modifier).toBe(first.modifier)
      expect(second.from?.year).toBe(first.from?.year)
      expect(second.from?.month).toBe(first.from?.month)
      expect(second.from?.day).toBe(first.from?.day)
    }
  })
})

describe('Rechnen mit Datumsangaben', () => {
  it('rechnet julianisch nach gregorianisch um', () => {
    // Der Übergang in katholischen Gebieten: auf den 4. folgte der 15. Oktober 1582
    expect(julianToGregorian(1582, 10, 5)).toEqual({ year: 1582, month: 10, day: 15 })
    // Im 18. Jahrhundert beträgt der Unterschied elf Tage
    expect(julianToGregorian(1750, 1, 1)).toEqual({ year: 1750, month: 1, day: 12 })
  })

  it('ordnet unvollständige Angaben in die Jahresmitte ein', () => {
    const v = dateValue(parseDate('1723'))!
    expect(v).toBeGreaterThan(1723)
    expect(v).toBeLessThan(1724)
  })

  it('berechnet das Alter', () => {
    expect(yearsBetween(parseDate('14.08.1723'), parseDate('20.09.1789'))).toBe(66)
    expect(yearsBetween(parseDate('14.08.1723'), parseDate('01.03.1789'))).toBe(65)
  })

  it('kennt die Grenzen offener Angaben', () => {
    expect(dateEarliest(parseDate('vor 1800'))).toBeNull()
    expect(dateLatest(parseDate('nach 1800'))).toBeNull()
    expect(dateLatest(parseDate('vor 1800'))).toBeCloseTo(1800.5, 1)
  })
})

describe('Präposition im Fließtext', () => {
  it('setzt „am“ nur bei taggenauen Angaben', () => {
    expect(formatDateWithPreposition(parseDate('14.02.1758'))).toBe('am 14.02.1758')
  })

  it('lässt die Präposition bei ungefähren Angaben weg', () => {
    // Sonst entstünde in Berichten „am um 1730“
    expect(formatDateWithPreposition(parseDate('um 1730'))).toBe('um 1730')
    expect(formatDateWithPreposition(parseDate('vor 1750'))).toBe('vor 1750')
    expect(formatDateWithPreposition(parseDate('zwischen 1720 und 1725'))).toBe('zwischen 1720 und 1725')
  })

  it('setzt „im“ bei monatsgenauen Angaben', () => {
    expect(formatDateWithPreposition(parseDate('März 1698'), true)).toBe('im März 1698')
  })

  it('lässt reine Jahresangaben ohne Präposition', () => {
    expect(formatDateWithPreposition(parseDate('1698'))).toBe('1698')
  })

  it('kommt ohne Datum zurecht', () => {
    expect(formatDateWithPreposition(undefined)).toBe('')
  })
})
