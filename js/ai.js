// AI studio images: turns a product photo into a clean, minimal studio image with Google's
// Gemini image model (Google AI Studio API key). The key is stored in Firestore under
// private/ai, which only the owner account can read (see firestore.rules).
// The admin always compares the result with the original photo before using it.

export const DEFAULT_MODEL = 'gemini-2.5-flash-image';
const API = 'https://generativelanguage.googleapis.com/v1beta';
export const MODEL_RE = /^[a-z0-9][a-z0-9.\-]{1,79}$/;
export const KEY_RE = /^[A-Za-z0-9._\-]{20,200}$/; // classic "AIza…" keys and newer "AQ.…" keys

export const PROMPT = [
  'Turn this photo into a clean, minimal e-commerce studio product image.',
  'The product must stay 100% identical to the photo: exactly the same shape, proportions, size relationships, colour, surface texture, edges, holes, markings, printed text and logos.',
  'Do not add, remove, straighten, repair, beautify or redesign any part of the product. Do not invent details that are not visible.',
  'Only change the surroundings: pure white seamless background, soft even studio lighting, a subtle soft shadow under the product.',
  'Keep the same camera angle. Center the product so it fills about 75% of a square 1:1 frame.',
  'No props, no people, no text, no watermark.',
].join(' ');

function parseDataUrl(src) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(src || '');
  if (!m) throw new Error('This photo cannot be sent to the AI. Upload it again as JPG, PNG or WEBP.');
  return { mime: m[1], data: m[2] };
}
async function call(path, key, body) {
  const res = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: Object.assign({ 'x-goog-api-key': key }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
    referrerPolicy: 'strict-origin',
  });
  let j = {}; try { j = await res.json(); } catch (e) { /* not json */ }
  if (!res.ok) {
    const msg = (j.error && j.error.message) || ('AI request failed (' + res.status + ').');
    if (res.status === 400 && /API key/i.test(msg)) throw new Error('The API key was not accepted. Check it in Account › AI images.');
    if (res.status === 403) throw new Error('This API key is not allowed to do that. Check the key restrictions in Google AI Studio / Google Cloud.');
    if (res.status === 429) throw new Error('AI limit reached for now. Image generation may need billing turned on in Google AI Studio, or wait and try again.');
    throw new Error(msg.length > 220 ? msg.slice(0, 220) + '…' : msg);
  }
  return j;
}
// Models on this key that can output images (names containing "image").
export async function listImageModels(key) {
  const j = await call('/models?pageSize=200', key);
  return (j.models || [])
    .filter(m => /image/i.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''))
    .filter(n => MODEL_RE.test(n));
}
export async function makeStudioImage(cfg, srcDataUrl, extra = '') {
  if (!cfg || !KEY_RE.test(cfg.key || '')) throw new Error('Add your Google AI Studio API key first (Account › AI images).');
  const model = MODEL_RE.test(cfg.model || '') ? cfg.model : DEFAULT_MODEL;
  const { mime, data } = parseDataUrl(srcDataUrl);
  const text = PROMPT + (extra ? ' Extra instruction from the shop owner (never change the product itself): ' + String(extra).slice(0, 300) : '');
  const j = await call('/models/' + encodeURIComponent(model) + ':generateContent', cfg.key, {
    contents: [{ role: 'user', parts: [{ text }, { inline_data: { mime_type: mime, data } }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  });
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  const img = parts.map(p => p.inlineData || p.inline_data).find(d => d && d.data);
  if (!img) {
    const why = (j.candidates && j.candidates[0] && j.candidates[0].finishReason) || (j.promptFeedback && j.promptFeedback.blockReason) || '';
    throw new Error('The AI did not return an image' + (why ? ' (' + why + ')' : '') + '. Try again, or try another photo.');
  }
  const outMime = /^image\/(png|jpeg|webp)$/.test(img.mimeType || img.mime_type || '') ? (img.mimeType || img.mime_type) : 'image/png';
  if (!/^[A-Za-z0-9+/=]+$/.test(img.data)) throw new Error('The AI returned an unreadable image.');
  return 'data:' + outMime + ';base64,' + img.data;
}
