/**
 * Datenmodell von Wappenbrief.
 *
 * Das Modell ist bewusst nah an GEDCOM 5.5.1 / 7.0 gehalten, damit der Import
 * verlustarm bleibt und der Export wieder gültiges GEDCOM erzeugt. Wo GEDCOM
 * unpräzise ist (Datumsangaben, Belegqualität, Orte), ist das Modell reicher.
 */

export type ID = string

// ---------------------------------------------------------------------------
// Datum
// ---------------------------------------------------------------------------

/** Kalender, in dem ein historisches Datum notiert wurde. */
export type Calendar = 'gregorian' | 'julian' | 'hebrew' | 'french' | 'unknown'

/**
 * Modifikator einer Datumsangabe. Genealogische Daten sind selten exakt –
 * das Modell bildet die GEDCOM-Qualifizierer vollständig ab.
 */
export type DateModifier =
  | 'exact' // 14.08.1723
  | 'about' // um 1723            (ABT)
  | 'calculated' // errechnet 1723       (CAL)
  | 'estimated' // geschätzt 1723       (EST)
  | 'before' // vor 1723            (BEF)
  | 'after' // nach 1723           (AFT)
  | 'between' // zwischen 1720 und 1723 (BET/AND)
  | 'range' // von 1720 bis 1723   (FROM/TO)
  | 'interpreted' // gedeutet            (INT)
  | 'phrase' // reiner Text         (Klammerausdruck)

/** Ein Tag-genauer Punkt im Kalender. Monat und Tag dürfen fehlen. */
export interface DatePoint {
  year: number
  month?: number // 1–12
  day?: number // 1–31
  calendar?: Calendar
  /** true, wenn das Jahr als Doppeljahr notiert war (z. B. 1712/13). */
  dualYear?: number
}

export interface GDate {
  modifier: DateModifier
  from?: DatePoint
  to?: DatePoint
  /** Originaltext, falls nicht maschinell deutbar oder als Beleg des Wortlauts. */
  phrase?: string
}

// ---------------------------------------------------------------------------
// Belegqualität
// ---------------------------------------------------------------------------

/** Beleggüte nach dem in der Forschung üblichen dreistufigen Schema. */
export interface EvidenceQuality {
  /** Primärquelle (zeitnah entstanden) oder Sekundärquelle. */
  source?: 'primary' | 'secondary' | 'unknown'
  /** Original, Abschrift oder Auszug. */
  form?: 'original' | 'transcript' | 'derivative' | 'unknown'
  /** Direkter Beleg, indirekter Schluss oder Widerspruch. */
  evidence?: 'direct' | 'indirect' | 'negative' | 'unknown'
}

export interface Citation {
  id: ID
  sourceId: ID
  /** Seite, Eintragsnummer, Bildnummer – „wo genau“. */
  page?: string
  date?: GDate
  /** Wörtliches Zitat aus der Quelle. */
  text?: string
  /** 0 = unzuverlässig … 3 = zweifelsfrei (GEDCOM QUAY). */
  confidence?: 0 | 1 | 2 | 3
  quality?: EvidenceQuality
  mediaIds?: ID[]
  note?: string
}

// ---------------------------------------------------------------------------
// Namen
// ---------------------------------------------------------------------------

export type NameType = 'birth' | 'married' | 'religious' | 'aka' | 'immigrant' | 'nobility' | 'unknown'

export interface PersonName {
  id: ID
  given?: string
  /** Nachgestellte Namenspartikel: „von“, „van der“, „zu“. */
  surnamePrefix?: string
  surname?: string
  /** Titel vor dem Namen: „Dr.“, „Graf“. */
  prefix?: string
  /** Nachgestellt: „d. J.“, „II.“. */
  suffix?: string
  nickname?: string
  type: NameType
  /** Der im Programm angezeigte Hauptname. Genau einer pro Person. */
  primary?: boolean
  /** Normalisierte Schreibweise für Suche und Dublettenabgleich. */
  sortKey?: string
  citations?: Citation[]
}

