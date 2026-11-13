// Sprachausgabe über die im Tablet eingebaute Stimme (Web Speech API) + kleine Töne.
const synth = window.speechSynthesis;
let voices = [];

function loadVoices() {
  voices = (synth?.getVoices() || []).filter((v) => v.lang.toLowerCase().startsWith('en'));
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}

export const englishVoices = () => voices;
export const speechSupported = () => !!synth;

export function speak(text, { voiceURI, rate = 0.85 } = {}) {
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = voices.find((v) => v.voiceURI === voiceURI);
  u.lang = voice ? voice.lang : 'en-GB';
  if (voice) u.voice = voice;
  u.rate = rate;
  synth.speak(u);
}

let audioCtx;
function tone(freq, start, dur, type = 'sine') {
  audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const t = audioCtx.currentTime + start;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export function playRight() {
  try { tone(660, 0, 0.15); tone(880, 0.12, 0.15); tone(1320, 0.24, 0.3); } catch { /* kein Audio */ }
}
export function playWrong() {
  try { tone(220, 0, 0.3, 'triangle'); } catch { /* kein Audio */ }
}
