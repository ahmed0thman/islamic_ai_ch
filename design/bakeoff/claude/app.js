/* Huda reading screen: bake-off entry (Claude).
   Every Arabic string is read from content/ui.ar.json or content/export/*.json at runtime.
   No Arabic is written in this file. */
'use strict';

const BASE = '../../../content/';
const NF = new Intl.NumberFormat('ar-EG', { useGrouping: false });
const dig = n => NF.format(n);
const GLYPH_TAIL = new RegExp('[\\s\\u00a0]*[\\uFB50-\\uFDCF\\uFDF0-\\uFDFF]+\\s*$');
const cleanAyah = t => t.replace(GLYPH_TAIL, '').trim();
const LEAD_PUNCT = /^\s*[.!?\u061F\u061B;:\u060C,]+\s*/;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const S = {
  ui: null, index: null, cache: new Map(),
  no: null, d: null, model: null, ayahMap: new Map(), main: [],
  depth: 1, scope: { kind: 'surah' },
  play: { units: [], i: -1 }, seen: new Set(),
  refs: null, opener: null, sheetOpener: null, io: null,
  cur: null, sheetSide: false, run: null
};

/* icons: Hugeicons paths live in icons.js; one glyph per source type (names verified against the installed package) */
const TYPE_ICON = { ayah: 'Quran03', hadith: 'QuoteDown', athar: 'Footprints', scholar: 'QuillWrite01', link: 'Link01', hidaya: 'Compass' };
const ico = (n, size, cls) => (window.icon ? window.icon(n, size, cls) : null);
const typeGlyph = (k, size) => ico(TYPE_ICON[k], size);
const wideMQ = window.matchMedia('(min-width: 1024px)');
const wide = () => wideMQ.matches;

const $ = (s, r = document) => r.querySelector(s);
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
  return e;
}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
};
async function getJSON(p) { const r = await fetch(BASE + p); if (!r.ok) throw new Error(p); return r.json(); }

/* ---------------- data model ---------------- */
async function loadSurah(no) {
  if (S.cache.has(no)) return S.cache.get(no);
  const d = await getJSON(`export/surah-${no}.json`);
  d.ayahMap = new Map(d.ayahs.map(a => [a.key, a]));
  d.main = d.ayahs.filter(a => a.key.startsWith(no + ':'));
  d.passIdx = new Map();
  (d.passages || []).forEach((p, i) => {
    const a = +p.from.split(':')[1], b = +p.to.split(':')[1];
    for (let n = a; n <= b; n++) d.passIdx.set(`${no}:${n}`, i);
  });
  d.model = d.levels.slice().sort((x, y) => x.depth - y.depth).map(l => parseLevel(d, l));
  S.cache.set(no, d);
  return d;
}

function segsOf(block) { return block.type === 'details' ? block.title.concat(block.blocks.flatMap(segsOf)) : (block.segments || []); }
function recordIdsOf(d, blocks) {
  const ids = new Set();
  for (const b of blocks) for (const s of segsOf(b)) {
    if (s.t === 'mark') s.records.forEach(r => ids.add(r));
  }
  return [...ids].filter(id => d.records[id]);
}
function iconsOf(d, blocks) {
  const set = new Set();
  recordIdsOf(d, blocks).forEach(id => d.records[id].icons.forEach(i => set.add(i)));
  return S.ui.icon_order.filter(i => set.has(i));
}
function anchorOf(d, blocks) {
  const no = d.surah.no; let best = null;
  for (const id of recordIdsOf(d, blocks)) for (const k of d.records[id].ayah_keys || []) {
    if (!k.startsWith(no + ':')) continue;
    const n = +k.split(':')[1];
    if (n >= 1 && n <= d.main.length && (best == null || n < best)) best = n;
  }
  return best == null ? null : `${no}:${best}`;
}
const flatText = segs => segs.filter(s => s.t === 'text' || s.t === 'term').map(s => s.v).join('').trim();

function parseLevel(d, lv) {
  const B = lv.blocks, out = { depth: lv.depth, ayahs: [], stops: [], sections: [], pins: [] };
  let cur = null, sec = null, group = null, gotAyahs = false;
  const newSec = heading => {
    sec = { idx: out.sections.length, heading, blocks: [], kind: heading && heading.kind };
    out.sections.push(sec); cur = null; return sec;
  };
  B.forEach((b, i) => {
    if (b.type === 'ayah') { if (!gotAyahs) { out.ayahs = b.keys.slice(); gotAyahs = true; } return; }
    if (b.type === 'heading') {
      const nx = B[i + 1]; cur = null;
      if (nx && nx.type === 'paragraph' && nx.title) { group = b; sec = null; } else { group = null; newSec(b); }
      return;
    }
    if (b.type === 'paragraph') {
      if (b.title) {
        const anchor = (b.ayahs && b.ayahs[0]) || d.main[0].key;
        cur = { kind: 'stop', title: b.title, role: b.role, ayahs: b.ayahs || [anchor], anchor, group, blocks: [b] };
        out.stops.push(cur); sec = null; return;
      }
      if (cur) cur.blocks.push(b); else { if (!sec) newSec(null); sec.blocks.push(b); }
      return;
    }
    if (b.type === 'details') { if (!sec) newSec(null); cur = null; sec.blocks.push(b); }
  });
  out.stops.forEach(s => {
    s.id = 's:' + s.anchor + '|' + s.title;
    s.key = s.id;
    s.icons = iconsOf(d, s.blocks);
    s.pass = d.passIdx.get(s.anchor);
    s.unit = s;
  });
  out.sections = out.sections.filter(s => s.blocks.length);
  out.sections.forEach((s, i) => {
    s.idx = i; s.kind2 = 'sec';
    s.unit = { kind: 'sec', sec: s, open: null, anchor: null, id: 'x:' + i + ':' + (s.heading ? s.heading.text : ''), key: 'x:' + (s.heading ? s.heading.text : i), icons: iconsOf(d, s.blocks), title: s.heading ? s.heading.text : '' };
    s.blocks.forEach((b, j) => {
      if (b.type !== 'details') return;
      const anchor = anchorOf(d, [b]);
      const title = flatText(b.title);
      const unit = { kind: 'sec', sec: s, open: j, anchor, id: `det:${i}:${j}`, key: 'd:' + title.slice(0, 48), icons: iconsOf(d, [b]), title, depthItem: true };
      out.pins.push({ unit, anchor, key: unit.key, id: unit.id, pass: anchor ? d.passIdx.get(anchor) : undefined });
    });
  });
  out.count = out.stops.length + out.pins.length;
  out.all = [...out.stops, ...out.sections.map(s => s.unit)];
  return out;
}

