// KI-Bildgenerierung. Der Aufruf geht direkt vom Tablet an den gewählten Anbieter.

export const PROVIDERS = {
  openai: { label: 'OpenAI', defaultModel: 'gpt-image-1-mini' },
  gemini: { label: 'Google Gemini', defaultModel: 'gemini-2.5-flash-image' },
};

function buildPrompt(word, hint) {
  const subject = hint ? `"${word}" (${hint})` : `"${word}"`;
  return (
    `A simple, friendly, colorful cartoon illustration showing the meaning of the English word ${subject}, ` +
    `as a picture card for young children learning vocabulary. One clear subject, centered, ` +
    `plain white background, bold outlines, flat bright colors. ` +
    `Absolutely no text, no letters, no words, no numbers, no labels in the image.`
  );
}

async function fail(res) {
  let msg = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    msg = body.error?.message || msg;
  } catch { /* keine JSON-Antwort */ }
  throw new Error(msg);
}

function b64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function openai(prompt, key, model) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024', quality: 'low' }),
  });
  if (!res.ok) await fail(res);
  const b64 = (await res.json()).data?.[0]?.b64_json;
  if (!b64) throw new Error('Antwort enthielt kein Bild');
  return b64ToBlob(b64, 'image/png');
}

async function gemini(prompt, key, model) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) await fail(res);
  const parts = (await res.json()).candidates?.[0]?.content?.parts || [];
  const img = parts.map((p) => p.inlineData || p.inline_data).find(Boolean);
  if (!img) throw new Error('Antwort enthielt kein Bild');
  return b64ToBlob(img.data, img.mimeType || img.mime_type || 'image/png');
}

/** Verkleinert auf 512×512 JPEG und liefert eine Data-URL (ca. 30–80 kB, passt in ein Firestore-Dokument). */
export async function shrink(blob, size = 512) {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  const scale = Math.max(size / bmp.width, size / bmp.height); // quadratisch zuschneiden
  const w = bmp.width * scale;
  const h = bmp.height * scale;
  ctx.drawImage(bmp, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function generateImage(word, hint, settings) {
  if (!settings.apiKey) throw new Error('Kein API-Schlüssel hinterlegt');
  const provider = PROVIDERS[settings.provider] ? settings.provider : 'openai';
  const model = settings.model || PROVIDERS[provider].defaultModel;
  const prompt = buildPrompt(word, hint);
  const raw = await (provider === 'gemini' ? gemini : openai)(prompt, settings.apiKey, model);
  return shrink(raw);
}
