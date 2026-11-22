// Data layer for the Kawya Group website.
// - Firebase Firestore when js/firebase-config.js is filled in.
// - "demo" mode on localhost when Firebase is not set up (data kept in this browser only, for testing).
// - Built-in defaults otherwise.
import { FIREBASE_CONFIG } from './firebase-config.js?v=202611221404';

export const FB_VERSION = '10.12.2';
export const fbReady = () => !!FIREBASE_CONFIG.apiKey && !String(FIREBASE_CONFIG.apiKey).startsWith('PASTE');
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export const MODE = fbReady() ? 'firebase' : (LOCAL ? 'demo' : 'static');

export const SECTIONS = ['concrete', 'transport', 'hardware'];

/* ------------------------------------------------------------------ */
/* Sanitisers. Everything shown on the page passes through these.      */
/* ------------------------------------------------------------------ */
export const str = (v, max = 4000) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
export const digits = v => str(v, 40).replace(/[^\d]/g, '').slice(0, 15);
export const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function safeImg(src) {
  if (typeof src !== 'string') return '';
  if (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(src)) return src;
  if (/^assets\/[\w./-]+\.(svg|png|jpe?g|webp)$/.test(src) && !src.includes('..')) return src;
  return '';
}
export function img(o) {
  if (!o || typeof o !== 'object') return { t: '', m: '' };
  const m = typeof o.m === 'string' && ID_RE.test(o.m) ? o.m : '';
  return { t: safeImg(o.t), m, c: o.c === true, label: str(o.label, 80) };
}
// Sri Lankan numbers: 0771234567 -> 94771234567
export function intlNumber(v) {
  let d = digits(v);
  if (d.startsWith('0') && d.length === 10) d = '94' + d.slice(1);
  return d;
}
export const telHref = v => { const d = intlNumber(v); return d ? 'tel:+' + d : ''; };
export const waHref = (v, text = '') => { const d = intlNumber(v); return d ? `https://wa.me/${d}${text ? '?text=' + encodeURIComponent(text.slice(0, 1500)) : ''}` : ''; };
export function mailHref(v) { const e = str(v, 120).trim(); return /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(e) ? 'mailto:' + e : ''; }
export function safeMapLink(u) {
  const s = str(u, 600).trim();
  return /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]{2,8}\/maps)[\w\-./?=&%+@!:,~#]*$/i.test(s) ? s : '';
}
export function mapEmbed(lat, lng) {
  const a = Number(lat), b = Number(lng);
  if (!isFinite(a) || !isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return '';
  return `https://www.google.com/maps?q=${a.toFixed(6)},${b.toFixed(6)}&z=16&output=embed`;
}
export function newId() {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const r = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(r, x => abc[x % 62]).join('');
}

/* ------------------------------------------------------------------ */
/* Default content (shown until the owner edits it in admin).          */
/* ------------------------------------------------------------------ */
const I = t => ({ t: 'assets/img/' + t, m: '' });
export const DEFAULTS = {
  settings: {
    phones: [{ label: 'Office', number: '0770000000' }, { label: 'Concrete yard', number: '0770000001' }],
    whatsapp: '0770000000',
    email: '',
    address: 'Kawya Group, Kantale, Sri Lanka',
    hours: 'Mon – Sat · 7.30 am – 6.00 pm',
    mapLat: 8.4237641,
    mapLng: 81.0393958,
    mapLink: 'https://maps.app.goo.gl/gyTLszXxnfMPQeuY6',
    facebook: '',
  },
  home: {
    badge: 'SLS certified concrete products',
    heroLine1: 'Built to last,',
    heroLine2: 'Concrete, Transport & Hardware',
    heroSub: 'Kawya Group makes SLS certified concrete products, delivers them with our own fleet, and runs a full hardware store, all from one yard.',
    gallery: [I('yard-1.webp'), I('yard-2.webp'), I('yard-3.webp'), I('yard-4.webp'), I('yard-5.webp')],
    stats: [
      { value: '15+', label: 'Years building' },
      { value: '100%', label: 'SLS certified items' },
      { value: '10+', label: 'Vehicles in our fleet' },
      { value: '500+', label: 'Projects supplied' },
    ],
    sections: {
      concrete: { title: 'Concrete Yard', text: 'Pipes, blocks, pavers, kerbs, posts and drains, cast and cured in our own yard to SLS standard.' },
      transport: { title: 'Transport Service', text: 'We deliver our concrete items to your site, and our lorries and tippers are available for hire.' },
      hardware: { title: 'Hardware Store', text: 'Cement, steel, tools, plumbing and everything else your build needs, under one roof.' },
    },
    slsTitle: 'Every item carries the SLS mark',
    slsText: 'Each concrete product we make is tested and certified by the Sri Lanka Standards Institution, so what reaches your site is built to the national standard.',
  },
  about: {
    title: 'A family business that builds Sri Lanka',
    intro: 'Kawya Group started as a small concrete yard and grew into three businesses that work together: a concrete yard, a transport service and a hardware store.',
    story: 'We cast every product in our own yard, cure it properly, and test it against SLS standards before it leaves. Because we own the trucks that carry it, your order reaches the site on time and in one piece. And because we also run a hardware store, you can get the rest of your materials from the same people you already trust.',
    storyImage: I('yard-3.webp'),
    bossName: 'Owner name',
    bossRole: 'Founder & Managing Director',
    bossMessage: 'Our promise is simple: honest products, built to standard, delivered when we say they will be.',
    bossPhoto: { t: '', m: '' },
    slsTitle: 'SLS certified, every single item',
    slsText: 'The SLS mark is given by the Sri Lanka Standards Institution only to products that pass its tests for strength, size and finish. Every concrete item Kawya Group sells carries that certificate.',
    certs: [],
    mission: 'To supply strong, certified building materials and dependable transport to every builder in our region.',
    vision: 'To be the most trusted name in concrete products and construction supply in the Eastern Province.',
    values: [
      { title: 'Quality first', text: 'Tested and SLS certified before it leaves the yard.' },
      { title: 'On time', text: 'Our own fleet means we control the delivery.' },
      { title: 'Fair dealing', text: 'Clear advice and honest service on every order.' },
    ],
  },
  transport: {
    title: 'Our fleet, your site',
    intro: 'Kawya Group runs its own lorries and tippers. We deliver the concrete items you buy from our yard, and you can hire our vehicles for your own work.',
    deliveryTitle: 'Delivery of our products',
    deliveryText: 'Buy from the yard and we load, carry and unload at your site. Pipes, blocks and slabs are handled with care so they arrive whole.',
    hireTitle: 'Vehicles for hire',
    hireText: 'Need a lorry or tipper for a day or a job? Hire one of our vehicles with an experienced driver. Call or WhatsApp us for a quote.',
    points: ['Experienced drivers', 'Loading help on site', 'Island-wide on request'],
  },
  categories: [
    { id: 'c-pipes', name: 'Concrete Pipes', section: 'concrete', parent: '', order: 1 },
    { id: 'c-hume', name: 'Hume Pipes', section: 'concrete', parent: 'c-pipes', order: 1 },
    { id: 'c-culvert', name: 'Culvert Pipes', section: 'concrete', parent: 'c-pipes', order: 2 },
    { id: 'c-blocks', name: 'Blocks & Bricks', section: 'concrete', parent: '', order: 2 },
    { id: 'c-hollow', name: 'Hollow Blocks', section: 'concrete', parent: 'c-blocks', order: 1 },
    { id: 'c-solid', name: 'Solid Blocks', section: 'concrete', parent: 'c-blocks', order: 2 },
    { id: 'c-paving', name: 'Paving & Kerbs', section: 'concrete', parent: '', order: 3 },
    { id: 'c-drain', name: 'Drains & Slabs', section: 'concrete', parent: '', order: 4 },
    { id: 'c-posts', name: 'Fence Posts', section: 'concrete', parent: '', order: 5 },
    { id: 't-tipper', name: 'Tippers', section: 'transport', parent: '', order: 1 },
    { id: 't-lorry', name: 'Lorries', section: 'transport', parent: '', order: 2 },
    { id: 'h-cement', name: 'Cement', section: 'hardware', parent: '', order: 1 },
    { id: 'h-steel', name: 'Steel', section: 'hardware', parent: '', order: 2 },
  ],
  items: [
    { id: 'i-hume450', name: 'Hume Pipe 450 mm', section: 'concrete', category: 'c-hume', summary: 'Reinforced concrete pipe for road crossings and storm water.', description: 'Spun, reinforced concrete pipe for culverts, road crossings and storm water lines. Cast and cured in our yard and SLS certified.', specs: [{ k: 'Diameter', v: '450 mm' }, { k: 'Length', v: '2 m' }, { k: 'Class', v: 'SLS 1350' }], sls: true, badge: 'Best seller', images: [I('p-pipe.svg')], visible: true, featured: true, hire: false, order: 1 },
    { id: 'i-hume900', name: 'Hume Pipe 900 mm', section: 'concrete', category: 'c-culvert', summary: 'Large culvert pipe for main drains and bridges.', description: 'Heavy, large-diameter reinforced pipe for main drains, culverts and small bridges.', specs: [{ k: 'Diameter', v: '900 mm' }, { k: 'Length', v: '2 m' }], sls: true, badge: '', images: [I('p-pipe.svg')], visible: true, featured: false, hire: false, order: 2 },
    { id: 'i-block6', name: 'Hollow Block 6"', section: 'concrete', category: 'c-hollow', summary: 'Strong hollow cement block for load-bearing walls.', description: 'Machine-pressed hollow cement block with even size and clean edges, for load-bearing and boundary walls.', specs: [{ k: 'Size', v: '16 × 8 × 6 in' }, { k: 'Type', v: 'Hollow' }], sls: true, badge: 'New', images: [I('p-block.svg'), I('p-brick.svg')], visible: true, featured: true, hire: false, order: 3 },
    { id: 'i-block4', name: 'Solid Block 4"', section: 'concrete', category: 'c-solid', summary: 'Solid cement block for partition walls.', description: 'Dense solid block for partitions and finishing walls.', specs: [{ k: 'Size', v: '16 × 8 × 4 in' }, { k: 'Type', v: 'Solid' }], sls: true, badge: '', images: [I('p-brick.svg')], visible: true, featured: false, hire: false, order: 4 },
    { id: 'i-paver', name: 'Interlock Paving', section: 'concrete', category: 'c-paving', summary: 'Hard-wearing paving for driveways and yards.', description: 'Interlocking paving blocks for driveways, car parks and garden paths.', specs: [{ k: 'Thickness', v: '60 / 80 mm' }, { k: 'Colours', v: 'Grey, red' }], sls: true, badge: '', images: [I('p-paver.svg')], visible: true, featured: true, hire: false, order: 5 },
    { id: 'i-kerb', name: 'Road Kerb Stone', section: 'concrete', category: 'c-paving', summary: 'Kerb stones for roads and car parks.', description: 'Precast kerb stones with a chamfered top edge for roads, footpaths and car parks.', specs: [{ k: 'Length', v: '600 mm' }], sls: true, badge: '', images: [I('p-kerb.svg')], visible: true, featured: false, hire: false, order: 6 },
    { id: 'i-udrain', name: 'U Drain', section: 'concrete', category: 'c-drain', summary: 'Precast U drain for roadside drainage.', description: 'Precast U-shaped drain sections that join quickly on site for roadside and yard drainage.', specs: [{ k: 'Width', v: '300 mm' }, { k: 'Length', v: '1 m' }], sls: true, badge: '', images: [I('p-udrain.svg'), I('p-slab.svg')], visible: true, featured: true, hire: false, order: 7 },
    { id: 'i-post', name: 'Concrete Fence Post', section: 'concrete', category: 'c-posts', summary: 'Reinforced post for boundary fences.', description: 'Reinforced concrete posts for wire and boundary fences.', specs: [{ k: 'Height', v: '7 ft' }], sls: true, badge: '', images: [I('p-post.svg')], visible: true, featured: false, hire: false, order: 8 },
    { id: 'v-tipper', name: 'Tipper Truck', section: 'transport', category: 't-tipper', summary: 'For sand, metal, soil and rubble.', description: 'Our tipper carries sand, metal, soil and rubble to your site, and is available for hire with a driver.', specs: [{ k: 'Capacity', v: '3 cubes' }, { k: 'Use', v: 'Sand, metal, soil' }], sls: false, badge: 'For hire', images: [I('p-truck.svg'), I('yard-5.webp')], visible: true, featured: true, hire: true, order: 1 },
    { id: 'v-lorry', name: 'Isuzu Lorry', section: 'transport', category: 't-lorry', summary: 'Delivers our concrete items to your site.', description: 'A flat-bed lorry for delivering pipes, blocks and slabs. Also available for hire.', specs: [{ k: 'Load', v: '4 tonnes' }, { k: 'Body', v: 'Flat bed' }], sls: false, badge: 'For hire', images: [I('p-lorry.svg')], visible: true, featured: false, hire: true, order: 2 },
    { id: 'h-cement-50', name: 'Portland Cement 50 kg', section: 'hardware', category: 'h-cement', summary: 'Ordinary Portland cement for all building work.', description: 'Ordinary Portland cement in 50 kg bags from leading brands.', specs: [{ k: 'Bag', v: '50 kg' }], sls: true, badge: '', images: [I('p-cement.svg')], visible: true, featured: true, hire: false, order: 1 },
    { id: 'h-steel-bar', name: 'Steel Reinforcement Bars', section: 'hardware', category: 'h-steel', summary: 'Tor steel bars in all common sizes.', description: 'High-tensile tor steel bars for slabs, beams and columns, in all common diameters.', specs: [{ k: 'Sizes', v: '10 – 25 mm' }], sls: true, badge: '', images: [I('p-steel.svg')], visible: true, featured: false, hire: false, order: 2 },
  ],
};

/* ------------------------------------------------------------------ */
/* Normalising raw data (from Firestore / demo / defaults).            */
/* ------------------------------------------------------------------ */
const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
export function normSettings(s = {}) {
  const d = DEFAULTS.settings; s = { ...d, ...s };
  return {
    phones: arr(s.phones, 8).map(p => ({ label: str(p && p.label, 40), number: str(p && p.number, 24) })).filter(p => digits(p.number)),
    whatsapp: str(s.whatsapp, 24), email: str(s.email, 120), address: str(s.address, 300), hours: str(s.hours, 120),
    mapLat: Number(s.mapLat) || d.mapLat, mapLng: Number(s.mapLng) || d.mapLng, mapLink: safeMapLink(s.mapLink),
    facebook: /^https:\/\/(www\.|m\.)?facebook\.com\/[\w.\-/?=&%]+$/i.test(str(s.facebook, 300)) ? str(s.facebook, 300) : '',
  };
}
export function normHome(h = {}) {
  const d = DEFAULTS.home; h = { ...d, ...h };
  const sec = {};
  for (const k of SECTIONS) { const v = (h.sections && h.sections[k]) || d.sections[k]; sec[k] = { title: str(v.title, 60) || d.sections[k].title, text: str(v.text, 400) }; }
  return {
    badge: str(h.badge, 80), heroLine1: str(h.heroLine1, 80), heroLine2: str(h.heroLine2, 120), heroSub: str(h.heroSub, 400),
    gallery: arr(h.gallery, 10).map(img).filter(x => x.t || x.m),
    stats: arr(h.stats, 4).map(x => ({ value: str(x && x.value, 12), label: str(x && x.label, 40) })),
    sections: sec, slsTitle: str(h.slsTitle, 100), slsText: str(h.slsText, 500),
  };
}
export function normAbout(a = {}) {
  const d = DEFAULTS.about; a = { ...d, ...a };
  return {
    title: str(a.title, 120), intro: str(a.intro, 600), story: str(a.story, 3000), storyImage: img(a.storyImage),
    bossName: str(a.bossName, 80), bossRole: str(a.bossRole, 80), bossMessage: str(a.bossMessage, 800), bossPhoto: img(a.bossPhoto),
    slsTitle: str(a.slsTitle, 100), slsText: str(a.slsText, 800), certs: arr(a.certs, 12).map(img).filter(x => x.t || x.m),
    mission: str(a.mission, 500), vision: str(a.vision, 500),
    values: arr(a.values, 6).map(v => ({ title: str(v && v.title, 60), text: str(v && v.text, 200) })),
  };
}
export function normTransport(t = {}) {
  const d = DEFAULTS.transport; t = { ...d, ...t };
  const o = {};
  for (const k of ['title', 'intro', 'deliveryTitle', 'deliveryText', 'hireTitle', 'hireText']) o[k] = str(t[k], k.endsWith('Title') || k === 'title' ? 100 : 800);
  o.points = arr(t.points, 6).map(p => str(p, 60)).filter(Boolean);
  return o;
}
export function normCategory(c) {
  return { id: str(c.id, 40), name: str(c.name, 60), section: SECTIONS.includes(c.section) ? c.section : 'concrete', parent: typeof c.parent === 'string' && ID_RE.test(c.parent) ? c.parent : '', order: Number(c.order) || 0 };
}
export function normItem(i) {
  return {
    id: str(i.id, 40), name: str(i.name, 120), section: SECTIONS.includes(i.section) ? i.section : 'concrete',
    category: typeof i.category === 'string' && ID_RE.test(i.category) ? i.category : '',
    summary: str(i.summary, 200), description: str(i.description, 3000),
    specs: arr(i.specs, 12).map(s => ({ k: str(s && s.k, 40), v: str(s && s.v, 80) })).filter(s => s.k || s.v),
    sls: i.sls === true, badge: str(i.badge, 24), images: arr(i.images, 8).map(img).filter(x => x.t || x.m),
    visible: i.visible !== false, featured: i.featured === true, hire: i.hire === true, order: Number(i.order) || 0,
  };
}
const byOrder = (a, b) => (a.order - b.order) || a.name.localeCompare(b.name);
export function normAll(raw) {
  return {
    settings: normSettings(raw.settings), home: normHome(raw.home), about: normAbout(raw.about), transport: normTransport(raw.transport),
    categories: (raw.categories || []).map(normCategory).filter(c => c.id && c.name).sort(byOrder),
    items: (raw.items || []).map(normItem).filter(i => i.id && i.name).sort(byOrder),
  };
}
const defaultsRaw = () => JSON.parse(JSON.stringify(DEFAULTS));

/* ------------------------------------------------------------------ */
/* Demo backend (localhost only, data stays in this browser).          */
/* ------------------------------------------------------------------ */
const DEMO_KEY = 'kawya-demo-db-v1';
function demoDb() {
  try { const d = JSON.parse(localStorage.getItem(DEMO_KEY)); if (d && d.site) return d; } catch (e) { /* ignore */ }
  const r = defaultsRaw();
  const db = { site: { settings: r.settings, home: r.home, about: r.about, transport: r.transport }, categories: {}, items: {}, media: {} };
  r.categories.forEach(c => { db.categories[c.id] = c; });
  r.items.forEach(i => { db.items[i.id] = i; });
  return db;
}
function demoSave(db) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); }
  catch (e) { throw new Error('Demo storage is full. Use smaller or fewer photos while testing.'); }
}
function demoRaw(includeHidden) {
  const db = demoDb();
  const withId = o => Object.entries(o).map(([id, v]) => ({ ...v, id }));
  return { ...db.site, categories: withId(db.categories), items: withId(db.items).filter(i => includeHidden || i.visible !== false) };
}

