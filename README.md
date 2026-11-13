# Englisch lernen

Eine Tablet-App, mit der Kinder englische Vokabeln lernen: Ein Wort wird vorgelesen,
das Kind tippt aus vier Bildern das richtige an. Die Bilder werden per KI erzeugt.

## Benutzung

- **Spielen:** Auf ▶ tippen. Das Wort wird gesprochen und ausgeschrieben angezeigt, 🔊 wiederholt es. Für jedes Wort,
  das beim ersten Versuch richtig ist, gibt es einen Stern.
- **Einstellungen (⚙️, mit Rechenaufgabe für Eltern gesichert):**
  - Vokabeln eintragen – ein Wort pro Zeile, optional mit Hinweis in Klammern, z. B. `bat (animal)`.
  - Bei „Bild-KI“ Anbieter (OpenAI oder Google Gemini) wählen und den eigenen API-Schlüssel eintragen.
    Danach wird für jedes neue Wort automatisch ein Bild erzeugt.
  - Pro Wort: anhören 🔊, Bild neu erzeugen 🔄, eigenes Foto verwenden 📷, löschen 🗑️.
  - Stimme, Sprechtempo und Wörter pro Runde einstellen.

Zum Spielen werden mindestens 4 Wörter mit Bild benötigt.

## Speicherung auf dem Server (Firebase)

Damit Vokabeln und Bilder auf allen Geräten gleich sind, speichert die App sie in
Google Firebase (Firestore, kostenloser „Spark“-Tarif genügt). Einmalige Einrichtung:

1. Auf <https://console.firebase.google.com> ein Projekt anlegen.
2. **Build → Firestore Database → Datenbank erstellen** (Produktionsmodus, Standort z. B. `eur3`).
3. Im Reiter **Regeln** den Inhalt von [`firestore.rules`](firestore.rules) einfügen, dort die eigene
   E-Mail-Adresse eintragen und veröffentlichen.
4. **Build → Authentication → Anmeldemethode**: „E-Mail/Passwort“ aktivieren. Im Reiter **Nutzer**
   einen Nutzer mit genau dieser E-Mail-Adresse und einem Passwort anlegen (das Eltern-Konto).
5. **Authentication → Einstellungen → Autorisierte Domains**: die Domain der App hinzufügen
   (z. B. `luisschueller.github.io`).
6. **Projekteinstellungen → Meine Apps → Web-App (`</>`) registrieren** und die angezeigten
   `firebaseConfig`-Werte in [`js/config.js`](js/config.js) eintragen.

Danach kann jedes Gerät die Vokabeln lesen und spielen; ändern kann sie nur, wer sich in den
Einstellungen mit dem Eltern-Konto anmeldet. Solange `js/config.js` leer ist, speichert die App
nur lokal auf dem Gerät.

Auf dem Gerät bleiben: API-Schlüssel der Bild-KI, Stimme/Tempo/Rundenlänge und der Lernstand (✓/✗).

## Technik

Reine Web-App (HTML/CSS/JavaScript, kein Build-Schritt, kein eigener Server):

- Vokabeln und Bilder liegen in Firestore (Bilder als verkleinerte JPEGs direkt im Dokument) und
  werden auf dem Gerät zwischengespeichert, sodass das Spiel auch ohne Internet läuft.
- Die Sprachausgabe nutzt die eingebaute englische Stimme des Geräts (Web Speech API).
- Der API-Schlüssel wird nur auf dem Gerät gespeichert; Bildanfragen gehen direkt vom Gerät an den Anbieter.
### Lokal starten

```bash
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Für das Tablet die Dateien auf einem beliebigen
statischen Webspace mit HTTPS bereitstellen (z. B. GitHub Pages) und im Browser
„Zum Startbildschirm hinzufügen“ wählen – dann läuft die App im Vollbild.
