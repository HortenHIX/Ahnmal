/**
 * Figurenkatalog.
 *
 * Jede gemeine Figur ist als Satz von SVG-Pfaden in einem Feld von 100 × 100
 * hinterlegt. Die Figuren sind stilisiert, nicht naturalistisch – so wird in
 * der Heraldik seit jeher gezeichnet, und nur so bleiben sie klein noch
 * erkennbar.
 *
 * Blickrichtung ist immer heraldisch rechts, also aus Sicht der Betrachterin
 * nach links. Das ist die Ehrenseite; wo eine Figur nach links blickt, wird
 * das in der Blasonierung eigens vermerkt („linksgewendet“).
 *
 * Die Rollen der Pfade steuern die Farbgebung:
 *   main   – in der Tinktur der Figur
 *   armed  – Bewehrung: Krallen, Zunge, Schnabel, Hufe
 *   detail – Binnenzeichnung in der Kontrastfarbe (Auge, Gesicht)
 *   line   – reine Konturlinie ohne Füllung (Federn, Fell, Gefieder)
 */

export type ChargeRole = 'main' | 'armed' | 'detail' | 'line'

export interface ChargePath {
  d: string
  role?: ChargeRole
  /** Feste Farbe, unabhängig von der Tinktur der Figur. */
  fixed?: string
  /** Linienstärke für Pfade der Rolle „line“. */
  width?: number
}

export type ChargeCategory =
  | 'beast' | 'bird' | 'monster' | 'plant' | 'object' | 'celestial'
  | 'building' | 'human' | 'geometric'

export interface ChargeDef {
  key: string
  german: string
  english: string
  /** Weitere Bezeichnungen, unter denen der Parser die Figur findet. */
  aliases: string[]
  category: ChargeCategory
  paths: ChargePath[]
  /** Figuren, die am Schildfuß aufsitzen, statt frei zu schweben. */
  anchor?: 'base'
  /** Ob die Figur beim Mehrfachvorkommen gespiegelt angeordnet werden darf. */
  symmetrical?: boolean
}

// ---------------------------------------------------------------------------
// Vierfüßer
// ---------------------------------------------------------------------------

/**
 * Der steigende Löwe – die häufigste Figur der europäischen Heraldik.
 * Aufgerichtet auf dem linken Hinterlauf, den Kopf im Profil, die Vorderpranken
 * vorgestreckt, der Schweif über den Rücken geschlagen.
 */
const LION_RAMPANT: ChargePath[] = [
  // Schweif mit Quaste, über den Rücken geschlagen
  { d: 'M68 58 C81 55 90 44 90 30 C90 18 84 8 73 4 L69 15 C76 18 80 24 80 32 C80 43 74 51 64 54 Z' },
  { d: 'M66 1 C74 -2 83 1 87 9 C80 13 71 12 65 8 Z' },
  // Erhobene Vorderpranke
  { d: 'M37 31 L28 42 L5 20 L15 9 Z' },
  { d: 'M15 9 L9 1 L1 8 L5 20 Z', role: 'armed' },
  // Untere Vorderpranke
  { d: 'M33 43 L38 55 L13 69 L7 57 Z' },
  { d: 'M13 69 L5 71 L6 80 L15 78 Z', role: 'armed' },
  // Rumpf
  { d: 'M29 29 L48 27 C60 41 69 58 73 77 L51 85 C47 67 41 49 29 40 Z' },
  // Keule
  { d: 'M64 57 C77 57 86 67 86 78 C86 89 78 96 67 96 C55 96 47 87 47 76 C47 64 53 57 64 57 Z' },
  // Hinterlauf mit Pranke
  { d: 'M55 87 L79 89 L77 99 L53 99 Z' },
  { d: 'M53 99 L52 92 L79 94 L79 99 Z', role: 'armed' },
  // Mähne: zackige Strähnen, die den Löwen vom Bären unterscheiden
  { d: 'M27 -4 L34 4 L40 -3 L44 6 L52 2 L52 12 L60 13 L54 21 L60 29 L51 31 L52 40 L44 36 L40 44 L34 38 L26 43 L24 34 L15 35 L18 27 L10 22 L18 16 L14 7 L23 6 Z' },
  // Kopf
  { d: 'M12 25 C10 15 17 6 27 4 C38 2 47 8 49 17 C51 27 45 35 35 37 C24 39 14 34 12 25 Z' },
  // Fang mit Zunge
  { d: 'M11 21 L0 24 L1 34 L13 31 Z' },
  { d: 'M0 29 L-8 32 L-7 39 L1 35 Z', role: 'armed' },
  // Mähnenzeichnung, Rippen und Auge
  { d: 'M23 5 C27 12 29 21 27 30 M35 4 C40 12 42 22 40 31', role: 'line' },
  { d: 'M40 38 C46 48 52 60 56 72 M33 44 C38 52 43 62 46 72', role: 'line' },
  { d: 'M21 18 a3 3 0 1 0 0.1 0 Z', role: 'detail' },
]

/** Der schreitende Löwe, in England „lion passant“, oft mit hersehendem Kopf. */
const LION_PASSANT: ChargePath[] = [
  // Schweif
  { d: 'M84 40 C93 34 98 23 96 13 C94 5 88 0 80 1 L79 10 C85 10 89 15 88 21 C87 28 83 34 77 37 Z' },
  // Rumpf
  { d: 'M24 42 C24 34 30 29 40 29 L74 29 C83 29 89 36 89 45 C89 55 83 61 74 61 L38 61 C28 61 24 53 24 44 Z' },
  // Kopf und Hals
  { d: 'M25 33 C17 30 8 34 5 42 C3 49 7 55 13 57 C20 59 27 55 29 48 C31 41 30 35 25 33 Z' },
  { d: 'M4 39 L-5 42 L-4 50 L6 48 Z' },
  // Läufe
  { d: 'M28 57 L23 86 L33 86 L37 59 Z' },
  { d: 'M45 59 L42 86 L52 86 L53 59 Z' },
  { d: 'M67 59 L64 86 L74 86 L75 59 Z' },
  { d: 'M79 57 L78 86 L88 86 L88 56 Z' },
  // Pranken
  { d: 'M23 86 L20 93 L34 93 L33 86 Z M42 86 L39 93 L53 93 L52 86 Z M64 86 L61 93 L75 93 L74 86 Z M78 86 L76 93 L89 93 L88 86 Z', role: 'armed' },
  { d: 'M-5 42 L-11 45 L-10 51 L-4 50 Z', role: 'armed' },
  // Mähne und Auge
  { d: 'M26 33 C29 39 30 47 28 54', role: 'line', width: 1.6 },
  { d: 'M11 39 a2.4 2.4 0 1 0 0.1 0 Z', role: 'detail' },
]