// ---------------------------------------------------------------------------
// Ereignisse und Eigenschaften
// ---------------------------------------------------------------------------

export type PersonEventType =
  | 'BIRT' | 'CHR' | 'DEAT' | 'BURI' | 'CREM' | 'ADOP' | 'BAPM' | 'BARM' | 'BASM'
  | 'BLES' | 'CONF' | 'FCOM' | 'ORDN' | 'NATU' | 'EMIG' | 'IMMI' | 'CENS'
  | 'PROB' | 'WILL' | 'GRAD' | 'RETI' | 'EVEN'

export type FamilyEventType =
  | 'MARR' | 'MARB' | 'MARC' | 'MARL' | 'MARS' | 'ENGA' | 'DIV' | 'DIVF' | 'ANUL' | 'CENS' | 'EVEN'

export type EventType = PersonEventType | FamilyEventType

export type AttributeType =
  | 'OCCU' | 'RESI' | 'RELI' | 'NATI' | 'EDUC' | 'TITL' | 'PROP' | 'CAST'
  | 'DSCR' | 'IDNO' | 'SSN' | 'NCHI' | 'NMR' | 'FACT'

export interface GEvent {
  id: ID
  type: EventType
  /** Freie Bezeichnung bei type === 'EVEN'. */
  label?: string
  date?: GDate
  placeId?: ID
  /** Ort als Text, falls (noch) kein Ortsdatensatz angelegt wurde. */
  placeText?: string
  description?: string
  /** Ausführende Stelle: Pfarramt, Standesamt, Regiment. */
  agency?: string
  /** Todesursache o. Ä. */
  cause?: string
  /** Alter zum Zeitpunkt des Ereignisses, als Text („72 J 3 M“). */
  age?: string
  citations?: Citation[]
  mediaIds?: ID[]
  note?: string
  /** Weitere beteiligte Personen: Paten, Trauzeugen, Hebamme. */
  witnesses?: { personId?: ID; name?: string; role: string }[]
}

export interface GAttribute {
  id: ID
  type: AttributeType
  value: string
  date?: GDate
  placeId?: ID
  placeText?: string
  citations?: Citation[]
  note?: string
}

// ---------------------------------------------------------------------------
// Person
// ---------------------------------------------------------------------------

export type Sex = 'M' | 'F' | 'U' | 'X'

export interface Person {
  id: ID
  /** Kennung aus der Importdatei, damit ein Reexport stabile IDs behält. */
  xref?: string
  names: PersonName[]
  sex: Sex
  events: GEvent[]
  attributes: GAttribute[]
  /** Familien, in denen diese Person Kind ist. */
  childOf: ID[]
  /** Familien, in denen diese Person Partner ist. */
  spouseIn: ID[]
  mediaIds: ID[]
  citations: Citation[]
  notes: string[]
  /** Zugeordnetes Wappen aus der Wappenrolle. */
  armsId?: ID
  /** Manuell gesetzt: Person lebt. Sonst wird es aus den Daten geschätzt. */
  living?: boolean
  /** Freie Farbmarkierung für die Diagramme. */
  color?: string
  /** Nutzerdefinierte Schlagworte. */
  tags?: string[]
  created: number
  changed: number
}

// ---------------------------------------------------------------------------
// Familie
// ---------------------------------------------------------------------------

/** Art der Kind-Eltern-Beziehung, getrennt für Vater und Mutter. */
export type PedigreeLink = 'birth' | 'adopted' | 'foster' | 'step' | 'sealing' | 'unknown'

export interface ChildRef {
  personId: ID
  /** Beziehung zum Vater bzw. zur Mutter der Familie. */
  fatherRel?: PedigreeLink
  motherRel?: PedigreeLink
}

/** Art der Partnerschaft. Nicht jede Familie beruht auf einer Ehe. */
export type UnionType = 'married' | 'unmarried' | 'engaged' | 'unknown'

