/* ============================================================
   Huda - surah reader prototype (bakeoff entry "kimi")
   Front-end only. Every Arabic string is rendered from the
   JSON files under content/ at runtime. Latin only in code.
   ============================================================ */
'use strict';

/* ---------- paths & constants ---------- */
const CONTENT = '../../../content/';
const URLS = {
  ui: CONTENT + 'ui.ar.json',
  index: CONTENT + 'export/index.json',
  surah: (no) => CONTENT + 'export/surah-' + no + '.json',
};
const AVAILABLE = [108, 93]; // surah files shipped with this prototype
const AR_DIGIT_BASE = 0x0660; // Eastern Arabic-Indic digits, built in code
const GLYPH_TAIL = /[\s\u00A0]*[\uFB50-\uFDCF]+\s*$/u; // trailing number glyph, U+FB50..FDCF

/* ---------- state ---------- */
const S = {
  ui: null,
  index: null,
  surahs: new Map(),     // no -> surah json
  no: 108,
  depth: 0,
  view: 'map',           // 'map' | 'scene' | 'flow'
  sceneIdx: 0,           // index into current level's scenes
  ayahKey: null,         // when scene is an ayah focus
  scope: null,           // passage id or null
  visited: new Set(),    // "no:depth:sceneIdx"
  lastFocus: null,
};

const $ = (sel, root) => (root || document).querySelector(sel);
const main = $('#main');
const phone = $('#phone');

/* ---------- tiny helpers ---------- */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function arDigits(n) {
  return String(n).replace(/\d/g, (d) => String.fromCharCode(AR_DIGIT_BASE + Number(d)));
}
function stripGlyph(text) {
  return text.replace(GLYPH_TAIL, '');
}
function ownAyahKeys(data) {
  const prefix = data.surah.no + ':';
  return data.ayahs.filter((a) => a.key.startsWith(prefix)).map((a) => a.key);
}
function ayahByKey(data, key) {
  return data.ayahs.find((a) => a.key === key);
}
function esc(text) { // safe text -> html escape (we only ever insert via textContent; this is for rare cases)
  return String(text);
}

/* svg icons (no text) */
const SVG = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  fwd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.9 12.1L21 2m-4 2l3 3"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4L11 13"/><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></svg>',
};
function svgIcon(name) {
  const s = document.createElement('span');
  s.innerHTML = SVG[name];
  s.setAttribute('aria-hidden', 'true');
  s.style.display = 'inline-flex';
  return s.firstChild;
}

/* ============================================================
   Data
   ============================================================ */
async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('fetch failed: ' + url + ' -> ' + r.status);
  return r.json();
}
async function ensureSurah(no) {
  if (!S.surahs.has(no)) S.surahs.set(no, await loadJSON(URLS.surah(no)));
  return S.surahs.get(no);
}

/* ============================================================
   Model: walk a level's blocks into stream items
   ============================================================ */
function deriveDetailStation(data, block, order) {
  // anchor a details item to the first in-surah ayah its title's records point to
  const keys = [];
  for (const seg of block.title) {
    if (seg.t === 'mark') for (const id of seg.records) keys.push(...(data.records[id].ayah_keys || []));
    if (seg.t === 'term') keys.push(...(data.records[seg.record].ayah_keys || []));
  }
  for (const k of keys) if (order.has(k)) return order.get(k);
  return Infinity;
}

function buildLevel(data, depth) {
  const blocks = (data.levels.find((l) => l.depth === depth) || { blocks: [] }).blocks;
  const own = ownAyahKeys(data);
  const order = new Map(own.map((k, i) => [k, i]));

  const items = [];
  let curScene = null;
  blocks.forEach((b, idx) => {
    if (b.type === 'ayah') return; // stations come from data.ayahs
    if (b.type === 'heading') {
      items.push({ kind: 'heading', b, idx, sort: null });
      curScene = null;
      return;
    }
    if (b.type === 'paragraph' && b.title) {
      curScene = {
        kind: 'scene', idx,
        title: b.title,
        ayahs: b.ayahs || [],
        passage: b.passage || null,
        paras: [b],
        sort: b.ayahs && order.has(b.ayahs[0]) ? order.get(b.ayahs[0]) : Infinity,
      };
      items.push(curScene);
      return;
    }
    if (b.type === 'paragraph') {
      if (curScene) { curScene.paras.push(b); return; }
      items.push({ kind: 'card', b, idx, sort: null }); // loose paragraph
      return;
    }
    if (b.type === 'details') {
      items.push({ kind: 'details', b, idx, sort: deriveDetailStation(data, b, order) });
      curScene = null;
    }
  });

  // resolve heading / card sort keys
  items.forEach((it, i) => {
    if (it.sort !== null) return;
    if (it.kind === 'heading') {
      const nxt = items.slice(i + 1).find((x) => x.sort !== null);
      it.sort = nxt ? nxt.sort - 0.5 : Infinity;
    } else { // loose card: attach to the heading before it, else next anchor
      const prevH = items.slice(0, i).reverse().find((x) => x.kind === 'heading');
      if (prevH && prevH.sort !== null) it.sort = prevH.sort + 0.01;
      else {
        const nxt = items.slice(i + 1).find((x) => x.sort !== null);
        it.sort = nxt ? nxt.sort - 0.4 : Infinity;
      }
    }
  });

  const scenes = items.filter((i) => i.kind === 'scene');
  return { blocks, own, order, items, scenes };
}