/* ------------------------------------------------------------------ */
/* Firebase                                                            */
/* ------------------------------------------------------------------ */
let fbP = null;
export function firebase() {
  if (!fbP) {
    const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
    fbP = Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-firestore.js')]).then(([app, fs]) => {
      const a = app.getApps().length ? app.getApp() : app.initializeApp(FIREBASE_CONFIG);
      return { app: a, fs, db: fs.getFirestore(a), base };
    });
  }
  return fbP;
}
async function fbRaw(includeHidden) {
  const { fs, db } = await firebase();
  const itemsQ = includeHidden ? fs.collection(db, 'items') : fs.query(fs.collection(db, 'items'), fs.where('visible', '==', true));
  const site = n => fs.getDoc(fs.doc(db, 'site', n)).then(s => (s.exists() ? s.data() : undefined));
  const [settings, home, about, transport, cats, items] = await Promise.all([
    site('settings'), site('home'), site('about'), site('transport'), fs.getDocs(fs.collection(db, 'categories')), fs.getDocs(itemsQ),
  ]);
  const first = !settings && !home && cats.empty && items.empty; // never saved yet -> show defaults
  if (first && !includeHidden) return defaultsRaw();
  return {
    settings, home, about, transport,
    categories: cats.docs.map(d => ({ ...d.data(), id: d.id })),
    items: items.docs.map(d => ({ ...d.data(), id: d.id })),
    _empty: first,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */
const CACHE_KEY = 'kawya-site-cache-v1';
const CACHE_MAX_AGE = 5 * 60 * 1000; // returning visitors re-use content for 5 minutes (saves free Firestore reads)
function readCache() { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY)); if (c && c.raw && typeof c.t === 'number') return c; } catch (e) { /* ignore */ } return null; }
export function bustCache() { try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ } }
export function cachedSite() {
  if (MODE === 'demo') return normAll(demoRaw(false));
  const c = MODE === 'firebase' && readCache();
  return normAll(c ? c.raw : defaultsRaw());
}
export async function loadSite() {
  if (MODE === 'demo') return normAll(demoRaw(false));
  if (MODE === 'static') return normAll(defaultsRaw());
  const c = readCache();
  if (c && Date.now() - c.t < CACHE_MAX_AGE && Date.now() >= c.t) return normAll(c.raw);
  const raw = await fbRaw(false);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), raw })); } catch (e) { /* quota */ }
  return normAll(raw);
}

