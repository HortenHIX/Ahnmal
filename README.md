# Wappenbrief

Ahnenforschung und Heraldik in einem Werkzeug. Läuft vollständig im Browser –
ohne Server, ohne Anmeldung, ohne Datenübertragung.

Der genealogische Teil kann, was Programme dieser Gattung können: Personen und
Familien, Ereignisse mit Quellenbelegen, Diagramme, GEDCOM in beide Richtungen,
Plausibilitätsprüfung, Dublettensuche und Verwandtschaftsberechnung.

Der heraldische Teil geht darüber hinaus und ist der eigentliche Grund für
dieses Programm: Blasonierungen werden gelesen **und** erzeugt, Wappen werden
aus Tinkturen, Teilungen, Heroldsbildern und gemeinen Figuren als Vektorgrafik
gezeichnet und gegen die heraldischen Regeln geprüft.

## Starten

```bash
npm install
npm run dev      # Entwicklungsserver auf http://localhost:5173
npm run build    # Auslieferungsfassung nach dist/
npm test         # Prüfläufe der Kernlogik
```

`dist/` ist eine reine Sammlung statischer Dateien. Sie lässt sich auf jeden
Webspeicher legen oder mit `npm run preview` lokal öffnen.

Beim ersten Start wird ein Beispielbestand geladen – eine erfundene Familie aus
der Baar mit dem Datenbild, das süddeutsche Kirchenbücher tatsächlich liefern.
Unter *Einstellungen* lässt sich stattdessen ein leerer Bestand anlegen.

## Was das Programm kann

### Bestand

- **Personen** mit beliebig vielen Namensformen (Geburts-, Ehe-, Ordensname),
  Geschlecht, Ereignissen, Eigenschaften, Notizen und Belegen
- **Familien** mit Ehe- und Scheidungsereignissen, Kindern samt Art der
  Kindschaft (leiblich, adoptiert, Pflege, Stief)
- **Ereignisse** in vollem GEDCOM-Umfang – Geburt, Taufe, Firmung, Auswanderung,
  Testamentseröffnung, Volkszählung und weitere, jeweils mit Datum, Ort,
  ausführender Stelle, Ursache und Zeugen
- **Quellen** mit Archiv, Signatur und abgedecktem Zeitraum; Belege mit
  Seitenangabe, wörtlichem Zitat und Zuverlässigkeitsstufe
- **Orte** mit Hierarchie, Koordinaten und früheren Namen
- **Medien** als eingebettete Dateien bis 8 MB

### Datumsangaben

Historische Daten sind selten exakt. Gelesen werden

- deutsche und englische Schreibweisen: `14.08.1723`, `14 AUG 1723`, `3. März 1698`
- lateinische Monatsnamen aus Kirchenbüchern: `12 septembris 1701`, `4 8bris 1699`
- Qualifizierer: `um 1723`, `vor 1800`, `nach 1750`, `geschätzt`, `errechnet`
- Zeitspannen: `zwischen 1720 und 1725`, `von 1700 bis 1710`
- Doppeljahre der Zeit vor der Kalenderreform: `1712/13`
- julianische Daten mit Umrechnung in den gregorianischen Kalender

Was sich nicht deuten lässt, bleibt im Wortlaut erhalten statt verworfen zu
werden.

### Diagramme

Ahnentafel mit Kekulé-Nummerierung, Fächerdiagramm mit farblich getrennten
väterlichen und mütterlichen Linien, Nachkommenliste, Sanduhr, Zeitstrahl und
eine Ortskarte. Alle Diagramme lassen sich als SVG sichern und drucken.

### Forschungswerkzeuge

- **Plausibilitätsprüfung** – Tod vor Geburt, unmögliche Elternalter, Kinder
  nach dem Tod der Mutter, zu geringe Geburtsabstände, Ringschlüsse in der
  Ahnenreihe, fehlende Belege