/* ---------------- scope & playlist ---------------- */
const model = () => S.model[S.depth];
function inScope(key) {
  const sc = S.scope;
  if (sc.kind === 'surah') return true;
  if (sc.kind === 'ayah') return key === sc.id;
  return S.d.passIdx.get(key) === sc.id;
}
function playlist() {
  const m = model();
  if (S.scope.kind === 'surah') return m.stops.map(s => s.unit).concat(m.sections.map(s => s.unit));
  const out = [];
  S.main.forEach(a => {
    if (!inScope(a.key)) return;
    m.stops.filter(s => s.anchor === a.key).forEach(s => out.push(s.unit));
    m.pins.filter(p => p.anchor === a.key).forEach(p => out.push(p.unit));
  });
  return out;
}
const unitTitle = u => u.kind === 'stop' ? u.title : (u.depthItem ? u.title : u.title || (S.d.surah.name));
function setScope(sc) {
  const same = S.scope.kind === sc.kind && S.scope.id === sc.id;
  S.scope = same ? { kind: 'surah' } : sc;
  paintScope(); updateHook();
}

/* ---------------- boot ---------------- */
async function init() {
  const sc = $('#screen');
  try {
    [S.ui, S.index] = await Promise.all([getJSON('ui.ar.json'), getJSON('export/index.json')]);
  } catch (e) { return fail(sc, init); }
  const seen = store.get('huda.seen'); if (seen) try { JSON.parse(seen).forEach(x => S.seen.add(x)); } catch (e) { /* ignore */ }
  const q = new URLSearchParams(location.search);
  const d0 = store.get('huda.depth');
  S.depth = Math.min(3, Math.max(0, q.has('d') ? +q.get('d') : (d0 != null ? +d0 : 1))) || 0;
  if (Number.isNaN(S.depth)) S.depth = 1;
  wireChrome();
  const ids = S.index.surahs.map(x => x.no);
  const want = +q.get('s');
  await selectSurah(ids.includes(want) ? want : (ids.includes(93) ? 93 : ids[0]), true);
}
function fail(sc, again) {
  sc.replaceChildren(h('button', { class: 'retry', type: 'button', 'aria-label': S.ui ? S.ui.reader.retry : 'Retry', onclick: () => { sc.replaceChildren(); again(); } }, ico('ArrowReloadHorizontal', 26)));
}
function wireChrome() {
  const u = S.ui;
  $('#sceneBack').textContent = u.reader.back;
  $('#sceneBack').addEventListener('click', closeScene);
  $('#scenePrev').append(ico('ArrowRight01', 20)); $('#sceneNext').append(ico('ArrowLeft01', 20));
  $('#scenePrev').setAttribute('aria-label', u.reader.previous_stop);
  $('#sceneNext').setAttribute('aria-label', u.reader.next_stop);
  $('#scenePrev').addEventListener('click', () => go(-1));
  $('#sceneNext').addEventListener('click', () => go(1));
  $('#sheetClose').textContent = u.panel.close;
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#scrim').addEventListener('click', closeSheet);
  buildKeybar();
  document.addEventListener('keydown', onKey);
  wideMQ.addEventListener('change', applyLayout);
}

/* keyboard: Esc closes the source (or the sheet); on wide screens the arrows walk the stops
   (RTL: left arrow = next, right arrow = previous), unless a control that owns the arrows has focus */