export interface Family {
  id: ID
  xref?: string
  /** Bewusst neutral benannt: Partner 1 und 2 statt Mann und Frau. */
  partner1?: ID
  partner2?: ID
  unionType: UnionType
  children: ChildRef[]
  events: GEvent[]
  mediaIds: ID[]
  citations: Citation[]
  notes: string[]
  /** Allianzwappen des Paares. */
  armsId?: ID
  created: number
  changed: number
}

// ---------------------------------------------------------------------------
// Quellen, Archive, Orte, Medien
// ---------------------------------------------------------------------------

export interface Source {
  id: ID
  xref?: string
  title: string
  author?: string
  publication?: string
  /** Wörtlicher Auszug aus der Quelle. */
  text?: string
  repositoryId?: ID
  /** Signatur im Archiv. */
  callNumber?: string
  /** Kirchenbuch, Standesamtsregister, Zählliste … */
  kind?: string
  /** Abgedeckter Zeitraum, hilft bei der Lückenanalyse. */
  coversFrom?: number
  coversTo?: number
  url?: string
  mediaIds: ID[]
  notes: string[]
  created: number
  changed: number
}

export interface Repository {
  id: ID
  xref?: string
  name: string
  address?: string
  phone?: string
  email?: string
  url?: string
  notes: string[]
  created: number
  changed: number
}

export interface Place {
  id: ID
  /** Anzeigename, üblicherweise der historische Ortsname. */
  name: string
  /** Hierarchie von klein nach groß: Ort, Kreis, Land, Staat. */
  hierarchy?: string[]
  lat?: number
  lng?: number
  /** Frühere oder fremdsprachige Namen – wichtig bei Gebietsänderungen. */
  altNames?: { name: string; from?: number; to?: number }[]
  kind?: string
  notes: string[]
  created: number
  changed: number
}

export interface MediaItem {
  id: ID
  xref?: string
  title: string
  mime: string
  /** Data-URL oder Objektschlüssel in IndexedDB. */
  data?: string
  /** Externer Pfad, falls die Datei nicht eingebettet wurde. */
  path?: string
  date?: GDate
  placeId?: ID
  /** Bildausschnitte mit Personenzuordnung („wer ist wer auf dem Foto“). */
  regions?: { personId: ID; x: number; y: number; w: number; h: number }[]
  notes: string[]
  created: number
  changed: number
}

// ---------------------------------------------------------------------------
// Forschungsorganisation
// ---------------------------------------------------------------------------

export type TaskStatus = 'open' | 'active' | 'waiting' | 'done' | 'dropped'
export type TaskPriority = 'low' | 'normal' | 'high'

export interface ResearchTask {
  id: ID
  title: string
  detail?: string
  status: TaskStatus
  priority: TaskPriority
  personId?: ID
  placeId?: ID
  repositoryId?: ID
  due?: string
  created: number
  changed: number
}

/** Ein Rechercheschritt – auch der erfolglose. Negativbefunde sind Befunde. */
export interface ResearchLogEntry {
  id: ID
  date: string
  repository?: string
  sourceSearched: string
  searchTerms?: string
  /** Was gesucht wurde. */
  objective?: string
  result: string
  /** true, wenn nichts gefunden wurde – verhindert doppelte Arbeit. */
  negative?: boolean
  personId?: ID
  created: number
}

// ---------------------------------------------------------------------------
// Heraldik
// ---------------------------------------------------------------------------

export type Tincture =
  // Metalle
  | 'or' | 'argent'
  // Farben
  | 'gules' | 'azure' | 'sable' | 'vert' | 'purpure'
  // seltene Farben
  | 'tenne' | 'sanguine' | 'murrey' | 'cendree' | 'carnation'
  // Pelzwerk
  | 'ermine' | 'ermines' | 'erminois' | 'pean'
  | 'vair' | 'counterVair' | 'vairEnPoint' | 'potent' | 'counterPotent'
  // naturfarben
  | 'proper'