/* collect deduped icon keys of a scene, in legend order */
function sceneIcons(data, scene) {
  const found = new Set();
  for (const p of scene.paras) {
    for (const seg of p.segments) {
      if (seg.t === 'mark') for (const id of seg.records) for (const ic of data.records[id].icons) found.add(ic);
      if (seg.t === 'quote') for (const ic of data.records[seg.record].icons) found.add(ic);
      if (seg.t === 'term') for (const ic of data.records[seg.record].icons) found.add(ic);
    }
  }
  return S.ui.icon_order.filter((k) => found.has(k));
}

/* ============================================================
   Segment rendering (shared by scene / cards / details titles)
   ============================================================ */
function renderMark(data, seg) {
  const recs = seg.records.map((id) => data.records[id]).filter(Boolean);
  const btn = el('button', 'mark');
  btn.type = 'button';
  const icons = [];
  for (const r of recs) for (const ic of r.icons) if (!icons.includes(ic)) icons.push(ic);
  icons.sort((a, b) => S.ui.icon_order.indexOf(a) - S.ui.icon_order.indexOf(b));
  for (const ic of icons) {
    const g = el('span', 'g', S.ui.icons[ic].symbol);
    g.style.color = S.ui.icons[ic].color;
    btn.appendChild(g);
  }
  // badge next to marker (schema rule: la_yathbut / khilaf_mutabar show in text)
  const badged = recs.find((r) => r.badge === 'la_yathbut' || r.badge === 'khilaf_mutabar');
  if (badged) {
    const b = S.ui.badges[badged.badge];
    const chip = el('span', 'mb', b.label);
    chip.style.background = b.color;
    btn.appendChild(chip);
  }
  btn.setAttribute('aria-label', S.ui.panel.title);
  btn.addEventListener('click', (e) => { e.stopPropagation(); openPanel(seg.records); });
  return btn;
}

function renderTerm(data, seg) {
  const btn = el('button', 'term', seg.v);
  btn.type = 'button';
  btn.setAttribute('aria-label', S.ui.reader.open_term);
  btn.addEventListener('click', (e) => { e.stopPropagation(); openPanel([seg.record], { term: seg.v }); });
  return btn;
}

function renderAyahSeg(data, seg, withNumber) {
  const a = ayahByKey(data, seg.key);
  if (!a) return document.createTextNode('');
  const span = el('span', 'qseg');
  span.appendChild(document.createTextNode(stripGlyph(a.text)));
  if (withNumber !== false) {
    const no = el('span', 'ano', arDigits(a.no));
    no.setAttribute('aria-hidden', 'true');
    span.appendChild(no);
  }
  return span;
}

function renderSegments(data, segments, opts) {
  const frag = document.createDocumentFragment();
  for (const seg of segments) {
    if (seg.t === 'text') frag.appendChild(document.createTextNode(seg.v));
    else if (seg.t === 'ayah') frag.appendChild(renderAyahSeg(data, seg, opts && opts.ayahNumber));
    else if (seg.t === 'quote') {
      const q = el('span', 'quote');
      q.appendChild(document.createTextNode(seg.v));
      frag.appendChild(q);
    }
    else if (seg.t === 'mark') frag.appendChild(renderMark(data, seg));
    else if (seg.t === 'term') frag.appendChild(renderTerm(data, seg));
  }
  return frag;
}

function renderParagraph(data, p) {
  const cls = 'prose' + (p.role === 'transmission' ? ' trans' : '');
  const node = el('p', cls);
  node.appendChild(renderSegments(data, p.segments));
  return node;
}

/* ============================================================
   Quran blocks
   ============================================================ */
function quranCard(data, keys, small) {
  const card = el('div', 'quran-card' + (small ? ' small' : ''));
  const text = el('p', 'qtext');
  keys.forEach((k, i) => {
    const a = ayahByKey(data, k);
    if (!a) return;
    if (i > 0) text.appendChild(document.createTextNode(' '));
    text.appendChild(document.createTextNode(stripGlyph(a.text)));
    const no = el('span', 'ano', arDigits(a.no));
    no.setAttribute('aria-hidden', 'true');
    text.appendChild(no);
  });
  card.appendChild(text);
  return card;
}

