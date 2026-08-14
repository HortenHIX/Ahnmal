/**
 * Tinkturen.
 *
 * Die Farbwerte folgen der in der deutschsprachigen Heraldik üblichen
 * gedeckten Palette – kein Signalrot, kein Neonblau. Wappen sollen auch im
 * Druck und auf Papier stimmig wirken.
 */

import type { Tincture } from '../core/types'

export interface TinctureDef {
  key: Tincture
  /** Fachbegriff. */
  name: string
  /** Deutsche Farbbezeichnung. */
  german: string
  english: string
  fill: string
  /** Aufgehellter Ton für Verläufe und Rundungen. */
  light: string
  dark: string
  class: 'metal' | 'colour' | 'stain' | 'fur' | 'proper'
  /** Schraffur nach Petra Sancta – die Konvention für einfarbige Darstellung. */
  hatch?: 'none' | 'vertical' | 'horizontal' | 'diagonal' | 'diagonalSinister' | 'cross' | 'dots' | 'plain'
}

export const TINCTURES: Record<Tincture, TinctureDef> = {
  or: { key: 'or', name: 'Or', german: 'Gold', english: 'Or', fill: '#d4af37', light: '#f0d878', dark: '#a8842a', class: 'metal', hatch: 'dots' },
  argent: { key: 'argent', name: 'Argent', german: 'Silber', english: 'Argent', fill: '#f2f2ee', light: '#ffffff', dark: '#cfcfc8', class: 'metal', hatch: 'plain' },

  gules: { key: 'gules', name: 'Gules', german: 'Rot', english: 'Gules', fill: '#a52321', light: '#c4453f', dark: '#78191a', class: 'colour', hatch: 'vertical' },
  azure: { key: 'azure', name: 'Azure', german: 'Blau', english: 'Azure', fill: '#20487a', light: '#3a6aa6', dark: '#15325a', class: 'colour', hatch: 'horizontal' },
  sable: { key: 'sable', name: 'Sable', german: 'Schwarz', english: 'Sable', fill: '#1c1c1c', light: '#3a3a3a', dark: '#000000', class: 'colour', hatch: 'cross' },
  vert: { key: 'vert', name: 'Vert', german: 'Grün', english: 'Vert', fill: '#2e6b3a', light: '#4a9152', dark: '#1e4a28', class: 'colour', hatch: 'diagonal' },
  purpure: { key: 'purpure', name: 'Purpure', german: 'Purpur', english: 'Purpure', fill: '#6b2d5b', light: '#8f4a7c', dark: '#4c1e40', class: 'colour', hatch: 'diagonalSinister' },

  tenne: { key: 'tenne', name: 'Tenné', german: 'Orange-Braun', english: 'Tenné', fill: '#a15c1e', light: '#c07c38', dark: '#7a4414', class: 'stain' },
  sanguine: { key: 'sanguine', name: 'Sanguine', german: 'Blutfarben', english: 'Sanguine', fill: '#6e1f21', light: '#8d3335', dark: '#4f1416', class: 'stain' },
  murrey: { key: 'murrey', name: 'Murrey', german: 'Maulbeerfarben', english: 'Murrey', fill: '#66203c', light: '#883353', dark: '#48152a', class: 'stain' },
  cendree: { key: 'cendree', name: 'Cendrée', german: 'Aschgrau', english: 'Cendrée', fill: '#8a8a86', light: '#a7a7a2', dark: '#6a6a66', class: 'stain' },
  carnation: { key: 'carnation', name: 'Carnation', german: 'Fleischfarben', english: 'Carnation', fill: '#e0b39a', light: '#f0cdb9', dark: '#bf917a', class: 'proper' },

  ermine: { key: 'ermine', name: 'Ermine', german: 'Hermelin', english: 'Ermine', fill: '#f2f2ee', light: '#ffffff', dark: '#d8d8d2', class: 'fur' },
  ermines: { key: 'ermines', name: 'Ermines', german: 'Gegenhermelin', english: 'Ermines', fill: '#1c1c1c', light: '#333333', dark: '#000000', class: 'fur' },
  erminois: { key: 'erminois', name: 'Erminois', german: 'Goldhermelin', english: 'Erminois', fill: '#d4af37', light: '#eccb63', dark: '#a8842a', class: 'fur' },
  pean: { key: 'pean', name: 'Pean', german: 'Schwarzhermelin mit Gold', english: 'Pean', fill: '#1c1c1c', light: '#333333', dark: '#000000', class: 'fur' },

  vair: { key: 'vair', name: 'Vair', german: 'Feh', english: 'Vair', fill: '#f2f2ee', light: '#ffffff', dark: '#20487a', class: 'fur' },
  counterVair: { key: 'counterVair', name: 'Counter-vair', german: 'Gegenfeh', english: 'Counter-vair', fill: '#f2f2ee', light: '#ffffff', dark: '#20487a', class: 'fur' },
  vairEnPoint: { key: 'vairEnPoint', name: 'Vair en point', german: 'Sturzfeh', english: 'Vair en point', fill: '#f2f2ee', light: '#ffffff', dark: '#20487a', class: 'fur' },
  potent: { key: 'potent', name: 'Potent', german: 'Sturzkrückenfeh', english: 'Potent', fill: '#f2f2ee', light: '#ffffff', dark: '#20487a', class: 'fur' },
  counterPotent: { key: 'counterPotent', name: 'Counter-potent', german: 'Gegenkrückenfeh', english: 'Counter-potent', fill: '#f2f2ee', light: '#ffffff', dark: '#20487a', class: 'fur' },

  proper: { key: 'proper', name: 'Proper', german: 'naturfarben', english: 'Proper', fill: '#8a7d5e', light: '#a89a78', dark: '#6b6047', class: 'proper' },
}

