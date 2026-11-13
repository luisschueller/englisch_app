// Server-Speicher (Firebase Firestore), auf dem Gerät zwischengespeichert für Offline-Betrieb.
//   sets/{setId}                 { name, created }            Vokabel-Sets, gelten für die ganze App
//   sets/{setId}/words/{wortId}  { word, hint, image }        (Bild als JPEG-Data-URL)
//   children/{kindId}            { name, created, sets: [setId, …] }   welche Sets das Kind übt
// Altbestand, wird nur noch gelesen: children/{kindId}/words (Liste je Kind) und words (gemeinsame Liste).
import { firebaseConfig } from './config.js';

const CDN = 'https://www.gstatic.com/firebasejs/12.6.0';
const [{ initializeApp }, fs] = await Promise.all([
  import(`${CDN}/firebase-app.js`),
  import(`${CDN}/firebase-firestore.js`),
]);

let db;
let stopWatching = () => {};

const setWords = (id) => fs.collection(db, 'sets', id, 'words');
const toList = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const byCreated = (a, b) => (a.created || 0) - (b.created || 0);

/** onChildren(liste) / onSets(liste) werden bei jeder Änderung aufgerufen (auch von anderen Geräten). */
export function initStore({ onChildren, onSets }) {
  const { emulator, ...options } = firebaseConfig;
  db = fs.initializeFirestore(initializeApp(options), {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });
  if (emulator) fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const listen = (name, cb) =>
    new Promise((resolve, reject) => {
      fs.onSnapshot(
        fs.collection(db, name),
        (snap) => {
          cb(toList(snap).sort(byCreated));
          resolve();
        },
        reject
      );
    });
  return Promise.all([listen('children', onChildren), listen('sets', onSets)]);
}

/** Beobachtet die Wörter der angegebenen Sets; onWords(liste) bei jeder Änderung. Ersetzt die vorige Beobachtung. */
export function watchWords(setIds, onWords) {
  stopWatching();
  const lists = new Map();
  let active = true;
  const emit = () => active && lists.size === setIds.length && onWords([...lists.values()].flat());
  const stops = [];
  stopWatching = () => {
    active = false;
    stops.forEach((stop) => stop());
  };
  if (!setIds.length) {
    onWords([]);
    return Promise.resolve();
  }
  return Promise.all(
    setIds.map(
      (id) =>
        new Promise((resolve, reject) => {
          stops.push(
            fs.onSnapshot(
              setWords(id),
              (snap) => {
                lists.set(id, toList(snap).map((w) => ({ ...w, set: id })));
                emit();
                resolve();
              },
              reject
            )
          );
        })
    )
  );
}

export function saveChild({ id, name, created, sets = [] }) {
  return fs.setDoc(fs.doc(db, 'children', id), { name, created, sets });
}

export async function removeChild(id) {
  const old = await fs.getDocs(fs.collection(db, 'children', id, 'words')); // Altbestand mit aufräumen
  await Promise.all([...old.docs.map((d) => fs.deleteDoc(d.ref)), fs.deleteDoc(fs.doc(db, 'children', id))]);
}

export function saveSet({ id, name, created }) {
  return fs.setDoc(fs.doc(db, 'sets', id), { name, created });
}

export async function removeSet(id) {
  const snap = await fs.getDocs(setWords(id));
  await Promise.all([...snap.docs.map((d) => fs.deleteDoc(d.ref)), fs.deleteDoc(fs.doc(db, 'sets', id))]);
}

// Wörter tragen die ID ihres Sets (w.set), damit z. B. ein gerade erzeugtes Bild auch nach
// einem Wechsel der Ansicht im richtigen Set landet.
export function saveWord(w) {
  return fs.setDoc(fs.doc(setWords(w.set), w.id), { word: w.word, hint: w.hint || '', image: w.image || '' });
}

export function removeWord(w) {
  return fs.deleteDoc(fs.doc(setWords(w.set), w.id));
}

/** Frühere Vokabelliste eines Kindes (aus der Zeit, als jedes Kind eine eigene Liste hatte). */
export async function oldChildWords(childId) {
  return toList(await fs.getDocs(fs.collection(db, 'children', childId, 'words')));
}

/** Vokabeln der früheren gemeinsamen Liste (vor Einführung der Kinder). */
export async function legacyWords() {
  return toList(await fs.getDocs(fs.collection(db, 'words')));
}