/* ============================================================
   Header / controls
   ============================================================ */
function renderChrome() {
  $('#brand').textContent = S.ui.app_name;

  // surah picker
  const picker = $('#surahPicker');
  picker.textContent = '';
  const sel = el('select');
  sel.setAttribute('aria-label', S.ui.reader.surahs_title);
  for (const no of AVAILABLE) {
    const meta = S.index.surahs.find((s) => s.no === no);
    if (!meta) continue;
    const opt = el('option', null, meta.name);
    opt.value = String(no);
    sel.appendChild(opt);
  }
  sel.value = String(S.no);
  sel.addEventListener('change', async () => {
    S.no = Number(sel.value);
    await ensureSurah(S.no);
    S.view = 'map'; S.scope = null; S.sceneIdx = 0; S.ayahKey = null;
    render();
  });
  picker.appendChild(sel);

  // top actions: full surah text + legend
  const actions = $('#topActions');
  actions.textContent = '';
  const ayahsBtn = el('button', 'iconbtn');
  ayahsBtn.type = 'button';
  ayahsBtn.appendChild(svgIcon('book'));
  ayahsBtn.appendChild(el('span', null, S.ui.reader.ayahs_title));
  ayahsBtn.addEventListener('click', openSurahText);
  const legendBtn = el('button', 'iconbtn');
  legendBtn.type = 'button';
  legendBtn.appendChild(svgIcon('key'));
  legendBtn.appendChild(el('span', null, S.ui.legend.show));
  legendBtn.addEventListener('click', openLegend);
  actions.append(ayahsBtn, legendBtn);

  // depth tabs
  $('#depthLabel').textContent = S.ui.reader.choose_depth;
  const tabs = $('#depthTabs');
  tabs.textContent = '';
  S.ui.levels.forEach((lv) => {
    const b = el('button', 'depth-tab');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(lv.depth === S.depth));
    b.appendChild(el('span', 'dt-dot'));
    b.appendChild(el('span', null, lv.name));
    b.addEventListener('click', () => {
      if (S.depth === lv.depth) return;
      S.depth = lv.depth;
      S.view = 'map'; S.ayahKey = null;
      render();
    });
    tabs.appendChild(b);
  });

  // view toggle
  const vt = $('#viewToggle');
  vt.textContent = '';
  const mkView = (id, label, icon) => {
    const b = el('button', 'view-btn');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(S.view === id));
    b.appendChild(svgIcon(icon));
    b.appendChild(el('span', null, label));
    b.addEventListener('click', () => { S.view = id; S.ayahKey = null; render(); });
    return b;
  };
  vt.append(
    mkView('map', S.ui.reader.map_view, 'map'),
    mkView('flow', S.ui.reader.read_continuous, 'book'),
  );
}

/* ============================================================
   MAP VIEW — the stream
   ============================================================ */
function passageOf(data, ayahKey) {
  const ps = data.passages || [];
  return ps.find((p) => {
    const o = ownAyahKeys(data);
    return o.indexOf(ayahKey) >= o.indexOf(p.from) && o.indexOf(ayahKey) <= o.indexOf(p.to);
  });
}

