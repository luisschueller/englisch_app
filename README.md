# Englisch lernen

Eine Tablet-App, mit der Kinder englische Vokabeln lernen: Ein Wort wird vorgelesen,
das Kind tippt aus vier Bildern das richtige an. Die Bilder werden per KI erzeugt.

## Benutzung

- **Spielen:** Auf ▶ tippen. Das Wort wird gesprochen, 🔊 wiederholt es. Für jedes Wort,
  das beim ersten Versuch richtig ist, gibt es einen Stern.
- **Einstellungen (⚙️, mit Rechenaufgabe für Eltern gesichert):**
  - Vokabeln eintragen – ein Wort pro Zeile, optional mit Hinweis in Klammern, z. B. `bat (animal)`.
  - Bei „Bild-KI“ Anbieter (OpenAI oder Google Gemini) wählen und den eigenen API-Schlüssel eintragen.
    Danach wird für jedes neue Wort automatisch ein Bild erzeugt.
  - Pro Wort: anhören 🔊, Bild neu erzeugen 🔄, eigenes Foto verwenden 📷, löschen 🗑️.
  - Stimme, Sprechtempo und Wörter pro Runde einstellen.

Zum Spielen werden mindestens 4 Wörter mit Bild benötigt.

## Technik

Reine Web-App (HTML/CSS/JavaScript, kein Build-Schritt, kein Server):

- Vokabeln und Bilder liegen in der IndexedDB des Tablets, Einstellungen im `localStorage`.
- Die Sprachausgabe nutzt die eingebaute englische Stimme des Geräts (Web Speech API).
- Der API-Schlüssel wird nur auf dem Gerät gespeichert; Bildanfragen gehen direkt vom Tablet an den Anbieter.

### Lokal starten

```bash
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Für das Tablet die Dateien auf einem beliebigen
statischen Webspace mit HTTPS bereitstellen (z. B. GitHub Pages) und im Browser
„Zum Startbildschirm hinzufügen“ wählen – dann läuft die App im Vollbild.
