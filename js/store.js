// Server-Speicher (Firebase Firestore), auf dem Gerät zwischengespeichert für Offline-Betrieb.
//   children/{kindId}                { name, created }
//   children/{kindId}/words/{wortId} { word, hint, image }   (Bild als JPEG-Data-URL)
//   words/{wortId}                   frühere gemeinsame Liste, nur noch zum Übernehmen
import { firebaseConfig } from './config.js';

const CDN = 'https://www.gstatic.com/firebasejs/12.6.0';
const [{ initializeApp }, fs] = await Promise.all([
  import(`${CDN}/firebase-app.js`),
  import(`${CDN}/firebase-firestore.js`),
]);

let db;
let childId = null;
let unsubscribeWords = null;

const wordsOf = (id) => fs.collection(db, 'children', id, 'words');
const toList = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** onChildren(liste) wird bei jeder Änderung der Kinderliste aufgerufen. */
export function initStore({ onChildren }) {
  const { emulator, ...options } = firebaseConfig;
  db = fs.initializeFirestore(initializeApp(options), {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });
  if (emulator) fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return new Promise((resolve, reject) => {
    fs.onSnapshot(
      fs.collection(db, 'children'),
      (snap) => {
        onChildren(toList(snap).sort((a, b) => (a.created || 0) - (b.created || 0)));
        resolve();
      },
      reject
    );
  });
}

/** Wechselt zur Vokabelliste eines Kindes; onWords(liste) bei jeder Änderung (auch von anderen Geräten). */
export function selectChild(id, onWords) {
  unsubscribeWords?.();
  childId = id;
  return new Promise((resolve, reject) => {
    unsubscribeWords = fs.onSnapshot(
      wordsOf(id),
      (snap) => {
        if (childId !== id) return;
        onWords(toList(snap));
        resolve();
      },
      reject
    );
  });
}

export function saveChild({ id, name, created }) {
  return fs.setDoc(fs.doc(db, 'children', id), { name, created });
}

export async function removeChild(id) {
  if (childId === id) {
    unsubscribeWords?.();
    unsubscribeWords = null;
    childId = null;
  }
  const snap = await fs.getDocs(wordsOf(id));
  await Promise.all([...snap.docs.map((d) => fs.deleteDoc(d.ref)), fs.deleteDoc(fs.doc(db, 'children', id))]);
}

// Wörter tragen die ID ihres Kindes (w.child), damit z. B. ein gerade erzeugtes Bild auch nach
// einem Wechsel des Kindes in der richtigen Liste landet.
export function saveWord(w) {
  return fs.setDoc(fs.doc(wordsOf(w.child), w.id), { word: w.word, hint: w.hint || '', image: w.image || '' });
}

export function removeWord(w) {
  return fs.deleteDoc(fs.doc(wordsOf(w.child), w.id));
}

/** Vokabeln der früheren gemeinsamen Liste (vor Einführung der Kinder). */
export async function legacyWords() {
  return toList(await fs.getDocs(fs.collection(db, 'words')));
}