/** Der Bär, in schweizerischen und süddeutschen Wappen häufig. */
/** Der aufgerichtete Bär – Wappentier vieler Städte im Alpenraum. */
const BEAR: ChargePath[] = [
  // Erhobene Tatze
  { d: 'M36 33 L29 44 L8 26 L17 14 Z' },
  { d: 'M17 14 L12 5 L4 12 L8 26 Z', role: 'armed' },
  // Untere Tatze
  { d: 'M33 45 L38 57 L15 70 L9 58 Z' },
  { d: 'M15 70 L7 73 L9 82 L18 79 Z', role: 'armed' },
  // Rumpf, kräftiger als beim Löwen
  { d: 'M27 30 L50 27 C63 42 72 60 76 80 L50 88 C46 68 40 48 27 40 Z' },
  // Keule und Hinterlauf
  { d: 'M63 56 C77 56 87 67 87 79 C87 90 79 97 67 97 C54 97 46 88 46 76 C46 64 52 56 63 56 Z' },
  { d: 'M54 88 L80 90 L78 99 L52 99 Z' },
  { d: 'M52 99 L51 93 L80 95 L80 99 Z', role: 'armed' },
  // Runder Kopf ohne Mähne
  { d: 'M12 24 C12 12 21 3 33 3 C45 3 54 12 54 24 C54 36 45 44 33 44 C21 44 12 36 12 24 Z' },
  // Kleine runde Ohren
  { d: 'M14 8 C10 3 12 -4 19 -4 C25 -4 29 1 28 8 Z' },
  { d: 'M42 3 C48 -2 55 0 56 7 C57 13 52 17 46 15 Z' },
  // Schnauze
  { d: 'M13 22 L1 25 L2 35 L14 32 Z' },
  { d: 'M1 27 L-6 29 L-5 35 L2 34 Z', role: 'armed' },
  { d: 'M32 40 C40 50 46 62 50 76', role: 'line' },
  { d: 'M22 19 a3 3 0 1 0 0.1 0 Z', role: 'detail' },
]

/** Der Eber, Zeichen der Wehrhaftigkeit. */
const BOAR: ChargePath[] = [
  { d: 'M30 30 C18 32 10 38 8 46 L2 50 C0 55 3 60 8 60 C10 70 20 78 34 80 L62 80 C78 78 88 68 88 54 C88 40 76 30 60 30 Z' },
  // Kopf mit Rüssel
  { d: 'M8 46 L-2 48 L-1 58 L9 56 Z' },
  // Hauer
  { d: 'M6 48 L-4 42 L-6 48 L4 54 Z M8 58 L0 66 L5 70 L12 62 Z', role: 'armed' },
  // Läufe
  { d: 'M24 76 L21 95 L31 95 L33 76 Z M44 78 L42 95 L52 95 L53 78 Z M64 78 L62 95 L72 95 L73 78 Z M79 72 L78 95 L88 95 L88 70 Z' },
  // Borsten auf dem Kamm
  { d: 'M22 32 L20 22 M30 28 L29 18 M38 27 L38 17 M46 27 L47 17', role: 'line', width: 2 },
  { d: 'M14 44 a2.4 2.4 0 1 0 0.1 0 Z', role: 'detail' },
]

/** Das steigende Ross. */
const HORSE: ChargePath[] = [
  // Schweif
  { d: 'M68 54 C81 52 90 42 92 28 C94 14 87 4 75 0 L71 12 C79 15 83 22 82 31 C81 42 74 49 64 51 Z' },
  // Vorderläufe
  { d: 'M35 34 L27 45 L6 24 L15 13 Z' },
  { d: 'M33 46 L38 57 L14 70 L8 58 Z' },
  // Rumpf
  { d: 'M30 32 L50 28 C62 42 70 60 74 79 L52 87 C48 68 42 50 30 42 Z' },
  // Keule und Hinterlauf
  { d: 'M62 58 C76 58 86 68 86 80 C86 91 78 98 67 98 C55 98 47 89 47 77 C47 65 52 58 62 58 Z' },
  { d: 'M55 89 L80 91 L78 99 L53 99 Z' },
  // Gebogener Hals
  { d: 'M28 42 C20 32 17 19 22 10 C27 1 39 -1 46 5 C52 11 51 21 46 30 L38 40 Z' },
  // Kopf mit langer Nase
  { d: 'M24 10 L6 6 L2 22 L22 26 Z' },
  // Ohren
  { d: 'M21 5 L20 -6 L28 2 Z M30 2 L34 -8 L37 3 Z' },
  // Mähne
  { d: 'M25 3 C32 10 36 20 35 32 M34 2 C41 10 45 20 44 32', role: 'line', width: 2.4 },
  // Hufe
  { d: 'M15 13 L10 4 L2 11 L6 24 Z M14 70 L6 73 L8 82 L17 79 Z M53 99 L52 93 L80 95 L80 99 Z', role: 'armed' },
  { d: 'M18 12 a2.6 2.6 0 1 0 0.1 0 Z', role: 'detail' },
]

/** Der Widder mit gewundenem Horn. */
const RAM: ChargePath[] = [
  // Läufe
  { d: 'M28 66 L25 92 L35 92 L38 66 Z M46 68 L44 92 L54 92 L55 68 Z M68 68 L66 92 L76 92 L77 68 Z M80 64 L80 92 L90 92 L89 62 Z' },
  { d: 'M25 92 L23 98 L36 98 L35 92 Z M44 92 L42 98 L55 98 L54 92 Z M66 92 L64 98 L77 98 L76 92 Z M80 92 L78 98 L91 98 L90 92 Z', role: 'armed' },
  // Rumpf, wollig gerundet
  { d: 'M34 26 C52 26 70 28 80 32 C90 37 94 48 90 58 C86 68 74 72 60 72 L40 72 C24 72 14 63 14 50 C14 36 22 26 34 26 Z' },
  // Kopf
  { d: 'M24 34 C14 34 6 42 6 52 C6 61 13 67 22 67 C31 67 37 60 37 50 C37 40 32 34 24 34 Z' },
  { d: 'M7 46 L-4 48 L-3 60 L9 57 Z' },
  // Gewundenes Horn
  { d: 'M14 36 C3 33 -3 22 3 13 C9 5 22 5 27 14 L19 19 C16 13 10 13 8 17 C6 22 10 29 17 31 Z', role: 'armed' },
  // Wollzeichnung
  { d: 'M40 30 C45 38 45 52 40 62 M56 28 C62 38 62 54 56 66 M72 30 C78 40 78 54 72 66', role: 'line' },
  { d: 'M15 44 a2.6 2.6 0 1 0 0.1 0 Z', role: 'detail' },
]

/** Die Hirschstange – im deutschen Wappenwesen eine Figur für sich. */
const STAG_ATTIRE: ChargePath[] = [
  { d: 'M40 98 C37 78 39 56 46 38 C51 24 58 12 67 3 L76 9 C67 19 60 31 55 45 C48 62 46 80 48 98 Z' },
  { d: 'M46 78 L12 64 L9 74 L45 88 Z' },
  { d: 'M50 56 L18 38 L14 48 L49 66 Z' },
  { d: 'M56 34 L28 14 L23 23 L55 44 Z' },
  { d: 'M64 16 L44 2 L40 10 L62 24 Z' },
]

// ---------------------------------------------------------------------------
// Vögel
// ---------------------------------------------------------------------------