const mediaCache = new Map();
export async function getMedia(id) {
  if (!id || !ID_RE.test(id)) return '';
  if (mediaCache.has(id)) return mediaCache.get(id);
  const p = (async () => {
    if (MODE === 'demo') return safeImg(demoDb().media[id] || '');
    if (MODE !== 'firebase') return '';
    const { fs, db } = await firebase();
    const s = await fs.getDoc(fs.doc(db, 'media', id));
    return s.exists() ? safeImg(s.data().data) : '';
  })().catch(() => '');
  mediaCache.set(id, p);
  return p;
}
// Best available source for an image object: full media if present, else thumbnail.
export async function fullSrc(o) { const f = o && o.m ? await getMedia(o.m) : ''; return f || (o && o.t) || ''; }

/* ------------------------------------------------------------------ */
/* Admin API                                                           */
/* ------------------------------------------------------------------ */
export async function adminApi() {
  if (MODE === 'demo') {
    let user = sessionStorage.getItem('kawya-demo-user') ? { email: 'demo@local', uid: 'demo' } : null;
    const subs = new Set();
    const emit = () => subs.forEach(f => f(user));
    return {
      mode: 'demo',
      onUser(f) { subs.add(f); setTimeout(() => f(user)); },
      async signIn(email, pass) {
        await new Promise(r => setTimeout(r, 350));
        if (email !== 'demo@local' || pass !== 'demo1234') throw new Error('auth/invalid-credential');
        sessionStorage.setItem('kawya-demo-user', '1'); user = { email, uid: 'demo' }; emit();
      },
      async signOut() { sessionStorage.removeItem('kawya-demo-user'); user = null; emit(); },
      async resetPassword() { throw new Error('Not available in demo mode.'); },
      async loadAll() { return { ...normAll(demoRaw(true)), _empty: false }; },
      async saveSite(name, data) { const db = demoDb(); db.site[name] = data; demoSave(db); },
      async saveDoc(col, id, data) { const db = demoDb(); db[col][id] = data; demoSave(db); },
      async removeDoc(col, id) { const db = demoDb(); delete db[col][id]; demoSave(db); },
      async batch(ops) { const db = demoDb(); for (const o of ops) { if (o.del) delete db[o.col][o.id]; else db[o.col][o.id] = o.data; } demoSave(db); },
      async addMedia(dataUrl) { const db = demoDb(); const id = newId(); db.media[id] = dataUrl; demoSave(db); mediaCache.delete(id); return id; },
      async removeMedia(id) { const db = demoDb(); delete db.media[id]; demoSave(db); mediaCache.delete(id); },
      async getPrivate(name) { const db = demoDb(); return (db.private && db.private[name]) || null; },
      async savePrivate(name, data) { const db = demoDb(); db.private = db.private || {}; db.private[name] = data; demoSave(db); },
    };
  }
  if (MODE !== 'firebase') return null;
  const { app, fs, db, base } = await firebase();
  const au = await import(base + 'firebase-auth.js');
  const auth = au.getAuth(app);
  await au.setPersistence(auth, au.browserSessionPersistence);
  return {
    mode: 'firebase',
    onUser(f) { au.onAuthStateChanged(auth, u => f(u ? { email: u.email, uid: u.uid } : null)); },
    signIn: (e, p) => au.signInWithEmailAndPassword(auth, e, p),
    signOut: () => au.signOut(auth),
    resetPassword: e => au.sendPasswordResetEmail(auth, e),
    async loadAll() { const raw = await fbRaw(true); return { ...normAll(raw), _empty: !!raw._empty }; },
    saveSite: (name, data) => { bustCache(); return fs.setDoc(fs.doc(db, 'site', name), data); },
    saveDoc: (col, id, data) => { bustCache(); return fs.setDoc(fs.doc(db, col, id), data); },
    removeDoc: (col, id) => { bustCache(); return fs.deleteDoc(fs.doc(db, col, id)); },
    async batch(ops) {
      bustCache();
      for (let i = 0; i < ops.length; i += 400) {
        const b = fs.writeBatch(db);
        for (const o of ops.slice(i, i + 400)) { const r = fs.doc(db, o.col, o.id); if (o.del) b.delete(r); else b.set(r, o.data); }
        await b.commit();
      }
    },
    async addMedia(dataUrl) { const id = newId(); await fs.setDoc(fs.doc(db, 'media', id), { data: dataUrl }); return id; },
    async removeMedia(id) { mediaCache.delete(id); await fs.deleteDoc(fs.doc(db, 'media', id)); },
    async getPrivate(name) { const s = await fs.getDoc(fs.doc(db, 'private', name)); return s.exists() ? s.data() : null; },
    savePrivate: (name, data) => fs.setDoc(fs.doc(db, 'private', name), data),
  };
}
