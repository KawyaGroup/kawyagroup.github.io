import { cachedSite, loadSite, fullSrc, SECTIONS, telHref, waHref, mailHref, mapEmbed, ID_RE } from './data.js';
import { h, icon } from './ui.js';

const $ = (s, r = document) => r.querySelector(s);
const main = $('#main');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let S = cachedSite();
let cleanup = [];

const SEC_LABEL = { concrete: 'Concrete Items', transport: 'Transport', hardware: 'Hardware' };
const SEC_ICON = { concrete: 'cube', transport: 'truck', hardware: 'tool' };

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */
function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch (e) { return ''; } });
  const q = new URLSearchParams(qs || '');
  return { name: parts[0] || 'home', parts, q };
}
const PAGES = { home: pageHome, about: pageAbout, products: pageProducts, item: pageItem, transport: pageTransport, contact: pageContact };

let lastRouteKey = '';
async function render(opts = {}) {
  const r = parseRoute();
  const page = PAGES[r.name] || pageHome;
  const key = r.name + '/' + (r.parts[1] || '');
  const samePage = key === lastRouteKey && !opts.force;
  // Products filter changes re-render in place (no page transition / scroll jump).
  if (samePage && r.name === 'products') { productsUpdate(r); return; }
  lastRouteKey = key;
  const old = main.firstElementChild;
  if (old && !opts.instant && !reduce) { old.classList.add('out'); await new Promise(res => setTimeout(res, 200)); }
  cleanup.forEach(f => { try { f(); } catch (e) { /* ignore */ } }); cleanup = [];
  const view = h('div', { class: 'view' });
  main.replaceChildren(view);
  page(view, r);
  if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
  setActive(r.name === 'item' ? 'products' : (PAGES[r.name] ? r.name : 'home'));
  observe(view);
  document.title = titleFor(r) + ' · Kawya Group';
  closeSheet();
}
function titleFor(r) {
  if (r.name === 'item') { const it = S.items.find(i => i.id === r.parts[1]); return it ? it.name : 'Product'; }
  return { home: 'Concrete Yard, Transport & Hardware', about: 'About us', products: 'Products', transport: 'Transport service', contact: 'Contact us' }[r.name] || 'Kawya Group';
}

/* ------------------------------------------------------------------ */
/* Nav                                                                 */
/* ------------------------------------------------------------------ */
function setActive(name) {
  document.querySelectorAll('[data-route]').forEach(a => a.classList.toggle('on', a.dataset.route === name));
  movePill();
}
function movePill() {
  const nav = $('.links'), pill = nav && nav.querySelector('.pill'), on = nav && nav.querySelector('a.on');
  if (!pill) return;
  if (!on) { pill.style.opacity = '0'; return; }
  pill.style.opacity = '1';
  pill.style.width = on.offsetWidth + 'px';
  pill.style.transform = `translateX(${on.offsetLeft}px)`;
}
addEventListener('resize', movePill);
if (document.fonts) document.fonts.ready.then(movePill);
const burger = $('#burger'), sheet = $('#sheet');
function closeSheet() { sheet.hidden = true; burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }
burger.addEventListener('click', () => {
  const open = sheet.hidden;
  sheet.hidden = !open; burger.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) sheet.querySelectorAll('a').forEach(a => { a.style.animation = 'none'; void a.offsetWidth; a.style.animation = ''; });
});
addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); const lb = $('.lb'); if (lb) lb.remove(); } });
// the top bar always stays visible (no hide/show on scroll, which made scrolling feel jumpy)

/* ------------------------------------------------------------------ */
/* Reveal on scroll                                                    */
/* ------------------------------------------------------------------ */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); if (e.target.dataset.count != null) countUp(e.target); }
}), { rootMargin: '0px 0px -6% 0px', threshold: 0 });
function observe(root) {
  root.querySelectorAll('[data-r], .words, [data-count]').forEach(el => (reduce ? (el.classList.add('in')) : io.observe(el)));
}
const R = (el, kind = '', d = 0) => { el.dataset.r = kind; if (d) el.style.setProperty('--d', d + 's'); return el; };
function words(tag, text, cls = '', base = 0, grey = 0) {
  const el = h(tag, { class: 'words ' + cls });
  const parts = text.split(/\s+/).filter(Boolean);
  parts.forEach((w, i) => {
    if (i) el.append(' ');
    const inner = h('span', null, w); inner.style.setProperty('--d', (base + i * 0.07).toFixed(3) + 's');
    el.append(h('span', { class: 'w' + (grey && i >= parts.length - Math.min(grey, parts.length - 1) ? ' g' : '') }, inner));
  });
  return el;
}
function countUp(el) {
  const txt = el.dataset.count; const m = txt.match(/^(\D*)(\d[\d,]*)(.*)$/);
  if (!m || reduce) { el.textContent = txt; return; }
  const target = parseInt(m[2].replace(/,/g, ''), 10); const t0 = performance.now(); const dur = 1600;
  const step = t => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 4); el.textContent = m[1] + Math.round(target * e).toLocaleString() + m[3]; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */
const arrowBtn = (text, href, cls = 'btn-dark', ext = false) => h('a', { class: 'btn ' + cls, href, target: ext ? '_blank' : null, rel: ext ? 'noopener noreferrer' : null }, h('span', null, text), h('i', { class: 'arrow', 'aria-hidden': 'true' }));
const waNumber = () => S.settings.whatsapp || (S.settings.phones[0] && S.settings.phones[0].number) || '';
const waLink = text => waHref(waNumber(), text) || '#/contact';

// <img> that shows the thumbnail first and swaps to the full image when it arrives
function pic(o, alt = '', cls = '') {
  const el = h('img', { alt, loading: 'lazy', decoding: 'async', class: cls });
  const photo = o && !o.c && photoish(o.t || 'x.webp');
  if (photo) el.classList.add('photo');
  if (o && o.t) el.src = o.t;
  if (o && o.m) fullSrc(o).then(src => { if (src && src !== o.t) el.src = src; });
  return el;
}
// Uploaded photos (data URLs) and yard photos are shown "cover"; svg renders are shown floating.
const photoish = src => /^data:image\//.test(src) || /\.(webp|jpe?g|png)$/i.test(src);