export const TINCTURE_KEYS = Object.keys(TINCTURES) as Tincture[]

export function isMetal(t: Tincture): boolean {
  const c = TINCTURES[t].class
  if (c === 'metal') return true
  // Goldhermelin und Silberpelze gelten farbregeltechnisch als Metall
  return t === 'erminois' || t === 'ermine'
}

export function isColour(t: Tincture): boolean {
  const c = TINCTURES[t].class
  if (c === 'colour' || c === 'stain') return true
  return t === 'ermines' || t === 'pean'
}

/**
 * Prüft die heraldische Farbregel: Metall darf nicht auf Metall, Farbe nicht
 * auf Farbe stehen. Pelzwerk und naturfarbene Figuren sind ausgenommen, ebenso
 * Figuren, die sich über eine Teilung erstrecken.
 *
 * Die Regel dient der Erkennbarkeit auf Entfernung – ein rotes Wappentier auf
 * blauem Grund war auf dem Turnierplatz nicht zu unterscheiden.
 */
export function violatesTinctureRule(a: Tincture, b: Tincture): boolean {
  if (a === 'proper' || b === 'proper') return false
  if (TINCTURES[a].class === 'fur' || TINCTURES[b].class === 'fur') return false
  if (isMetal(a) && isMetal(b)) return true
  if (isColour(a) && isColour(b)) return true
  return false
}

export function tinctureLabel(t: Tincture): string {
  return TINCTURES[t]?.german ?? t
}

/** Sucht eine Tinktur anhand eines deutschen oder englischen Namens. */
const TINCTURE_ALIASES: Record<string, Tincture> = {
  // Deutsch
  gold: 'or', gelb: 'or', golden: 'or',
  silber: 'argent', weiss: 'argent', 'weiß': 'argent', silbern: 'argent',
  rot: 'gules', roth: 'gules',
  blau: 'azure',
  schwarz: 'sable',
  'grün': 'vert', gruen: 'vert',
  purpur: 'purpure', violett: 'purpure',
  braun: 'tenne', orange: 'tenne',
  blutrot: 'sanguine',
  maulbeerfarben: 'murrey',
  grau: 'cendree', aschgrau: 'cendree',
  fleischfarben: 'carnation', 'fleischfarbig': 'carnation',
  hermelin: 'ermine', gegenhermelin: 'ermines', goldhermelin: 'erminois',
  feh: 'vair', gegenfeh: 'counterVair', sturzfeh: 'vairEnPoint',
  krückenfeh: 'potent', kruckenfeh: 'potent', sturzkrückenfeh: 'potent',
  naturfarben: 'proper', natürlich: 'proper', naturfarbig: 'proper',
  // Englisch und Fachbegriffe
  or: 'or', argent: 'argent', gules: 'gules', azure: 'azure', sable: 'sable',
  vert: 'vert', purpure: 'purpure', tenne: 'tenne', tenny: 'tenne',
  sanguine: 'sanguine', murrey: 'murrey', cendree: 'cendree',
  carnation: 'carnation', ermine: 'ermine', ermines: 'ermines',
  erminois: 'erminois', pean: 'pean', vair: 'vair', potent: 'potent',
  proper: 'proper',
}

export function lookupTincture(word: string): Tincture | undefined {
  const w = word.toLowerCase().replace(/[^a-zäöüß]/g, '')
  return TINCTURE_ALIASES[w]
}

/** Alle Wörter, die als Tinktur gelesen werden – für den Parser. */
export const TINCTURE_WORDS = Object.keys(TINCTURE_ALIASES)

/**
 * Gibt einen Farbwert zurück, mit dem sich eine Figur auf dem gewählten Grund
 * noch abhebt. Nötig für Konturen: Ein schwarzer Adler auf Schwarz braucht
 * eine helle Umrisslinie.
 */
export function outlineFor(t: Tincture): string {
  const def = TINCTURES[t]
  if (!def) return '#00000055'
  return def.class === 'colour' && (t === 'sable' || t === 'azure' || t === 'purpure')
    ? 'rgba(255,255,255,0.45)'
    : 'rgba(0,0,0,0.55)'
}
