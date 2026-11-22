// Kawya Group admin page.
import {
  MODE, adminApi, SECTIONS, DEFAULTS, normItem, normCategory, normSettings, normHome, normAbout, normTransport,
  safeImg, ID_RE, newId, str, mapEmbed, safeMapLink, digits,
  getMedia,
} from './data.js?v=202611221052';
import { h } from './ui.js?v=202611221052';
import { makeStudioImage, listImageModels, DEFAULT_MODEL, MODEL_RE, KEY_RE } from './ai.js?v=202611221052';

// Refuse to run inside a frame (clickjacking protection; GitHub Pages cannot send frame-ancestors headers).
if (window.top !== window.self) { document.documentElement.replaceChildren(); throw new Error('Admin cannot be framed'); }

const app = document.getElementById('app');
const SEC_LABEL = { concrete: 'Concrete items', transport: 'Transport (vehicles)', hardware: 'Hardware' };
let api = null, D = null, user = null, view = 'overview', dirty = false;

/* ------------------------------------------------------------------ */
/* Small UI helpers                                                    */
/* ------------------------------------------------------------------ */
const ICON = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  items: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  categories: '<path d="M4 5h6M4 12h6M4 19h6"/><path d="M14 5h6M17 12h3M17 19h3M14 5v14"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
  about: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6.5 8-6.5s7 2 8 6.5"/>',
  transport: '<path d="M2 6h11v10H2zM13 9h4.5l3.5 4v3h-8"/><circle cx="6" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  contact: '<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  account: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  out: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', del: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', move: '<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
function svg(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.9'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICON[name] || ''; // constant markup only
  return s;
}
const ib = (name, label, onclick, cls = '') => h('button', { class: 'ib ' + cls, type: 'button', title: label, 'aria-label': label, onclick }, svg(name));
function toast(msg, bad = false) {
  const t = h('div', { class: 'toast' + (bad ? ' bad' : '') }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => { t.style.transition = 'opacity .3s, transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(() => t.remove(), 320); }, bad ? 5200 : 2600);
}
function errMsg(e) {
  const c = (e && (e.code || e.message)) || '';
  if (/permission-denied|insufficient permissions/i.test(c)) return 'This account is not allowed to make changes. Check the owner UID in the Firestore rules.';
  if (/unavailable|network|offline/i.test(c)) return 'No internet connection. Please try again.';
  if (/resource-exhausted|quota/i.test(c)) return 'Daily free limit reached. Try again tomorrow or use smaller photos.';
  if (/too large|exceeds the maximum|invalid-argument/i.test(c)) return 'This is too large to save. Use fewer or smaller photos.';
  return (e && e.message && e.message.length < 140) ? e.message : 'Something went wrong. Please try again.';
}
function overlay(node, onClose, guard) {
  const scrim = h('div', { class: 'scrim' + (node.classList.contains('modal') ? ' top' : '') });
  const close = () => { scrim.remove(); node.remove(); document.removeEventListener('keydown', key); onClose && onClose(); };
  const ask = () => (guard ? guard() : close());
  const key = e => { if (e.key === 'Escape' && document.body.lastElementChild === node) ask(); };
  scrim.addEventListener('click', ask); document.addEventListener('keydown', key);
  document.body.append(scrim, node);
  return close;
}
function confirmBox(title, text, okLabel = 'Delete', danger = true) {
  return new Promise(res => {
    let done = false;
    const m = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, h('h3', null, title), h('p', null, text));
    const close = overlay(m, () => { if (!done) res(false); });
    m.append(h('div', { class: 'acts' }, h('button', { class: 'b ghost', onclick: () => close() }, 'Cancel'),
      h('button', { class: 'b ' + (danger ? 'red' : 'pri'), onclick: () => { done = true; res(true); close(); } }, okLabel)));
    m.querySelector('.b.ghost').focus();
  });
}
function promptBox(title, label, value = '', max = 60) {
  return new Promise(res => {
    let done = false;
    const input = h('input', { value, maxlength: String(max) });
    const m = h('form', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, h('h3', null, title), h('label', { class: 'f', style: { marginTop: '16px' } }, h('span', null, label), input));
    const close = overlay(m, () => { if (!done) res(null); });
    m.append(h('div', { class: 'acts' }, h('button', { class: 'b ghost', type: 'button', onclick: () => close() }, 'Cancel'), h('button', { class: 'b pri', type: 'submit' }, 'Save')));
    m.addEventListener('submit', e => { e.preventDefault(); const v = input.value.trim(); if (!v) { input.focus(); return; } done = true; res(v); close(); });
    setTimeout(() => { input.focus(); input.select(); });
  });
}
function selectBox(title, label, options, value) {
  return new Promise(res => {
    let done = false;
    const sel = h('select', null, options.map(o => h('option', { value: o.v, selected: o.v === value }, o.t)));
    const m = h('form', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, h('h3', null, title), h('label', { class: 'f', style: { marginTop: '16px' } }, h('span', null, label), sel));
    const close = overlay(m, () => { if (!done) res(null); });
    m.append(h('div', { class: 'acts' }, h('button', { class: 'b ghost', type: 'button', onclick: () => close() }, 'Cancel'), h('button', { class: 'b pri', type: 'submit' }, 'Move')));
    m.addEventListener('submit', e => { e.preventDefault(); done = true; res(sel.value); close(); });
  });
}

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */
function textF(label, value, { max = 200, area = false, hint = '', type = 'text', ph = '' } = {}) {
  const i = area ? h('textarea', { maxlength: String(max), placeholder: ph }) : h('input', { type, maxlength: String(max), placeholder: ph });
  i.value = value == null ? '' : value;
  return { el: h('label', { class: 'f' }, h('span', null, label), i, hint ? h('small', null, hint) : null), get: () => i.value.trim(), input: i };
}
function toggleF(label, value, hint = '') {
  const i = h('input', { type: 'checkbox', role: 'switch' }); i.checked = !!value;
  return { el: h('label', { class: 'tg' }, h('span', null, label, hint ? h('small', null, hint) : null), i), get: () => i.checked, input: i };
}
// rows of {a, b} with two inputs, or one input when keys.length === 1
function rowsF(label, rows, { keys = ['k', 'v'], ph = ['', ''], max = 8, lens = [40, 80], area = false } = {}) {
  const box = h('div', { class: 'pairs' });
  const add = h('button', { class: 'b ghost sm', type: 'button' }, '+ Add');
  const mk = (r = {}) => {
    const ins = keys.map((k, j) => { const x = h(area && j === keys.length - 1 ? 'textarea' : 'input', { maxlength: String(lens[j] || 80), placeholder: ph[j] || '' }); x.value = r[k] || ''; return x; });
    const row = h('div', { class: 'pr' + (keys.length === 1 ? ' one' : '') }, ins, ib('del', 'Remove', () => { row.remove(); upd(); markDirty(); }, 'red'));
    row._get = () => { const o = {}; keys.forEach((k, j) => { o[k] = ins[j].value.trim(); }); return o; };
    box.append(row);
  };
  const upd = () => { add.disabled = box.children.length >= max; };
  (rows || []).forEach(mk); upd();
  add.addEventListener('click', () => { mk(); upd(); markDirty(); box.lastChild.querySelector('input,textarea').focus(); });
  return { el: h('div', { class: 'f' }, h('span', null, label), box, h('div', null, add)), get: () => [...box.children].map(r => r._get()).filter(o => keys.some(k => o[k])) };
}

/* ------------------------------------------------------------------ */
/* Images: resize + re-encode in the browser (strips metadata and any  */
/* hidden payload), thumbnail kept in the doc, full image in /media.   */
/* ------------------------------------------------------------------ */
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
async function decode(file) {
  if (!OK_TYPES.includes(file.type)) throw new Error('Use a JPG, PNG or WEBP photo.');
  if (file.size > 25 * 1024 * 1024) throw new Error('That photo is too big (max 25 MB).');
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) {
    return await new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Could not read that photo.')); }; im.src = u; });
  }
}
function encode(src, maxSide, limit) {
  const w0 = src.width, h0 = src.height;
  let k = Math.min(1, maxSide / Math.max(w0, h0));
  for (let tries = 0; tries < 6; tries++) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
    for (let q = 0.86; q >= 0.5; q -= 0.08) {
      let u = c.toDataURL('image/webp', q);
      if (!u.startsWith('data:image/webp')) { // browser without WEBP encoding: JPEG on white
        const c2 = document.createElement('canvas'); c2.width = c.width; c2.height = c.height; const y = c2.getContext('2d');
        y.fillStyle = '#fff'; y.fillRect(0, 0, c2.width, c2.height); y.drawImage(c, 0, 0); u = c2.toDataURL('image/jpeg', q);
      }
      if (u.length <= limit) return u;
    }
    k *= 0.75;
  }
  throw new Error('Could not make this photo small enough.');
}
// Cut-out product shots (transparent or plain white background) are shown "contain" instead of "cover".
function isCutout(src) {
  const c = document.createElement('canvas'); c.width = 24; c.height = 24; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, 24, 24); const d = x.getImageData(0, 0, 24, 24).data;
  const px = (i, j) => { const o = (j * 24 + i) * 4; return [d[o], d[o + 1], d[o + 2], d[o + 3]]; };
  const corners = [px(0, 0), px(23, 0), px(0, 23), px(23, 23)];
  return corners.every(p => p[3] < 250) || corners.every(p => p[0] > 238 && p[1] > 238 && p[2] > 238);
}
async function processImage(file) {
  const bmp = await decode(file);
  return { t: encode(bmp, 520, 48000), full: encode(bmp, 1600, 880000), m: '', c: isCutout(bmp), label: '' };
}
function imagesF(label, list, { max = 8, labels = false, hint = '', single = false, ai = false } = {}) {
  let arr = (list || []).filter(o => o && (o.t || o.m)).map(o => ({ ...o }));
  const box = h('div', { class: 'imgs' + (single ? ' round' : '') });
  const file = h('input', { type: 'file', accept: OK_TYPES.join(','), multiple: !single, hidden: true });
  const draw = () => {
    box.replaceChildren();
    arr.forEach((o, i) => {
      const im = h('img', { alt: '' }); im.src = safeImg(o.t) || 'assets/img/mark.svg'; if (/^data:/.test(o.t) && !o.c) im.className = 'photo';
      const t = h('div', { class: 'ti' }, im, h('button', { class: 'x', type: 'button', 'aria-label': 'Remove photo', onclick: () => { arr.splice(i, 1); draw(); markDirty(); } }, '×'));
      if (!single && i === 0) t.append(h('span', { class: 'first' }, 'Main'));
      if (ai && (/^data:/.test(o.t) || o.m)) t.append(h('button', { class: 'aib', type: 'button', title: 'Make an AI studio image', 'aria-label': 'Make an AI studio image', onclick: () => studioFor(o, nu => { arr[i] = nu; draw(); markDirty(); }) }, '✦ AI'));
      if (labels) { const li = h('input', { value: o.label || '', placeholder: 'Label', maxlength: '80' }); li.addEventListener('input', () => { o.label = li.value; }); t.append(li); }
      else if (!single && arr.length > 1) t.append(h('div', { class: 'mv' },
        i > 0 ? h('button', { type: 'button', 'aria-label': 'Move left', onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; draw(); markDirty(); } }, '‹') : null,
        i < arr.length - 1 ? h('button', { type: 'button', 'aria-label': 'Move right', onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; draw(); markDirty(); } }, '›') : null));
      box.append(t);
    });
    if (arr.length < max) box.append(h('button', { class: 'add', type: 'button', onclick: () => file.click() }, h('span', null, h('b', null, '+'), single && arr.length ? 'Replace' : 'Add photo')));
  };
  file.addEventListener('change', async () => {
    const files = [...file.files].slice(0, max - arr.length || 1); file.value = '';
    if (!files.length) return;
    box.classList.add('busy');
    for (const f of files) {
      try { const o = await processImage(f); if (single) arr = [o]; else if (arr.length < max) arr.push(o); }
      catch (e) { toast(e.message || 'Could not use that photo.', true); }
    }
    box.classList.remove('busy'); draw(); markDirty();
  });
  draw();
  return { el: h('div', { class: 'f' }, h('span', null, label), box, file, hint ? h('small', null, hint) : null), get: () => arr };
}
// Upload pending full images, return clean list + ids added (for rollback).
async function commitImages(arr) {
  const added = [], out = [];
  for (const o of arr) {
    let m = o.m;
    if (o.full) { m = await api.addMedia(o.full); added.push(m); o.m = m; delete o.full; }
    out.push({ t: safeImg(o.t), m: ID_RE.test(m || '') ? m : '', c: o.c === true, label: str(o.label, 80) });
  }
  return { list: out, added };
}
const mediaIds = list => (list || []).map(o => o && o.m).filter(m => m && ID_RE.test(m));
async function dropMedia(ids) { for (const id of ids) { try { await api.removeMedia(id); } catch (e) { /* leftover media is harmless */ } } }