function renderMap(data, model) {
  const view = el('div', 'view');

  /* hero */
  const hero = el('section', 'hero');
  hero.appendChild(el('div', 's-name', data.surah.name));
  const meta = el('div', 's-meta');
  meta.appendChild(el('span', 'meta-chip', S.ui.reader.ayahs_title + ' ' + arDigits(data.surah.ayah_count)));
  hero.appendChild(meta);
  hero.appendChild(el('div', 'tagline', S.ui.tagline));
  view.appendChild(hero);

  /* passage chips (scope pickers) */
  const passages = data.passages || [];
  if (passages.length) {
    const wrap = el('section', 'passages');
    wrap.appendChild(el('div', 'p-label', S.ui.reader.passages_title));
    const row = el('div', 'p-chips');
    passages.forEach((p) => {
      const chip = el('button', 'p-chip');
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(S.scope === p.id));
      chip.appendChild(el('span', 'p-t', p.title));
      const a = ayahByKey(data, p.from), b = ayahByKey(data, p.to);
      chip.appendChild(el('span', 'p-r', arDigits(a.no) + ' – ' + arDigits(b.no)));
      chip.addEventListener('click', () => {
        S.scope = S.scope === p.id ? null : p.id;
        render();
        if (S.scope) {
          const target = $('.station[data-ayah="' + p.from + '"]', main);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      row.appendChild(chip);
    });
    wrap.appendChild(row);
    view.appendChild(wrap);
  }

  /* stream */
  const wrapS = el('div', 'stream-wrap');
  const ol = el('ol', 'stream');

  const byStation = new Map();
  const preItems = [];
  const endItems = [];
  for (const it of model.items) {
    if (it.sort === Infinity) { endItems.push(it); continue; }
    const s = Math.floor(it.sort);
    if (s < 0) { preItems.push(it); continue; }
    if (!byStation.has(s)) byStation.set(s, []);
    byStation.get(s).push(it);
  }
  for (const list of byStation.values()) list.sort((a, b) => a.idx - b.idx);
  preItems.sort((a, b) => a.idx - b.idx);
  endItems.sort((a, b) => a.idx - b.idx);

  let anim = 0;
  const delay = () => { anim += 1; return Math.min(anim * 45, 500) + 'ms'; };

  const passageStarts = new Map(); // station index -> passage
  if (passages.length) {
    for (const p of passages) passageStarts.set(model.order.get(p.from), p);
  }

  const sceneCounters = new Map(); // scene item -> number
  model.scenes.forEach((sc, i) => sceneCounters.set(sc, i + 1));

  const appendItem = (parent, it) => {
    if (it.kind === 'heading') {
      const band = el('div', 'band');
      const inr = el('div', 'band-in', it.b.text);
      band.style.setProperty('--d', delay());
      band.appendChild(inr);
      parent.appendChild(band);
    } else if (it.kind === 'card') {
      const c = el('div', 'rcard');
      c.style.setProperty('--d', delay());
      c.appendChild(renderSegments(data, it.b.segments));
      parent.appendChild(c);
    } else if (it.kind === 'scene') {
      parent.appendChild(stopCard(data, it, sceneCounters.get(it), model.scenes.length, delay()));
    } else if (it.kind === 'details') {
      parent.appendChild(detailsCard(data, it.b, delay()));
    }
  };

  /* lead-in items (section openers before the first station) */
  if (preItems.length) {
    const li = el('li', 'row');
    li.style.paddingInlineStart = '14px';
    const stops = el('div', 'stops');
    for (const it of preItems) appendItem(stops, it);
    li.appendChild(stops);
    ol.appendChild(li);
  }

  model.own.forEach((key, sIdx) => {
    // passage divider rows
    if (passageStarts.has(sIdx)) {
      const p = passageStarts.get(sIdx);
      const prow = el('li', 'pass-row');
      const chip = el('button', 'pass-chip');
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(S.scope === p.id));
      chip.appendChild(el('span', 'p-t', p.title));
      const a = ayahByKey(data, p.from), b = ayahByKey(data, p.to);
      chip.appendChild(el('span', 'p-r', arDigits(a.no) + ' – ' + arDigits(b.no)));
      chip.addEventListener('click', () => {
        S.scope = S.scope === p.id ? null : p.id;
        render();
      });
      prow.appendChild(chip);
      const pIdx = passages.indexOf(p);
      if (pIdx > 0 && p.records && p.records.length) {
        const why = el('button', 'why-btn', S.ui.reader.why_next);
        why.type = 'button';
        why.setAttribute('aria-label', S.ui.reader.why_next);
        why.addEventListener('click', (e) => { e.stopPropagation(); openPanel(p.records); });
        prow.appendChild(why);
      }
      ol.appendChild(prow);
    }

    const items = byStation.get(sIdx) || [];
    const hot = items.length > 0;
    const li = el('li', 'row station' + (hot ? ' hot' : ''));
    li.dataset.ayah = key;

    const p = passages.length ? passageOf(data, key) : null;
    const dimmed = S.scope && p && p.id !== S.scope;

    const node = el('button', 'node', arDigits(ayahByKey(data, key).no));
    node.type = 'button';
    node.setAttribute('aria-label', S.ui.reader.ayahs_title + ' ' + arDigits(ayahByKey(data, key).no));
    node.addEventListener('click', () => {
      S.ayahKey = key; S.view = 'scene'; render();
    });
    li.appendChild(node);

    if (hot) {
      const stops = el('div', 'stops');
      for (const it of items) appendItem(stops, it);
      li.appendChild(stops);
    }
    if (dimmed) li.classList.add('dim');
    ol.appendChild(li);
  });

  /* trailing items (surah-wide sections) */
  if (endItems.length) {
    const li = el('li', 'row');
    li.style.paddingInlineStart = '14px';
    const stops = el('div', 'stops');
    for (const it of endItems) appendItem(stops, it);
    li.appendChild(stops);
    ol.appendChild(li);
  }

  wrapS.appendChild(ol);
  view.appendChild(wrapS);

  /* footer: disclosures */
  const foot = el('footer', 'foot');
  foot.appendChild(el('p', null, S.ui.disclosure.scripture));
  foot.appendChild(el('p', null, S.ui.disclosure.ai));
  foot.appendChild(el('p', null, S.ui.privacy_line));
  view.appendChild(foot);

  return view;
}

/* a stop (question) card on the stream */
function stopCard(data, scene, num, total, d) {
  const btn = el('button', 'stop');
  btn.type = 'button';
  btn.style.setProperty('--d', d);
  if (S.visited.has(S.no + ':' + S.depth + ':' + (num - 1))) btn.classList.add('visited');
  btn.appendChild(el('span', 'idx', arDigits(num) + '/' + arDigits(total)));
  btn.appendChild(el('span', 'q', scene.title));
  const dna = el('span', 'dna');
  const glyphs = el('span', 'glyphs');
  glyphs.setAttribute('aria-hidden', 'true');
  for (const ic of sceneIcons(data, scene)) {
    const g = el('span', null, S.ui.icons[ic].symbol);
    g.style.color = S.ui.icons[ic].color;
    glyphs.appendChild(g);
  }
  dna.appendChild(glyphs);
  btn.appendChild(dna);
  btn.addEventListener('click', () => {
    S.ayahKey = null;
    S.sceneIdx = num - 1;
    S.view = 'scene';
    render();
  });
  return btn;
}

/* a details accordion (depth 3) */
function detailsCard(data, block, d) {
  const box = el('div', 'det');
  box.style.setProperty('--d', d);

  const head = el('div', 'det-head');
  const titleId = 'det-t-' + Math.random().toString(36).slice(2, 8);
  const bodyId = 'det-b-' + Math.random().toString(36).slice(2, 8);

  const toggle = el('button', 'det-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', bodyId);
  toggle.setAttribute('aria-labelledby', titleId);

  const title = el('span', 'det-title');
  title.id = titleId;
  title.appendChild(renderSegments(data, block.title, { ayahNumber: true }));

  head.append(toggle, title);

  const body = el('div', 'det-body');
  body.id = bodyId;
  body.hidden = true;
  for (const inner of block.blocks) body.appendChild(renderParagraph(data, inner));

  toggle.addEventListener('click', () => {
    const open = box.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
  });

  box.append(head, body);
  return box;
}

/* ============================================================
   SCENE VIEW — one focused stop (or one ayah)
   ============================================================ */
function renderScene(data, model) {
  const view = el('div', 'view scene');

  /* bar: back + minimap */
  const bar = el('div', 'scene-bar');
  const back = el('button', 'backbtn');
  back.type = 'button';
  back.appendChild(svgIcon('back'));
  back.appendChild(el('span', null, S.ui.reader.back));
  back.addEventListener('click', () => { S.view = 'map'; S.ayahKey = null; render(); });
  bar.appendChild(back);

  const mm = el('nav', 'minimap');
  mm.setAttribute('aria-label', S.ui.reader.map_view);
  model.scenes.forEach((sc, i) => {
    const pill = el('button', 'mm-pill', arDigits(i + 1));
    pill.type = 'button';
    if (i === S.sceneIdx && !S.ayahKey) pill.setAttribute('aria-current', 'true');
    else if (S.visited.has(S.no + ':' + S.depth + ':' + i)) pill.classList.add('done');
    pill.title = sc.title;
    pill.setAttribute('aria-label', sc.title);
    pill.addEventListener('click', () => {
      S.ayahKey = null; S.sceneIdx = i; render();
    });
    mm.appendChild(pill);
  });
  bar.appendChild(mm);
  view.appendChild(bar);

  /* ---- ayah focus scene ---- */
  if (S.ayahKey) {
    view.appendChild(quranCard(data, [S.ayahKey], false));
    const here = model.scenes.filter((sc) => sc.ayahs.includes(S.ayahKey));
    const list = el('div', 'scene-body');
    here.forEach((sc) => {
      const i = model.scenes.indexOf(sc);
      list.appendChild(stopCard(data, sc, i + 1, model.scenes.length, '0ms'));
    });
    view.appendChild(list);
    return view;
  }

  const scene = model.scenes[S.sceneIdx];
  if (!scene) {
    view.appendChild(el('div', 'empty', S.ui.reader.empty_level));
    return view;
  }
  S.visited.add(S.no + ':' + S.depth + ':' + S.sceneIdx);

  /* passage context line */
  if (scene.passage && data.passages) {
    const p = data.passages.find((x) => x.id === scene.passage);
    if (p) view.appendChild(el('div', 'scene-pass', p.title));
  }

  /* ayah card for the stop's stations */
  if (scene.ayahs.length) view.appendChild(quranCard(data, scene.ayahs, scene.ayahs.length > 2));

  /* question */
  const h = el('h1', 'scene-q', scene.title);
  h.tabIndex = -1;
  view.appendChild(h);

  /* paragraphs */
  const body = el('div', 'scene-body');
  for (const p of scene.paras) body.appendChild(renderParagraph(data, p));
  view.appendChild(body);

  /* onward */
  const onw = el('nav', 'onward');
  const row = el('div', 'onward-row');

  const prev = model.scenes[S.sceneIdx - 1];
  const next = model.scenes[S.sceneIdx + 1];

  const prevBtn = el('button', 'navbtn prev');
  prevBtn.type = 'button';
  prevBtn.disabled = !prev;
  const pl = el('span', 'nb-l'); pl.appendChild(svgIcon('back')); pl.appendChild(el('span', null, S.ui.reader.previous_stop));
  prevBtn.appendChild(pl);
  prevBtn.appendChild(el('span', 'nb-q', prev ? prev.title : ''));
  prevBtn.addEventListener('click', () => { if (prev) { S.sceneIdx -= 1; render(); } });

  const nextBtn = el('button', 'navbtn next');
  nextBtn.type = 'button';
  nextBtn.disabled = !next;
  const nl = el('span', 'nb-l'); nl.appendChild(el('span', null, S.ui.reader.next_stop)); nl.appendChild(svgIcon('fwd'));
  nextBtn.appendChild(nl);
  nextBtn.appendChild(el('span', 'nb-q', next ? next.title : ''));
  nextBtn.addEventListener('click', () => { if (next) { S.sceneIdx += 1; render(); } });

  row.append(nextBtn, prevBtn); // RTL: next sits on the right (start)
  onw.appendChild(row);

  /* end of the level: invite deeper + next surah */
  if (!next) {
    const deep = el('div', 'deepen');
    if (S.depth < 3) {
      deep.appendChild(el('div', 'd-l', S.ui.reader.choose_depth));
      const dt = el('div', 'd-tabs');
      S.ui.levels.forEach((lv) => {
        const b = el('button', 'd-tab' + (lv.depth === S.depth ? ' cur' : ''), lv.name);
        b.type = 'button';
        b.addEventListener('click', () => { S.depth = lv.depth; S.view = 'map'; render(); });
        dt.appendChild(b);
      });
      deep.appendChild(dt);
    }
    const other = AVAILABLE.find((n) => n !== S.no);
    const meta = S.index.surahs.find((s) => s.no === other);
    if (meta) {
      const ns = el('button', 'ns-btn', S.ui.reader.next_surah + ' ' + meta.name);
      ns.type = 'button';
      ns.addEventListener('click', async () => {
        S.no = other; await ensureSurah(S.no);
        S.view = 'map'; S.sceneIdx = 0; S.scope = null;
        render();
      });
      deep.appendChild(ns);
    }
    onw.appendChild(deep);
  }

  view.appendChild(onw);
  return view;
}

/* ============================================================
   FLOW VIEW — continuous reading of the whole level
   ============================================================ */
function renderFlow(data, model) {
  const view = el('div', 'view flow');

  const ayahBlock = model.blocks.find((b) => b.type === 'ayah');
  if (ayahBlock) view.appendChild(quranCard(data, ayahBlock.keys, model.own.length > 6));

  let n = 0;
  for (const it of model.items) {
    if (it.kind === 'heading') {
      const bandWrap = el('div', 'row'); bandWrap.style.paddingInlineStart = '16px'; bandWrap.style.paddingInlineEnd = '16px';
      const band = el('div', 'band'); band.style.margin = '18px 0 4px';
      band.appendChild(el('div', 'band-in', it.b.text));
      bandWrap.appendChild(band);
      view.appendChild(bandWrap);
    } else if (it.kind === 'card') {
      const wrap = el('div'); wrap.style.padding = '0 16px';
      const c = el('div', 'rcard');
      c.appendChild(renderSegments(data, it.b.segments));
      wrap.appendChild(c);
      view.appendChild(wrap);
    } else if (it.kind === 'details') {
      const wrap = el('div'); wrap.style.padding = '8px 16px 0';
      wrap.appendChild(detailsCard(data, it.b, '0ms'));
      view.appendChild(wrap);
    } else if (it.kind === 'scene') {
      n += 1;
      const sec = el('section', 'fscene');
      if (it.passage && data.passages) {
        const p = data.passages.find((x) => x.id === it.passage);
        if (p) sec.appendChild(el('div', 'scene-pass', p.title));
      }
      if (it.ayahs.length) sec.appendChild(quranCard(data, it.ayahs, true));
      sec.appendChild(el('h2', 'scene-q', it.title));
      const body = el('div', 'scene-body');
      for (const p of it.paras) body.appendChild(renderParagraph(data, p));
      sec.appendChild(body);
      view.appendChild(sec);
      view.appendChild(el('hr', 'sep'));
    }
  }

  /* deepen card at the very end */
  const deep = el('div', 'deepen');
  if (S.depth < 3) {
    deep.appendChild(el('div', 'd-l', S.ui.reader.choose_depth));
    const dt = el('div', 'd-tabs');
    S.ui.levels.forEach((lv) => {
      const b = el('button', 'd-tab' + (lv.depth === S.depth ? ' cur' : ''), lv.name);
      b.type = 'button';
      b.addEventListener('click', () => { S.depth = lv.depth; S.view = 'map'; render(); });
      dt.appendChild(b);
    });
    deep.appendChild(dt);
  }
  view.appendChild(deep);

  const foot = el('footer', 'foot');
  foot.appendChild(el('p', null, S.ui.disclosure.scripture));
  foot.appendChild(el('p', null, S.ui.disclosure.ai));
  view.appendChild(foot);

  return view;
}

/* ============================================================
   Sheets: source panel / legend / surah text
   ============================================================ */
function closeSheet() {
  phone.classList.remove('sheet-open');
  document.removeEventListener('keydown', onSheetKey);
  const root = $('#sheetRoot');
  setTimeout(() => { if (!phone.classList.contains('sheet-open')) root.textContent = ''; }, 340);
  if (S.lastFocus) { S.lastFocus.focus(); S.lastFocus = null; }
}
function onSheetKey(e) { if (e.key === 'Escape') closeSheet(); }

function sheetShell(titleText, closeLabel) {
  const root = $('#sheetRoot');
  root.textContent = '';
  const scrim = el('div', 'scrim');
  scrim.addEventListener('click', closeSheet);
  const sheet = el('section', 'sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', titleText);
  sheet.appendChild(el('div', 'grab'));
  const head = el('div', 'sheet-head');
  head.appendChild(el('h2', null, titleText));
  const close = el('button', 'sheet-close');
  close.type = 'button';
  close.setAttribute('aria-label', closeLabel);
  close.appendChild(svgIcon('close'));
  close.addEventListener('click', closeSheet);
  head.appendChild(close);
  const body = el('div', 'sheet-body');
  sheet.append(head, body);
  root.append(scrim, sheet);
  S.lastFocus = document.activeElement;
  document.addEventListener('keydown', onSheetKey);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    phone.classList.add('sheet-open');
    close.focus();
  }));
  return body;
}