function slsBadge() { return h('span', { class: 'badge sls' }, h('img', { src: 'assets/img/sls.png', alt: '' }), 'SLS'); }
function catName(id) { const c = S.categories.find(c => c.id === id); return c ? c.name : ''; }
function itemCard(it, i = 0) {
  const card = h('a', { class: 'pcard', href: '#/item/' + encodeURIComponent(it.id) },
    h('div', { class: 'badges' }, it.sls ? slsBadge() : null, it.badge ? h('span', { class: 'badge' + (it.hire ? ' hire' : '') }, it.badge) : null),
    h('div', { class: 'pic' }, it.images[0] ? pic(it.images[0], it.name) : h('img', { src: 'assets/img/mark.svg', alt: '', style: { width: '30%', opacity: '.12' } })),
    h('div', { class: 'row' },
      h('div', null, h('h3', null, it.name), it.summary ? h('p', { class: 'sum' }, it.summary) : null),
      h('span', { class: 'view', 'aria-hidden': 'true' })));
  card.style.setProperty('--d', Math.min(i, 12) * 0.05 + 's');
  return card;
}
function lightbox(src) {
  if (!src) return;
  const lb = h('div', { class: 'lb', role: 'dialog', 'aria-modal': 'true', onclick: e => { if (e.target === lb || e.target.tagName === 'BUTTON') lb.remove(); } },
    h('img', { src, alt: '' }), h('button', { 'aria-label': 'Close' }, '×'));
  document.body.append(lb);
}
function mapFrame() {
  const src = mapEmbed(S.settings.mapLat, S.settings.mapLng);
  return src ? h('iframe', { src, title: 'Kawya Group on Google Maps', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade', allowfullscreen: true }) : h('div');
}
const dirLink = () => S.settings.mapLink || `https://www.google.com/maps/dir/?api=1&destination=${S.settings.mapLat},${S.settings.mapLng}`;

/* ------------------------------------------------------------------ */
/* HOME                                                                */
/* ------------------------------------------------------------------ */
function pageHome(v) {
  const H = S.home;
  const hero = h('section', { class: 'hero wrap' },
    R(h('span', { class: 'tag' }, h('span', { class: 'dot' }, h('img', { src: 'assets/img/mark.svg', alt: '' })), H.badge), 'blur'),
    h('h1', null, words('span', H.heroLine1, 'serif', .1), words('span', H.heroLine2, '', .25)),
    R(h('p', { class: 'sub' }, H.heroSub), '', .45),
    R(h('div', { class: 'ctas' }, arrowBtn('View products', '#/products'), arrowBtn('Contact us', '#/contact', 'btn-light')), '', .55));
  v.append(hero);

  if (H.gallery.length) v.append(R(curve(H.gallery), 'fade', .3));

  const trio = h('div', { class: 'trio wrap' }, SECTIONS.map((k, i) =>
    R(h('a', { href: k === 'transport' ? '#/transport' : '#/products/' + k }, h('h3', null, H.sections[k].title), h('p', null, H.sections[k].text)), '', .1 * i)));
  v.append(trio);

  if (H.stats.length) {
    v.append(h('div', { class: 'wrap' }, h('div', { class: 'stats' }, H.stats.map((s, i) =>
      R(h('div', { class: 'stat' }, h('b', { 'data-count': s.value }, s.value), h('span', null, s.label)), '', i * .08)))));
  }

  // Bento
  const img3 = H.gallery[2] || H.gallery[0];
  const bento = h('section', { class: 'sec wrap' },
    h('div', { class: 'sec-head' }, words('h2', 'Everything your build needs, from one yard', '', 0, 3), R(h('p', null, 'Three businesses that work together, so your materials are made, moved and supplied by the same people.'), '', .2)),
    h('div', { class: 'bento' },
      R(h('a', { class: 'tile photo big', href: '#/products/concrete' }, h('div', { class: 'bg' }, img3 ? pic(img3, '') : null), h('span', { class: 'go' }), h('h3', null, H.sections.concrete.title), h('p', null, H.sections.concrete.text)), 'scale'),
      R(h('a', { class: 'tile sand', href: '#/transport' }, h('img', { class: 'art', src: 'assets/img/p-truck.svg', alt: '' }), h('span', { class: 'go' }), h('h3', null, H.sections.transport.title), h('p', null, H.sections.transport.text)), 'scale', .1),
      R(h('a', { class: 'tile tan', href: '#/products/hardware' }, h('img', { class: 'art', src: 'assets/img/p-cement.svg', alt: '' }), h('span', { class: 'go' }), h('h3', null, H.sections.hardware.title), h('p', null, H.sections.hardware.text)), 'scale', .05),
      R(h('a', { class: 'tile olive', href: '#/about' }, h('img', { class: 'art', src: 'assets/img/p-block.svg', alt: '' }), h('span', { class: 'go' }), h('h3', null, 'SLS certified'), h('p', null, 'Every concrete item we make carries the Sri Lanka Standards mark.')), 'scale', .15)));
  v.append(bento);

  const feat = S.items.filter(i => i.featured);
  const list = (feat.length ? feat : S.items).slice(0, 10);
  if (list.length) {
    v.append(h('section', { class: 'wrap', style: { paddingBottom: '40px' } },
      h('div', { class: 'rail-head' }, h('div', null, R(h('span', { class: 'eyebrow' }, 'From the yard'), ''), words('h2', 'Popular items', '', 0, 1)), R(arrowBtn('All products', '#/products', 'btn-light'), '', .1)),
      h('div', { class: 'rail' }, list.map((it, i) => R(itemCard(it), '', i * .06)))));
  }

  v.append(h('section', { class: 'sec wrap' }, R(h('div', { class: 'slsband' },
    h('div', { class: 'seal' }, h('img', { src: 'assets/img/sls.png', alt: 'SLS mark' })),
    h('div', null, h('h2', null, H.slsTitle), h('p', null, H.slsText)),
    arrowBtn('About our quality', '#/about', 'btn-light')), 'scale')));

  v.append(h('section', { class: 'wrap' },
    h('div', { class: 'sec-head' }, words('h2', 'Visit our yard', '', 0, 2), R(h('p', null, S.settings.address), '', .15)),
    R(h('div', { class: 'mapcard' }, mapFrame(),
      h('div', { class: 'float' }, h('span', { class: 'eyebrow' }, 'Kawya Group'), h('h3', null, 'Find us'), h('p', null, S.settings.address + (S.settings.hours ? ' · ' + S.settings.hours : '')),
        arrowBtn('Get directions', dirLink(), 'btn-dark', true))), 'scale')));

  v.append(cta());
}
function cta() {
  return h('section', { class: 'cta wrap' },
    words('h2', 'Let’s build something that lasts.', '', 0, 2),
    R(h('p', null, 'Tell us what you need. We reply quickly on WhatsApp and phone.'), '', .2),
    R(h('div', { class: 'ctas', style: { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' } },
      arrowBtn('Chat on WhatsApp', waLink('Hello Kawya Group, I would like to ask about '), 'btn-dark', true), arrowBtn('All contact details', '#/contact', 'btn-light')), '', .3));
}

// Concave 3D gallery (cards bend toward you at the edges), auto-scrolls, draggable.
function curve(gallery) {
  const wrap = h('div', { class: 'curve', 'aria-label': 'Photos from our yard' });
  const stage = h('div', { class: 'stage' }); wrap.append(stage);
  let imgs = gallery.slice(); while (imgs.length < 9) imgs = imgs.concat(gallery);
  const cards = imgs.map(o => { const c = h('figure', { class: 'card' }, pic(o, '')); stage.append(c); return c; });
  let off = 0, vel = 0, drag = null, raf = 0, W = 0, cw = 0, gap = 0;
  const measure = () => { W = wrap.clientWidth; cw = cards[0].offsetWidth || 200; gap = cw * 1.08; };
  measure();
  const ro = new ResizeObserver(measure); ro.observe(wrap);
  const tick = () => {
    if (!drag) { vel *= 0.94; off += (reduce ? 0 : 0.35) + vel; }
    const total = gap * cards.length;
    cards.forEach((c, i) => {
      let x = ((i * gap - off) % total + total) % total - total / 2;
      const n = Math.max(-1.6, Math.min(1.6, x / (W / 2 || 1)));
      const rot = -n * 32, sc = 1 + Math.abs(n) * .32, z = Math.abs(n) * 60;
      c.style.transform = `translate(-50%,-50%) translate3d(${x}px,0,${z}px) rotateY(${rot}deg) scale(${sc})`;
      c.style.zIndex = String(100 - Math.round(Math.abs(n) * 10));
    });
    raf = requestAnimationFrame(tick);
  };
  let visible = true;
  const vio = new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was) raf = requestAnimationFrame(tick); else if (!visible) cancelAnimationFrame(raf); });
  vio.observe(wrap);
  raf = requestAnimationFrame(tick);
  wrap.addEventListener('pointerdown', e => { drag = { x: e.clientX, off, last: e.clientX, t: performance.now() }; wrap.classList.add('drag'); wrap.setPointerCapture(e.pointerId); });
  wrap.addEventListener('pointermove', e => { if (!drag) return; off = drag.off - (e.clientX - drag.x); const now = performance.now(); vel = -(e.clientX - drag.last) / Math.max(8, now - drag.t) * 10; drag.last = e.clientX; drag.t = now; });
  const end = () => { drag = null; wrap.classList.remove('drag'); };
  wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
  cleanup.push(() => { cancelAnimationFrame(raf); ro.disconnect(); vio.disconnect(); });
  return wrap;
}

/* ------------------------------------------------------------------ */
/* ABOUT                                                               */
/* ------------------------------------------------------------------ */
function pageAbout(v) {
  const A = S.about, H = S.home;
  v.append(h('section', { class: 'phead wrap' }, R(h('span', { class: 'eyebrow' }, 'About us'), 'blur'), words('h1', A.title, '', 0, 2), R(h('p', null, A.intro), '', .3)));

  v.append(h('section', { class: 'sec wrap', style: { paddingTop: '40px' } }, h('div', { class: 'about-intro' },
    R(h('div', { class: 'pic' }, A.storyImage.t || A.storyImage.m ? pic(A.storyImage, 'Kawya Group yard') : null,
      h('span', { class: 'tag yardtag' }, h('span', { class: 'dot' }, h('img', { src: 'assets/img/mark.svg', alt: '' })), 'Our yard')), 'scale'),
    h('div', { class: 'txt' }, R(h('span', { class: 'eyebrow' }, 'Our story'), ''), words('h2', 'Made in our yard. Delivered by our trucks.', '', 0, 4), R(h('p', null, A.story), '', .2)))));

  // Boss
  const bp = A.bossPhoto;
  v.append(h('section', { class: 'wrap' }, R(h('div', { class: 'boss' },
    h('div', { class: 'photo' }, bp.t || bp.m ? pic(bp, A.bossName) : h('div', { class: 'ph' }, h('img', { src: 'assets/img/mark.svg', alt: '' }))),
    h('div', { class: 'body' }, h('span', { class: 'eyebrow' }, 'A word from our founder'), h('blockquote', null, A.bossMessage),
      h('div', { class: 'who' }, h('span', { class: 'line' }), h('div', null, h('b', null, A.bossName), h('span', null, A.bossRole))))), 'scale')));

  // Services
  v.append(h('section', { class: 'sec wrap' },
    h('div', { class: 'sec-head' }, words('h2', 'What we do', '', 0, 2), R(h('p', null, 'Three services, one team you can count on.'), '', .15)),
    h('div', { class: 'svc3' }, SECTIONS.map((k, i) => R(h('a', { class: 'svc', href: k === 'transport' ? '#/transport' : '#/products/' + k },
      h('span', { class: 'n' }, icon(SEC_ICON[k])), h('h3', null, H.sections[k].title), h('p', null, H.sections[k].text),
      h('span', { class: 'more' }, k === 'transport' ? 'See our fleet' : 'See products', ' →')), '', i * .08)))));

  // SLS
  const certs = A.certs.length
    ? h('div', { class: 'certs' }, A.certs.map((c, i) => {
      const f = h('figure', { class: 'cert', tabindex: '0', role: 'button', 'aria-label': 'View certificate' }, pic(c, c.label || 'SLS certificate'), c.label ? h('figcaption', null, c.label) : null);
      const open = async () => lightbox(await fullSrc(c));
      f.addEventListener('click', open); f.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
      return R(f, 'scale', i * .06);
    }))
    : h('div', { class: 'certs-empty' }, [0, 1, 2].map(() => h('div', null, h('img', { src: 'assets/img/sls.png', alt: '' }))));
  v.append(h('section', { class: 'wrap' }, R(h('div', { class: 'sls-wrap' },
    h('div', null, h('div', { class: 'mk' }, h('span', null, h('img', { src: 'assets/img/sls.png', alt: 'SLS' })), h('em', { class: 'eyebrow' }, 'Sri Lanka Standards')),
      h('h2', null, A.slsTitle), h('p', null, A.slsText)),
    certs), 'scale')));

  // Mission / vision / values
  v.append(h('section', { class: 'sec wrap' },
    h('div', { class: 'mv' }, R(h('div', { class: 'm' }, h('h3', null, 'Our mission'), h('p', null, A.mission)), 'scale'), R(h('div', { class: 'v' }, h('h3', null, 'Our vision'), h('p', null, A.vision)), 'scale', .1)),
    A.values.length ? h('div', { class: 'values' }, A.values.map((x, i) => R(h('div', null, h('b', null, x.title), h('p', null, x.text)), '', i * .08))) : null));
  v.append(cta());
}

/* ------------------------------------------------------------------ */
/* PRODUCTS                                                            */
/* ------------------------------------------------------------------ */
let P = null; // live state of the products page
const kids = (sec, parent) => S.categories.filter(c => c.section === sec && c.parent === parent);
function descendants(id) { const out = new Set([id]); let grew = true; while (grew) { grew = false; for (const c of S.categories) if (out.has(c.parent) && !out.has(c.id)) { out.add(c.id); grew = true; } } return out; }
function pathTo(id) { const p = []; let c = S.categories.find(x => x.id === id); let guard = 0; while (c && guard++ < 20) { p.unshift(c); c = S.categories.find(x => x.id === c.parent); } return p; }
function countIn(sec, id) { const ds = id ? descendants(id) : null; return S.items.filter(i => i.section === sec && (!ds || ds.has(i.category))).length; }
function setQuery(sec, cat, q) {
  const qs = new URLSearchParams(); if (cat) qs.set('c', cat); if (q) qs.set('q', q);
  const s = qs.toString();
  history.replaceState(null, '', '#/products/' + sec + (s ? '?' + s : ''));
  productsUpdate(parseRoute());
}
function pageProducts(v, r) {
  const side = h('aside', { class: 'side' });
  const toggle = h('button', { class: 'side-toggle', 'aria-expanded': 'false', onclick: () => { const o = side.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(o)); } }, icon('filter'), h('span', null, 'Browse categories'), h('i', { class: 'chev', 'aria-hidden': 'true' }));
  const tree = h('nav', { class: 'tree', 'aria-label': 'Product sections and categories' });
  side.append(h('div', { class: 'side-logo' }, h('span', { class: 'disc' }, h('img', { src: 'assets/img/mark.svg', alt: '' })), h('div', null, h('b', null, 'Kawya'), h('span', null, 'Product range'))), toggle, tree);
  const title = h('h1', { class: 'ptitle' });
  const search = h('input', { type: 'search', placeholder: 'Search products', 'aria-label': 'Search products', maxlength: '60' });
  let st; search.addEventListener('input', () => { clearTimeout(st); st = setTimeout(() => setQuery(P.sec, P.cat, search.value.trim()), 180); });
  const crumbs = h('div', { class: 'pcrumbs' });
  const grid = h('div', { class: 'pgrid' });
  const pmain = h('div', { class: 'pmain' }, h('div', { class: 'phead2' }, title, h('label', { class: 'psearch' }, icon('search'), search)), crumbs, grid);
  v.append(h('section', { class: 'pwrap wrap' }, h('div', { class: 'panel' }, side, pmain)));
  P = { tree, title, search, crumbs, grid, side, sec: null, cat: null, q: null };
  productsUpdate(r, true);
  cleanup.push(() => { P = null; });
}
function productsUpdate(r, first = false) {
  if (!P) return;
  const sec = SECTIONS.includes(r.parts[1]) ? r.parts[1] : 'concrete';
  let cat = r.q.get('c') || ''; if (cat && !S.categories.some(c => c.id === cat && c.section === sec)) cat = '';
  const q = (r.q.get('q') || '').slice(0, 60);
  const changed = first || sec !== P.sec || cat !== P.cat || q !== P.q;
  P.sec = sec; P.cat = cat; P.q = q;
  if (document.activeElement !== P.search) P.search.value = q;
  const path = cat ? pathTo(cat) : [];
  const onPath = new Set(path.map(c => c.id));
  // sidebar tree: three sections, the open one shows its categories (nested along the chosen path)
  const branch = (parent, depth) => {
    const list = kids(sec, parent);
    if (!list.length) return null;
    return h('ul', { class: 'branch' + (depth ? ' sub' : '') }, list.map(c => {
      const n = countIn(sec, c.id), active = c.id === cat;
      return h('li', null,
        h('button', { class: 'leaf' + (active ? ' on' : onPath.has(c.id) ? ' path' : ''), 'aria-current': active ? 'true' : null, onclick: () => { setQuery(sec, c.id, q); P.side.classList.remove('open'); } },
          h('span', { class: 'lt' }, c.name), n ? h('span', { class: 'cnt' + (active ? ' g' : '') }, n) : null),
        onPath.has(c.id) ? branch(c.id, depth + 1) : null);
    }));
  };
  P.tree.replaceChildren(...SECTIONS.map(k => {
    const open = k === sec;
    return h('div', { class: 'grp' + (open ? ' open' : '') },
      h('button', { class: 'secrow' + (open && !cat ? ' on' : ''), onclick: () => { setQuery(k, '', ''); if (k !== sec) P.side.classList.add('open'); } },
        icon(SEC_ICON[k]), h('span', { class: 'lt' }, S.home.sections[k].title || SEC_LABEL[k]), h('span', { class: 'cnt' + (open && !cat ? ' g' : '') }, countIn(k, '')), h('i', { class: 'chev', 'aria-hidden': 'true' })),
      open ? branch('', 0) : null);
  }));
  // title: name in ink, count fading to grey (reference style)
  const name = cat ? catName(cat) : (S.home.sections[sec].title || SEC_LABEL[sec]);
  if (!changed) return;
  const ds = cat ? descendants(cat) : null; const ql = q.toLowerCase();
  const items = S.items.filter(i => i.section === sec && (!ds || ds.has(i.category)) && (!ql || (i.name + ' ' + i.summary + ' ' + catName(i.category)).toLowerCase().includes(ql)));
  P.title.replaceChildren(h('span', null, name), ' ', h('span', { class: 'fade' }, items.length + (items.length === 1 ? ' item' : ' items')));
  P.title.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: reduce ? 1 : 600, easing: 'cubic-bezier(.22,1,.36,1)' });
  P.crumbs.replaceChildren(...[
    h('button', { onclick: () => setQuery(sec, '', q) }, S.home.sections[sec].title || SEC_LABEL[sec]),
    ...path.flatMap(c => [h('span', { class: 'sep', 'aria-hidden': 'true' }, '/'), h('button', { class: c.id === cat ? 'on' : '', onclick: () => setQuery(sec, c.id, q) }, c.name)]),
    q ? h('button', { class: 'qchip', onclick: () => setQuery(sec, cat, '') }, '“' + q + '”  ×') : null].filter(Boolean));
  P.grid.replaceChildren(...(items.length ? items.map((it, i) => itemCard(it, i)) : [h('div', { class: 'empty' }, h('b', null, 'Nothing here yet'), q ? 'Try another search word.' : 'We are adding items to this category soon. Call or WhatsApp us to ask.')]));
}