/* ------------------------------------------------------------------ */
/* AI studio image                                                     */
/* ------------------------------------------------------------------ */
let aiCfg = null;
async function getAiCfg() {
  if (aiCfg) return aiCfg;
  try { const d = await api.getPrivate('ai'); aiCfg = d && KEY_RE.test(d.key || '') ? { key: d.key, model: MODEL_RE.test(d.model || '') ? d.model : DEFAULT_MODEL } : null; }
  catch (e) { aiCfg = null; }
  return aiCfg;
}
function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Could not read the AI image.')); im.src = src; }); }
async function studioFor(o, onUse) {
  const cfg = await getAiCfg();
  if (!cfg) { toast('Add your Google AI Studio API key first: Account › AI images.', true); return; }
  let src = o.full || '';
  if (!src && o.m) src = await getMedia(o.m);
  if (!src && /^data:/.test(o.t)) src = o.t;
  if (!src) { toast('This photo cannot be used with AI. Upload a real photo first.', true); return; }
  const orig = h('img', { alt: 'Your photo' }); orig.src = src;
  const out = h('div', { class: 'aiout' }, h('div', { class: 'spinner' }));
  const status = h('p', { class: 'aistat' }, 'Making the studio image… this can take 10–30 seconds.');
  const extra = h('input', { maxlength: '300', placeholder: 'Optional extra instruction, e.g. “keep the label text exactly”' });
  const useBtn = h('button', { class: 'b pri', disabled: true }, 'Use AI image');
  const again = h('button', { class: 'b ghost', disabled: true }, 'Try again');
  const m = h('div', { class: 'modal aimodal', role: 'dialog', 'aria-modal': 'true' },
    h('h3', null, 'AI studio image'),
    h('p', { class: 'aiwarn' }, 'Check carefully before using it: shape, size, colour, holes, edges and any printed text must match the real product exactly. AI can make small mistakes.'),
    h('div', { class: 'aicmp' }, h('figure', null, orig, h('figcaption', null, 'Your photo')), h('figure', null, out, h('figcaption', null, 'AI studio image'))),
    status, h('label', { class: 'f', style: { marginTop: '6px' } }, extra),
    h('div', { class: 'acts' }, h('button', { class: 'b ghost', onclick: () => close() }, 'Cancel'), again, useBtn));
  let result = '', alive = true;
  const close = overlay(m, () => { alive = false; });
  const run = async () => {
    useBtn.disabled = true; again.disabled = true; result = '';
    out.replaceChildren(h('div', { class: 'spinner' })); status.textContent = 'Making the studio image… this can take 10–30 seconds.'; status.classList.remove('bad');
    try {
      const r = await makeStudioImage(cfg, src, extra.value.trim());
      if (!alive) return;
      const im = await loadImg(r);
      result = r; out.replaceChildren(im); status.textContent = 'Compare both pictures. Use it only if the product looks exactly the same.';
      useBtn.disabled = false;
    } catch (e) { if (!alive) return; out.replaceChildren(h('span', { class: 'aifail' }, '—')); status.textContent = e.message || 'The AI request failed.'; status.classList.add('bad'); }
    again.disabled = false;
  };
  again.addEventListener('click', run);
  useBtn.addEventListener('click', async () => {
    try {
      const im = await loadImg(result);
      onUse({ t: encode(im, 520, 48000), full: encode(im, 1600, 880000), m: '', c: true, label: o.label || '' });
      close(); toast('AI studio image added. Press Save to keep it.');
    } catch (e) { toast(e.message || 'Could not use that image.', true); }
  });
  run();
}