/** Schildteilung. */
export type DivisionType =
  | 'none'
  | 'perPale' // gespalten
  | 'perFess' // geteilt
  | 'perBend' // schrägrechts geteilt
  | 'perBendSinister' // schräglinks geteilt
  | 'quarterly' // geviert
  | 'perSaltire' // schräggeviert
  | 'perChevron' // sparrenweise geteilt
  | 'gyronny' // geständert
  | 'tiercedPerPale' // gespalten in drei
  | 'tiercedPerFess' // geteilt in drei
  | 'chevronny' // sparrenweise gestreift
  | 'barry' // mehrfach geteilt
  | 'paly' // mehrfach gespalten
  | 'bendy' // mehrfach schrägrechts geteilt
  | 'bendySinister'
  | 'checky' // geschacht
  | 'lozengy' // geweckt
  | 'fusilly'
  | 'papelonny'

/** Linienart einer Teilung oder eines Heroldsbildes. */
export type LineStyle =
  | 'straight' // gerade
  | 'wavy' // wellenförmig
  | 'engrailed' // eingebogen
  | 'invected' // ausgebogen
  | 'indented' // gezackt
  | 'dancetty' // gezinnt, grobe Zacken
  | 'embattled' // gezinnt
  | 'nebuly' // wolkenförmig
  | 'dovetailed' // geschwalbenschwanzt
  | 'raguly' // astwerkartig
  | 'potenty' // krückenförmig

/** Heroldsbild. */
export type OrdinaryType =
  | 'fess' | 'pale' | 'bend' | 'bendSinister' | 'chevron' | 'chevronReversed'
  | 'cross' | 'saltire' | 'chief' | 'base' | 'pile' | 'bordure' | 'canton'
  | 'quarter' | 'orle' | 'tressure' | 'pall' | 'pallReversed' | 'label'
  | 'gyron' | 'flaunches' | 'fret' | 'shakefork'
  // Verkleinerungen
  | 'bar' | 'barrulet' | 'pallet' | 'endorse' | 'bendlet' | 'baton' | 'chevronel'
  | 'crossHumetty' | 'inescutcheon'

/** Stellung einer Figur. */
export type Attitude =
  | 'rampant' | 'passant' | 'statant' | 'salient' | 'sejant' | 'couchant'
  | 'displayed' | 'rising' | 'volant' | 'close'
  | 'guardant' | 'regardant' | 'contourne'
  | 'erect' | 'inverted' | 'fesswise' | 'palewise' | 'bendwise'
  | 'couped' | 'erased' | 'cabossed'
  /** wachsend: nur die obere Hälfte der Figur ist sichtbar */
  | 'issuant'

export interface Charge {
  /** Schlüssel aus dem Figurenkatalog, z. B. 'lion', 'eagle', 'fleurDeLis'. */
  key: string
  tincture: Tincture
  /** Anzahl gleicher Figuren. */
  count: number
  attitudes?: Attitude[]
  /** Abweichende Farbe für Bewehrung (Zunge, Krallen, Schnabel). */
  armedTincture?: Tincture
  /** Farbe der Krone, falls die Figur gekrönt ist. */
  crownedTincture?: Tincture
  /** Anordnung, falls von der Vorgabe abweichend: '2,1' oder 'inPale'. */
  arrangement?: string
  /** Platz im Schild: oben, unten oder mittig (Vorgabe). */
  position?: 'chief' | 'base'
  /** Feinjustierung in Prozent des Schildes. */
  scale?: number
  dx?: number
  dy?: number
  /** Auf welchem Heroldsbild die Figur sitzt (Index in ordinaries). */
  onOrdinary?: number
}

export interface Division {
  type: DivisionType
  /** Feldfarben von links oben nach rechts unten. */
  tinctures: Tincture[]
  line?: LineStyle
  /** Anzahl der Streifen bei barry/paly/bendy, Reihen bei checky. */
  count?: number
  /** Rekursive Felder für gevierte Wappen: Index → Unterwappen. */
  quarters?: (BlazonSpec | null)[]
}