function iconChip(key) {
  const meta = S.ui.icons[key];
  const chip = el('span', 'ichip');
  chip.style.setProperty('--ic', meta.color);
  chip.appendChild(el('span', 'g', meta.symbol));
  chip.appendChild(el('span', null, meta.label));
  return chip;
}

function recordCard(rec) {
  const box = el('article', 'rec');

  const icons = el('div', 'rec-icons');
  const ordered = S.ui.icon_order.filter((k) => rec.icons.includes(k));
  for (const k of ordered) icons.appendChild(iconChip(k));
  if (rec.badge) {
    const b = S.ui.badges[rec.badge];
    const chip = el('span', 'badge', b.label);
    chip.style.background = b.color;
    chip.title = b.meaning;
    icons.appendChild(chip);
  } else {
    icons.appendChild(el('span', 'nobadge', S.ui.panel.no_badge));
  }
  box.appendChild(icons);

  const claim = el('div', 'rec-claim');
  claim.appendChild(el('span', 'lbl', S.ui.panel.claim));
  claim.appendChild(el('p', null, rec.claim));
  box.appendChild(claim);

  if (rec.status_text) box.appendChild(el('div', 'rec-status', rec.status_text));

  for (const ev of rec.evidence) {
    const card = el('div', 'ev');
    card.style.setProperty('--ic', S.ui.icons[ev.icon] ? S.ui.icons[ev.icon].color : null);
    card.appendChild(iconChip(ev.icon));

    const dl = el('dl');
    const rows = [
      [S.ui.panel.source, ev.source_title],
      [S.ui.panel.author, ev.author],
      [S.ui.panel.locator, ev.locator],
    ];
    for (const [k, v] of rows) {
      if (!v) continue;
      dl.appendChild(el('dt', null, k));
      dl.appendChild(el('dd', null, v));
    }
    card.appendChild(dl);

    if (ev.quote) {
      card.appendChild(el('span', 'lbl', S.ui.panel.quote));
      const bq = el('blockquote');
      String(ev.quote).split('\n').forEach((line) => bq.appendChild(el('span', 'ql', line)));
      card.appendChild(bq);
    }

    for (const r of ev.rulings || []) {
      const row = el('div', 'ruling');
      row.appendChild(el('span', 'rl-t', r.text));
      row.appendChild(el('span', 'rl-r', S.ui.panel.ruler + ': ' + r.ruler));
      card.appendChild(row);
    }

    if (ev.link_strength && S.ui.link_strength[ev.link_strength]) {
      card.appendChild(el('span', 'ls-chip', S.ui.link_strength[ev.link_strength]));
      card.appendChild(el('div', 'ls-note', S.ui.link_strength.note));
    }

    if (ev.url) {
      const a = el('a', 'src-link', S.ui.panel.open_source);
      a.href = ev.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.appendChild(svgIcon('ext'));
      card.appendChild(a);
    }

    box.appendChild(card);
  }
  return box;
}