/* ------------------------------------------------------------------ */
/* Dirty tracking                                                      */
/* ------------------------------------------------------------------ */
let saveBar = null;
function markDirty() { dirty = true; if (saveBar) saveBar.classList.remove('clean'); }
function markClean() { dirty = false; if (saveBar) saveBar.classList.add('clean'); }
addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ------------------------------------------------------------------ */
/* Boot / auth                                                         */
/* ------------------------------------------------------------------ */
let idleT = null;
function armIdle() {
  clearTimeout(idleT);
  idleT = setTimeout(async () => { if (user) { await api.signOut(); toast('Signed out after 30 minutes without activity.'); } }, 30 * 60 * 1000);
}
['pointerdown', 'keydown', 'scroll'].forEach(ev => addEventListener(ev, () => { if (user) armIdle(); }, { passive: true }));

async function boot() {
  if (MODE === 'static') return setupScreen();
  try { api = await adminApi(); }
  catch (e) { app.className = 'login'; app.replaceChildren(h('div', { class: 'card' }, h('h1', null, 'Could not connect'), h('p', null, 'Check your internet connection and reload the page.'))); return; }
  api.onUser(async u => {
    user = u;
    if (!u) { D = null; markClean(); loginScreen(); return; }
    armIdle();
    app.className = 'boot'; app.replaceChildren(h('div', { class: 'spinner' }));
    try { D = await api.loadAll(); }
    catch (e) {
      app.className = 'login';
      app.replaceChildren(h('div', { class: 'card' }, h('h1', null, 'No access'), h('p', null, errMsg(e)), h('button', { class: 'b pri full', onclick: () => api.signOut() }, 'Sign out')));
      return;
    }
    shell();
  });
}
function setupScreen() {
  app.className = 'login';
  app.replaceChildren(h('div', { class: 'card', style: { width: 'min(560px,100%)' } },
    h('div', { class: 'logo' }, h('img', { src: 'assets/img/mark.svg', alt: '' })),
    h('h1', null, 'Admin is not set up yet'), h('p', null, 'Connect a free Firebase project once, then the owner can sign in here. Full steps are in README.md.'),
    h('ol', { class: 'steps' },
      h('li', null, 'Create a Firebase project and a Firestore database.'),
      h('li', null, 'Turn on Email/Password sign-in and add the owner account.'),
      h('li', null, 'Paste the owner UID into ', h('code', null, 'firestore.rules'), ' and publish the rules.'),
      h('li', null, 'Paste the web config into ', h('code', null, 'js/firebase-config.js'), ' and upload the site again.'))));
}
function loginScreen() {
  app.className = 'login';
  const email = h('input', { type: 'email', autocomplete: 'username', required: true, maxlength: '120' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true, maxlength: '128' });
  const err = h('p', { class: 'err', 'aria-live': 'polite' });
  const btn = h('button', { class: 'b pri full', type: 'submit' }, 'Sign in');
  const form = h('form', { class: 'card' },
    h('div', { class: 'logo' }, h('img', { src: 'assets/img/mark.svg', alt: '' })),
    h('h1', null, 'Kawya Group admin'), h('p', null, 'Sign in to edit the website.'),
    h('label', { class: 'f' }, h('span', null, 'Email'), email), h('label', { class: 'f' }, h('span', null, 'Password'), pass), err, btn,
    api.mode === 'firebase' ? h('button', { class: 'b ghost full', type: 'button', style: { marginTop: '10px' }, onclick: async () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) { err.textContent = 'Type your email first, then press this again.'; return; }
      try { await api.resetPassword(email.value.trim()); } catch (e) { /* same message either way */ }
      err.textContent = 'If that email has an account, a reset link is on its way.';
    } }, 'Forgot password') : null,
    api.mode === 'demo' ? h('div', { class: 'note' }, h('b', null, 'Test mode on this computer. '), 'Firebase is not connected, so changes are saved only in this browser. Sign in with ', h('b', null, 'demo@local'), ' / ', h('b', null, 'demo1234'), '.') : null);
  let fails = 0, lockUntil = 0;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (Date.now() < lockUntil) { err.textContent = 'Too many tries. Wait a moment and try again.'; return; }
    btn.disabled = true; err.textContent = '';
    try { await api.signIn(email.value.trim(), pass.value); pass.value = ''; }
    catch (x) {
      fails++; if (fails >= 5) { lockUntil = Date.now() + 60000 * Math.min(10, fails - 4); }
      const c = String(x && (x.code || x.message));
      err.textContent = /too-many-requests/.test(c) ? 'Too many tries. Wait a few minutes and try again.' : /network/.test(c) ? 'No internet connection.' : 'Email or password is wrong.';
    }
    btn.disabled = false;
  });
  app.replaceChildren(form);
  email.focus();
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */
const NAV = [['overview', 'Overview'], ['items', 'Products & vehicles'], ['categories', 'Categories'], ['home', 'Home page'], ['about', 'About us'], ['transport', 'Transport page'], ['contact', 'Contact details'], ['account', 'Account']];
const PAGES = { overview: pOverview, items: pItems, categories: pCategories, home: pHome, about: pAbout, transport: pTransport, contact: pContact, account: pAccount };
let mainEl = null;
function shell() {
  app.className = 'shell';
  const bar = h('div', { class: 'bar' }, h('div', { class: 'mark' }, h('img', { src: 'assets/img/mark.svg', alt: 'Kawya' })));
  NAV.forEach(([k, label]) => bar.append(h('button', { class: 'nb' + (k === view ? ' on' : ''), 'data-k': k, 'aria-label': label, onclick: () => go(k) }, svg(k), h('span', { class: 'tip' }, label))));
  bar.append(h('span', { class: 'sp' }), h('button', { class: 'nb', 'aria-label': 'Sign out', onclick: async () => { if (dirty && !(await confirmBox('Leave without saving?', 'Your changes on this page are not saved yet.', 'Leave'))) return; markClean(); api.signOut(); } }, svg('out'), h('span', { class: 'tip' }, 'Sign out')));
  mainEl = h('main', { class: 'main' });
  app.replaceChildren(h('nav', { class: 'rail', 'aria-label': 'Admin sections' }, bar), mainEl);
  render();
}
async function go(k) {
  if (k === view) return;
  if (dirty && !(await confirmBox('Leave without saving?', 'Your changes on this page are not saved yet.', 'Leave'))) return;
  markClean(); view = k;
  app.querySelectorAll('.rail .nb[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === view));
  render();
}
function render() {
  saveBar = null; markClean();
  mainEl.replaceChildren();
  if (api.mode === 'demo') mainEl.append(h('div', { class: 'demo' }, 'Test mode: Firebase is not connected, so changes are saved in this browser only. Open the website on this same computer to see them.'));
  PAGES[view]();
  window.scrollTo({ top: 0 });
}
function top(title, sub, ...acts) {
  mainEl.append(h('div', { class: 'top' }, h('div', null, h('h1', null, title), sub ? h('p', null, sub) : null), h('div', { class: 'acts' }, acts)));
}
const viewSite = (hash = '') => h('a', { class: 'b ghost-l', href: 'index.html' + hash, target: '_blank', rel: 'noopener' }, svg('ext'), 'View site');
const wd = (title, kids, cls = '', d = 0) => { const w = h('section', { class: 'wd ' + cls }, title ? h('h2', null, title) : null, kids); if (d) w.style.setProperty('--d', d + 's'); return w; };

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */
function pOverview() {
  top('Overview', 'Signed in as ' + (user && user.email), viewSite());
  const g = h('div', { class: 'grid' });
  const noCatalog = !D.items.length && !D.categories.length;
  if (D._empty || noCatalog) {
    g.append(wd(D._empty ? 'Publish the starting content' : 'Add the sample products', [h('p', { class: 'sub', style: { margin: '0 0 16px' } }, D._empty
      ? 'Your database is empty, so the website is showing the built-in sample content. Publish it once to start editing it here.'
      : 'There are no products or categories yet. Add the sample categories and products as a starting point, then edit or delete them. Your saved pages are not changed.'),
      h('button', { class: 'b pri', onclick: async e => {
        e.target.disabled = true;
        try { await publishDefaults(!D._empty); D = await api.loadAll(); toast('Sample products added.'); render(); }
        catch (x) { toast(errMsg(x), true); e.target.disabled = false; }
      } }, D._empty ? 'Publish starting content' : 'Add sample products')], 'wide'));
  }
  const stat = (icon, n, label, k, d) => { const w = wd('', h('button', { class: 'stat', style: { width: '100%', textAlign: 'left' }, onclick: () => go(k) }, h('span', { class: 'dot' }, svg(icon)), h('div', null, h('b', null, String(n)), h('span', null, label))), '', d); return w; };
  g.append(
    stat('items', D.items.filter(i => i.section === 'concrete').length, 'Concrete items', 'items', 0),
    stat('transport', D.items.filter(i => i.section === 'transport').length, 'Vehicles', 'items', .04),
    stat('home', D.items.filter(i => i.section === 'hardware').length, 'Hardware items', 'items', .08),
    stat('categories', D.categories.length, 'Categories', 'categories', .12),
  );
  const hidden = D.items.filter(i => !i.visible).length;
  g.append(wd('Quick actions', h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
    h('button', { class: 'b pri', onclick: () => { view = 'items'; shell(); setTimeout(() => editItem(null, 'concrete')); } }, '+ Add product'),
    h('button', { class: 'b ghost', onclick: () => { view = 'items'; shell(); setTimeout(() => editItem(null, 'transport')); } }, '+ Add vehicle'),
    h('button', { class: 'b ghost', onclick: () => go('contact') }, 'Change phone numbers'),
    h('button', { class: 'b ghost', onclick: () => go('about') }, 'Change owner photo')), 'wide', .16));
  if (hidden) g.append(wd('Hidden items', h('p', { class: 'sub', style: { margin: 0 } }, `${hidden} item${hidden > 1 ? 's are' : ' is'} hidden from the website.`), '', .2));
  mainEl.append(g);
}
async function publishDefaults(catalogOnly = false) {
  const ops = [];
  for (const c of DEFAULTS.categories) { const { id, ...rest } = normCategory(c); ops.push({ col: 'categories', id, data: rest }); }
  for (const i of DEFAULTS.items) { const { id, ...rest } = normItem(i); rest.images = rest.images.map(cleanImg); ops.push({ col: 'items', id, data: rest }); }
  await api.batch(ops);
  if (catalogOnly) return;
  await api.saveSite('settings', normSettings(DEFAULTS.settings));
  await api.saveSite('home', siteDoc('home', normHome(DEFAULTS.home)));
  await api.saveSite('about', siteDoc('about', normAbout(DEFAULTS.about)));
  await api.saveSite('transport', normTransport(DEFAULTS.transport));
}
const cleanImg = o => ({ t: safeImg(o.t), m: ID_RE.test(o.m || '') ? o.m : '', c: o.c === true, label: str(o.label, 80) });
function siteDoc(name, o) {
  if (name === 'home') return { ...o, gallery: o.gallery.map(cleanImg) };
  if (name === 'about') return { ...o, storyImage: cleanImg(o.storyImage), bossPhoto: cleanImg(o.bossPhoto), certs: o.certs.map(cleanImg) };
  return o;
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */
const IS = { sec: 'concrete', cat: '', q: '' };
const catsOf = sec => D.categories.filter(c => c.section === sec);
function descendants(id) { const out = new Set([id]); let grew = true; while (grew) { grew = false; for (const c of D.categories) if (out.has(c.parent) && !out.has(c.id)) { out.add(c.id); grew = true; } } return out; }
function catPath(id) { const p = []; let c = D.categories.find(x => x.id === id), g = 0; while (c && g++ < 20) { p.unshift(c.name); c = D.categories.find(x => x.id === c.parent); } return p.join(' › '); }
function treeOptions(sec, exclude = new Set()) {
  const out = []; const walk = (parent, depth) => catsOf(sec).filter(c => c.parent === parent).forEach(c => { if (exclude.has(c.id)) return; out.push({ v: c.id, t: '   '.repeat(depth) + (depth ? '› ' : '') + c.name }); walk(c.id, depth + 1); });
  walk('', 0); return out;
}
function pItems() {
  top('Products & vehicles', 'Concrete items, vehicles and hardware shown on the Products page.', viewSite('#/products'), h('button', { class: 'b dark', onclick: () => editItem(null, IS.sec) }, '+ Add ' + (IS.sec === 'transport' ? 'vehicle' : 'item')));
  const seg = h('div', { class: 'seg' }, SECTIONS.map(s => h('button', { class: s === IS.sec ? 'on' : '', onclick: () => { IS.sec = s; IS.cat = ''; render(); } }, SEC_LABEL[s])));
  const cat = h('select', { class: 'sel-l', 'aria-label': 'Category filter' }, h('option', { value: '' }, 'All categories'), treeOptions(IS.sec).map(o => h('option', { value: o.v, selected: o.v === IS.cat }, o.t)));
  cat.addEventListener('change', () => { IS.cat = cat.value; drawList(); });
  const q = h('input', { class: 'search', type: 'search', placeholder: 'Search', value: IS.q });
  q.addEventListener('input', () => { IS.q = q.value; drawList(); });
  const list = h('div', { class: 'list' });
  mainEl.append(h('div', { class: 'tools' }, seg, cat, q), list);
  function drawList() {
    const ds = IS.cat ? descendants(IS.cat) : null; const ql = IS.q.trim().toLowerCase();
    const all = D.items.filter(i => i.section === IS.sec);
    const rows = all.filter(i => (!ds || ds.has(i.category)) && (!ql || i.name.toLowerCase().includes(ql)));
    list.replaceChildren(...(rows.length ? rows.map((it, n) => {
      const o = it.images[0]; const im = h('img', { alt: '' }); im.src = (o && safeImg(o.t)) || 'assets/img/mark.svg'; if (o && /^data:/.test(o.t) && !o.c) im.className = 'photo'; else if (o && /\.webp$/.test(o.t)) im.className = 'photo';
      const ix = all.indexOf(it);
      const row = h('div', { class: 'it' },
        h('div', { class: 'th' }, im),
        h('div', { style: { minWidth: 0 } }, h('div', { class: 'nm' }, it.name), h('div', { class: 'pth' }, catPath(it.category) || 'No category'),
          h('div', { class: 'tags' }, !it.visible ? h('span', { class: 'pill r' }, 'Hidden') : null, it.sls ? h('span', { class: 'pill g' }, 'SLS') : null, it.featured ? h('span', { class: 'pill y' }, 'On home page') : null, it.badge ? h('span', { class: 'pill' }, it.badge) : null, it.hire ? h('span', { class: 'pill y' }, 'For hire') : null)),
        h('div', { class: 'acts' },
          ib('up', 'Move up', () => moveItem(all, ix, -1)), ib('down', 'Move down', () => moveItem(all, ix, 1)),
          ib(it.visible ? 'eye' : 'eyeoff', it.visible ? 'Hide from website' : 'Show on website', () => toggleVisible(it)),
          ib('edit', 'Edit', () => editItem(it)), ib('del', 'Delete', () => deleteItem(it), 'red')));
      row.style.setProperty('--d', Math.min(n, 15) * .03 + 's');
      return row;
    }) : [h('div', { class: 'emptyl' }, 'No items here yet. Press “Add” to create one.')]));
  }
  drawList();
}
const itemDoc = it => { const { id, ...rest } = normItem(it); rest.images = rest.images.map(cleanImg); return rest; };
async function moveItem(all, ix, dir) {
  const j = ix + dir; if (j < 0 || j >= all.length) return;
  const arr = all.slice(); [arr[ix], arr[j]] = [arr[j], arr[ix]];
  const ops = []; arr.forEach((it, n) => { if (it.order !== n + 1) { it.order = n + 1; ops.push({ col: 'items', id: it.id, data: itemDoc(it) }); } });
  try { await api.batch(ops); D.items.sort((a, b) => a.order - b.order); render(); } catch (e) { toast(errMsg(e), true); D = await api.loadAll(); render(); }
}
async function toggleVisible(it) {
  const nv = !it.visible;
  try { await api.saveDoc('items', it.id, itemDoc({ ...it, visible: nv })); it.visible = nv; toast(nv ? 'Shown on the website.' : 'Hidden from the website.'); render(); }
  catch (e) { toast(errMsg(e), true); }
}
async function deleteItem(it) {
  if (!(await confirmBox('Delete “' + it.name + '”?', 'This removes it from the website and deletes its photos. This cannot be undone.'))) return;
  try { await api.removeDoc('items', it.id); await dropMedia(mediaIds(it.images)); D.items = D.items.filter(x => x.id !== it.id); toast('Deleted.'); render(); }
  catch (e) { toast(errMsg(e), true); }
}
function editItem(it, sec) {
  const isNew = !it;
  const cur = it ? { ...it, images: it.images.map(o => ({ ...o })), specs: it.specs.map(s => ({ ...s })) } : { name: '', section: sec || IS.sec, category: IS.cat || '', summary: '', description: '', specs: [], sls: (sec || IS.sec) === 'concrete', badge: '', images: [], visible: true, featured: false, hire: (sec || IS.sec) === 'transport', order: 0 };
  const name = textF('Name *', cur.name, { max: 120, ph: 'e.g. Hume Pipe 600 mm' });
  const secSel = h('select', null, SECTIONS.map(s => h('option', { value: s, selected: s === cur.section }, SEC_LABEL[s])));
  const catSel = h('select');
  const fillCats = () => { const opts = treeOptions(secSel.value); catSel.replaceChildren(h('option', { value: '' }, '— No category —'), ...opts.map(o => h('option', { value: o.v, selected: o.v === cur.category }, o.t))); };
  fillCats(); secSel.addEventListener('change', () => { cur.category = ''; fillCats(); });
  const summary = textF('Short description (on cards)', cur.summary, { max: 200, area: true, hint: 'One or two lines.' });
  const desc = textF('Full description', cur.description, { max: 3000, area: true });
  const specs = rowsF('Details (size, capacity, strength…)', cur.specs, { keys: ['k', 'v'], ph: ['e.g. Diameter', 'e.g. 600 mm'], max: 12, lens: [40, 80] });
  const imgs = imagesF('Photos', cur.images, { max: 8, ai: true, hint: 'First photo is the main one. Press ✦ AI on a photo to make a clean studio image (you check it before it is used).' });
  const badge = textF('Badge (optional)', cur.badge, { max: 24, ph: 'e.g. New, Best seller, For hire' });
  const sls = toggleF('SLS certified', cur.sls, 'Shows the SLS badge');
  const feat = toggleF('Show on home page', cur.featured, 'In the “Popular items” row');
  const hire = toggleF('Available for hire', cur.hire, 'For vehicles');
  const vis = toggleF('Visible on website', cur.visible);
  const body = h('div', { class: 'body' },
    name.el, h('div', { class: 'row2' }, h('label', { class: 'f' }, h('span', null, 'Section'), secSel), h('label', { class: 'f' }, h('span', null, 'Category'), catSel)),
    summary.el, desc.el, h('p', { class: 'sect' }, 'Photos'), imgs.el, h('p', { class: 'sect' }, 'Details'), specs.el,
    h('p', { class: 'sect' }, 'Options'), badge.el, sls.el, feat.el, hire.el, vis.el);
  const err = h('span', { class: 'err', style: { marginRight: 'auto', alignSelf: 'center' } });
  const save = h('button', { class: 'b pri', type: 'submit' }, isNew ? 'Add' : 'Save');
  const dr = h('form', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': isNew ? 'Add item' : 'Edit item' },
    h('header', null, h('h2', null, isNew ? 'Add ' + (cur.section === 'transport' ? 'vehicle' : 'item') : 'Edit ' + cur.name), ib('close', 'Close', () => tryClose())),
    body, h('footer', null, err, h('button', { class: 'b ghost', type: 'button', onclick: () => tryClose() }, 'Cancel'), save));
  let local = false; dr.addEventListener('input', () => { local = true; }); dr.addEventListener('change', () => { local = true; });
  const realDirty = dirty;
  const close = overlay(dr, () => { dirty = realDirty; }, () => tryClose());
  dirty = true; // so a page close warns while the drawer is open
  async function tryClose() { if (local && !(await confirmBox('Discard changes?', 'Your changes to this item are not saved.', 'Discard'))) return; close(); }
  dr.addEventListener('submit', async e => {
    e.preventDefault();
    const nm = name.get(); if (!nm) { err.textContent = 'Please add a name.'; name.input.focus(); return; }
    save.disabled = true; err.textContent = 'Saving…';
    const origMedia = mediaIds(it ? it.images : []);
    let added = [];
    try {
      const c = await commitImages(imgs.get()); added = c.added;
      const sec2 = secSel.value;
      const order = it && it.section === sec2 ? it.order : Math.max(0, ...D.items.filter(i => i.section === sec2).map(i => i.order)) + 1;
      const doc = itemDoc({ name: nm, section: sec2, category: catSel.value, summary: summary.get(), description: desc.get(), specs: specs.get(), sls: sls.get(), badge: badge.get(), images: c.list, visible: vis.get(), featured: feat.get(), hire: hire.get(), order });
      const id = it ? it.id : newId();
      await api.saveDoc('items', id, doc);
      const keep = new Set(mediaIds(doc.images)); await dropMedia(origMedia.filter(m => !keep.has(m)));
      const saved = normItem({ ...doc, id });
      D.items = D.items.filter(x => x.id !== id).concat(saved).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      IS.sec = sec2; local = false; close(); toast(isNew ? 'Added.' : 'Saved.'); render();
    } catch (x) { await dropMedia(added); err.textContent = ''; toast(errMsg(x), true); save.disabled = false; }
  });
  setTimeout(() => name.input.focus(), 50);
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */
const catDoc = c => { const { id, ...rest } = normCategory(c); return rest; };
function pCategories() {
  top('Categories', 'Group items into categories and sub-categories. Sub-categories can have their own sub-categories too.', viewSite('#/products'));
  const g = h('div', { class: 'grid' });
  SECTIONS.forEach((sec, si) => {
    const tree = h('div', { class: 'tree' });
    const walk = (parent, depth) => catsOf(sec).filter(c => c.parent === parent).forEach((c, i, sibs) => {
      const nItems = D.items.filter(it => it.category === c.id).length;
      const node = h('div', { class: 'node' },
        h('span', { class: 'lv', style: { opacity: String(1 - depth * .25) } }),
        h('span', { class: 'nm' }, c.name, h('span', { class: 'cnt' }, nItems ? nItems + ' item' + (nItems > 1 ? 's' : '') : '')),
        h('span', { class: 'acts' },
          ib('plus', 'Add sub-category', () => addCat(sec, c.id)), ib('edit', 'Rename', () => renameCat(c)),
          i > 0 ? ib('up', 'Move up', () => reorderCat(sibs, i, -1)) : null, i < sibs.length - 1 ? ib('down', 'Move down', () => reorderCat(sibs, i, 1)) : null,
          ib('move', 'Move into another category', () => moveCat(c)), ib('del', 'Delete', () => deleteCat(c), 'red')));
      node.style.marginLeft = depth * 22 + 'px';
      node.style.animationDelay = Math.min(tree.children.length, 20) * .025 + 's';
      tree.append(node); walk(c.id, depth + 1);
    });
    walk('', 0);
    if (!tree.children.length) tree.append(h('p', { class: 'sub', style: { margin: 0 } }, 'No categories yet.'));
    g.append(wd(null, [h('h2', null, SEC_LABEL[sec], h('button', { class: 'b pri sm', onclick: () => addCat(sec, '') }, '+ Category')), tree], 'wide', si * .05));
  });
  mainEl.append(g);
}
async function addCat(sec, parent) {
  const name = await promptBox(parent ? 'New sub-category in “' + D.categories.find(c => c.id === parent).name + '”' : 'New category', 'Name');
  if (!name) return;
  const order = Math.max(0, ...D.categories.filter(c => c.section === sec && c.parent === parent).map(c => c.order)) + 1;
  const c = normCategory({ id: newId(), name, section: sec, parent, order });
  try { await api.saveDoc('categories', c.id, catDoc(c)); D.categories.push(c); toast('Category added.'); render(); } catch (e) { toast(errMsg(e), true); }
}
async function renameCat(c) {
  const name = await promptBox('Rename category', 'Name', c.name); if (!name || name === c.name) return;
  try { await api.saveDoc('categories', c.id, catDoc({ ...c, name })); c.name = name; toast('Renamed.'); render(); } catch (e) { toast(errMsg(e), true); }
}
async function reorderCat(sibs, i, dir) {
  const arr = sibs.slice(); [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
  const ops = []; arr.forEach((c, n) => { if (c.order !== n + 1) { c.order = n + 1; ops.push({ col: 'categories', id: c.id, data: catDoc(c) }); } });
  try { await api.batch(ops); D.categories.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)); render(); } catch (e) { toast(errMsg(e), true); }
}
async function moveCat(c) {
  const opts = [{ v: '', t: '(Top level)' }].concat(treeOptions(c.section, descendants(c.id)));
  const to = await selectBox('Move “' + c.name + '”', 'Put it inside', opts, c.parent);
  if (to == null || to === c.parent) return;
  const order = Math.max(0, ...D.categories.filter(x => x.section === c.section && x.parent === to).map(x => x.order)) + 1;
  try { await api.saveDoc('categories', c.id, catDoc({ ...c, parent: to, order })); c.parent = to; c.order = order; toast('Moved.'); render(); } catch (e) { toast(errMsg(e), true); }
}
async function deleteCat(c) {
  const subs = D.categories.filter(x => x.parent === c.id), its = D.items.filter(i => i.category === c.id);
  const parentName = c.parent ? (D.categories.find(x => x.id === c.parent) || {}).name : 'top level';
  const extra = subs.length || its.length ? `\n\n${subs.length} sub-categor${subs.length === 1 ? 'y' : 'ies'} and ${its.length} item${its.length === 1 ? '' : 's'} inside it will move up to “${parentName}”. Nothing else is deleted.` : '';
  if (!(await confirmBox('Delete “' + c.name + '”?', 'The category will be removed.' + extra))) return;
  const ops = [{ col: 'categories', id: c.id, del: true }];
  subs.forEach(s => ops.push({ col: 'categories', id: s.id, data: catDoc({ ...s, parent: c.parent }) }));
  its.forEach(i => ops.push({ col: 'items', id: i.id, data: itemDoc({ ...i, category: c.parent }) }));
  try {
    await api.batch(ops);
    subs.forEach(s => { s.parent = c.parent; }); its.forEach(i => { i.category = c.parent; });
    D.categories = D.categories.filter(x => x.id !== c.id); toast('Category deleted.'); render();
  } catch (e) { toast(errMsg(e), true); }
}

/* ------------------------------------------------------------------ */
/* Site documents (Home / About / Transport / Contact)                 */
/* ------------------------------------------------------------------ */
// widgets: [{ title, fields: [[key, fieldObject]] }], build(values) -> doc
function siteEditor(name, widgets, build, norm) {
  const g = h('div', { class: 'grid' });
  widgets.forEach((w, i) => g.append(wd(w.title, [w.sub ? h('p', { class: 'sub' }, w.sub) : null, w.fields.map(f => f[1].el)], w.wide ? 'wide' : '', i * .04)));
  g.addEventListener('input', markDirty); g.addEventListener('change', markDirty);
  const btn = h('button', { class: 'b pri' }, 'Save changes');
  saveBar = h('div', { class: 'savebar clean' }, h('div', { class: 'in2' }, h('span', null, 'Unsaved changes'), btn));
  mainEl.append(g, saveBar);
  const orig = D[name];
  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Saving…';
    const v = {}; widgets.forEach(w => w.fields.forEach(([k, f]) => { v[k] = f.get(); }));
    const added = [];
    try {
      const imgKeys = []; widgets.forEach(w => w.fields.forEach(([k, f]) => { if (f.isImg) imgKeys.push(k); }));
      for (const k of imgKeys) { const c = await commitImages(v[k]); added.push(...c.added); v[k] = c.list; }
      const doc = siteDoc(name, norm(build(v)));
      await api.saveSite(name, doc);
      const before = allMedia(name, orig), after = new Set(allMedia(name, doc));
      await dropMedia(before.filter(m => !after.has(m)));
      D[name] = norm(doc); markClean(); toast('Saved. The website now shows the changes.');
    } catch (e) { await dropMedia(added); toast(errMsg(e), true); }
    btn.disabled = false; btn.textContent = 'Save changes';
  });
}
function allMedia(name, o) {
  if (!o) return [];
  if (name === 'home') return mediaIds(o.gallery);
  if (name === 'about') return mediaIds([o.storyImage, o.bossPhoto, ...(o.certs || [])]);
  return [];
}
const imgF = (...a) => { const f = imagesF(...a); f.isImg = true; return f; };