function onKey(e) {
  const sheetOpen = $('#sheet').classList.contains('open'), sceneOpen = $('#scene').classList.contains('open');
  if (e.key === 'Escape') {
    if (sheetOpen) closeSheet(); else if (sceneOpen && !wide()) closeScene();
    return;
  }
  if (!wide() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (sheetOpen && !S.sheetSide) return;
  if (e.target.closest && e.target.closest('.dial, input, textarea, select, [contenteditable]')) return;
  const d = e.key === 'ArrowLeft' ? 1 : -1;
  if (!sceneOpen) { const u = playlist()[0]; if (d > 0 && u) { e.preventDefault(); openUnit(u, document.activeElement); } return; }
  e.preventDefault(); go(d);
}

/* bottom key bar (wide only): six source types with their short names, then the three standing badges.
   Any item or the details button opens the key window. */
function buildKeybar() {
  const ui = S.ui, L = ui.legend, bar = $('#keybar');
  bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', L.title);
  const types = ui.icon_order.map(k => h('button', { class: 'kb-item', type: 'button', title: ui.icons[k].meaning, onclick: e => openLegend(e.currentTarget, k) },
    iconChip(k), h('span', null, ui.icons[k].short)));
  const badges = Object.entries(ui.badges).map(([k, b]) => h('button', { class: 'kb-item kb-badge', type: 'button', title: b.meaning, onclick: e => openLegend(e.currentTarget, 'b:' + k) },
    h('span', { class: 'bdg', style: `--tone:${b.color}` }, b.label)));
  bar.replaceChildren(h('div', { class: 'kb-in' },
    h('span', { class: 'kb-title' }, ico('Key01', 18), L.show),
    h('div', { class: 'kb-group' }, h('span', { class: 'kb-cap' }, L.icons_title), types),
    h('i', { class: 'kb-sep', 'aria-hidden': 'true' }),
    h('div', { class: 'kb-group' }, h('span', { class: 'kb-cap' }, L.badges_title), badges),
    h('button', { class: 'pill-btn kb-more', type: 'button', onclick: e => openLegend(e.currentTarget) }, ico('InformationCircle', 18), L.open_details)));
}

/* layout switch at 1024px: the same nodes move between the phone arrangement and the two-page spread */
function applyLayout() {
  const w = wide(), ph = $('#phone'), scene = $('#scene'), R = S.refs;
  if ($('#sheet').classList.contains('open')) closeSheet({ silent: true });
  ph.classList.toggle('wide', w);
  if (w) {
    $('#platform').append(scene);
    scene.setAttribute('role', 'region'); scene.setAttribute('aria-modal', 'false');
    $('#screen').removeAttribute('inert');
  } else {
    ph.insertBefore(scene, $('#keybar'));
    scene.setAttribute('role', 'dialog'); scene.setAttribute('aria-modal', 'true');
    if (scene.classList.contains('open')) $('#screen').setAttribute('inert', '');
  }
  if (R && R.cover) { $('#home').replaceChildren(); if (w) $('#home').append(R.homeStage, R.hook, R.flow); else R.cover.append(R.hook, R.flow); }
  ph.classList.toggle('reading', scene.classList.contains('open'));
}

async function selectSurah(no, first) {
  const sc = $('#screen');
  let d;
  try { d = await loadSurah(no); } catch (e) { return fail(sc, () => selectSurah(no, first)); }
  if ($('#scene').classList.contains('open')) closeScene({ silent: true });
  if ($('#sheet').classList.contains('open')) closeSheet({ silent: true });
  S.no = no; S.d = d; S.model = d.model; S.main = d.main; S.ayahMap = d.ayahMap;
  S.scope = { kind: 'surah' }; S.cur = null;
  $('#scene').setAttribute('aria-label', d.surah.name);
  buildMap();
  applyLayout();
  sc.scrollTo({ top: 0, behavior: 'auto' });
  applyDepth(false);
  const url = new URL(location.href); url.searchParams.set('s', no); history.replaceState(null, '', url);
}

/* ---------------- map ---------------- */
function iconChip(key, sm) {
  const i = S.ui.icons[key]; if (!i) return null;
  return h('span', { class: 'ic' + (sm ? ' sm' : ''), dataset: { k: key }, style: `--tone:${i.color}`, 'aria-hidden': 'true' }, typeGlyph(key, sm ? 14 : 16) || i.symbol);
}

function buildMap() {
  const { ui, d } = S, sc = $('#screen');
  const R = S.refs = { stations: new Map(), doors: new Map(), pins: new Map(), cols: new Map(), beads: new Map(), rails: [], chapters: [] };

  // cover
  const keyBtn = h('button', { class: 'key-btn', type: 'button', onclick: e => openLegend(e.currentTarget) },
    ui.legend.show, h('span', { class: 'key-dots', 'aria-hidden': 'true' }, ui.icon_order.map(k => h('i', { style: `--tone:${ui.icons[k].color}` }))));
  const appbar = h('div', { class: 'appbar' }, h('span', { class: 'brand' }, ui.app_name), keyBtn);
  const chips = h('div', { class: 'surah-chips' }, S.index.surahs.map(s =>
    h('button', { class: 'chip', type: 'button', 'aria-pressed': String(s.no === S.no), onclick: () => { if (s.no !== S.no) selectSurah(s.no); } }, s.name)));
  R.homeStage = h('div', { class: 'home-stage' });   // wide screens only: the ayahs of the opening stop above its question
  R.hookQ = h('span', { class: 'hook-q' });
  R.hookIcons = h('span', { class: 'hook-icons', 'aria-hidden': 'true' });
  R.hook = h('button', { class: 'hook', type: 'button', onclick: () => { const u = playlist(); if (u.length) openUnit(u[0], R.hook); } },
    R.hookQ, h('span', { class: 'hook-row' }, R.hookIcons, h('span', { class: 'hook-go', 'aria-hidden': 'true' }, ico('ArrowLeft01', 24))));
  R.flow = h('button', { class: 'read-flow', type: 'button', onclick: e => openContinuous(e.currentTarget) }, ico('BookOpen01', 20), ui.reader.read_continuous);
  R.unitText = h('span', { class: 'unit-t' });
  R.unitBtn = h('button', { class: 'unit-btn', type: 'button', 'aria-haspopup': 'dialog', onclick: e => openUnitMenu(e.currentTarget) }, ico('Bookmark01', 18), R.unitText);
  const cover = R.cover = h('header', { class: 'cover' },
    h('h1', { class: 'cover-name' }, d.surah.name),
    h('div', { class: 'cover-meta' }, h('span', { class: 'sym', 'aria-hidden': 'true' }, typeGlyph('ayah', 18)), h('b', null, dig(d.surah.ayah_count)), h('span', null, ui.tagline)),
    chips, R.unitBtn, R.hook, R.flow);

  // console: ribbon + scope + dial
  const groups = d.passages && d.passages.length ? d.passages.map((p, i) => ({ i, p, keys: d.main.filter(a => d.passIdx.get(a.key) === i) })) : [{ i: null, p: null, keys: d.main }];
  R.ribbon = h('nav', { class: 'ribbon', 'aria-label': ui.reader.ayahs_title });
  // one grid track per ayah (equal widths), a spacer track between passages
  const tracks = [];
  groups.forEach((g, gi) => {
    const start = tracks.length + 1;
    g.keys.forEach(() => tracks.push('1fr'));
    if (gi < groups.length - 1) tracks.push('6px');
    const rail = h('button', { class: 'rail', type: 'button', tabindex: g.p ? null : '-1', 'aria-hidden': g.p ? null : 'true', 'aria-label': g.p ? g.p.title : null, dataset: { p: g.i == null ? '' : g.i }, style: `grid-column:${start} / span ${g.keys.length};grid-row:1`, onclick: () => g.p && (setScope({ kind: 'passage', id: g.i }), scrollToKey(g.keys[0].key)) });
    const beads = h('div', { class: 'beads' }, g.keys.map((a, k) => {
      const bead = h('button', { class: 'bead', type: 'button', 'aria-label': ui.reader.ayahs_title + ' ' + dig(a.no), onclick: () => scrollToKey(a.key) }, h('span', { class: 'bn', dataset: (a.no === 1 || a.no % 5 === 0 || a.no === d.main.length) ? { show: '' } : null }, dig(a.no)));
      const pins = h('div', { class: 'pins' });
      const col = h('div', { class: 'col', style: `grid-column:${start + k};grid-row:2` }, bead, pins);
      R.cols.set(a.key, col); R.beads.set(a.key, bead); R.pins.set(a.key, pins);
      return col;
    }));
    const rp = h('div', { class: 'rp' + (g.p ? '' : ' plain') }, rail, beads);
    if (g.i != null) rp.style.setProperty('--pt', [16, 30, 44][g.i] ? [16, 30, 44][g.i] + '%' : '24%');
    R.ribbon.append(rp);
  });
  R.ribbon.style.gridTemplateColumns = tracks.join(' ');
  if (d.main.length > 14) R.ribbon.dataset.dense = '';   // wide thread column: smaller numerals so two digits do not touch
  R.scopeText = h('span');
  R.scopeRow = h('div', { class: 'scope-row', hidden: true }, R.scopeText, h('button', { class: 'round-btn', type: 'button', 'aria-label': ui.reader.back, onclick: () => setScope(S.scope) }, ico('Cancel01', 18)));
  R.dial = h('div', { class: 'dial', role: 'radiogroup', 'aria-label': ui.reader.choose_depth, onkeydown: dialKeys },
    h('i', { class: 'thumb' }), h('i', { class: 'fill' }),
    ui.levels.map(l => h('button', { class: 'notch', type: 'button', role: 'radio', 'aria-checked': 'false', dataset: { depth: l.depth }, onclick: () => setDepth(l.depth) },
      h('span', { class: 'nm' }, l.name))));
  R.dial.style.setProperty('--i', S.depth);
  const consoleEl = h('div', { class: 'console' }, R.ribbon, R.scopeRow, R.dial);

  // thread
  const thread = h('div', { class: 'thread' });
  let lastP = null;
  d.main.forEach(a => {
    const p = d.passIdx.get(a.key);
    if (d.passages && p !== lastP && p != null) {
      lastP = p; const ps = d.passages[p];
      const a1 = +ps.from.split(':')[1], a2 = +ps.to.split(':')[1];
      const go = h('button', { class: 'go', type: 'button', 'aria-pressed': 'false', 'aria-label': ps.title, dataset: { p }, onclick: () => setScope({ kind: 'passage', id: p }) }, ico('Play', 18));
      R.chapters.push(go);
      thread.append(h('div', { class: 'chapter' }, h('i', { class: 'node' }), h('div', { class: 'ct' }, h('b', null, ps.title), h('span', null, dig(a1) + ' - ' + dig(a2))), go));
    }
    const medal = h('button', { class: 'medal', type: 'button', 'aria-pressed': 'false', 'aria-label': ui.reader.ayahs_title + ' ' + dig(a.no), dataset: { key: a.key }, onclick: () => setScope({ kind: 'ayah', id: a.key }) }, dig(a.no));
    const doors = h('div', { class: 'doors' });
    const station = h('section', { class: 'station', dataset: { key: a.key } }, medal, h('div', { class: 'body' }, h('p', { class: 'verse' }, cleanAyah(a.text)), doors));
    R.stations.set(a.key, station); R.doors.set(a.key, doors);
    thread.append(station);
  });

  R.shelfBox = h('div', { class: 'doors shelf-doors' });
  R.shelf = h('section', { class: 'shelf' }, R.shelfBox, h('div', { class: 'shelf-end', 'aria-hidden': 'true' }, typeGlyph('ayah', 28)));
  R.empty = h('p', { class: 'empty-note', hidden: true }, ui.reader.empty_level);
  const fine = h('footer', { class: 'fine' }, h('p', null, ui.disclosure.ai), h('p', null, ui.disclosure.scripture), h('p', null, ui.disclosure.limits), h('p', null, ui.privacy_line));

  sc.replaceChildren(appbar, cover, consoleEl, thread, R.empty, R.shelf, fine);
  { const cur = chips.querySelector('[aria-pressed="true"]'); if (cur) chips.scrollLeft = cur.offsetLeft - (chips.clientWidth - cur.offsetWidth) / 2 - 0; }

  if (S.io) S.io.disconnect();
  S.io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return;
    const k = en.target.dataset.key;
    R.beads.forEach((b, key) => b.setAttribute('aria-current', String(key === k)));
  }), { root: sc, rootMargin: '-38% 0px -52% 0px' });
  R.stations.forEach(st => S.io.observe(st));
}