function openPanel(recordIds) {
  const data = S.surahs.get(S.no);
  const body = sheetShell(S.ui.panel.title, S.ui.panel.close);
  let any = false;
  for (const id of recordIds) {
    const rec = data.records[id];
    if (!rec) continue;
    any = true;
    body.appendChild(recordCard(rec));
  }
  if (!any) body.appendChild(el('p', 'empty', S.ui.phrases.insufficient_sources));
}

function openLegend() {
  const body = sheetShell(S.ui.legend.title, S.ui.legend.hide);

  const g1 = el('div', 'lg-group');
  g1.appendChild(el('h3', null, S.ui.legend.icons_title));
  for (const key of S.ui.icon_order) {
    const meta = S.ui.icons[key];
    const item = el('div', 'lg-item');
    const sym = el('span', 'lg-sym', meta.symbol);
    sym.style.color = meta.color;
    const txt = el('div');
    txt.appendChild(el('div', 'lg-l', meta.label));
    txt.appendChild(el('div', 'lg-m', meta.meaning));
    item.append(sym, txt);
    g1.appendChild(item);
  }
  body.appendChild(g1);

  const g2 = el('div', 'lg-group');
  g2.appendChild(el('h3', null, S.ui.legend.badges_title));
  for (const key of Object.keys(S.ui.badges)) {
    const meta = S.ui.badges[key];
    const item = el('div', 'lg-item');
    const sym = el('span', 'lg-sym lg-badge', meta.label);
    sym.style.background = meta.color;
    sym.style.color = '#fff';
    sym.style.fontSize = '.6rem';
    sym.style.borderRadius = '8px';
    sym.style.width = 'auto';
    sym.style.padding = '0 10px';
    const txt = el('div');
    txt.appendChild(el('div', 'lg-m', meta.meaning));
    item.append(sym, txt);
    g2.appendChild(item);
  }
  body.appendChild(g2);
}