function pHome() {
  const H = D.home;
  top('Home page', 'The first page people see.', viewSite('#/'));
  const f = {
    badge: textF('Small label above the title', H.badge, { max: 80 }),
    heroLine1: textF('Title line 1 (thin, italic)', H.heroLine1, { max: 80 }),
    heroLine2: textF('Title line 2 (bold)', H.heroLine2, { max: 120 }),
    heroSub: textF('Text under the title', H.heroSub, { max: 400, area: true }),
    gallery: imgF('Yard photos (the curved photo row)', H.gallery, { max: 10, hint: 'Tall photos look best. Up to 10.' }),
    stats: rowsF('Numbers row', H.stats, { keys: ['value', 'label'], ph: ['e.g. 15+', 'e.g. Years building'], max: 4, lens: [12, 40] }),
    concreteT: textF('Concrete yard: title', H.sections.concrete.title, { max: 60 }), concreteX: textF('Concrete yard: text', H.sections.concrete.text, { max: 400, area: true }),
    transportT: textF('Transport: title', H.sections.transport.title, { max: 60 }), transportX: textF('Transport: text', H.sections.transport.text, { max: 400, area: true }),
    hardwareT: textF('Hardware: title', H.sections.hardware.title, { max: 60 }), hardwareX: textF('Hardware: text', H.sections.hardware.text, { max: 400, area: true }),
    slsTitle: textF('SLS band: title', H.slsTitle, { max: 100 }), slsText: textF('SLS band: text', H.slsText, { max: 500, area: true }),
  };
  siteEditor('home', [
    { title: 'Top of the page', fields: [['badge', f.badge], ['heroLine1', f.heroLine1], ['heroLine2', f.heroLine2], ['heroSub', f.heroSub]] },
    { title: 'Photos', fields: [['gallery', f.gallery]] },
    { title: 'Numbers', sub: 'Up to 4. Numbers count up when they come into view.', fields: [['stats', f.stats]] },
    { title: 'The three services', fields: [['concreteT', f.concreteT], ['concreteX', f.concreteX], ['transportT', f.transportT], ['transportX', f.transportX], ['hardwareT', f.hardwareT], ['hardwareX', f.hardwareX]] },
    { title: 'SLS band', fields: [['slsTitle', f.slsTitle], ['slsText', f.slsText]] },
  ], v => ({
    badge: v.badge, heroLine1: v.heroLine1, heroLine2: v.heroLine2, heroSub: v.heroSub, gallery: v.gallery, stats: v.stats,
    sections: { concrete: { title: v.concreteT, text: v.concreteX }, transport: { title: v.transportT, text: v.transportX }, hardware: { title: v.hardwareT, text: v.hardwareX } },
    slsTitle: v.slsTitle, slsText: v.slsText,
  }), normHome);
}
function pAbout() {
  const A = D.about;
  top('About us', 'Company story, the owner, and SLS certificates.', viewSite('#/about'));
  const f = {
    title: textF('Page title', A.title, { max: 120 }), intro: textF('Intro', A.intro, { max: 600, area: true }),
    story: textF('Our story', A.story, { max: 3000, area: true }), storyImage: imgF('Story photo', A.storyImage.t || A.storyImage.m ? [A.storyImage] : [], { max: 1, single: true }),
    bossPhoto: imgF('Owner photo', A.bossPhoto.t || A.bossPhoto.m ? [A.bossPhoto] : [], { max: 1, single: true, hint: 'A clear portrait works best.' }),
    bossName: textF('Owner name', A.bossName, { max: 80 }), bossRole: textF('Position', A.bossRole, { max: 80 }), bossMessage: textF('Message from the owner', A.bossMessage, { max: 800, area: true }),
    slsTitle: textF('SLS title', A.slsTitle, { max: 100 }), slsText: textF('SLS text', A.slsText, { max: 800, area: true }),
    certs: imgF('SLS certificate photos', A.certs, { max: 12, labels: true, hint: 'Add a photo of each certificate. Visitors can tap to view it large.' }),
    mission: textF('Mission', A.mission, { max: 500, area: true }), vision: textF('Vision', A.vision, { max: 500, area: true }),
    values: rowsF('Values', A.values, { keys: ['title', 'text'], ph: ['Title', 'Short text'], max: 6, lens: [60, 200] }),
  };
  siteEditor('about', [
    { title: 'Owner', fields: [['bossPhoto', f.bossPhoto], ['bossName', f.bossName], ['bossRole', f.bossRole], ['bossMessage', f.bossMessage]] },
    { title: 'Company', fields: [['title', f.title], ['intro', f.intro], ['story', f.story], ['storyImage', f.storyImage]] },
    { title: 'SLS certificates', wide: true, fields: [['slsTitle', f.slsTitle], ['slsText', f.slsText], ['certs', f.certs]] },
    { title: 'Mission, vision & values', wide: true, fields: [['mission', f.mission], ['vision', f.vision], ['values', f.values]] },
  ], v => ({ ...v, storyImage: v.storyImage[0] || { t: '', m: '' }, bossPhoto: v.bossPhoto[0] || { t: '', m: '' } }), normAbout);
}
function pTransport() {
  const T = D.transport;
  top('Transport page', 'Texts on the Transport page. Add or edit vehicles under Products & vehicles.', viewSite('#/transport'), h('button', { class: 'b dark', onclick: () => { IS.sec = 'transport'; go('items'); } }, 'Edit vehicles'));
  const f = {
    title: textF('Title', T.title, { max: 100 }), intro: textF('Intro', T.intro, { max: 800, area: true }),
    points: rowsF('Highlights', T.points.map(p => ({ p })), { keys: ['p'], ph: ['e.g. Experienced drivers'], max: 6, lens: [60] }),
    deliveryTitle: textF('Delivery: title', T.deliveryTitle, { max: 100 }), deliveryText: textF('Delivery: text', T.deliveryText, { max: 800, area: true }),
    hireTitle: textF('Hire: title', T.hireTitle, { max: 100 }), hireText: textF('Hire: text', T.hireText, { max: 800, area: true }),
  };
  siteEditor('transport', [
    { title: 'Top of the page', fields: [['title', f.title], ['intro', f.intro], ['points', f.points]] },
    { title: 'Two services', fields: [['deliveryTitle', f.deliveryTitle], ['deliveryText', f.deliveryText], ['hireTitle', f.hireTitle], ['hireText', f.hireText]] },
  ], v => ({ ...v, points: v.points.map(x => x.p) }), normTransport);
}
function parseMapLink(u) {
  const s = String(u);
  let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|destination|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}