function dialKeys(e) {
  const map = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 };
  let n = null;
  if (e.key in map) n = S.depth + map[e.key]; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = 3;
  if (n == null) return;
  e.preventDefault(); n = Math.max(0, Math.min(3, n)); setDepth(n);
  const b = $(`.notch[data-depth="${n}"]`); if (b) b.focus();
}

function scrollToKey(key) {
  const st = S.refs.stations.get(key); if (!st) return;
  st.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  st.classList.remove('flash'); void st.offsetWidth; st.classList.add('flash');
}

function setDepth(n) {
  if (n === S.depth) return;
  S.depth = n; store.set('huda.depth', String(n));
  if (wide() && $('#scene').classList.contains('open')) closeScene({ silent: true });   // stop identity is not kept across depths
  if (S.scope.kind !== 'surah' && !playlist().length) S.scope = { kind: 'surah' };
  applyDepth(true);
}

/* reconcile keyed children so that changing depth reveals / hides pieces in place */
function reconcile(box, items, spec, animate) {
  const have = new Map();
  [...box.children].forEach(c => { if (!c.classList.contains('leaving')) have.set(c.dataset.key, c); });
  const want = new Set(items.map(i => i.key));
  have.forEach((c, k) => { if (!want.has(k)) { if (animate) { c.classList.add('leaving'); setTimeout(() => c.remove(), 650); } else c.remove(); } });
  items.forEach((it, n) => {
    let c = have.get(it.key);
    if (!c) {
      c = spec.make(it); c.dataset.key = it.key;
      if (animate) { c.classList.add('enter'); c.style.transitionDelay = (n * 45) + 'ms'; box.append(c); requestAnimationFrame(() => requestAnimationFrame(() => { c.classList.remove('enter'); setTimeout(() => { c.style.transitionDelay = ''; }, 700); })); }
      else box.append(c);
    } else { spec.update(c, it); box.append(c); }
  });
}

const doorSpec = {
  make(it) {
    const btn = h('button', { class: 'door', type: 'button' });
    const w = h('div', { class: 'door-wrap' }, h('div', { class: 'door-in' }, btn));
    btn.addEventListener('click', () => { const u = w._u; if (!inScopeUnit(u)) { S.scope = { kind: 'surah' }; paintScope(); updateHook(); } openUnit(u, btn); });
    doorSpec.update(w, it); return w;
  },
  update(w, it) {
    const u = it.unit; w._u = u;
    const b = w.querySelector('.door');
    b.className = 'door' + (u.depthItem ? ' depth' : '');
    if (S.seen.has(S.no + '|' + u.id)) b.setAttribute('data-seen', ''); else b.removeAttribute('data-seen');
    if (S.cur === u.id) { w.setAttribute('data-cur', ''); b.setAttribute('aria-current', 'true'); }
    b.replaceChildren(h('span', { class: 'door-title' }, unitTitle(u)), h('span', { class: 'door-meta' }, u.icons.map(k => iconChip(k, true))), ico('ArrowLeft01', 20, 'chev'));
  }
};
const pinSpec = {
  make(it) { const p = h('i', { class: 'pin' + (it.unit.depthItem ? ' depth' : '') }); return p; },
  update() { }
};
function inScopeUnit(u) { return playlist().some(x => x.id === u.id); }

function applyDepth(animate) {
  const R = S.refs, m = model(), d = S.d;
  R.dial.style.setProperty('--i', S.depth);
  R.dial.querySelectorAll('.notch').forEach(n => n.setAttribute('aria-checked', String(+n.dataset.depth === S.depth)));
  d.main.forEach(a => {
    const items = m.stops.filter(s => s.anchor === a.key).map(s => ({ key: s.key, unit: s.unit }))
      .concat(m.pins.filter(p => p.anchor === a.key).map(p => ({ key: p.key, unit: p.unit })));
    reconcile(R.doors.get(a.key), items, doorSpec, animate);
    reconcile(R.pins.get(a.key), items, pinSpec, animate);
  });
  reconcile(R.shelfBox, m.sections.map(s => ({ key: s.unit.key, unit: s.unit })), doorSpec, animate);
  R.shelf.hidden = !m.sections.length;
  R.empty.hidden = m.count + m.sections.length > 0;
  paintScope(); updateHook(animate);
}

