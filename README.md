# Englisch lernen

Eine Tablet-App, mit der Kinder englische Vokabeln lernen: Ein Wort wird vorgelesen,
das Kind tippt aus vier Bildern das richtige an. Die Bilder werden per KI erzeugt.

## Benutzung

- **Kind auswählen:** Beim Start fragt die App „Wer spielt?“. Über „Neues Kind“ (mit Rechenaufgabe
  für Eltern gesichert) wird ein weiteres Kind angelegt. Jedes Kind hat seine eigene Vokabelliste.
- **Spielen:** Auf ▶ tippen. Das Wort wird gesprochen und ausgeschrieben angezeigt, 🔊 wiederholt es.
  Bei einem falschen Bild wird dessen Wort vorgelesen und eingeblendet. Für jedes Wort, das beim
  ersten Versuch richtig ist, gibt es einen Stern.
- **Einstellungen (⚙️, mit Rechenaufgabe für Eltern gesichert)** – gelten für das ausgewählte Kind:
  - Vokabeln eintragen – ein Wort pro Zeile, optional mit Hinweis in Klammern, z. B. `bat (animal)`.
  - Bei „Bild-KI“ Anbieter (OpenAI oder Google Gemini) wählen und den eigenen API-Schlüssel eintragen.
    Danach wird für jedes neue Wort automatisch ein Bild erzeugt.
  - Pro Wort: anhören 🔊, Bild neu erzeugen 🔄, eigenes Foto verwenden 📷, löschen 🗑️.
  - Stimme, Sprechtempo und Wörter pro Runde einstellen.
  - Kind löschen.

Zum Spielen werden mindestens 4 Wörter mit Bild benötigt.

## Speicherung auf dem Server (Firebase)

Kinder, Vokabeln und Bilder liegen in Google Firebase (Firestore, kostenloser „Spark“-Tarif genügt)
und sind damit auf allen Geräten gleich. Einmalige Einrichtung:

1. Auf <https://console.firebase.google.com> ein Projekt anlegen.
2. **Build → Firestore Database → Datenbank erstellen** (Produktionsmodus, Standort z. B. `eur3`).
3. Im Reiter **Regeln** den Inhalt von [`firestore.rules`](firestore.rules) einfügen und veröffentlichen.
4. **Projekteinstellungen → Meine Apps → Web-App (`</>`) registrieren** und die angezeigten
   `firebaseConfig`-Werte in [`js/config.js`](js/config.js) eintragen.

Es gibt keine Anmeldung: Jeder, der die Adresse der App kennt, kann Kinder und Vokabeln sehen,
ändern und löschen. Die Rechenaufgabe schützt nur vor versehentlichen Änderungen durch Kinder.

Auf dem Gerät bleiben: API-Schlüssel der Bild-KI, Stimme/Tempo/Rundenlänge und der Lernstand (✓/✗).

## Technik

Reine Web-App (HTML/CSS/JavaScript, kein Build-Schritt, kein eigener Server):

- Daten liegen in Firestore (`children/{Kind}/words/{Wort}`, Bilder als verkleinerte JPEGs direkt im
  Dokument) und werden auf dem Gerät zwischengespeichert, sodass das Spiel auch ohne Internet läuft.
- Die Sprachausgabe nutzt die eingebaute englische Stimme des Geräts (Web Speech API).
- Der API-Schlüssel wird nur auf dem Gerät gespeichert; Bildanfragen gehen direkt vom Gerät an den Anbieter.

### Lokal starten

```bash
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Für das Tablet die Dateien auf einem beliebigen
statischen Webspace mit HTTPS bereitstellen (z. B. GitHub Pages) und im Browser
„Zum Startbildschirm hinzufügen“ wählen – dann läuft die App im Vollbild.
