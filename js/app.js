import { loadSettings, saveSettings } from './db.js';
import { remote, initStore, saveWord, removeWord, signIn, signOut } from './store.js';
import { generateImage, shrink, PROVIDERS } from './imagegen.js';
import { speak, englishVoices, speechSupported, playRight, playWrong } from './speech.js';

const app = document.getElementById('app');
const MIN_WORDS = 4;

let settings = loadSettings();
let words = [];
let game = null;
let user = null; // angemeldeter Elternteil (nur mit Server-Speicher)
let view = 'home';
const runtime = new Map(); // Wort-ID -> { busy, error } (nur Laufzeit, wird nicht gespeichert)

// Lernstand bleibt pro Gerät, damit Kinder-Tablets nichts auf den Server schreiben müssen.
let stats = {};
try { stats = JSON.parse(localStorage.getItem('stats') || '{}'); } catch { /* leer starten */ }
function bumpStat(id, key) {
  stats[id] = { right: 0, wrong: 0, ...stats[id] };
  stats[id][key]++;
  localStorage.setItem('stats', JSON.stringify(stats));
}

// ---------- Hilfsfunktionen ----------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const imageUrl = (w) => w.image || '';
const rt = (id) => runtime.get(id) || {};
const canEdit = () => !remote || !!user;

function storeError(err) {
  alert(`Speichern auf dem Server fehlgeschlagen: ${err.message || err}`);
}

const playable = () => words.filter((w) => w.image);
const say = (text) => speak(text, settings);

// ---------- Startseite ----------

function renderHome() {
  game = null;
  view = 'home';
  const ready = playable().length >= MIN_WORDS;
  app.innerHTML = `
    <section class="home">
      <button class="icon-btn corner" data-act="settings" aria-label="Einstellungen">⚙️</button>
      <h1>Englisch lernen</h1>
      ${
        ready
          ? `<button class="play-btn" data-act="play" aria-label="Spiel starten">▶</button>`
          : `<p class="notice">Bitte zuerst in den Einstellungen (⚙️) mindestens ${MIN_WORDS} Wörter mit Bildern anlegen.</p>`
      }
      ${speechSupported() ? '' : '<p class="notice">Dieser Browser unterstützt leider keine Sprachausgabe.</p>'}
    </section>`;
}

// ---------- Spiel ----------

function startGame() {
  const pool = playable();
  if (pool.length < MIN_WORDS) return;
  view = 'game';
  game = { queue: shuffle(pool).slice(0, settings.roundLength), index: 0, stars: 0 };
  nextQuestion();
}

function nextQuestion() {
  const target = game.queue[game.index];
  const others = shuffle(playable().filter((w) => w.id !== target.id)).slice(0, MIN_WORDS - 1);
  game.target = target;
  game.options = shuffle([target, ...others]);
  game.firstTry = true;
  game.locked = false;
  app.innerHTML = `
    <section class="game">
      <header class="game-bar">
        <button class="icon-btn" data-act="home" aria-label="Beenden">✖</button>
        <div class="dots">${game.queue
          .map((_, i) => `<span class="dot ${i < game.index ? 'done' : i === game.index ? 'now' : ''}"></span>`)
          .join('')}</div>
        <div class="stars">⭐ ${game.stars}</div>
      </header>
      <div class="game-body">
        <button class="speak-btn" data-act="repeat" aria-label="Wort noch einmal hören">🔊</button>
        <div class="cards">${game.options
          .map((w) => `<button class="card" data-act="pick" data-id="${w.id}"><img src="${imageUrl(w)}" alt="" draggable="false"></button>`)
          .join('')}</div>
      </div>
    </section>`;
  say(target.word);
}

function pick(btn) {
  if (!game || game.locked || btn.disabled) return;
  const target = game.target;
  if (btn.dataset.id === target.id) {
    game.locked = true;
    btn.classList.add('right');
    playRight();
    if (game.firstTry) {
      game.stars++;
      bumpStat(target.id, 'right');
    }
    setTimeout(() => {
      if (!game) return;
      game.index++;
      if (game.index >= game.queue.length) renderResult();
      else nextQuestion();
    }, 1300);
  } else {
    btn.classList.add('wrong');
    btn.disabled = true;
    playWrong();
    if (game.firstTry) {
      game.firstTry = false;
      bumpStat(target.id, 'wrong');
    }
    setTimeout(() => game && !game.locked && say(target.word), 600);
  }
}