/**
 * Der Adler mit ausgebreiteten Schwingen – nach dem Löwen die wichtigste
 * Figur, in deutschen Wappen omnipräsent. Die Flügel sind in drei Federreihen
 * gegliedert; ohne diese Gliederung wird der Adler zum schwarzen Fleck.
 */
const EAGLE_DISPLAYED: ChargePath[] = [
  // Schwinge heraldisch rechts: einzelne Schwungfedern, vom Bug ausstrahlend.
  // Getrennt gezeichnet, weil eine geschlossene Fläche zum Fleck gerinnt.
  {
    d: 'M44 29 C30 21 16 13 4 7 L1 18 C13 24 30 33 43 39 Z'
      + 'M44 36 C30 32 14 28 1 26 L2 37 C14 41 30 45 43 47 Z'
      + 'M43 45 C30 45 15 47 4 51 L9 61 C21 57 33 55 43 55 Z'
      + 'M43 53 C31 57 19 63 10 71 L18 79 C27 72 36 67 44 64 Z'
      + 'M44 63 C35 69 27 77 22 87 L32 93 C37 84 43 77 47 73 Z',
  },
  // Schwinge heraldisch links
  {
    d: 'M56 29 C70 21 84 13 96 7 L99 18 C87 24 70 33 57 39 Z'
      + 'M56 36 C70 32 86 28 99 26 L98 37 C86 41 70 45 57 47 Z'
      + 'M57 45 C70 45 85 47 96 51 L91 61 C79 57 67 55 57 55 Z'
      + 'M57 53 C69 57 81 63 90 71 L82 79 C73 72 64 67 56 64 Z'
      + 'M56 63 C65 69 73 77 78 87 L68 93 C63 84 57 77 53 73 Z',
  },
  // Bugfedern, welche die Schwingen mit dem Rumpf verbinden
  { d: 'M42 26 C48 32 50 44 48 58 L44 72 L38 46 Z M58 26 C52 32 50 44 52 58 L56 72 L62 46 Z' },
  // Rumpf
  { d: 'M43 22 C37 31 34 43 35 55 C36 66 40 76 46 84 L54 84 C60 76 64 66 65 55 C66 43 63 31 57 22 Z' },
  // Kopf, nach heraldisch rechts gewendet
  { d: 'M50 0 C41 0 34 7 34 16 C34 23 39 28 47 29 L53 29 C61 28 66 23 66 16 C66 7 59 0 50 0 Z' },
  { d: 'M35 10 L18 7 L20 21 L36 20 Z' },
  // Schwanzfedern
  { d: 'M43 80 L37 99 L44 95 L50 99 L56 95 L63 99 L57 80 Z' },
  // Fänge
  { d: 'M45 76 L36 90 L41 93 L49 82 Z M55 76 L64 90 L59 93 L51 82 Z', role: 'armed' },
  { d: 'M18 7 L8 4 L11 16 L21 21 Z', role: 'armed' },
  // Gefiederzeichnung auf dem Rumpf
  { d: 'M44 40 C48 44 52 44 56 40 M43 52 C47 56 53 56 57 52 M44 64 C47 68 53 68 56 64 M45 74 C48 78 52 78 55 74', role: 'line' },
  { d: 'M43 14 a3 3 0 1 0 0.1 0 Z', role: 'detail' },
]

/** Der Schwan mit S-förmigem Hals. */
const SWAN: ChargePath[] = [
  // Körper
  { d: 'M32 56 C16 56 4 66 4 78 C4 90 16 97 32 97 L72 97 C86 97 96 89 96 79 C96 67 84 60 68 59 L46 57 Z' },
  // Hals, von der Brust aufsteigend und zurückgebogen
  { d: 'M42 62 C30 52 25 36 32 23 C38 11 52 7 61 15 L52 26 C48 22 41 24 39 31 C35 41 40 51 51 60 Z' },
  // Kopf
  { d: 'M50 10 C59 8 66 14 65 23 C64 30 56 34 49 30 C42 26 42 14 50 10 Z' },
  // Schnabel
  { d: 'M44 15 L28 12 L29 24 L45 24 Z', role: 'armed' },
  // Flügelzeichnung
  { d: 'M38 66 C52 62 68 66 80 76 M40 80 C54 76 70 80 84 90', role: 'line' },
  { d: 'M52 18 a2.8 2.8 0 1 0 0.1 0 Z', role: 'detail' },
]

/** Die Merlette – ein Vogel ohne Schnabel und Füße, klassisches Beizeichen. */
const MARTLET: ChargePath[] = [
  // Körper
  { d: 'M30 32 C16 34 8 46 10 60 C12 74 26 82 42 82 L58 82 C70 82 77 74 76 62 L73 44 C70 35 58 30 44 30 Z' },
  // Kopf
  { d: 'M22 20 C13 20 6 27 6 36 C6 44 12 50 20 50 C29 50 35 43 35 34 C35 25 30 20 22 20 Z' },
  // Schnabel
  { d: 'M7 28 L-6 26 L-5 38 L8 38 Z', role: 'armed' },
  // Flügel
  { d: 'M32 46 C46 40 62 42 74 52 L66 66 C56 57 44 55 34 58 Z' },
  // Schwanz, gefächert
  { d: 'M70 58 L96 46 L100 60 L76 78 Z' },
  { d: 'M38 50 C50 46 62 48 70 54 M36 56 C48 52 60 54 68 60', role: 'line' },
  { d: 'M17 30 a2.8 2.8 0 1 0 0.1 0 Z', role: 'detail' },
]

const FISH: ChargePath[] = [
  { d: 'M8 50 C20 32 42 22 64 24 C80 26 92 34 98 46 C92 58 80 66 64 68 C42 70 20 62 8 50 Z' },
  { d: 'M4 28 L20 44 L20 52 L4 68 Z' },
  { d: 'M42 24 L50 10 L60 26 Z M42 68 L50 86 L60 66 Z' },
  { d: 'M30 38 C34 44 34 50 30 58 M46 34 C50 42 50 52 46 60 M62 32 C66 42 66 52 62 62', role: 'line' },
  { d: 'M84 42 a3.4 3.4 0 1 0 0.1 0 Z', role: 'detail' },
]

// ---------------------------------------------------------------------------
// Fabelwesen
// ---------------------------------------------------------------------------