export interface Ordinary {
  type: OrdinaryType
  tincture: Tincture
  line?: LineStyle
  /** Zweite Farbe bei geteilten Heroldsbildern. */
  tincture2?: Tincture
  count?: number
  /** Farbe eines schmalen Randes um das Heroldsbild. */
  fimbriation?: Tincture
}

/** Vollständige Beschreibung eines Wappens als Baum. */
export interface BlazonSpec {
  field: Tincture
  division?: Division
  ordinaries: Ordinary[]
  charges: Charge[]
  /** Herzschild. */
  inescutcheon?: BlazonSpec
  /** Beizeichen zur Kennzeichnung jüngerer Linien. */
  difference?: { key: string; tincture: Tincture }
}

export type ShieldShape =
  | 'heater' // Dreiecksschild, Hochmittelalter
  | 'norman' // Normannenschild, langgezogen
  | 'iberian' // unten gerundet
  | 'french' // französisch modern, Nasen unten
  | 'italian' // ovaler Rossstirnschild
  | 'polish'
  | 'lozenge' // Raute, traditionell für Frauen
  | 'oval'
  | 'square'
  | 'targe' // Tartsche mit Speerruhe

export interface Crest {
  /** Helmzier als Figurenschlüssel. */
  key?: string
  tincture?: Tincture
  /** Helmdecken außen und innen. */
  mantlingOuter?: Tincture
  mantlingInner?: Tincture
  /** Wulst statt Krone. */
  torse?: [Tincture, Tincture]
  /** Rangkrone auf dem Helm. */
  coronet?: 'none' | 'baron' | 'count' | 'duke' | 'prince' | 'royal' | 'mural' | 'naval'
  helmType?: 'none' | 'tilting' | 'barred' | 'pot' | 'sallet'
  /** Blickrichtung des Helms. */
  helmFacing?: 'affronty' | 'dexter' | 'sinister'
}

export interface Arms {
  id: ID
  /** Name des Wappens, meist der Familienname. */
  name: string
  /** Blasonierung im Wortlaut. */
  blazon: string
  /** Sprache der Blasonierung. */
  blazonLang?: 'de' | 'en'
  spec: BlazonSpec
  shape: ShieldShape
  crest?: Crest
  /** Wahlspruch. */
  motto?: string
  mottoPosition?: 'above' | 'below'
  /** Schildhalter als Figurenschlüssel. */
  supporters?: { key: string; tincture: Tincture }[]
  /** Nachweis: Wappenbrief, Siegel, Wappenbuch. */
  attribution?: string
  sourceIds?: ID[]
  /** Herkunftsregion, hilft beim Suchen in der Wappenrolle. */
  region?: string
  /** Zeitraum der belegten Führung. */
  usedFrom?: number
  usedTo?: number
  notes: string[]
  created: number
  changed: number
}

// ---------------------------------------------------------------------------
// Baumdokument
// ---------------------------------------------------------------------------

export interface TreeMeta {
  id: ID
  name: string
  description?: string
  /** Person, auf die sich Ahnentafeln standardmäßig beziehen. */
  rootPersonId?: ID
  researcher?: string
  created: number
  changed: number
}

export interface Database {
  meta: TreeMeta
  persons: Record<ID, Person>
  families: Record<ID, Family>
  sources: Record<ID, Source>
  repositories: Record<ID, Repository>
  places: Record<ID, Place>
  media: Record<ID, MediaItem>
  arms: Record<ID, Arms>
  tasks: Record<ID, ResearchTask>
  log: Record<ID, ResearchLogEntry>
}

export function emptyDatabase(name = 'Neuer Stammbaum'): Database {
  const now = Date.now()
  return {
    meta: { id: 'tree', name, created: now, changed: now },
    persons: {},
    families: {},
    sources: {},
    repositories: {},
    places: {},
    media: {},
    arms: {},
    tasks: {},
    log: {},
  }
}