/* ------------------------------------------------------------------ */
/* ITEM DETAIL                                                         */
/* ------------------------------------------------------------------ */
function pageItem(v, r) {
  const id = r.parts[1] || '';
  const it = ID_RE.test(id) && S.items.find(i => i.id === id);
  if (!it) {
    v.append(h('section', { class: 'phead wrap' }, h('h1', null, 'Item not found'), h('p', null, 'This item may have been removed.'), h('div', { style: { marginTop: '24px' } }, arrowBtn('Back to products', '#/products'))));
    return;
  }
  const sib = S.items.filter(i => i.section === it.section);
  const idx = sib.indexOf(it), prev = sib[(idx - 1 + sib.length) % sib.length], next = sib[(idx + 1) % sib.length];
  const imgs = it.images.length ? it.images : [{ t: 'assets/img/mark.svg', m: '' }];
  let cur = 0, busy = false;
  const floatEl = h('div', { class: 'stage-float' });
  const first = pic(imgs[0], it.name); floatEl.append(first);
  const counter = h('div', { class: 'counter' });
  const knob = h('span', { class: 'knob' });
  const arc = h('div', { class: 'arc' }); arc.innerHTML = '<svg viewBox="0 0 100 26" preserveAspectRatio="none"><path d="M0 2 Q50 30 100 2" fill="none" stroke="rgba(18,18,18,.25)" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>'; arc.append(knob);
  const thumbs = h('div', { class: 'thumbs' });
  const placeKnob = () => { const t = imgs.length > 1 ? cur / (imgs.length - 1) : .5; knob.style.left = (t * 100) + '%'; knob.style.top = (2 + 56 * t * (1 - t)) + 'px'; counter.textContent = String(cur + 1).padStart(2, '0') + ' / ' + String(imgs.length).padStart(2, '0'); };
  function show(n) {
    if (busy || n === cur || !imgs[n]) return;
    const dir = n > cur ? 1 : -1; busy = true;
    const old = floatEl.querySelector('img:last-child');
    const nu = pic(imgs[n], it.name); floatEl.append(nu);
    if (reduce) { old.remove(); busy = false; }
    else {
      old.animate([{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: `translateX(${-90 * dir}px) rotate(${-8 * dir}deg) scale(.86)`, opacity: 0, filter: 'blur(6px)' }], { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).onfinish = () => old.remove();
      nu.animate([{ transform: `translateX(${120 * dir}px) rotate(${10 * dir}deg) scale(.82)`, opacity: 0 }, { offset: .7, opacity: 1 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 160, easing: 'cubic-bezier(.34,1.4,.5,1)', fill: 'backwards' }).onfinish = () => { busy = false; };
    }
    cur = n; thumbs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === cur)); placeKnob();
  }
  imgs.forEach((o, i) => thumbs.append(h('button', { class: i === 0 ? 'on' : '', 'aria-label': 'Picture ' + (i + 1), onclick: () => show(i) }, pic(o, ''))));
  floatEl.addEventListener('click', () => show((cur + 1) % imgs.length));
  // swipe on touch
  let sx = null; floatEl.addEventListener('pointerdown', e => { sx = e.clientX; });
  floatEl.addEventListener('pointerup', e => { if (sx != null && Math.abs(e.clientX - sx) > 40) show((cur + (e.clientX < sx ? 1 : imgs.length - 1)) % imgs.length); sx = null; });
  placeKnob();

  const path = pathTo(it.category);
  const ask = `Hello Kawya Group, I would like to know more about: ${it.name}`;
  const phone = S.settings.phones[0];
  const left = h('div', { class: 'left' },
    h('a', { class: 'back', href: '#/products/' + it.section + (it.category ? '?c=' + encodeURIComponent(it.category) : '') }, 'Back'),
    h('div', { class: 'stagewrap' }, h('div', { style: { width: '100%' } }, floatEl, h('div', { class: 'shadow', style: { margin: '6px auto 0' } }))),
    imgs.length > 1 ? [arc, counter, thumbs] : null);
  const right = h('div', { class: 'right' },
    h('span', { class: 'eyebrow' }, [SEC_LABEL[it.section]].concat(path.map(c => c.name)).join('  ·  ')),
    words('h1', it.name),
    R(h('div', { class: 'meta' }, it.sls ? h('span', { class: 'badge sls' }, h('img', { src: 'assets/img/sls.png', alt: '' }), 'SLS certified') : null, it.badge ? h('span', { class: 'badge' + (it.hire ? ' hire' : '') }, it.badge) : null), '', .15),
    R(h('p', { class: 'desc' }, it.description || it.summary), '', .2),
    it.specs.length ? R(h('div', { class: 'specs' }, it.specs.map(s => h('div', null, h('span', null, s.k), h('b', null, s.v)))), '', .25) : null,
    R(h('div', { class: 'acts' }, arrowBtn(it.section === 'transport' ? 'Book on WhatsApp' : 'Ask on WhatsApp', waLink(ask), 'btn-dark', true), phone ? h('a', { class: 'btn btn-ghost', href: telHref(phone.number) }, icon('phone'), 'Call us') : null), '', .3),
    R(h('p', { class: 'note' }, 'Prices change with size and quantity. Ask us for a quote.'), '', .35),
    sib.length > 1 ? R(h('div', { class: 'pn' }, h('a', { href: '#/item/' + encodeURIComponent(prev.id) }, '← Previous', h('b', null, prev.name)), h('a', { class: 'nx', href: '#/item/' + encodeURIComponent(next.id) }, 'Next →', h('b', null, next.name))), '', .4) : null);
  v.append(h('section', { class: 'wrap' }, h('div', { class: 'detail' }, left, right)));

  const rel = S.items.filter(i => i.id !== it.id && i.section === it.section && (i.category === it.category || path.some(p => descendants(p.id).has(i.category)))).slice(0, 8);
  const more = rel.length ? rel : sib.filter(i => i.id !== it.id).slice(0, 8);
  if (more.length) v.append(h('section', { class: 'sec wrap', style: { paddingBottom: '20px' } }, h('div', { class: 'rail-head' }, words('h2', 'You may also need', '', 0, 2)), h('div', { class: 'rail' }, more.map((x, i) => R(itemCard(x), '', i * .05)))));
  const onKey = e => { if (e.target.closest('input,textarea')) return; if (e.key === 'ArrowRight') show((cur + 1) % imgs.length); if (e.key === 'ArrowLeft') show((cur - 1 + imgs.length) % imgs.length); };
  addEventListener('keydown', onKey); cleanup.push(() => removeEventListener('keydown', onKey));
}