/** Der Greif: vorn Adler, hinten Löwe. */
const GRIFFIN: ChargePath[] = [
  // Löwenschweif
  { d: 'M68 58 C81 55 90 44 90 30 C90 18 84 8 73 4 L69 15 C76 18 80 24 80 32 C80 43 74 51 64 54 Z' },
  { d: 'M66 1 C74 -2 83 1 87 9 C80 13 71 12 65 8 Z' },
  // Erhobener Adlerfang
  { d: 'M37 31 L28 42 L5 20 L15 9 Z' },
  { d: 'M15 9 L8 3 L2 10 L5 20 Z', role: 'armed' },
  // Zweiter Fang
  { d: 'M33 43 L38 55 L13 69 L7 57 Z' },
  { d: 'M13 69 L5 72 L7 80 L16 77 Z', role: 'armed' },
  // Löwenleib
  { d: 'M29 29 L48 27 C60 41 69 58 73 77 L51 85 C47 67 41 49 29 40 Z' },
  { d: 'M64 57 C77 57 86 67 86 78 C86 89 78 96 67 96 C55 96 47 87 47 76 C47 64 53 57 64 57 Z' },
  { d: 'M55 87 L79 89 L77 99 L53 99 Z' },
  { d: 'M53 99 L52 92 L79 94 L79 99 Z', role: 'armed' },
  // Schwinge
  { d: 'M40 30 C32 20 22 8 12 -2 L2 8 C10 20 22 34 34 42 Z' },
  { d: 'M8 4 C17 14 26 24 35 32 M16 -1 C23 8 30 16 38 22', role: 'line' },
  // Adlerkopf mit Federohren
  { d: 'M12 24 C12 12 21 3 33 3 C44 3 52 11 52 22 C52 33 44 40 33 40 C21 40 12 34 12 24 Z' },
  { d: 'M12 20 L-2 17 L-1 30 L13 29 Z', role: 'armed' },
  { d: 'M20 5 L16 -5 L28 1 Z M34 3 L40 -6 L42 5 Z' },
  { d: 'M22 18 a3 3 0 1 0 0.1 0 Z', role: 'detail' },
]

/** Das Einhorn: Pferdeleib, Ziegenbart, Löwenschweif und gewundenes Horn. */
const UNICORN: ChargePath[] = [
  // Löwenschweif
  { d: 'M68 56 C81 53 90 43 92 29 C94 15 87 5 75 1 L71 13 C79 16 83 23 82 32 C81 43 74 50 64 52 Z' },
  { d: 'M68 -2 C76 -5 85 -2 89 6 C82 10 73 9 67 5 Z' },
  // Vorderläufe
  { d: 'M35 35 L27 46 L6 25 L15 14 Z' },
  { d: 'M33 47 L38 58 L14 71 L8 59 Z' },
  // Rumpf
  { d: 'M30 33 L50 29 C62 43 70 61 74 80 L52 88 C48 69 42 51 30 43 Z' },
  { d: 'M62 59 C76 59 86 69 86 81 C86 92 78 99 67 99 C55 99 47 90 47 78 C47 66 52 59 62 59 Z' },
  { d: 'M55 90 L80 92 L78 99 L53 99 Z' },
  // Hals
  { d: 'M28 43 C20 33 17 20 22 11 C27 2 39 0 46 6 C52 12 51 22 46 31 L38 41 Z' },
  // Kopf
  { d: 'M24 11 L6 7 L2 23 L22 27 Z' },
  // Gewundenes Horn
  { d: 'M18 8 L-4 -12 L-9 -4 L14 17 Z', role: 'armed' },
  { d: 'M0 -6 L-4 -1 M6 0 L2 5 M12 6 L8 11', role: 'line', width: 1.6 },
  // Ziegenbart
  { d: 'M8 22 C3 28 0 36 3 44 C8 39 13 31 15 24 Z' },
  // Ohr und Mähne
  { d: 'M22 6 L21 -5 L29 3 Z' },
  { d: 'M26 4 C33 11 37 21 36 33 M35 3 C42 11 46 21 45 33', role: 'line', width: 2.4 },
  // Hufe
  { d: 'M15 14 L10 5 L2 12 L6 25 Z M14 71 L6 74 L8 83 L17 80 Z M53 99 L52 94 L80 96 L80 99 Z', role: 'armed' },
  { d: 'M18 13 a2.6 2.6 0 1 0 0.1 0 Z', role: 'detail' },
]

// ---------------------------------------------------------------------------
// Pflanzen
// ---------------------------------------------------------------------------

const FLEUR_DE_LIS: ChargePath[] = [
  { d: 'M50 2 C45 13 42 24 42 35 C38 28 32 23 24 22 C18 30 18 41 24 49 C29 55 37 58 45 56 L45 60 L55 60 L55 56 C63 58 71 55 76 49 C82 41 82 30 76 22 C68 23 62 28 58 35 C58 24 55 13 50 2 Z' },
  { d: 'M33 60 L67 60 L67 70 L33 70 Z' },
  { d: 'M45 70 C43 79 39 87 32 93 C40 96 48 93 50 86 C52 93 60 96 68 93 C61 87 57 79 55 70 Z' },
]

/**
 * Die heraldische Rose: fünf Blätter, Kelchblätter zwischen den Blättern,
 * Butzen in der Mitte. Nie eine Gartenrose – die Stilisierung ist verbindlich.
 */
const ROSE: ChargePath[] = [
  // Kelchblätter, zwischen den Blütenblättern hervorstehend
  { d: 'M50 6 L57 26 L43 26 Z M89 34 L71 44 L67 30 Z M74 80 L64 62 L77 56 Z M26 80 L36 62 L23 56 Z M11 34 L29 44 L33 30 Z', role: 'armed' },
  // Fünf Blütenblätter
  {
    d: 'M50 8 C56 8 61 13 62 20 L64 30 L74 24 C80 21 87 23 90 29 C93 35 91 42 85 45 L76 50 L85 55 '
      + 'C91 58 93 65 90 71 C87 77 80 79 74 76 L64 70 L62 80 C61 87 56 92 50 92 C44 92 39 87 38 80 '
      + 'L36 70 L26 76 C20 79 13 77 10 71 C7 65 9 58 15 55 L24 50 L15 45 C9 42 7 35 10 29 '
      + 'C13 23 20 21 26 24 L36 30 L38 20 C39 13 44 8 50 8 Z',
  },
  // Butzen
  { d: 'M50 36 a14 14 0 1 0 0.1 0 Z', role: 'armed' },
  { d: 'M50 42 C54 42 57 45 57 49 C57 53 54 56 50 56 C46 56 43 53 43 49 C43 45 46 42 50 42 Z', role: 'detail' },
  { d: 'M50 22 L50 34 M68 34 L59 42 M62 62 L57 52 M38 62 L43 52 M32 34 L41 42', role: 'line' },
]

const TREFOIL: ChargePath[] = [
  { d: 'M50 6 C42 6 36 12 36 20 C36 25 39 29 43 32 C38 29 32 28 27 30 C20 33 17 42 20 49 C23 56 32 59 39 56 C43 54 46 51 47 47 L47 94 L53 94 L53 47 C54 51 57 54 61 56 C68 59 77 56 80 49 C83 42 80 33 73 30 C68 28 62 29 57 32 C61 29 64 25 64 20 C64 12 58 6 50 6 Z' },
]

const OAK_LEAF: ChargePath[] = [
  { d: 'M50 2 C44 8 42 14 43 20 C38 16 32 15 27 17 C29 23 33 27 38 29 C31 30 26 34 24 40 C29 44 36 45 42 43 C36 47 33 53 33 60 C39 61 45 59 49 55 L49 96 L55 96 L55 55 C59 59 65 61 71 60 C71 53 68 47 62 43 C68 45 75 44 80 40 C78 34 73 30 66 29 C71 27 75 23 77 17 C72 15 66 16 61 20 C62 14 60 8 54 2 Z' },
  { d: 'M52 20 L52 54', role: 'line' },
]