- **Dublettensuche** mit Kölner Phonetik. Sie ist auf deutsche Namen abgestimmt
  und erkennt Meyer/Maier/Mayr als dieselbe Schreibvariante, was Soundex nicht
  leistet. Gefundene Paare lassen sich zusammenführen, wobei Familienbande
  umgehängt werden.
- **Verwandtschaftsrechner** mit deutscher Benennung („Cousine 2. Grades“),
  gemeinsamen Vorfahren, kürzestem Weg und dem Verwandtschaftskoeffizienten
  nach Wright
- **Ahnenschwund** – welche Person wie viele Ahnenstellen besetzt
- **Forschungsfront** – Vorfahren, bei denen ein Elternteil fehlt; das ist die
  Liste für den nächsten Archivbesuch
- **Forschungsprotokoll** mit ausdrücklichem Vermerk für Negativbefunde. Wer
  nicht festhält, wo er vergeblich gesucht hat, sucht dort in zwei Jahren wieder.
- **Auswertungen** – Sterbealter, Kindersterblichkeit, Heiratsalter,
  Kinderzahl, Geburtsmonate, Namens- und Ortshäufigkeiten

### Heraldik

**Blasonierungen lesen.** Aus dem Text eines Wappenbriefs wird ein gezeichnetes
Wappen:

```
In Rot ein goldener steigender Löwe, blau bewehrt
Geteilt von Gold und Schwarz
In Silber ein blaues gewelltes Schildhaupt
Azure, three fleurs-de-lis or
```

Der Parser versteht Deutsch und Englisch, kommt mit gebeugten Formen zurecht
(`goldener`, `silbernen`, `gewelltes`) und meldet, welche Wörter er nicht
zuordnen konnte, statt stillschweigend etwas Falsches zu zeichnen.

**Blasonierungen erzeugen.** Umgekehrt liefert jedes zusammengestellte Wappen
seine fachgerechte Beschreibung in Deutsch und Englisch – mit richtiger Beugung
und Mehrzahlbildung. Die Beschreibung ist das rechtlich Verbindliche; die
Zeichnung ist nur eine mögliche Umsetzung davon.

**Umfang des Wappenwerks**

- 22 Tinkturen: Metalle, Farben, seltene Farben und neun Arten Pelzwerk
  (Hermelin, Gegenhermelin, Goldhermelin, Feh, Gegenfeh, Sturzfeh, Krückenfeh …)
- 19 Teilungen von gespalten und geteilt bis geständert, geschacht und geweckt
- 30 Heroldsbilder samt ihren Verkleinerungen
- 11 Schnittlinien: gewellt, eingebogen, gezinnt, wolkenförmig, geschwalbenschwanzt …
- 50 gemeine Figuren, gezeichnet als Vektorgrafik – Löwe, Adler, Greif, Einhorn,
  Bär, Eber, Ross, Widder, Schwan, Merlette, Lilie, Rose, Dreiberg,
  Hirschstange, Mühleisen und weitere
- 10 Schildformen vom hochmittelalterlichen Dreiecksschild bis zur Raute
- Vollwappen mit Stechhelm, Spangenhelm oder Topfhelm, Helmdecke, Wulst,
  Rangkronen, Helmzier, Schildhaltern und Spruchband
- Schraffur nach Petra Sancta für einfarbigen Druck und Gravuren
- **Regelprüfung**: Metall auf Metall und Farbe auf Farbe werden beanstandet,
  Pelzwerk und naturfarbene Figuren richtigerweise ausgenommen
- **Wappenrolle** mit Suche, Zuordnung zu Personen und Erzeugung von
  Allianzwappen aus zwei Einzelwappen

### Datenaustausch

- **GEDCOM einlesen**: 5.5, 5.5.1 und 7.0. Die Kodierung wird selbsttätig
  erkannt – UTF-8, UTF-16, Windows-1252 und das ältere ANSEL aus PAF und
  Ahnenblatt, samt dessen vorangestellten Akzentzeichen. Fehlerhafte Zeilen und
  Ebenensprünge werden ausgeglichen und gemeldet, statt den Import abzubrechen.