/* ------------------------------------------------------------------ */
/* TRANSPORT                                                           */
/* ------------------------------------------------------------------ */
function pageTransport(v) {
  const T = S.transport;
  const fleet = S.items.filter(i => i.section === 'transport');
  v.append(h('section', { class: 'wrap t-hero' },
    h('div', null, R(h('span', { class: 'eyebrow' }, 'Transport service'), 'blur'), words('h1', T.title, '', 0, 2), R(h('p', null, T.intro), '', .25),
      T.points.length ? R(h('div', { class: 'points' }, T.points.map(p => h('span', null, p))), '', .35) : null),
    lorryStage()));

  v.append(h('section', { class: 'sec wrap', style: { paddingBottom: '40px' } }, h('div', { class: 'modes' },
    R(h('div', { class: 'mode a' }, h('div', null, h('span', { class: 'num' }, '01'), h('h3', { style: { marginTop: '14px' } }, T.deliveryTitle), h('p', null, T.deliveryText)), arrowBtn('Browse concrete items', '#/products/concrete', 'btn-dark')), 'scale'),
    R(h('div', { class: 'mode b' }, h('div', null, h('span', { class: 'num' }, '02'), h('h3', { style: { marginTop: '14px' } }, T.hireTitle), h('p', null, T.hireText)), arrowBtn('Ask to hire', waLink('Hello Kawya Group, I would like to hire a vehicle for '), 'btn-dark', true)), 'scale', .1))));

  v.append(h('section', { class: 'sec wrap', style: { paddingTop: '40px' } },
    h('div', { class: 'sec-head' }, words('h2', 'Our fleet', '', 0, 1), R(h('p', null, fleet.length ? 'Every vehicle is maintained in our own yard and driven by our own team.' : 'Vehicle details coming soon.'), '', .15)),
    h('div', { class: 'fleet' }, fleet.map((it, i) => {
      const main0 = it.images[0];
      return R(h('article', { class: 'veh' },
        h('a', { class: 'vpic', href: '#/item/' + encodeURIComponent(it.id), 'aria-label': it.name }, main0 ? pic(main0, it.name) : null),
        h('div', { class: 'vbody' },
          h('div', { class: 'meta', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, catName(it.category) ? h('span', { class: 'eyebrow' }, catName(it.category)) : null, it.hire ? h('span', { class: 'badge hire' }, 'Available for hire') : null),
          h('h3', null, it.name), h('p', null, it.description || it.summary),
          it.specs.length ? h('div', { class: 'specs' }, it.specs.map(s => h('div', null, h('span', null, s.k), h('b', null, s.v)))) : null,
          h('div', { class: 'acts' }, arrowBtn(it.hire ? 'Book this vehicle' : 'Ask about delivery', waLink(`Hello Kawya Group, I would like to ask about the ${it.name}`), 'btn-dark', true), h('a', { class: 'btn btn-ghost', href: '#/item/' + encodeURIComponent(it.id) }, 'Details')))), 'scale', (i % 2) * .05);
    }))));
  v.append(cta());
}

/* ------------------------------------------------------------------ */
/* Lorry that drives in and parks (Transport page)                     */
/* ------------------------------------------------------------------ */
const LORRY_SVG = `<svg viewBox="0 0 640 300" aria-hidden="true">
<defs>
<linearGradient id="lm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#EDEDF0"/><stop offset="1" stop-color="#CFCFD4"/></linearGradient>
<linearGradient id="lb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9E9EC"/><stop offset="1" stop-color="#BFC0C6"/></linearGradient>
<linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5A6270"/><stop offset=".5" stop-color="#2A2F38"/><stop offset="1" stop-color="#1A1D23"/></linearGradient>
<linearGradient id="lp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2E0DC"/><stop offset=".6" stop-color="#BDBAB4"/><stop offset="1" stop-color="#99968F"/></linearGradient>
<radialGradient id="lh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#6E6B65"/><stop offset="1" stop-color="#8F8C85"/></radialGradient>
<radialGradient id="ls" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="rgba(0,0,0,.28)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient>
</defs>
<ellipse class="lshadow" cx="330" cy="262" rx="300" ry="16" fill="url(#ls)"/>
<g class="lbody">
<rect x="36" y="206" width="560" height="14" rx="6" fill="#2A2B30"/>
<rect x="36" y="172" width="372" height="36" rx="7" fill="url(#lb)"/>
<rect x="36" y="172" width="372" height="5" rx="2.5" fill="#fff" opacity=".7"/>
<g><rect x="58" y="100" width="156" height="72" rx="10" fill="url(#lp)"/><ellipse cx="214" cy="136" rx="15" ry="36" fill="#D9D6D0"/><ellipse cx="215" cy="136" rx="10" ry="27" fill="url(#lh)"/></g>
<g><rect x="232" y="100" width="156" height="72" rx="10" fill="url(#lp)"/><ellipse cx="388" cy="136" rx="15" ry="36" fill="#D9D6D0"/><ellipse cx="389" cy="136" rx="10" ry="27" fill="url(#lh)"/></g>
<rect x="404" y="96" width="10" height="112" rx="3" fill="#2A2B30"/>
<path d="M420 208 V98 Q420 80 438 80 H516 Q538 80 552 98 L594 156 Q604 170 604 186 V208 Z" fill="url(#lm)"/>
<path d="M452 96 H514 Q526 96 534 106 L566 150 H452 Z" fill="url(#lg)"/>
<path d="M460 102 H496 L470 144 H460 Z" fill="#fff" opacity=".12"/>
<path d="M440 108 V194" stroke="#C9C9CE" stroke-width="1.5"/>
<rect x="452" y="160" width="16" height="4" rx="2" fill="#9A9BA1"/>
<text x="476" y="190" font-family="Inter Tight, Arial, sans-serif" font-size="11" font-weight="600" letter-spacing="1.6" fill="#8E8E93">KAWYA</text>
<rect x="588" y="168" width="14" height="12" rx="3" fill="#FFF7D6"/>
<rect x="562" y="200" width="48" height="14" rx="5" fill="#2A2B30"/>
</g>
<g class="wheel"><circle cx="122" cy="226" r="30" fill="#18191C"/><circle cx="122" cy="226" r="17" fill="#D6D7DB"/><circle cx="122" cy="226" r="6" fill="#55575D"/><rect x="119" y="210" width="6" height="8" rx="2" fill="#8E9096"/><rect x="119" y="234" width="6" height="8" rx="2" fill="#8E9096"/><rect x="106" y="223" width="8" height="6" rx="2" fill="#8E9096"/><rect x="130" y="223" width="8" height="6" rx="2" fill="#8E9096"/></g>
<g class="wheel"><circle cx="198" cy="226" r="30" fill="#18191C"/><circle cx="198" cy="226" r="17" fill="#D6D7DB"/><circle cx="198" cy="226" r="6" fill="#55575D"/><rect x="195" y="210" width="6" height="8" rx="2" fill="#8E9096"/><rect x="195" y="234" width="6" height="8" rx="2" fill="#8E9096"/><rect x="182" y="223" width="8" height="6" rx="2" fill="#8E9096"/><rect x="206" y="223" width="8" height="6" rx="2" fill="#8E9096"/></g>
<g class="wheel"><circle cx="522" cy="226" r="30" fill="#18191C"/><circle cx="522" cy="226" r="17" fill="#D6D7DB"/><circle cx="522" cy="226" r="6" fill="#55575D"/><rect x="519" y="210" width="6" height="8" rx="2" fill="#8E9096"/><rect x="519" y="234" width="6" height="8" rx="2" fill="#8E9096"/><rect x="506" y="223" width="8" height="6" rx="2" fill="#8E9096"/><rect x="530" y="223" width="8" height="6" rx="2" fill="#8E9096"/></g>
</svg>`;
function lorryStage() {
  const stage = h('div', { class: 'lorry-stage', role: 'img', 'aria-label': 'A Kawya Group lorry carrying concrete pipes', title: 'Tap to drive again' });
  const road = h('div', { class: 'lroad', 'aria-hidden': 'true' });
  const truck = h('div', { class: 'lorry' }); truck.innerHTML = LORRY_SVG; // constant markup only
  stage.append(h('div', { class: 'lglow', 'aria-hidden': 'true' }), road, truck);
  const body = truck.querySelector('.lbody'), wheels = [...truck.querySelectorAll('.wheel')];
  let anims = [];
  const drive = () => {
    anims.forEach(a => a.cancel()); anims = [];
    if (reduce) return;
    const D = 2200, ease = 'cubic-bezier(.16,1,.3,1)';
    anims.push(truck.animate([{ transform: 'translateX(115%)' }, { transform: 'translateX(0)' }], { duration: D, easing: ease, fill: 'both' }));
    wheels.forEach(w => anims.push(w.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-1260deg)' }], { duration: D, easing: ease, fill: 'both' })));
    anims.push(road.animate([{ backgroundPosition: '0 0' }, { backgroundPosition: '-900px 0' }], { duration: D, easing: ease, fill: 'both' }));
    // brake: the body dips forward, rocks back and settles
    anims.push(body.animate([{ transform: 'rotate(0deg)' }, { offset: .72, transform: 'rotate(0deg)' }, { offset: .82, transform: 'rotate(1.6deg)' }, { offset: .9, transform: 'rotate(-.7deg)' }, { offset: .96, transform: 'rotate(.25deg)' }, { transform: 'rotate(0deg)' }], { duration: D + 500, easing: 'ease-out', fill: 'both' }));
  };
  stage.addEventListener('click', drive);
  requestAnimationFrame(() => requestAnimationFrame(drive));
  cleanup.push(() => anims.forEach(a => a.cancel()));
  return stage;
}

/* ------------------------------------------------------------------ */
/* CONTACT                                                             */
/* ------------------------------------------------------------------ */
function pageContact(v) {
  const C = S.settings;
  v.append(h('section', { class: 'phead wrap' }, R(h('span', { class: 'eyebrow' }, 'Contact us'), 'blur'), words('h1', 'Talk to Kawya Group', '', 0, 2), R(h('p', null, 'Call, WhatsApp or visit the yard. We are happy to help with sizes, quantities and delivery.'), '', .25)));
  const wa = waHref(waNumber());
  const grid = h('div', { class: 'c-grid' });
  grid.append(
    R(h('div', { class: 'ccard span5' }, h('span', { class: 'ic' }, icon('phone')), h('span', { class: 'lbl' }, 'Phone numbers'),
      h('div', { class: 'phones' }, C.phones.length ? C.phones.map(p => h('a', { href: telHref(p.number) }, h('b', null, p.number), h('span', null, p.label))) : h('p', { class: 'muted' }, 'Numbers coming soon.'))), 'scale'),
    R(h('a', { class: 'ccard wa span4', href: wa || '#/contact', target: '_blank', rel: 'noopener noreferrer' }, h('span', { class: 'ic' }, icon('wa')), h('span', { class: 'lbl' }, 'WhatsApp'), h('span', { class: 'val' }, waNumber() || '—'), h('span', { style: { fontSize: '14px', opacity: '.75', marginTop: '6px' } }, 'Tap to start a chat →')), 'scale', .06),
    R(h('div', { class: 'ccard dark span3' }, h('span', { class: 'ic' }, icon('clock')), h('span', { class: 'lbl' }, 'Open hours'), h('span', { class: 'val sm' }, C.hours || '—')), 'scale', .12),
    R(h('div', { class: 'ccard span6' }, h('span', { class: 'ic' }, icon('pin')), h('span', { class: 'lbl' }, 'Address'), h('span', { class: 'val sm' }, C.address), h('div', { style: { marginTop: '14px' } }, arrowBtn('Open in Google Maps', dirLink(), 'btn-dark', true))), 'scale'),
    mailHref(C.email) ? R(h('a', { class: 'ccard span6', href: mailHref(C.email) }, h('span', { class: 'ic' }, icon('mail')), h('span', { class: 'lbl' }, 'Email'), h('span', { class: 'val sm' }, C.email)), 'scale', .06)
      : R(contactForm('span6'), 'scale', .06),
    R(h('div', { class: 'mapcard span12' }, mapFrame()), 'scale'),
  );
  if (mailHref(C.email)) grid.append(R(contactForm('span12'), 'scale'));
  if (C.facebook) grid.append(R(h('a', { class: 'ccard span12', href: C.facebook, target: '_blank', rel: 'noopener noreferrer', style: { flexDirection: 'row', alignItems: 'center', gap: '16px' } }, h('span', { class: 'ic', style: { margin: 0 } }, icon('fb')), h('span', { class: 'val sm' }, 'Follow Kawya Group on Facebook')), 'scale'));
  v.append(h('section', { class: 'wrap', style: { paddingBottom: '60px' } }, grid));
}
function contactForm(span) {
  const name = h('input', { name: 'name', autocomplete: 'name', maxlength: '60', required: true });
  const phone = h('input', { name: 'phone', type: 'tel', autocomplete: 'tel', maxlength: '20', inputmode: 'tel' });
  const msg = h('textarea', { name: 'msg', maxlength: '800', required: true });
  const err = h('p', { class: 'err', 'aria-live': 'polite' });
  const form = h('form', { class: 'form', novalidate: true },
    h('div', { class: 'two' }, h('label', null, 'Your name', name), h('label', null, 'Phone (optional)', phone)),
    h('label', null, 'What do you need?', msg), err,
    h('button', { class: 'btn btn-dark', type: 'submit', style: { justifySelf: 'start' } }, h('span', null, 'Send on WhatsApp'), h('i', { class: 'arrow', 'aria-hidden': 'true' })));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const n = name.value.trim(), m = msg.value.trim(), p = phone.value.trim();
    if (!n || !m) { err.textContent = 'Please add your name and what you need.'; return; }
    err.textContent = '';
    const text = `Hello Kawya Group,\n\nName: ${n}${p ? '\nPhone: ' + p : ''}\n\n${m}`;
    const href = waHref(waNumber(), text);
    if (!href) { err.textContent = 'WhatsApp number is not set yet. Please call us.'; return; }
    window.open(href, '_blank', 'noopener,noreferrer');
  });
  return h('div', { class: 'ccard ' + span }, h('span', { class: 'lbl' }, 'Send us a message'), h('span', { class: 'val sm' }, 'It opens WhatsApp with your message ready to send.'), form);
}