const LINDEN_LEAF: ChargePath[] = [
  { d: 'M50 4 C34 12 22 26 22 42 C22 58 34 70 50 74 C66 70 78 58 78 42 C78 26 66 12 50 4 Z' },
  { d: 'M47 70 L53 70 L53 98 L47 98 Z' },
  { d: 'M50 12 L50 70 M50 30 L34 26 M50 30 L66 26 M50 46 L32 44 M50 46 L68 44', role: 'line' },
]

const TREE: ChargePath[] = [
  { d: 'M45 58 L55 58 L58 90 L42 90 Z' },
  { d: 'M50 4 C36 4 25 13 22 26 C12 30 6 40 8 51 C10 62 20 69 31 67 C36 75 45 79 54 77 C64 75 71 67 72 57 C82 53 88 43 85 33 C82 22 72 15 61 16 C58 8 54 4 50 4 Z' },
  { d: 'M28 90 L72 90 L72 97 L28 97 Z', role: 'armed' },
  { d: 'M50 60 L50 22 M50 36 L38 28 M50 44 L62 34', role: 'line' },
]

const GRAPE: ChargePath[] = [
  { d: 'M50 32 a10 10 0 1 0 0.1 0 Z M34 46 a10 10 0 1 0 0.1 0 Z M66 46 a10 10 0 1 0 0.1 0 Z M42 60 a10 10 0 1 0 0.1 0 Z M58 60 a10 10 0 1 0 0.1 0 Z M50 74 a10 10 0 1 0 0.1 0 Z M26 60 a9 9 0 1 0 0.1 0 Z M74 60 a9 9 0 1 0 0.1 0 Z' },
  { d: 'M48 6 L54 6 L54 24 L48 24 Z' },
  { d: 'M54 10 C64 4 76 6 82 16 C70 20 60 17 54 13 Z', role: 'armed' },
]

// ---------------------------------------------------------------------------
// Himmelszeichen
// ---------------------------------------------------------------------------

const MULLET5: ChargePath[] = [
  { d: 'M50 6 L61 38 L95 38 L67 58 L78 91 L50 71 L22 91 L33 58 L5 38 L39 38 Z' },
]

const MULLET6: ChargePath[] = [
  { d: 'M50 4 L59 33 L88 24 L71 50 L88 76 L59 67 L50 96 L41 67 L12 76 L29 50 L12 24 L41 33 Z' },
]

const CRESCENT: ChargePath[] = [
  { d: 'M50 8 C27 8 8 27 8 50 C8 73 27 92 50 92 C57 92 64 90 70 86 C55 85 43 70 43 50 C43 30 55 15 70 14 C64 10 57 8 50 8 Z' },
]

const SUN: ChargePath[] = [
  { d: 'M50 2 L56 20 L70 8 L68 26 L86 20 L76 34 L94 38 L78 48 L94 58 L76 62 L86 76 L68 70 L70 88 L56 76 L50 94 L44 76 L30 88 L32 70 L14 76 L24 62 L6 58 L22 48 L6 38 L24 34 L14 20 L32 26 L30 8 L44 20 Z' },
  { d: 'M50 26 a24 24 0 1 0 0.1 0 Z', role: 'line', width: 1.6 },
  { d: 'M41 42 a3 3 0 1 0 0.1 0 Z M56 42 a3 3 0 1 0 0.1 0 Z M40 56 C45 63 55 63 60 56', role: 'detail' },
]

const MOON: ChargePath[] = [
  { d: 'M50 6 a44 44 0 1 0 0.1 0 Z' },
  { d: 'M36 38 a4 4 0 1 0 0.1 0 Z M64 38 a4 4 0 1 0 0.1 0 Z', role: 'detail' },
  { d: 'M32 60 C39 72 61 72 68 60', role: 'line', width: 2.4 },
]

const COMET: ChargePath[] = [
  { d: 'M50 4 L58 30 L84 30 L63 46 L71 72 L50 56 L29 72 L37 46 L16 30 L42 30 Z' },
  { d: 'M42 60 L34 98 L50 72 L66 98 L58 60 Z' },
]

// ---------------------------------------------------------------------------
// Bauwerke
// ---------------------------------------------------------------------------

const TOWER: ChargePath[] = [
  { d: 'M20 30 L20 22 L28 22 L28 28 L36 28 L36 22 L44 22 L44 28 L52 28 L52 22 L60 22 L60 28 L68 28 L68 22 L76 22 L76 30 L72 34 L72 92 L28 92 L28 34 Z' },
  { d: 'M42 62 C42 54 45 49 50 49 C55 49 58 54 58 62 L58 92 L42 92 Z', role: 'armed' },
  { d: 'M36 40 L46 40 L46 50 L36 50 Z M54 40 L64 40 L64 50 L54 50 Z', role: 'armed' },
  { d: 'M28 34 L72 34 M28 56 L72 56 M28 74 L72 74', role: 'line' },
]

const CASTLE: ChargePath[] = [
  { d: 'M8 46 L8 38 L16 38 L16 44 L24 44 L24 38 L32 38 L32 46 L68 46 L68 38 L76 38 L76 44 L84 44 L84 38 L92 38 L92 46 L88 50 L88 92 L12 92 L12 50 Z' },
  { d: 'M34 28 L34 20 L42 20 L42 26 L58 26 L58 20 L66 20 L66 28 L66 46 L34 46 Z' },
  { d: 'M40 68 C40 60 44 54 50 54 C56 54 60 60 60 68 L60 92 L40 92 Z', role: 'armed' },
  { d: 'M18 60 L28 60 L28 70 L18 70 Z M72 60 L82 60 L82 70 L72 70 Z M44 32 L56 32 L56 42 L44 42 Z', role: 'armed' },
  { d: 'M12 50 L88 50 M34 34 L66 34', role: 'line' },
]

const CHURCH: ChargePath[] = [
  { d: 'M34 46 L74 46 L74 92 L34 92 Z' },
  { d: 'M30 46 L54 26 L78 46 Z' },
  { d: 'M14 26 L22 26 L22 16 L26 16 L26 26 L34 26 L34 92 L14 92 Z' },
  { d: 'M18 34 L30 34 L30 46 L18 46 Z', role: 'armed' },
  { d: 'M46 68 C46 62 49 58 54 58 C59 58 62 62 62 68 L62 92 L46 92 Z', role: 'armed' },
  { d: 'M24 6 L24 16 M20 10 L28 10', role: 'line', width: 2.6 },
]

const DREIBERG: ChargePath[] = [
  { d: 'M0 100 C6 78 16 64 30 64 C41 64 49 71 53 82 C57 62 66 46 82 46 C96 46 100 70 100 100 Z' },
  { d: 'M30 64 C36 70 40 78 42 88 M82 46 C88 56 91 72 92 88', role: 'line' },
]

// ---------------------------------------------------------------------------
// Gegenstände
// ---------------------------------------------------------------------------

const KEY: ChargePath[] = [
  { d: 'M50 8 C39 8 30 17 30 28 C30 37 36 45 45 47 L45 90 L55 90 L55 82 L66 82 L66 73 L55 73 L55 64 L68 64 L68 55 L55 55 L55 47 C64 45 70 37 70 28 C70 17 61 8 50 8 Z' },
  { d: 'M50 18 a9 9 0 1 0 0.1 0 Z', role: 'armed' },
  { d: 'M44 90 L44 96 L56 96 L56 90 Z' },
]

