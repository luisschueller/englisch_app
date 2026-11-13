// Server-Speicher: Firestore-Sammlung "words", ein Dokument pro Vokabel (Bild als JPEG-Data-URL).
// Lesen darf jeder, schreiben nur der angemeldete Elternteil (siehe firestore.rules).
const CDN = 'https://www.gstatic.com/firebasejs/12.6.0';
const [{ initializeApp }, fs, au] = await Promise.all([
  import(`${CDN}/firebase-app.js`),
  import(`${CDN}/firebase-firestore.js`),
  import(`${CDN}/firebase-auth.js`),
]);

let db;
let auth;

export function init({ onWords, onAuth, config }) {
  const { emulator, ...options } = config;
  const app = initializeApp(options);
  // Lokaler Cache: Die App funktioniert nach dem ersten Laden auch ohne Internet.
  db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });
  auth = au.getAuth(app);
  if (emulator) {
    fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    au.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  au.onAuthStateChanged(auth, (user) => onAuth(user ? { email: user.email } : null));

  return new Promise((resolve, reject) => {
    fs.onSnapshot(
      fs.collection(db, 'words'),
      (snap) => {
        onWords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        resolve();
      },
      reject
    );
  });
}

export function save({ id, ...data }) {
  return fs.setDoc(fs.doc(db, 'words', id), data);
}

export function remove(id) {
  return fs.deleteDoc(fs.doc(db, 'words', id));
}

export async function signIn(email, password) {
  await au.signInWithEmailAndPassword(auth, email, password);
}

export const signOut = () => au.signOut(auth);