function renderResult() {
  const { stars, queue } = game;
  game = null;
  view = 'result';
  app.innerHTML = `
    <section class="home">
      <h1>Super! 🎉</h1>
      <p class="result-stars">${'⭐'.repeat(stars) || '💪'}</p>
      <p class="result-text">${stars} / ${queue.length}</p>
      <div class="row">
        <button class="play-btn" data-act="play" aria-label="Noch einmal">▶</button>
        <button class="icon-btn big" data-act="home" aria-label="Startseite">🏠</button>
      </div>
    </section>`;
  playRight();
}

// ---------- Elternsperre ----------

function askParentGate() {
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  const dlg = document.createElement('dialog');
  dlg.className = 'gate';
  dlg.innerHTML = `
    <form method="dialog">
      <h2>Nur für Eltern</h2>
      <p>Wie viel ist ${a} × ${b}?</p>
      <input name="answer" inputmode="numeric" autocomplete="off" autofocus>
      <div class="row">
        <button type="button" class="btn ghost" data-cancel>Abbrechen</button>
        <button value="ok" type="submit" class="btn">Weiter</button>
      </div>
    </form>`;
  document.body.append(dlg);
  dlg.querySelector('[data-cancel]').onclick = () => dlg.close('cancel');
  dlg.addEventListener('close', () => {
    const ok = dlg.returnValue === 'ok' && Number(dlg.querySelector('input').value) === a * b;
    dlg.remove();
    if (ok) renderSettings();
  });
  dlg.showModal();
}

// ---------- Einstellungen ----------