const SWORD: ChargePath[] = [
  { d: 'M50 2 L57 20 L57 62 L43 62 L43 20 Z' },
  { d: 'M26 62 L74 62 L74 71 L26 71 Z' },
  { d: 'M46 71 L54 71 L54 88 L46 88 Z' },
  { d: 'M39 88 C39 84 44 81 50 81 C56 81 61 84 61 88 C61 93 56 96 50 96 C44 96 39 93 39 88 Z' },
  { d: 'M50 8 L50 60', role: 'line' },
]

const ARROW: ChargePath[] = [
  { d: 'M50 2 L67 34 L54 34 L54 76 L46 76 L46 34 L33 34 Z' },
  { d: 'M46 76 L37 98 L46 91 L50 98 L54 91 L63 98 L54 76 Z' },
]

const ANCHOR: ChargePath[] = [
  { d: 'M46 8 L54 8 L54 82 L46 82 Z' },
  { d: 'M24 22 L76 22 L76 31 L24 31 Z' },
  { d: 'M50 96 C29 96 12 79 10 58 L21 56 C23 71 35 84 50 84 C65 84 77 71 79 56 L90 58 C88 79 71 96 50 96 Z' },
  { d: 'M4 48 L26 50 L14 68 Z M96 48 L74 50 L86 68 Z' },
  { d: 'M50 2 a9 9 0 1 0 0.1 0 Z' },
  { d: 'M50 6 a5 5 0 1 0 0.1 0 Z', role: 'armed' },
]

const CROWN: ChargePath[] = [
  { d: 'M12 44 L20 16 L34 36 L50 8 L66 36 L80 16 L88 44 L88 60 L12 60 Z' },
  { d: 'M8 60 L92 60 L92 76 L8 76 Z', role: 'armed' },
  { d: 'M20 10 a7 7 0 1 0 0.1 0 Z M50 2 a7 7 0 1 0 0.1 0 Z M80 10 a7 7 0 1 0 0.1 0 Z' },
  { d: 'M24 68 a4 4 0 1 0 0.1 0 Z M50 68 a4 4 0 1 0 0.1 0 Z M76 68 a4 4 0 1 0 0.1 0 Z', role: 'detail' },
]

const HEART: ChargePath[] = [
  { d: 'M50 92 C22 72 8 54 8 36 C8 22 19 12 32 12 C40 12 47 16 50 23 C53 16 60 12 68 12 C81 12 92 22 92 36 C92 54 78 72 50 92 Z' },
]

const WHEEL: ChargePath[] = [
  { d: 'M50 3 a47 47 0 1 0 0.1 0 Z M50 17 a33 33 0 1 1 -0.1 0 Z' },
  { d: 'M46 8 L54 8 L54 92 L46 92 Z M8 46 L92 46 L92 54 L8 54 Z M19 14 L86 81 L81 86 L14 19 Z M81 14 L86 19 L19 86 L14 81 Z' },
  { d: 'M50 37 a13 13 0 1 0 0.1 0 Z', role: 'armed' },
]

const MILL_RIND: ChargePath[] = [
  { d: 'M30 10 L42 10 L42 26 L58 26 L58 10 L70 10 L70 40 L86 40 L86 28 L96 28 L96 72 L86 72 L86 60 L70 60 L70 90 L58 90 L58 74 L42 74 L42 90 L30 90 L30 60 L14 60 L14 72 L4 72 L4 28 L14 28 L14 40 L30 40 Z' },
]

const HAMMER: ChargePath[] = [
  // Kopf: breite Bahn mit leicht abgesetzten Enden
  { d: 'M10 14 C10 10 13 8 17 8 H83 C87 8 90 10 90 14 V36 C90 40 87 42 83 42 H17 C13 42 10 40 10 36 Z' },
  // Stiel
  { d: 'M43 42 H57 L60 96 H40 Z' },
  { d: 'M26 14 V36 M74 14 V36', role: 'line' },
]

const HUNTING_HORN: ChargePath[] = [
  // Gewundenes Hifthorn mit Mundstück und weiter Öffnung
  { d: 'M20 20 C10 30 8 46 14 60 C22 78 42 88 64 86 C78 85 88 78 94 68 L82 60 C77 68 68 74 58 75 C42 76 28 68 22 55 C17 44 18 32 26 24 Z' },
  { d: 'M88 52 L100 44 L100 82 L84 72 Z' },
  { d: 'M12 12 L34 12 L34 26 L12 26 Z', role: 'armed' },
  // Aufhängeschnur
  { d: 'M22 30 C34 36 46 44 56 54 M18 44 C30 50 44 58 56 68', role: 'line' },
]

const ESCALLOP: ChargePath[] = [
  // Jakobsmuschel: gefächerte Rippen, gerader Schlossrand mit Öhrchen
  {
    d: 'M50 10 C43 10 38 14 37 20 L28 22 C22 24 19 30 21 36 '
      + 'C14 46 10 60 10 74 C10 84 18 92 30 92 L70 92 C82 92 90 84 90 74 '
      + 'C90 60 86 46 79 36 C81 30 78 24 72 22 L63 20 C62 14 57 10 50 10 Z',
  },
  { d: 'M50 20 L50 90 M36 22 L28 90 M64 22 L72 90 M24 36 L17 86 M76 36 L83 86 M43 20 L40 90 M57 20 L60 90', role: 'line' },
]

const CHALICE: ChargePath[] = [
  { d: 'M16 14 L84 14 C84 36 71 51 56 55 L56 78 L78 78 L78 90 L22 90 L22 78 L44 78 L44 55 C29 51 16 36 16 14 Z' },
  { d: 'M22 24 L78 24', role: 'line' },
]

const BOOK: ChargePath[] = [
  { d: 'M5 20 C19 14 35 14 47 21 L47 85 C35 79 19 79 5 85 Z M95 20 C81 14 65 14 53 21 L53 85 C65 79 81 79 95 85 Z' },
  { d: 'M47 21 L53 21 L53 85 L47 85 Z', role: 'armed' },
  { d: 'M14 32 C24 29 34 30 42 34 M14 46 C24 43 34 44 42 48 M14 60 C24 57 34 58 42 62 M86 32 C76 29 66 30 58 34 M86 46 C76 43 66 44 58 48 M86 60 C76 57 66 58 58 62', role: 'line' },
]

const BELL: ChargePath[] = [
  { d: 'M44 4 L56 4 L56 14 C72 21 82 39 82 62 L88 62 L88 78 L12 78 L12 62 L18 62 C18 39 28 21 44 14 Z' },
  { d: 'M44 78 C44 88 46 94 50 98 C54 94 56 88 56 78 Z', role: 'armed' },
  { d: 'M30 62 C30 42 38 26 50 20 C62 26 70 42 70 62', role: 'line' },
]