function openSurahText() {
  const data = S.surahs.get(S.no);
  const model = buildLevel(data, S.depth);
  const ayahBlock = model.blocks.find((b) => b.type === 'ayah');
  const body = sheetShell(S.ui.reader.ayahs_title, S.ui.panel.close);
  const p = el('p', 'mushaf');
  (ayahBlock ? ayahBlock.keys : model.own).forEach((k, i) => {
    const a = ayahByKey(data, k);
    if (!a) return;
    if (i > 0) p.appendChild(document.createTextNode(' '));
    p.appendChild(document.createTextNode(stripGlyph(a.text)));
    const no = el('span', 'ano', arDigits(a.no));
    no.setAttribute('aria-hidden', 'true');
    p.appendChild(no);
  });
  body.appendChild(p);
}

/* ============================================================
   Render root
   ============================================================ */
function render() {
  const data = S.surahs.get(S.no);
  if (!data) return;
  renderChrome();
  const model = buildLevel(data, S.depth);

  main.textContent = '';
  main.classList.remove('view-host');
  if (S.view === 'map') main.appendChild(renderMap(data, model));
  else if (S.view === 'scene') main.appendChild(renderScene(data, model));
  else main.appendChild(renderFlow(data, model));

  main.scrollTop = 0;
  const cur = $('.mm-pill[aria-current="true"]', main);
  if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
  const h = $('.scene-q', main);
  if (h && S.view === 'scene') h.focus({ preventScroll: true });
}