/* ------------------------------------------------------------------ */
/* Footer & global links                                               */
/* ------------------------------------------------------------------ */
function renderChrome() {
  const C = S.settings; const wa = waHref(waNumber());
  const navWa = $('#navWa'), fab = $('#fab');
  if (wa) { navWa.href = wa; fab.href = wa; } else { navWa.href = '#/contact'; fab.href = '#/contact'; navWa.removeAttribute('target'); fab.removeAttribute('target'); }
  fab.replaceChildren(icon('wa'));
  $('#foot').replaceChildren(h('div', { class: 'wrap' },
    h('div', { class: 'cols' },
      h('div', null, h('img', { class: 'logo', src: 'assets/img/logo.svg', alt: 'Kawya Group' }), h('p', null, 'SLS certified concrete products, transport and hardware, from one trusted yard.')),
      h('div', null, h('h4', null, 'Explore'), h('a', { href: '#/' }, 'Home'), h('a', { href: '#/about' }, 'About us'), h('a', { href: '#/products' }, 'Products'), h('a', { href: '#/transport' }, 'Transport'), h('a', { href: '#/contact' }, 'Contact')),
      h('div', null, h('h4', null, 'Products'), SECTIONS.map(k => h('a', { href: k === 'transport' ? '#/transport' : '#/products/' + k }, S.home.sections[k].title))),
      h('div', null, h('h4', null, 'Contact'), C.phones.slice(0, 3).map(p => h('a', { href: telHref(p.number) }, p.number)), wa ? h('a', { href: wa, target: '_blank', rel: 'noopener noreferrer' }, 'WhatsApp') : null, h('a', { href: dirLink(), target: '_blank', rel: 'noopener noreferrer' }, C.address))),
    h('div', { class: 'big', 'aria-hidden': 'true' }, 'Kawya Group'),
    h('div', { class: 'bottom' }, h('span', null, '© ' + new Date().getFullYear() + ' Kawya Group. All rights reserved.'), h('span', null, 'Every concrete item SLS certified'))));
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
addEventListener('hashchange', () => render());
renderChrome();
render({ instant: true });
loadSite().then(fresh => {
  if (JSON.stringify(fresh) === JSON.stringify(S)) return;
  S = fresh; renderChrome();
  render({ instant: true, force: true, keepScroll: true });
}).catch(e => console.warn('Could not load latest content', e));
