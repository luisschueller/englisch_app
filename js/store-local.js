// Lokaler Speicher (IndexedDB) – nur in Gebrauch, solange kein Server eingerichtet ist.
import { allWords, putWord, deleteWord } from './db.js';

let words = [];
let notify = () => {};

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function init({ onWords }) {
  notify = () => onWords([...words]);
  words = await allWords();
  for (const w of words) {
    // Ältere Version speicherte Bilder als Blob.
    if (w.image instanceof Blob) {
      w.image = await toDataUrl(w.image);
      await putWord(w);
    }
  }
  notify();
}

export async function save(w) {
  words = [...words.filter((x) => x.id !== w.id), w];
  notify();
  await putWord(w);
}

export async function remove(id) {
  words = words.filter((x) => x.id !== id);
  notify();
  await deleteWord(id);
}

export const signIn = async () => {};
export const signOut = async () => {};