function renderSettings() {
  game = null;
  view = 'settings';
  const voices = englishVoices();
  app.innerHTML = `
    <section class="settings">
      <header class="settings-bar">
        <button class="btn ghost" data-act="home">← Zurück</button>
        <h1>Einstellungen</h1>
      </header>

      ${canEdit() ? editPanels() : loginPanel()}

      <div class="panel">
        <h2>Sprache &amp; Spiel</h2>
        <label>Stimme
          <select id="set-voice">
            <option value="">Automatisch (Englisch)</option>
            ${voices
              .map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === settings.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`)
              .join('')}
          </select>
        </label>
        <label>Sprechtempo: <span id="rate-val">${settings.rate}</span>
          <input id="set-rate" type="range" min="0.5" max="1.2" step="0.05" value="${settings.rate}">
        </label>
        <label>Wörter pro Runde
          <input id="set-round" type="number" min="3" max="30" value="${settings.roundLength}">
        </label>
        <button class="btn ghost" data-act="test-voice">🔊 Stimme testen</button>
      </div>
    </section>`;
  renderWordList();
}

function loginPanel() {
  return `
      <form class="panel" id="login-form">
        <h2>Anmeldung</h2>
        <p class="help">Die Vokabeln liegen auf dem Server. Zum Bearbeiten bitte mit dem Eltern-Konto anmelden.</p>
        <label>E-Mail <input id="login-email" type="email" autocomplete="username" required></label>
        <label>Passwort <input id="login-password" type="password" autocomplete="current-password" required></label>
        <p class="error" id="login-error"></p>
        <button class="btn" type="submit">Anmelden</button>
      </form>`;
}

function editPanels() {
  return `
      <div class="panel">
        <h2>Vokabeln hinzufügen</h2>
        <p class="help">Ein englisches Wort pro Zeile (oder mit Komma getrennt). Bei mehrdeutigen Wörtern
          hilft ein Hinweis in Klammern, z.&nbsp;B. <code>bat (animal)</code>. Das Bild wird automatisch erzeugt.</p>
        <textarea id="new-words" rows="3" placeholder="apple&#10;dog&#10;bat (animal)" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea>
        <button class="btn" data-act="add">Hinzufügen</button>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>Meine Vokabeln <span id="word-count" class="count"></span></h2>
          <button class="btn ghost" data-act="gen-missing">Fehlende Bilder erzeugen</button>
        </div>
        <ul id="word-list" class="word-list"></ul>
      </div>

      <div class="panel">
        <h2>Bild-KI</h2>
        <label>Anbieter
          <select id="set-provider">${Object.entries(PROVIDERS)
            .map(([id, p]) => `<option value="${id}" ${id === settings.provider ? 'selected' : ''}>${p.label}</option>`)
            .join('')}</select>
        </label>
        <label>API-Schlüssel
          <input id="set-key" type="password" value="${esc(settings.apiKey)}" autocomplete="off" placeholder="wird nur auf diesem Gerät gespeichert">
        </label>
        <label>Modell (optional)
          <input id="set-model" value="${esc(settings.model)}" autocomplete="off" autocapitalize="off" placeholder="${esc(PROVIDERS[settings.provider].defaultModel)}">
        </label>
      </div>
      ${
        remote
          ? `<div class="panel"><p class="help">Angemeldet als ${esc(user.email)}. Vokabeln und Bilder werden auf dem Server gespeichert und erscheinen auf allen Geräten.</p>
             <button class="btn ghost" data-act="logout">Abmelden</button></div>`
          : `<div class="panel"><p class="help">Es ist noch kein Server eingerichtet – Vokabeln und Bilder werden nur auf diesem Gerät gespeichert.</p></div>`
      }`;
}

function renderWordList() {
  const list = document.getElementById('word-list');
  if (!list) return;
  document.getElementById('word-count').textContent = `(${words.length})`;
  if (!words.length) {
    list.innerHTML = '<li class="empty">Noch keine Vokabeln angelegt.</li>';
    return;
  }
  list.innerHTML = [...words]
    .sort((a, b) => a.word.localeCompare(b.word))
    .map((w) => {
      const { busy, error } = rt(w.id);
      const st = stats[w.id] || {};
      const thumb = busy
        ? '<div class="thumb"><span class="spinner"></span></div>'
        : w.image
          ? `<div class="thumb"><img src="${imageUrl(w)}" alt=""></div>`
          : '<div class="thumb missing">?</div>';
      const status = busy
        ? 'Bild wird erzeugt …'
        : error
          ? `<span class="error">Fehler: ${esc(error)}</span>`
          : w.image
            ? `✓ ${st.right || 0} · ✗ ${st.wrong || 0}`
            : 'Noch kein Bild';
      return `
        <li data-id="${w.id}">
          ${thumb}
          <div class="word-info">
            <strong>${esc(w.word)}</strong>${w.hint ? ` <span class="hint">(${esc(w.hint)})</span>` : ''}
            <small>${status}</small>
          </div>
          <div class="word-actions">
            <button class="icon-btn small" data-act="say" title="Anhören">🔊</button>
            <button class="icon-btn small" data-act="regen" title="Bild neu erzeugen" ${busy ? 'disabled' : ''}>🔄</button>
            <label class="icon-btn small" title="Eigenes Bild verwenden">📷<input type="file" accept="image/*" data-act="upload" hidden></label>
            <button class="icon-btn small" data-act="delete" title="Löschen">🗑️</button>
          </div>
        </li>`;
    })
    .join('');
}

function parseNewWords(text) {
  return text
    .split(/[\n,;]+/)
    .map((line) => {
      const m = line.trim().match(/^([^()]+?)\s*(?:\((.*)\))?$/);
      return m ? { word: m[1].trim(), hint: (m[2] || '').trim() } : null;
    })
    .filter((e) => e && e.word);
}

async function addWords() {
  const input = document.getElementById('new-words');
  const known = new Set(words.map((w) => w.word.toLowerCase()));
  const added = [];
  for (const { word, hint } of parseNewWords(input.value)) {
    if (known.has(word.toLowerCase())) continue;
    known.add(word.toLowerCase());
    const entry = { id: crypto.randomUUID(), word, hint, image: '' };
    words.push(entry);
    saveWord(entry).catch(storeError);
    added.push(entry);
  }
  input.value = '';
  renderWordList();
  if (settings.apiKey) added.forEach(enqueue);
}

// Bildgenerierung: höchstens zwei Anfragen gleichzeitig.
const queue = [];
const deleted = new Set();
let running = 0;

function enqueue(w) {
  if (rt(w.id).busy) return;
  runtime.set(w.id, { busy: true, error: '' });
  queue.push(w);
  renderWordList();
  pump();
}

function pump() {
  while (running < 2 && queue.length) {
    const w = queue.shift();
    running++;
    generate(w).finally(() => {
      running--;
      pump();
    });
  }
}

async function generate(w) {
  try {
    const image = await generateImage(w.word, w.hint, settings);
    runtime.delete(w.id);
    // Nicht gegen `words` prüfen: Die Liste kann gerade ein Zwischenstand vom Server sein.
    if (!deleted.has(w.id)) setImage(w, image);
  } catch (err) {
    runtime.set(w.id, { busy: false, error: err.message || String(err) });
  }
  renderWordList();
}

function setImage(w, image) {
  const current = words.find((x) => x.id === w.id) || w;
  current.image = image;
  // Nicht auf die Server-Bestätigung warten (kommt offline erst später), nur Fehler melden.
  saveWord(current).catch(storeError);
}

function readSettingsForm() {
  const provider = document.getElementById('set-provider').value;
  settings = {
    ...settings,
    provider,
    apiKey: document.getElementById('set-key').value.trim(),
    model: document.getElementById('set-model').value.trim(),
    voiceURI: document.getElementById('set-voice').value,
    rate: Number(document.getElementById('set-rate').value),
    roundLength: Math.min(30, Math.max(3, Number(document.getElementById('set-round').value) || 10)),
  };
  document.getElementById('set-model').placeholder = PROVIDERS[provider].defaultModel;
  document.getElementById('rate-val').textContent = settings.rate;
  saveSettings(settings);
}

// ---------- Ereignisse ----------

app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  const row = el.closest('li[data-id]');
  const word = row && words.find((w) => w.id === row.dataset.id);
  switch (el.dataset.act) {
    case 'play': return startGame();
    case 'home': window.speechSynthesis?.cancel(); return renderHome();
    case 'settings': return askParentGate();
    case 'repeat': return game && say(game.target.word);
    case 'pick': return pick(el);
    case 'add': return addWords();
    case 'test-voice': return say('Hello! Let us learn English.');
    case 'gen-missing':
      if (!settings.apiKey) return alert('Bitte zuerst unten bei „Bild-KI“ einen API-Schlüssel eintragen.');
      return words.filter((w) => !w.image).forEach(enqueue);
    case 'say': return word && say(word.word);
    case 'regen':
      if (!settings.apiKey) return alert('Bitte zuerst unten bei „Bild-KI“ einen API-Schlüssel eintragen.');
      return word && enqueue(word);
    case 'delete':
      if (!word || !confirm(`„${word.word}“ wirklich löschen?`)) return;
      words = words.filter((w) => w !== word);
      runtime.delete(word.id);
      deleted.add(word.id);
      removeWord(word.id).catch(storeError);
      return renderWordList();
    case 'logout': return signOut();
  }
});

app.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.act === 'upload') {
    const word = words.find((w) => w.id === el.closest('li[data-id]')?.dataset.id);
    const file = el.files[0];
    if (!word || !file) return;
    try {
      runtime.delete(word.id);
      setImage(word, await shrink(file));
    } catch (err) {
      runtime.set(word.id, { busy: false, error: err.message || String(err) });
    }
    return renderWordList();
  }
  if (el.id?.startsWith('set-')) readSettingsForm();
});

app.addEventListener('input', (e) => {
  if (e.target.id === 'set-rate') document.getElementById('rate-val').textContent = e.target.value;
});

// ---------- Start ----------

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

app.addEventListener('submit', async (e) => {
  if (e.target.id !== 'login-form') return;
  e.preventDefault();
  const error = document.getElementById('login-error');
  error.textContent = '';
  try {
    await signIn(document.getElementById('login-email').value.trim(), document.getElementById('login-password').value);
  } catch {
    error.textContent = 'Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.';
  }
});

// Neue Daten vom Speicher (bei Server-Speicher auch Änderungen von anderen Geräten).
function onWords(list) {
  words = list;
  if (view === 'home') renderHome();
  else if (view === 'settings') renderWordList();
}

function onAuth(u) {
  user = u;
  if (view === 'settings') renderSettings();
}

app.innerHTML = '<section class="home"><span class="spinner"></span></section>';
try {
  await initStore({ onWords, onAuth });
  if (view === 'home') renderHome();
} catch (err) {
  app.innerHTML = `<section class="home"><p class="notice">Die Vokabeln konnten nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.<br><small>${esc(err.message || err)}</small></p></section>`;
}