function paintScope() {
  const R = S.refs, sc = S.scope, d = S.d;
  R.stations.forEach((st, k) => st.classList.toggle('dim', !inScope(k)));
  R.cols.forEach((c, k) => { c.classList.toggle('dim', !inScope(k)); c.classList.toggle('sel', sc.kind === 'ayah' && sc.id === k); });
  R.shelf.classList.toggle('dim', sc.kind !== 'surah');
  R.shelf.style.opacity = sc.kind !== 'surah' ? '.3' : '';
  R.stations.forEach((st, k) => st.querySelector('.medal').setAttribute('aria-pressed', String(sc.kind === 'ayah' && sc.id === k)));
  R.chapters.forEach(b => b.setAttribute('aria-pressed', String(sc.kind === 'passage' && sc.id === +b.dataset.p)));
  R.unitText.textContent = sc.kind === 'passage' ? d.passages[sc.id].title : sc.kind === 'ayah' ? S.ui.reader.ayahs_title + ' ' + dig(+sc.id.split(':')[1]) : d.surah.name;
  R.unitBtn.dataset.scope = sc.kind;
  syncPlay();
  R.scopeRow.hidden = sc.kind === 'surah';
  if (sc.kind === 'passage') R.scopeText.textContent = d.passages[sc.id].title;
  else if (sc.kind === 'ayah') R.scopeText.replaceChildren(typeGlyph('ayah', 16), dig(+sc.id.split(':')[1]));
}

function updateHook(animate) {
  const R = S.refs, list = playlist();
  R.hook.hidden = !list.length; R.flow.hidden = !list.length;
  if (!list.length) return;
  const u = list[0];
  const paint = () => {
    R.hookQ.textContent = unitTitle(u); R.hookIcons.replaceChildren(...u.icons.map(k => iconChip(k))); R.hookQ.classList.remove('swap');
    const st = u.kind === 'stop' ? makeStage(u.ayahs) : null; R.homeStage.replaceChildren(...(st ? [st] : []));
  };
  if (animate && !reduceMotion()) { R.hookQ.classList.add('swap'); setTimeout(paint, 220); } else paint();
}

/* ---------------- text rendering ---------------- */
function toBeats(segs) {
  const beats = []; let cur = [], closed = false;
  const flush = () => { if (cur.length) { beats.push(cur); cur = []; } };
  for (const s of segs) {
    if (s.t === 'text') {
      let v = s.v;
      if (!cur.length && closed && beats.length) {
        const m = v.match(LEAD_PUNCT);
        if (m) {
          const prev = beats[beats.length - 1];
          const before = prev[prev.length - 2];
          if (!before || (before.t !== 'quote' && before.t !== 'ayah')) prev.splice(prev.length - 1, 0, { t: 'text', v: m[0].trim() });
          v = v.slice(m[0].length);
        }
      }
      if (v.trim()) { cur.push({ t: 'text', v }); closed = false; }
    } else {
      cur.push(s);
      if (s.t === 'mark') { flush(); closed = true; } else closed = false;
    }
  }
  flush();
  return beats;
}

function ayahInline(key) {
  const a = S.ayahMap.get(key); if (!a) return null;
  const ref = key.split(':').map(n => dig(+n)).join(':');
  return h('span', { class: 'q-ayah', style: `--ayah-tone:${S.ui.icons.ayah.color}` }, cleanAyah(a.text), h('span', { class: 'ref' }, typeGlyph('ayah', 14), ref));
}
function recsOf(ids) { return ids.map(id => S.d.records[id]).filter(Boolean); }
function markBtn(seg) {
  const recs = recsOf(seg.records);
  const set = new Set(recs.flatMap(r => r.icons));
  const icons = S.ui.icon_order.filter(i => set.has(i));
  const flagged = recs.map(r => r.badge).find(b => b && b !== 'thabit');
  const kids = icons.map(k => iconChip(k));
  if (flagged && S.ui.badges[flagged]) kids.push(h('span', { class: 'bdg', style: `--tone:${S.ui.badges[flagged].color}` }, S.ui.badges[flagged].label));
  return h('button', { class: 'mark', type: 'button', 'aria-label': S.ui.panel.title, onclick: e => { e.stopPropagation(); e.preventDefault(); openRecords(seg.records, {}, e.currentTarget); } }, kids);
}
function termBtn(seg) {
  return h('button', { class: 'term', type: 'button', 'aria-label': S.ui.reader.open_term + ': ' + seg.v, onclick: e => { e.stopPropagation(); e.preventDefault(); openRecords([seg.record], { term: seg.v }, e.currentTarget); } }, seg.v);
}
function beatTone(segs) {
  const m = segs.find(s => s.t === 'mark'); if (!m) return null;
  const r = recsOf(m.records)[0]; if (!r || !r.icons[0]) return null;
  return S.ui.icons[r.icons[0]].color;
}
function renderBeat(segs, idx) {
  const tone = beatTone(segs);
  const b = h('div', { class: 'beat' + (tone ? '' : ' open'), style: `--i:${Math.min(idx, 9)};${tone ? '--tone:' + tone : ''}` });
  let afterBlock = false;
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    if (s.t === 'text') {
      const v = afterBlock ? s.v.replace(LEAD_PUNCT, '') : s.v;
      const nx = segs[k + 1];
      if (nx && nx.t === 'mark') {
        // keep the last word glued to its source marker so the marker never sits alone on a line
        const m = v.match(/^([\s\S]*?)(\S+\s*)$/);
        if (m) { if (m[1]) b.append(h('span', { class: 't' }, m[1])); b.append(h('span', { class: 'claim-end' }, m[2].trimEnd(), markBtn(nx))); k++; afterBlock = false; continue; }
      }
      b.append(h('span', { class: 't' }, v)); afterBlock = false;
    }
    else if (s.t === 'ayah') { b.append(ayahInline(s.key)); afterBlock = true; }
    else if (s.t === 'quote') {
      const q = h('span', { class: 'quote' });
      if (segs[k + 1] && segs[k + 1].t === 'mark') {
        const m = s.v.match(/^([\s\S]*?)(\S+)$/);
        if (m) { q.append(m[1], h('span', { class: 'claim-end' }, m[2], markBtn(segs[k + 1]))); } else { q.append(s.v, markBtn(segs[k + 1])); }
        k++;
      } else q.append(s.v);
      b.append(q); afterBlock = true;
    } else if (s.t === 'mark') { b.append(markBtn(s)); afterBlock = false; }
    else if (s.t === 'term') { b.append(termBtn(s)); afterBlock = false; }
  }
  return b;
}
function renderPara(p, counter) {
  return h('div', { class: 'para' + (p.role === 'transmission' ? ' transmission' : '') }, toBeats(p.segments).map(bt => renderBeat(bt, counter.n++)));
}
function renderSummary(segs) {
  const out = h('span', { class: 'sum-text' });
  segs.forEach(s => {
    if (s.t === 'text') out.append(s.v); else if (s.t === 'term') out.append(termBtn(s)); else if (s.t === 'mark') out.append(markBtn(s));
  });
  return out;
}
function renderDetails(b, counter, open) {
  const body = h('div', { class: 'deep-in' }, b.blocks.map(p => renderPara(p, counter)));
  const d = h('details', { class: 'deep' }, h('summary', null, renderSummary(b.title), h('span', { class: 'plus', 'aria-hidden': 'true' }, ico('PlusSign', 16, 'p'), ico('MinusSign', 16, 'm'))), body);
  if (open) d.open = true;
  return d;
}