- **GEDCOM ausgeben** als 5.5.1 in UTF-8, wahlweise ohne die Angaben lebender
  Personen
- **Vollsicherung** als JSON ohne die Einschränkungen von GEDCOM, also
  einschließlich Wappen, Aufgaben und Forschungsprotokoll
- **Berichte**: Ahnenliste nach Kekulé, Nachkommenliste, Personenblatt,
  Ortsliste, Quellenverzeichnis

## Datenschutz

Der gesamte Bestand liegt in der IndexedDB des Browsers auf dem eigenen Rechner.
Es gibt keinen Server, keine Anmeldung und keine ausgehende Verbindung. Auch die
Ortskarte kommt ohne Kartendienst aus – ein solcher Dienst würde bei jedem
Aufruf die Wohnorte lebender Verwandter an einen fremden Server melden.

Für Personen ohne Sterbedatum, deren jüngstes Ereignis weniger als 105 Jahre
zurückliegt, wird angenommen, dass sie leben. Im Datenschutzmodus erscheinen sie
in Diagrammen, Berichten und der GEDCOM-Ausgabe nur mit dem Familiennamen. Das
ist keine Zierde: Für Daten lebender Personen gilt die
Datenschutz-Grundverordnung, und ein weitergegebener Stammbaum ist eine
Veröffentlichung.

Sicherungen außerhalb des Browsers legen Sie unter *Datenaustausch* an. Wird der
Browserspeicher gelöscht, ist der Bestand weg – wie bei jeder lokal
gespeicherten Datei ohne Sicherungskopie.

## Aufbau des Quelltexts

```
src/
  core/        Datenmodell, Datumslogik, Verwandtschaft, Prüfungen, Dubletten, Ablage
  gedcom/      Zerleger, Import, Export
  heraldry/    Tinkturen, Figurenkatalog, Blasonierungs-Parser, Schildgeometrie, Renderer
  ui/          Bausteine und Ansichten
test/          Prüfläufe für Datumslogik, Blasonierung und Genealogie
```

Das Datenmodell in `src/core/types.ts` ist nah an GEDCOM gehalten, damit der
Import verlustarm bleibt, aber dort reicher, wo GEDCOM zu grob ist: bei
Datumsangaben, Belegqualität und Orten.

## Tastaturkürzel

| Taste | Wirkung |
| --- | --- |
| `Strg`+`Z` | rückgängig |
| `Strg`+`Umschalt`+`Z` | wiederholen |
| `U` | Übersicht |
| `P` | Personen |
| `A` | Ahnentafel |
| `F` | Fächerdiagramm |
| `N` | Nachkommen |
| `W` | Wappenwerkstatt |
| `R` | Wappenrolle |
| `Q` | Quellen |
| `S` | Auswertungen |

## Grenzen

Ehrlich benannt, damit niemand später überrascht wird:

- Die Ortskarte ist eine Streuungsdarstellung mit Gradnetz, keine Landkarte mit
  Küstenlinien. Das ist der Preis dafür, keinen Kartendienst einzubinden.
- Medien werden als Data-URL im Browserspeicher abgelegt. Für einige Hundert
  Bilder reicht das; ein Bildarchiv von mehreren Gigabyte gehört ins Dateisystem.
- Der Blasonierungs-Parser deckt den gebräuchlichen Wortschatz ab. Sehr
  verschachtelte Beschreibungen mit mehrfach gevierten Feldern und eigenen
  Blasonierungen je Platz werden vereinfacht gelesen; das Ergebnis lässt sich in
  der Werkstatt nachbessern.
- Es gibt keine Abgleichsfunktion gegen die Bestände kommerzieller Anbieter.
  Das ist Absicht: Diese Abgleiche setzen voraus, dass der eigene Bestand
  hochgeladen wird.
