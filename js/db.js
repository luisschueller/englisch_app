// Vokabeln + Bilder liegen in IndexedDB (Bilder als Blob), Einstellungen in localStorage.
const STORE = 'words';
let dbPromise;

function open() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('englisch-app', 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const allWords = () => tx('readonly', (s) => s.getAll());
export const putWord = (w) => tx('readwrite', (s) => s.put(w));
export const deleteWord = (id) => tx('readwrite', (s) => s.delete(id));

const DEFAULTS = {
  provider: 'openai',
  apiKey: '',
  model: '',
  voiceURI: '',
  rate: 0.85,
  roundLength: 10,
};

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('settings') || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  localStorage.setItem('settings', JSON.stringify(s));
}