/* ---------------- scene ---------------- */
function makeStage(keys) {
  const ks = keys.filter(k => S.ayahMap.has(k));
  if (!ks.length) return null;
  const verse = k => { const a = S.ayahMap.get(k); const n = k.split(':')[1]; return h('p', { class: 'stage-v' }, cleanAyah(a.text), h('span', { class: 'gem', 'aria-hidden': 'true' }, dig(+n))); };
  const stage = h('div', { class: 'stage' });
  if (ks.length <= 3) { ks.forEach(k => stage.append(verse(k))); return stage; }
  const holder = h('div'); const chips = h('div', { class: 'stage-chips' });
  const show = k => { holder.replaceChildren(verse(k)); chips.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k))); };
  ks.forEach(k => chips.append(h('button', { type: 'button', 'aria-pressed': 'false', dataset: { k }, 'aria-label': S.ui.reader.ayahs_title + ' ' + dig(+k.split(':')[1]), onclick: () => show(k) }, dig(+k.split(':')[1]))));
  stage.append(holder, chips); show(ks[0]); return stage;
}

function buildScene(u) {
  const frag = document.createDocumentFragment(), counter = { n: 0 };
  const keys = u.kind === 'stop' ? u.ayahs : (u.anchor ? [u.anchor] : []);
  const stage = makeStage(keys); if (stage) frag.append(stage);
  let kicker = null, title = null, isQ = false;
  if (u.kind === 'stop') {
    kicker = u.group ? u.group.text : (S.d.passages && S.d.passIdx.has(u.anchor) ? S.d.passages[S.d.passIdx.get(u.anchor)].title : null);
    title = u.title;
  } else if (u.sec.heading) { title = u.sec.heading.text; isQ = u.sec.heading.kind === 'question'; }
  else kicker = S.d.surah.name;
  if (title || kicker) frag.append(h('div', { class: 'scene-head' }, kicker && h('p', { class: 'kicker' }, kicker), title && h('h1', { class: 'scene-title' + (isQ ? ' q' : '') }, title)));
  const blocks = u.kind === 'stop' ? u.blocks : u.sec.blocks;
  let list = null, openEl = null;
  blocks.forEach((b, j) => {
    if (b.type === 'details') {
      if (!list) { list = h('div', { class: 'deep-list' }); frag.append(list); }
      const el = renderDetails(b, counter, u.open === j); if (u.open === j) openEl = el; list.append(el);
    } else { list = null; frag.append(renderPara(b, counter)); }
  });
  frag.append(buildOnward(u));
  return { frag, openEl };
}

function buildOnward(u) {
  const { units, i } = S.play, ui = S.ui, wrap = h('div', { class: 'onward' });
  const next = units[i + 1], prev = units[i - 1];
  if (next) {
    wrap.append(h('button', { class: 'next-card', type: 'button', onclick: () => go(1) },
      h('span', null, h('small', null, ui.reader.next_stop), h('strong', null, unitTitle(next))), h('span', { class: 'go', 'aria-hidden': 'true' }, ico('ArrowLeft01', 22))));
  }
  const alt = h('div', { class: 'alt-row' });
  if (prev) alt.append(h('button', { class: 'pill-btn', type: 'button', onclick: () => go(-1) }, ui.reader.previous_stop));
  const deeper = deeperUnit(u);
  if (deeper) alt.append(h('button', { class: 'pill-btn', type: 'button', onclick: () => { setDepth(S.depth + 1); const m = model(); const t = m.all.find(x => x.key === u.key) || (m.pins.find(p => p.key === u.key) || {}).unit; if (t) { S.play = { units: playlist(), i: Math.max(0, playlist().findIndex(x => x.id === t.id)) }; renderScene(t, 1); } } }, ui.levels[S.depth + 1].name));
  alt.append(h('button', { class: 'pill-btn', type: 'button', onclick: closeScene }, ui.reader.map_view));
  wrap.append(alt);
  return wrap;
}
function deeperUnit(u) {
  if (S.depth >= 3) return null;
  const m = S.model[S.depth + 1];
  return m.all.find(x => x.key === u.key) || (m.pins.find(p => p.key === u.key) || {}).unit || null;
}