function pContact() {
  const C = D.settings;
  top('Contact details', 'Phone numbers, WhatsApp, address and map location.', viewSite('#/contact'));
  const f = {
    phones: rowsF('Phone numbers', C.phones, { keys: ['number', 'label'], ph: ['e.g. 077 123 4567', 'e.g. Office'], max: 8, lens: [24, 40] }),
    whatsapp: textF('WhatsApp number', C.whatsapp, { max: 24, type: 'tel', hint: 'Customers’ WhatsApp messages and order questions go to this number.' }),
    email: textF('Email (optional)', C.email, { max: 120, type: 'email' }),
    address: textF('Address', C.address, { max: 300, area: true }),
    hours: textF('Open hours', C.hours, { max: 120, ph: 'e.g. Mon – Sat · 7.30 am – 6.00 pm' }),
    mapLink: textF('Google Maps link', C.mapLink, { max: 600, hint: 'Paste the share link from Google Maps. The “Get directions” buttons open it.' }),
    mapLat: textF('Latitude', String(C.mapLat), { max: 20 }), mapLng: textF('Longitude', String(C.mapLng), { max: 20 }),
    facebook: textF('Facebook page link (optional)', C.facebook, { max: 300, ph: 'https://www.facebook.com/…' }),
  };
  const prev = h('iframe', { title: 'Map preview', loading: 'lazy', style: { width: '100%', height: '220px', border: '0', borderRadius: '16px', marginTop: '6px', background: '#2a2a2e' } });
  const setPrev = () => { const s = mapEmbed(f.mapLat.get(), f.mapLng.get()); if (s) prev.src = s; };
  setPrev(); f.mapLat.input.addEventListener('change', setPrev); f.mapLng.input.addEventListener('change', setPrev);
  const readBtn = h('button', { class: 'b ghost sm', type: 'button', onclick: () => {
    const p = parseMapLink(f.mapLink.get());
    if (!p) { toast('Short links (maps.app.goo.gl) do not include the location. Open the link, copy the long address from the browser bar, and paste it here. Or type the numbers below.', true); return; }
    f.mapLat.input.value = p.lat.toFixed(7); f.mapLng.input.value = p.lng.toFixed(7); setPrev(); markDirty();
  } }, 'Read location from link');
  const mapWidget = { el: h('div', null, readBtn, prev) , get: () => null };
  siteEditor('settings', [
    { title: 'Phone & WhatsApp', fields: [['phones', f.phones], ['whatsapp', f.whatsapp], ['email', f.email], ['facebook', f.facebook]] },
    { title: 'Address & map', fields: [['address', f.address], ['hours', f.hours], ['mapLink', f.mapLink], ['_m', mapWidget], ['mapLat', f.mapLat], ['mapLng', f.mapLng]] },
  ], v => {
    const lat = Number(v.mapLat), lng = Number(v.mapLng);
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Latitude/longitude are not valid numbers.');
    if (v.mapLink && !safeMapLink(v.mapLink)) throw new Error('The map link must be a Google Maps link.');
    if (v.facebook && !/^https:\/\/(www\.|m\.)?facebook\.com\//i.test(v.facebook)) throw new Error('The Facebook link must start with https://www.facebook.com/');
    if (v.email && !/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(v.email)) throw new Error('The email address does not look right.');
    const bad = v.phones.find(p => digits(p.number).length < 9); if (bad) throw new Error('Phone number “' + bad.number + '” looks too short.');
    if (v.whatsapp && digits(v.whatsapp).length < 9) throw new Error('The WhatsApp number looks too short.');
    return { phones: v.phones, whatsapp: v.whatsapp, email: v.email, address: v.address, hours: v.hours, mapLink: v.mapLink, mapLat: lat, mapLng: lng, facebook: v.facebook };
  }, normSettings);
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */
function aiSettings() {
  const key = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'Paste the Google AI Studio API key', maxlength: '200' });
  const model = h('select', null, h('option', { value: DEFAULT_MODEL }, DEFAULT_MODEL));
  const state = h('p', { class: 'sub', style: { margin: '0 0 14px' } }, 'Loading…');
  const save = h('button', { class: 'b pri' }, 'Check & save');
  const remove = h('button', { class: 'b red' }, 'Remove key');
  getAiCfg().then(c => {
    state.textContent = c ? 'A key is saved. The ✦ AI button appears on product photos.' : 'No key saved yet.';
    if (c) { model.replaceChildren(h('option', { value: c.model }, c.model)); }
    remove.hidden = !c;
  });
  save.addEventListener('click', async () => {
    const k = key.value.trim() || (aiCfg && aiCfg.key) || '';
    if (!KEY_RE.test(k)) { toast('That does not look like an API key.', true); return; }
    save.disabled = true; save.textContent = 'Checking…';
    try {
      const models = await listImageModels(k);
      if (models.length) {
        const pick = models.includes(model.value) ? model.value : (models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : models[0]);
        model.replaceChildren(...models.map(n => h('option', { value: n, selected: n === pick }, n)));
      }
      const m = MODEL_RE.test(model.value) ? model.value : DEFAULT_MODEL;
      await api.savePrivate('ai', { key: k, model: m });
      aiCfg = { key: k, model: m }; key.value = '';
      state.textContent = 'Saved. ' + (models.length ? models.length + ' image model(s) found on this key.' : 'No image models were listed for this key; generation may not work.');
      remove.hidden = false; toast('AI key saved.');
    } catch (e) { toast(e.message || errMsg(e), true); }
    save.disabled = false; save.textContent = 'Check & save';
  });
  model.addEventListener('change', async () => {
    if (!aiCfg || !MODEL_RE.test(model.value)) return;
    try { await api.savePrivate('ai', { key: aiCfg.key, model: model.value }); aiCfg.model = model.value; toast('Model changed.'); } catch (e) { toast(errMsg(e), true); }
  });
  remove.addEventListener('click', async () => {
    if (!(await confirmBox('Remove the AI key?', 'The ✦ AI button will stop working until you add a key again.', 'Remove'))) return;
    try { await api.savePrivate('ai', { key: '', model: DEFAULT_MODEL }); aiCfg = null; state.textContent = 'No key saved yet.'; remove.hidden = true; toast('AI key removed.'); } catch (e) { toast(errMsg(e), true); }
  });
  return wd('AI images', [state,
    h('label', { class: 'f' }, h('span', null, 'Google AI Studio API key'), key, h('small', null, 'Only this admin account can read it. Get one at aistudio.google.com › Get API key.')),
    h('label', { class: 'f' }, h('span', null, 'Image model'), model),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, save, remove)], 'wide', .08);
}
function pAccount() {
  top('Account', 'Your sign-in.');
  const g = h('div', { class: 'grid' });
  g.append(wd('Signed in', [h('p', { class: 'sub', style: { margin: '0 0 16px' } }, user.email), h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
    api.mode === 'firebase' ? h('button', { class: 'b ghost', onclick: async () => { try { await api.resetPassword(user.email); toast('Password reset email sent to ' + user.email); } catch (e) { toast(errMsg(e), true); } } }, 'Change password by email') : null,
    h('button', { class: 'b pri', onclick: () => api.signOut() }, 'Sign out'))]));
  g.append(wd('Safety', h('ul', { class: 'steps' },
    h('li', null, 'You are signed out when you close the browser tab, or after 30 minutes without activity.'),
    h('li', null, 'Only the owner account listed in the Firestore rules can change the website.'),
    h('li', null, 'Never share your password. Kawya Group staff will never ask for it.')), '', .05));
  g.append(aiSettings());
  if (api.mode === 'demo') g.append(wd('Test data', [h('p', { class: 'sub', style: { margin: '0 0 16px' } }, 'Reset this browser’s test data back to the sample content.'),
    h('button', { class: 'b red', onclick: async () => { if (await confirmBox('Reset test data?', 'All test changes in this browser will be lost.', 'Reset')) { localStorage.removeItem('kawya-demo-db-v1'); D = await api.loadAll(); toast('Test data reset.'); render(); } } }, 'Reset test data')], '', .1));
  mainEl.append(g);
}

boot();