function fatal(err) {
  main.textContent = '';
  main.appendChild(el('div', 'err', 'prototype failed to load: ' + err.message));
  console.error(err);
}

/* ---------- boot ---------- */
function parseHash() {
  // deep links, e.g. #s=93&d=2&v=map | v=scene&i=3 | a=93:5 | r=93-r056 | legend=1 | text=1
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('s') && AVAILABLE.includes(Number(h.get('s')))) S.no = Number(h.get('s'));
  if (h.get('d') != null && h.get('d') !== '') S.depth = Math.min(3, Math.max(0, Number(h.get('d'))));
  if (h.get('v') === 'map' || h.get('v') === 'flow') S.view = h.get('v');
  if (h.get('v') === 'scene') { S.view = 'scene'; }
  if (h.get('i') != null && h.get('i') !== '') S.sceneIdx = Math.max(0, Number(h.get('i')));
  if (h.get('a')) { S.view = 'scene'; S.ayahKey = h.get('a'); }
  return h;
}

(async function boot() {
  try {
    const h = parseHash();
    [S.ui, S.index] = await Promise.all([loadJSON(URLS.ui), loadJSON(URLS.index)]);
    await ensureSurah(S.no);
    render();
    if (h.get('r')) openPanel(h.get('r').split(','));
    else if (h.get('legend')) openLegend();
    else if (h.get('text')) openSurahText();
  } catch (e) {
    fatal(e);
  }
})();