function openUnit(u, opener) {
  let units = playlist();
  let i = units.findIndex(x => x.id === u.id);
  if (i < 0 && u.depthItem) { const pins = model().pins.map(p => p.unit); units = pins; i = pins.findIndex(x => x.id === u.id); }
  S.play = i < 0 ? { units: [u], i: 0 } : { units, i };
  S.opener = opener || document.activeElement;
  renderScene(u, 0);
  showScene();
}
function showScene() {
  const sc = $('#scene');
  sc.removeAttribute('inert'); sc.setAttribute('aria-hidden', 'false'); sc.classList.add('open');
  $('#phone').classList.add('reading');
  if (wide()) { $('#screen').removeAttribute('inert'); setTimeout(focusTitle, 80); }
  else { $('#screen').setAttribute('inert', ''); setTimeout(() => $('#sceneBack').focus({ preventScroll: true }), 80); }
}
function focusTitle() {
  const t = $('#sceneBody .scene-title');
  if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); } else $('#sceneBack').focus({ preventScroll: true });
}
function markSeen(u) {
  S.seen.add(S.no + '|' + u.id); store.set('huda.seen', JSON.stringify([...S.seen]));
  const w = [...document.querySelectorAll('.door-wrap')].find(x => x._u && x._u.id === u.id);
  if (w) w.querySelector('.door').setAttribute('data-seen', '');
}
function renderScene(u, dir) {
  const body = $('#sceneBody'), { units, i } = S.play;
  const { frag, openEl } = buildScene(u);
  body.className = 'scene-body'; void body.offsetWidth;
  body.replaceChildren(frag);
  if (dir && !reduceMotion()) body.classList.add(dir > 0 ? 'go-next' : 'go-prev');
  const sc = $('#sceneScroll'); sc.scrollTo({ top: 0, behavior: 'auto' });
  if ($('#sheet').classList.contains('open') && S.sheetSide) closeSheet({ silent: true });   // a source belongs to the text it was opened on
  S.cur = u.id; paintCurrent(u);
  if (wide() && $('#scene').classList.contains('open')) focusTitle();
  if (openEl) setTimeout(() => { const top = openEl.offsetTop - 70; sc.scrollTo({ top: Math.max(0, top), behavior: reduceMotion() ? 'auto' : 'smooth' }); }, 350);
  paintNav();
  markSeen(u);
}
function paintNav() {
  const { units, i } = S.play;
  $('#pips').replaceChildren(...units.map((x, n) => h('i', { dataset: { state: n === i ? 'here' : (n < i ? 'done' : 'todo') } })));
  $('#scenePrev').disabled = i <= 0; $('#sceneNext').disabled = i >= units.length - 1;
}
/* the stop list follows the reading unit while a stop is open (wide screens keep the thread usable) */
function syncPlay() {
  if (!$('#scene').classList.contains('open') || S.cur == null || !S.play.units.length) return;
  const units = playlist(), i = units.findIndex(x => x.id === S.cur);
  if (i >= 0) { S.play = { units, i }; paintNav(); }
}
/* mark the open stop in the thread (door and its ayah) and keep it in view */
function paintCurrent(u) {
  const R = S.refs; if (!R) return;
  document.querySelectorAll('.door-wrap').forEach(w => {
    const on = !!(u && w._u && w._u.id === u.id), b = w.querySelector('.door');
    w.toggleAttribute('data-cur', on);
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
  R.stations.forEach((st, k) => st.classList.toggle('cur', !!(u && u.anchor === k)));
  if (u && wide()) revealInThread(u);
}
function revealInThread(u) {
  const w = [...document.querySelectorAll('.door-wrap')].find(x => x._u && x._u.id === u.id); if (!w) return;
  const sc = $('#screen'), top = $('.console').getBoundingClientRect().bottom, s = sc.getBoundingClientRect();
  const st = u.anchor && S.refs.stations.get(u.anchor);
  let el = w;
  if (st && st.getBoundingClientRect().height < s.bottom - top - 24) el = st;
  const r = el.getBoundingClientRect();
  if (r.top >= top + 8 && r.bottom <= s.bottom - 8) return;
  const want = sc.scrollTop + (r.top - top) - (el === st ? 12 : ((s.bottom - top) - r.height) / 2);
  sc.scrollTo({ top: Math.max(0, want), behavior: reduceMotion() ? 'auto' : 'smooth' });
}
function go(delta) {
  const { units, i } = S.play, n = i + delta;
  if (n < 0 || n >= units.length) return;
  S.play.i = n; renderScene(units[n], delta);
}
function closeScene(opts) {
  const sc = $('#scene');
  sc.classList.remove('open'); sc.setAttribute('aria-hidden', 'true'); sc.setAttribute('inert', '');
  $('#screen').removeAttribute('inert');
  $('#phone').classList.remove('reading');
  S.cur = null; paintCurrent(null);
  if (!(opts && opts.silent) && S.opener && document.contains(S.opener)) S.opener.focus({ preventScroll: true });
}

/* continuous reading: the whole level as one calm page */
function openContinuous(opener) {
  const m = model(), counter = { n: 0 }, frag = document.createDocumentFragment();
  S.play = { units: [], i: -1 }; S.opener = opener;
  frag.append(h('div', { class: 'scene-head' }, h('h1', { class: 'scene-title' }, S.d.surah.name)));
  frag.append(makeStage(S.main.map(a => a.key)) || '');
  S.d.levels.find(l => l.depth === S.depth).blocks.forEach(b => {
    if (b.type === 'heading') frag.append(h('div', { class: 'scene-head' }, h('h2', { class: 'scene-title q', style: 'font-size:22px' }, b.text)));
    else if (b.type === 'paragraph') {
      if (b.title) frag.append(h('div', { class: 'scene-head', style: 'padding-bottom:0' }, h('h2', { class: 'scene-title', style: 'font-size:22px' }, b.title)));
      frag.append(renderPara(b, counter));
    } else if (b.type === 'details') frag.append(h('div', { class: 'deep-list' }, renderDetails(b, counter, false)));
  });
  $('#sceneBody').className = 'scene-body'; $('#sceneBody').replaceChildren(frag);
  $('#pips').replaceChildren(); $('#scenePrev').disabled = true; $('#sceneNext').disabled = true;
  $('#sceneScroll').scrollTo({ top: 0, behavior: 'auto' });
  if ($('#sheet').classList.contains('open') && S.sheetSide) closeSheet({ silent: true });
  S.cur = null; paintCurrent(null);
  showScene();
}

/* ---------------- sheet: source panel, terms, legend ---------------- */
/* kind 'side': source / term. On wide screens it is a column beside the text (no scrim, nothing is locked).
   kind 'modal': the key window and the reading-unit menu. On phones every sheet is the bottom sheet. */
function bgInert(on) {
  ['#screen', '#keybar', '#home'].forEach(x => { const e = $(x); if (on) e.setAttribute('inert', ''); else e.removeAttribute('inert'); });
  const sc = $('#scene'); if (on) sc.setAttribute('inert', ''); else if (sc.classList.contains('open')) sc.removeAttribute('inert');
}
function openSheet(title, content, opener, cls, kind) {
  const sh = $('#sheet'), ph = $('#phone'), w = wide(), side = w && kind !== 'modal';
  clearRun();
  S.sheetOpener = opener || document.activeElement; S.sheetSide = side;
  sh.classList.toggle('side', side); sh.classList.toggle('modal', w && !side);
  sh.setAttribute('role', side ? 'complementary' : 'dialog'); sh.setAttribute('aria-modal', String(!side));
  const t = $('#sheetTitle'); t.textContent = title; t.className = 'sheet-title' + (cls ? ' ' + cls : '');
  $('#sheetBody').replaceChildren(content); $('#sheetBody').scrollTop = 0;
  sh.removeAttribute('inert'); sh.setAttribute('aria-hidden', 'false'); sh.setAttribute('aria-labelledby', 'sheetTitle');
  ph.classList.toggle('src-open', side);
  $('#scrim').classList.toggle('on', !side); sh.classList.add('open');
  if (!side) { if (w) bgInert(true); else { $('#scene').setAttribute('inert', ''); $('#screen').setAttribute('inert', ''); } }
  setTimeout(() => $('#sheetClose').focus({ preventScroll: true }), 60);
}
function closeSheet(opts) {
  const sh = $('#sheet'); if (!sh.classList.contains('open')) return;
  sh.classList.remove('open'); sh.setAttribute('aria-hidden', 'true'); sh.setAttribute('inert', ''); $('#scrim').classList.remove('on');
  $('#phone').classList.remove('src-open'); clearRun();
  if (wide()) bgInert(false);
  else if ($('#scene').classList.contains('open')) $('#scene').removeAttribute('inert'); else $('#screen').removeAttribute('inert');
  if (!(opts && opts.silent) && S.sheetOpener && document.contains(S.sheetOpener)) S.sheetOpener.focus({ preventScroll: true });
}
/* the sentence a source belongs to stays marked while its source is open (wide screens: both are on screen together) */
function markRun(el) { const r = el && el.closest && el.closest('.beat, .sum-text'); if (r) { r.classList.add('run-on'); S.run = r; } }
function clearRun() { if (S.run) { S.run.classList.remove('run-on'); S.run = null; } }
function field(label, value, cls) { return value ? h('div', { class: 'ev-row' }, h('span', { class: 'lbl' }, label), h('span', { class: 'v ' + (cls || '') }, value)) : null; }
function recView(r) {
  const P = S.ui.panel, B = S.ui.badges;
  const top = h('div', { class: 'rec-top' }, r.icons.map(k => { const i = S.ui.icons[k]; return h('span', { class: 'bdg', style: `--tone:${i.color}` }, typeGlyph(k, 14), i.label); }));
  if (r.badge && B[r.badge]) top.append(h('span', { class: 'bdg', style: `--tone:${B[r.badge].color}` }, B[r.badge].label));
  else top.append(h('span', { class: 'nobadge' }, P.no_badge));
  const el = h('div', { class: 'rec' }, top);
  if (r.badge && B[r.badge]) el.append(h('p', { class: 'badge-explain' }, B[r.badge].meaning));
  el.append(h('span', { class: 'lbl' }, P.claim), h('p', { class: 'rec-claim' }, r.claim));
  (r.evidence || []).forEach(e => {
    const tone = S.ui.icons[e.icon] ? S.ui.icons[e.icon].color : 'var(--accent)';
    const ev = h('div', { class: 'ev', style: `--tone:${tone}` },
      field(P.source, e.source_title), field(P.author, e.author), field(P.locator, e.locator));
    if (e.quote) ev.append(h('div', { class: 'ev-row' }, h('span', { class: 'lbl' }, P.quote), h('div', { class: 'ev-quote' }, e.quote)));
    if (e.rulings && e.rulings.length) ev.append(h('div', { class: 'ev-row' }, h('span', { class: 'lbl' }, P.ruling),
      h('div', { style: 'display:grid;gap:6px' }, e.rulings.map(g => h('div', { class: 'ruling' }, g.text, g.ruler && h('small', null, P.ruler + ': ' + g.ruler))))));
    if (e.link_strength && S.ui.link_strength[e.link_strength]) ev.append(h('div', { class: 'ev-row' }, h('span', { class: 'v' }, S.ui.link_strength[e.link_strength]), h('span', { class: 'lbl', style: 'margin-top:2px' }, S.ui.link_strength.note)));
    if (e.url) ev.append(h('a', { class: 'src-link', href: e.url, target: '_blank', rel: 'noopener noreferrer' }, P.open_source, ico('ArrowUpRight01', 18)));
    el.append(ev);
  });
  if (r.status_text) el.append(h('div', { class: 'status-lines' }, r.status_text.split('\n').filter(Boolean).map(l => h('p', null, l))));
  return el;
}
function openRecords(ids, opt, opener) {
  const recs = recsOf(ids); if (!recs.length) return;
  const wrap = h('div');
  recs.forEach((r, k) => {
    if (k === 0) wrap.append(recView(r));
    else wrap.append(h('details', { class: 'more-rec' }, h('summary', null, h('span', { class: 'sum' }, r.claim), h('span', { class: 'key-dots', 'aria-hidden': 'true' }, r.icons.map(i => h('i', { style: `--tone:${S.ui.icons[i].color}` })))), recView(r)));
  });
  openSheet(opt.term || S.ui.panel.title, wrap, opener, opt.term ? 'term-t' : '', 'side');
  markRun(opener);
}
function openLegend(opener, focusKey) {
  const L = S.ui.legend, wrap = h('div', { class: 'lg' });
  wrap.append(h('div', { class: 'lg-sec' }, h('h3', null, L.icons_title), S.ui.icon_order.map(k => { const i = S.ui.icons[k]; return h('div', { class: 'lg-item', dataset: { k } }, iconChip(k), h('div', null, h('b', null, i.label), h('span', null, i.meaning))); })));
  wrap.append(h('div', { class: 'lg-sec' }, h('h3', null, L.badges_title), Object.entries(S.ui.badges).map(([k, b]) => h('div', { class: 'lg-item', dataset: { k: 'b:' + k } }, h('span', { class: 'bdg', style: `--tone:${b.color}` }, b.label), h('div', null, h('span', null, b.meaning))))));
  openSheet(L.title, wrap, opener, '', 'modal');
  const hit = focusKey && wrap.querySelector(`.lg-item[data-k="${focusKey}"]`);
  if (hit) { hit.classList.add('hl'); setTimeout(() => hit.scrollIntoView({ block: 'nearest' }), 60); }
}

/* reading unit (wide screens: the pill under the surah name). Navigation and focus only: it never hides text. */
function openUnitMenu(opener) {
  const ui = S.ui, d = S.d, sc = S.scope, wrap = h('div', { class: 'unit-list' });
  const item = (label, sub, on, pick) => h('button', { class: 'unit-item', type: 'button', 'aria-pressed': String(on), onclick: () => { closeSheet({ silent: true }); if (!on) pick(); } },
    h('b', null, label), sub && h('span', null, sub), on && ico('Tick02', 18));
  wrap.append(item(d.surah.name, dig(d.surah.ayah_count) + ' ' + ui.reader.ayahs_title, sc.kind === 'surah', () => { S.scope = { kind: 'surah' }; paintScope(); updateHook(); }));
  if (d.passages && d.passages.length) {
    wrap.append(h('h3', null, ui.reader.passages_title));
    d.passages.forEach((ps, i) => {
      const a1 = +ps.from.split(':')[1], a2 = +ps.to.split(':')[1];
      wrap.append(item(ps.title, dig(a1) + ' - ' + dig(a2), sc.kind === 'passage' && sc.id === i, () => { setScope({ kind: 'passage', id: i }); const k = d.main.find(a => d.passIdx.get(a.key) === i); if (k) scrollToKey(k.key); }));
    });
  }
  openSheet(ui.reader.read_this, wrap, opener, '', 'modal');
}

init();