const SCALE: ChargePath[] = [
  { d: 'M46 6 L54 6 L54 92 L46 92 Z M20 92 L80 92 L80 98 L20 98 Z' },
  { d: 'M6 22 L94 22 L94 29 L6 29 Z' },
  { d: 'M4 30 C4 47 13 58 24 58 C35 58 44 47 44 30 Z M56 30 C56 47 65 58 76 58 C87 58 96 47 96 30 Z' },
  { d: 'M24 29 L24 58 M76 29 L76 58', role: 'line' },
]

const MITRE: ChargePath[] = [
  // Bischofsmütze mit zwei Spitzen und herabhängenden Bändern
  { d: 'M50 4 C58 22 66 38 74 50 C79 58 79 68 74 76 L74 80 L26 80 L26 76 C21 68 21 58 26 50 C34 38 42 22 50 4 Z' },
  { d: 'M32 80 L34 100 L44 92 L44 80 Z M68 80 L66 100 L56 92 L56 80 Z' },
  { d: 'M26 58 L74 58 L74 68 L26 68 Z', role: 'armed' },
  { d: 'M50 10 L50 58', role: 'line' },
]

const CROSIER: ChargePath[] = [
  { d: 'M44 42 L54 42 L54 98 L44 98 Z' },
  { d: 'M49 42 C49 24 60 8 76 8 C90 8 98 21 95 34 C92 45 82 51 73 48 C66 46 62 39 64 32 C66 26 73 23 78 27 C80 22 76 17 70 18 C60 20 56 30 56 42 Z' },
  { d: 'M76 20 C82 26 82 36 76 42', role: 'line' },
]

const HAND: ChargePath[] = [
  { d: 'M34 96 L34 54 C30 50 26 44 26 36 L34 36 C34 42 36 46 38 48 L38 12 C38 8 41 5 45 5 C49 5 52 8 52 12 L52 44 L56 44 L56 8 C56 4 59 1 63 1 C67 1 70 4 70 8 L70 44 L74 44 L74 14 C74 10 77 7 81 7 C85 7 88 10 88 14 L88 60 C88 80 78 96 62 96 Z' },
  { d: 'M45 48 L45 12 M63 46 L63 10 M81 48 L81 16', role: 'line' },
]

const CROSS_PATTEE: ChargePath[] = [
  // Tatzenkreuz: nach außen verbreiterte Arme mit gerader Kante
  {
    d: 'M32 6 L68 6 C64 22 62 34 62 38 C66 38 78 36 94 32 L94 68 '
      + 'C78 64 66 62 62 62 C62 66 64 78 68 94 L32 94 '
      + 'C36 78 38 66 38 62 C34 62 22 64 6 68 L6 32 '
      + 'C22 36 34 38 38 38 C38 34 36 22 32 6 Z',
  },
]

const CROSS_LATIN: ChargePath[] = [
  { d: 'M42 6 L58 6 L58 26 L80 26 L80 42 L58 42 L58 94 L42 94 L42 42 L20 42 L20 26 L42 26 Z' },
]

// ---------------------------------------------------------------------------

