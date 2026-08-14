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

## Veröffentlichen

Zwei Abläufe liegen unter `.github/workflows`:

- **Prüfung** läuft bei jedem Push und bei jedem Pull Request: Typprüfung,
  Prüfläufe, Bauen.
- **Veröffentlichen** stellt die Anwendung auf GitHub Pages bereit. Der Ablauf
  startet bei einem Push nach `main` und lässt sich auch von Hand aus einem
  beliebigen Zweig anstoßen (Actions → Veröffentlichen → Run workflow).

Einmalig ist im Repository unter *Settings → Pages → Build and deployment* als
Quelle **GitHub Actions** einzustellen. Danach liegt die Anwendung unter
`https://<benutzer>.github.io/<repository>/`.

Auch dort bleibt sie serverlos: Ausgeliefert werden nur statische Dateien, der
Bestand liegt weiterhin ausschließlich in der IndexedDB des jeweiligen
Browsers. Wer die Adresse öffnet, sieht seine eigenen Daten – und niemand
sonst sieht sie.

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

### Druckwerkstatt

Sieben Dokumente, jeweils auf ein Papierformat gesetzt und mit Seitenvorschau:

| Dokument | Vorgabe |
| --- | --- |
| Ahnentafel als Poster | A3 quer, eine Seite |
| Fächerdiagramm als Poster | A3 hoch, eine Seite |
| Ahnenliste nach Kekulé | A4 hoch, mehrseitig |
| Nachkommenliste | A4 hoch, mehrseitig |
| Personenblatt | A4 hoch |
| Familienbogen | A4 hoch |
| Wappenblatt | A4 hoch |

Papierformat (A4, A3, A2, Letter), Ausrichtung und Seitenrand sind frei
wählbar; die Vorschau zeigt die Seite in Originalgröße.

Die Ausgabe entsteht über die Druckfunktion des Browsers, in der sich
„Als PDF sichern“ wählen lässt. Das ist bewusst so gelöst: Text bleibt
auswählbar und durchsuchbar, Wappen und Diagramme bleiben Vektorgrafik. Eine
selbst erzeugte Rasterdatei wäre in Bildschirmauflösung entstanden und beim
Vergrößern zerfallen – bei einem Poster in A2 ist das der Unterschied zwischen
brauchbar und wertlos. Damit die Wappentinkturen mitkommen, muss im Druckdialog
„Hintergrundgrafiken“ aktiv sein.

Einträge und Tabellenzeilen werden nicht über einen Seitenumbruch zerrissen,
Generationsüberschriften bleiben bei ihrem ersten Eintrag.

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

## Von mehreren Geräten arbeiten

Die Browserablage gehört **einem Browser auf einem Gerät**. Firefox und Chrome
auf demselben Rechner sind zwei getrennte Bestände, die einander nicht sehen;
ebenso Laptop und Telefon. Dafür gibt es zwei Wege.

### Arbeitsdatei in einem Sync-Ordner (empfohlen)

Unter *Einstellungen → Arbeitsdatei* legen Sie eine Datei an – am besten in
einem Ordner, den Dropbox, OneDrive oder Nextcloud abgleicht. Danach schreibt
das Programm jede Änderung dorthin zurück, wie eine Textverarbeitung. Auf dem
zweiten Gerät öffnen Sie dieselbe Datei über *Bestehende öffnen*.

Den Abgleich zwischen den Geräten übernimmt Ihr Ordner. Es gibt weiterhin
keinen Server dieses Programms, der Ihre Daten sähe.

- Geschrieben wird wenige Sekunden nach der letzten Eingabe.
- Änderungen von einem anderen Gerät werden übernommen, sobald das Fenster
  wieder in den Vordergrund kommt, spätestens nach zwanzig Sekunden.
- Haben **beide** Seiten gearbeitet, fragt das Programm, welche Fassung gilt,
  und nennt zu beiden Personenzahl und Änderungszeit. Stillschweigend
  überschrieben wird nichts.
- Nach einem Neustart des Browsers muss der Dateizugriff einmal bestätigt
  werden. Das ist eine Sicherheitsvorgabe des Browsers und lässt sich nicht
  umgehen.

Vorausgesetzt wird die File System Access API: **Chrome und Edge** haben sie,
**Firefox und Safari** nicht. Dort bleibt es beim zweiten Weg.

### Sichern und einlesen von Hand

*Datenaustausch → Vollsicherung (JSON)*, die Datei auf das andere Gerät
bringen, dort *Datenaustausch → JSON-Sicherung wählen*.

Nehmen Sie **JSON, nicht GEDCOM**: GEDCOM kennt Wappen, Aufgaben und
Forschungsprotokoll nicht.

Hier gibt es keine Konflikterkennung. Behandeln Sie einen Browser als
Arbeitsplatz und die übrigen als Kopien — wer auf zwei Geräten parallel
arbeitet, verliert beim nächsten Einlesen eine Seite.

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

### Wie verlässlich ist die Browserablage?

*Einstellungen → Browserablage* zeigt es. Das Programm fordert beim Start
dauerhaften Speicher an (`navigator.storage.persist()`); ohne diese Zusage darf
der Browser die Ablage bei Platzmangel räumen. Angezeigt werden außerdem der
belegte Platz und Warnungen zur Plattform:

- **Safari auf iPhone und iPad** löscht Websitedaten nach etwa sieben Tagen ohne
  Besuch der Seite. Dort ist die Ablage keine Aufbewahrung, sondern ein
  Arbeitsspeicher. Die Warnung erscheint auch, wenn sich ein iPad als Macintosh
  meldet – erkennbar an der Berührungsfähigkeit.
- **Privates Fenster**: Ein auffällig kleines Speicherkontingent wird gemeldet,
  denn dort ist beim Schließen alles verworfen.
- Ohne verbundene Arbeitsdatei mahnt das Programm nach zwei Wochen ohne
  Sicherung – sichtbar als „Sicherung fällig“ in der Kopfleiste.

## Aufbau des Quelltexts

```
src/
  core/        Datenmodell, Datumslogik, Verwandtschaft, Prüfungen, Dubletten,
               Ablage, Arbeitsdatei
  gedcom/      Zerleger, Import, Export
  heraldry/    Tinkturen, Figurenkatalog, Blasonierungs-Parser, Schildgeometrie, Renderer
  ui/          Bausteine und Ansichten
test/          Prüfläufe für Datumslogik, Blasonierung, Genealogie und Arbeitsdatei
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
| `Strg`+`P` | Drucken (in der Druckwerkstatt) |

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
