// Geräte-Einstellungen (API-Schlüssel, Stimme, Rundenlänge) liegen im localStorage des Geräts.
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