export const CHARGES: ChargeDef[] = [
  { key: 'lion', german: 'Löwe', english: 'lion', aliases: ['löwe', 'loewe', 'lion', 'leo', 'löwen'], category: 'beast', paths: LION_RAMPANT },
  { key: 'lionPassant', german: 'schreitender Löwe', english: 'lion passant', aliases: ['schreitender löwe', 'leopard', 'lion passant'], category: 'beast', paths: LION_PASSANT },
  { key: 'eagle', german: 'Adler', english: 'eagle', aliases: ['adler', 'eagle', 'aar', 'adlern'], category: 'bird', paths: EAGLE_DISPLAYED, symmetrical: true },
  { key: 'griffin', german: 'Greif', english: 'griffin', aliases: ['greif', 'griffin', 'gryphon', 'greifen'], category: 'monster', paths: GRIFFIN },
  { key: 'unicorn', german: 'Einhorn', english: 'unicorn', aliases: ['einhorn', 'unicorn'], category: 'monster', paths: UNICORN },
  { key: 'bear', german: 'Bär', english: 'bear', aliases: ['bär', 'baer', 'bear', 'bären'], category: 'beast', paths: BEAR },
  { key: 'boar', german: 'Eber', english: 'boar', aliases: ['eber', 'wildschwein', 'boar', 'sau', 'keiler'], category: 'beast', paths: BOAR },
  { key: 'horse', german: 'Pferd', english: 'horse', aliases: ['pferd', 'ross', 'horse', 'rappe'], category: 'beast', paths: HORSE },
  { key: 'ram', german: 'Widder', english: 'ram', aliases: ['widder', 'schaf', 'ram', 'lamm', 'bock'], category: 'beast', paths: RAM },
  { key: 'stagAttire', german: 'Hirschstange', english: 'stag attire', aliases: ['hirschstange', 'geweih', 'hirschgeweih', 'attire', 'stangen'], category: 'beast', paths: STAG_ATTIRE },
  { key: 'swan', german: 'Schwan', english: 'swan', aliases: ['schwan', 'swan', 'gans'], category: 'bird', paths: SWAN },
  { key: 'martlet', german: 'Merlette', english: 'martlet', aliases: ['merlette', 'martlet', 'amsel', 'vogel', 'schwalbe'], category: 'bird', paths: MARTLET },
  { key: 'fish', german: 'Fisch', english: 'fish', aliases: ['fisch', 'fish', 'hecht', 'barbe', 'karpfen'], category: 'beast', paths: FISH },
  { key: 'fleurDeLis', german: 'Lilie', english: 'fleur-de-lis', aliases: ['lilie', 'lilien', 'fleur-de-lis', 'fleur de lis', 'lys'], category: 'plant', paths: FLEUR_DE_LIS, symmetrical: true },
  { key: 'rose', german: 'Rose', english: 'rose', aliases: ['rose', 'rosen'], category: 'plant', paths: ROSE, symmetrical: true },
  { key: 'trefoil', german: 'Kleeblatt', english: 'trefoil', aliases: ['kleeblatt', 'klee', 'trefoil'], category: 'plant', paths: TREFOIL, symmetrical: true },
  { key: 'oakLeaf', german: 'Eichenblatt', english: 'oak leaf', aliases: ['eichenblatt', 'eichenlaub', 'oak leaf'], category: 'plant', paths: OAK_LEAF, symmetrical: true },
  { key: 'lindenLeaf', german: 'Lindenblatt', english: 'linden leaf', aliases: ['lindenblatt', 'seeblatt', 'linden leaf'], category: 'plant', paths: LINDEN_LEAF, symmetrical: true },
  { key: 'tree', german: 'Baum', english: 'tree', aliases: ['baum', 'tree', 'linde', 'eiche', 'tanne'], category: 'plant', paths: TREE, symmetrical: true },
  { key: 'grape', german: 'Traube', english: 'grapes', aliases: ['traube', 'weintraube', 'grapes', 'reben'], category: 'plant', paths: GRAPE, symmetrical: true },
  { key: 'mullet', german: 'Stern', english: 'mullet', aliases: ['stern', 'sterne', 'mullet', 'star', 'fünfstrahliger stern'], category: 'celestial', paths: MULLET5, symmetrical: true },
  { key: 'mullet6', german: 'sechsstrahliger Stern', english: 'six-pointed mullet', aliases: ['sechsstrahliger stern', 'sechsstern', 'six-pointed'], category: 'celestial', paths: MULLET6, symmetrical: true },
  { key: 'crescent', german: 'Mondsichel', english: 'crescent', aliases: ['mondsichel', 'halbmond', 'crescent', 'mond'], category: 'celestial', paths: CRESCENT },
  { key: 'sun', german: 'Sonne', english: 'sun', aliases: ['sonne', 'sun', 'sonnenrad'], category: 'celestial', paths: SUN, symmetrical: true },
  { key: 'moon', german: 'Vollmond', english: 'moon in her plenitude', aliases: ['vollmond', 'moon'], category: 'celestial', paths: MOON, symmetrical: true },
  { key: 'comet', german: 'Komet', english: 'comet', aliases: ['komet', 'comet', 'schweifstern'], category: 'celestial', paths: COMET },
  { key: 'tower', german: 'Turm', english: 'tower', aliases: ['turm', 'tower', 'türme', 'zinnenturm'], category: 'building', paths: TOWER, symmetrical: true },
  { key: 'castle', german: 'Burg', english: 'castle', aliases: ['burg', 'castle', 'schloss', 'festung'], category: 'building', paths: CASTLE, symmetrical: true },
  { key: 'church', german: 'Kirche', english: 'church', aliases: ['kirche', 'church', 'kapelle'], category: 'building', paths: CHURCH },
  { key: 'dreiberg', german: 'Dreiberg', english: 'three-hilled mount', aliases: ['dreiberg', 'berg', 'mount', 'hügel'], category: 'geometric', paths: DREIBERG, anchor: 'base' },
  { key: 'key', german: 'Schlüssel', english: 'key', aliases: ['schlüssel', 'schluessel', 'key'], category: 'object', paths: KEY },
  { key: 'sword', german: 'Schwert', english: 'sword', aliases: ['schwert', 'sword', 'degen', 'klinge'], category: 'object', paths: SWORD },
  { key: 'arrow', german: 'Pfeil', english: 'arrow', aliases: ['pfeil', 'arrow', 'bolzen'], category: 'object', paths: ARROW },
  { key: 'anchor', german: 'Anker', english: 'anchor', aliases: ['anker', 'anchor'], category: 'object', paths: ANCHOR },
  { key: 'crown', german: 'Krone', english: 'crown', aliases: ['krone', 'crown', 'kronen'], category: 'object', paths: CROWN, symmetrical: true },
  { key: 'heart', german: 'Herz', english: 'heart', aliases: ['herz', 'heart', 'herzen'], category: 'object', paths: HEART, symmetrical: true },
  { key: 'wheel', german: 'Rad', english: 'wheel', aliases: ['rad', 'wheel', 'speichenrad', 'mühlrad'], category: 'object', paths: WHEEL, symmetrical: true },
  { key: 'millRind', german: 'Mühleisen', english: 'mill rind', aliases: ['mühleisen', 'muehleisen', 'mill rind'], category: 'object', paths: MILL_RIND, symmetrical: true },
  { key: 'hammer', german: 'Hammer', english: 'hammer', aliases: ['hammer', 'schlägel'], category: 'object', paths: HAMMER },
  { key: 'horn', german: 'Jagdhorn', english: 'hunting horn', aliases: ['jagdhorn', 'horn', 'hifthorn', 'hunting horn'], category: 'object', paths: HUNTING_HORN },
  { key: 'escallop', german: 'Jakobsmuschel', english: 'escallop', aliases: ['muschel', 'jakobsmuschel', 'escallop', 'pilgermuschel'], category: 'object', paths: ESCALLOP, symmetrical: true },
  { key: 'chalice', german: 'Kelch', english: 'chalice', aliases: ['kelch', 'chalice', 'becher'], category: 'object', paths: CHALICE, symmetrical: true },
  { key: 'book', german: 'Buch', english: 'book', aliases: ['buch', 'book', 'bibel'], category: 'object', paths: BOOK, symmetrical: true },
  { key: 'bell', german: 'Glocke', english: 'bell', aliases: ['glocke', 'bell', 'schelle'], category: 'object', paths: BELL, symmetrical: true },
  { key: 'scale', german: 'Waage', english: 'balance', aliases: ['waage', 'balance', 'scale'], category: 'object', paths: SCALE, symmetrical: true },
  { key: 'mitre', german: 'Bischofsmütze', english: 'mitre', aliases: ['mitra', 'bischofsmütze', 'mitre'], category: 'object', paths: MITRE, symmetrical: true },
  { key: 'crosier', german: 'Krummstab', english: 'crosier', aliases: ['krummstab', 'bischofsstab', 'crosier'], category: 'object', paths: CROSIER },
  { key: 'hand', german: 'Hand', english: 'hand', aliases: ['hand', 'schwurhand'], category: 'human', paths: HAND },
  { key: 'crossPattee', german: 'Tatzenkreuz', english: 'cross pattée', aliases: ['tatzenkreuz', 'cross pattee', 'pfotenkreuz'], category: 'geometric', paths: CROSS_PATTEE, symmetrical: true },
  { key: 'crossLatin', german: 'lateinisches Kreuz', english: 'Latin cross', aliases: ['lateinisches kreuz', 'kreuz', 'latin cross'], category: 'geometric', paths: CROSS_LATIN, symmetrical: true },
]

export const CHARGE_MAP: Record<string, ChargeDef> = Object.fromEntries(CHARGES.map((c) => [c.key, c]))

/** Sucht eine Figur anhand eines deutschen oder englischen Wortes. */
export function lookupCharge(word: string): ChargeDef | undefined {
  const w = word.toLowerCase().trim()
  for (const c of CHARGES) {
    if (c.key.toLowerCase() === w) return c
    if (c.aliases.includes(w)) return c
  }
  // Mehrzahlformen und angehängte Endungen
  const stem = w.replace(/(en|er|e|n|s)$/, '')
  if (stem.length >= 3) {
    for (const c of CHARGES) {
      if (c.aliases.some((a) => a === stem || a.startsWith(stem))) return c
    }
  }
  // Zusammengesetzte Begriffe im Plural: „fleurs-de-lis“ → „fleur-de-lis“
  const singular = w.replace(/([a-zäöüß]+)s(?=[- ])/g, '$1')
  if (singular !== w) {
    for (const c of CHARGES) {
      if (c.aliases.includes(singular)) return c
    }
  }
  return undefined
}

export function chargesByCategory(): Record<ChargeCategory, ChargeDef[]> {
  const out = {} as Record<ChargeCategory, ChargeDef[]>
  for (const c of CHARGES) {
    if (!out[c.category]) out[c.category] = []
    out[c.category].push(c)
  }
  return out
}

export const CATEGORY_LABELS: Record<ChargeCategory, string> = {
  beast: 'Vierfüßer', bird: 'Vögel', monster: 'Fabelwesen', plant: 'Pflanzen',
  object: 'Gegenstände', celestial: 'Himmelszeichen', building: 'Bauwerke',
  human: 'Menschliches', geometric: 'Geometrisches',
}
