// Speicher für Vokabeln + Bilder: Server (Firebase), sobald in config.js eingerichtet, sonst lokal.
import { firebaseConfig } from './config.js';

export const remote = !!firebaseConfig;
let impl;

/** onWords(liste) wird bei jeder Änderung aufgerufen, onAuth(user|null) bei An-/Abmeldung. */
export async function initStore({ onWords, onAuth }) {
  impl = await (remote ? import('./store-firebase.js') : import('./store-local.js'));
  return impl.init({ onWords, onAuth, config: firebaseConfig });
}

export const saveWord = (w) => impl.save({ id: w.id, word: w.word, hint: w.hint || '', image: w.image || '' });
export const removeWord = (id) => impl.remove(id);
export const signIn = (email, password) => impl.signIn(email, password);
export const signOut = () => impl.signOut();
