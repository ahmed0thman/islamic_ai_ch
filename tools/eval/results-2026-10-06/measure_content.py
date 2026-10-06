#!/usr/bin/env python3
"""Measure the 16 published surahs. Read-only. Run from repo root:
   python3 -B tools/eval/results-2026-10-06/measure_content.py
Writes $HUDA_OUT/results-content.json
"""
import json, os, re, sqlite3, collections, sys

ROOT = os.environ.get('HUDA_ROOT', '.')  # repo root
SCR = os.environ.get('HUDA_OUT', '.')  # where results-content.json is written
SURAHS = [93] + list(range(100, 115))
TASH = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
FN = re.compile(r'\s*¬([^¥]*)¥')


def collapse(s):
    return re.sub(r'\s+', ' ', s or '').strip()


def norm(s):
    s = TASH.sub('', s or '')
    s = s.translate(str.maketrans('أإآٱ', 'اااا')).replace('ى', 'ي').replace('ة', 'ه')
    return collapse(s)


def words(s):
    return [w for w in re.findall(r'\S+', s or '') if any(ch.isalpha() for ch in w)]


# ---------- passage fetch (independent re-implementation of "stored source passage") ----------
_cache = {}


def fetch(pr):
    k = (pr['file'], pr.get('table'), pr['key_column'], str(pr['row_id']), pr['field'])
    if k in _cache:
        return _cache[k]
    path = os.path.join(ROOT, pr['file'])
    val = None
    try:
        if pr['file'].endswith('.sqlite'):
            con = sqlite3.connect('file:%s?mode=ro' % path, uri=True)
            r = con.execute('select %s from %s where %s=?' % (pr['field'], pr['table'], pr['key_column']), (pr['row_id'],)).fetchone()
            con.close()
            val = r[0] if r else None
        else:
            j = json.load(open(path, encoding='utf-8'))
            if isinstance(j, dict):
                val = j.get(pr['field'])
            else:
                hit = [x for x in j if str(x.get(pr['key_column'])) == str(pr['row_id'])]
                val = hit[0].get(pr['field']) if hit else None
    except Exception as exc:  # recorded as a failure to fetch, never hidden
        val = None
        _cache[('err',) + k] = str(exc)
    _cache[k] = val
    return val


def layout(raw):
    notes = []

    def rep(m):
        notes.append(collapse(m.group(1)))
        return ''
    s = FN.sub(rep, re.sub(r'</?div[^>]*>', '', raw or ''))
    return collapse(s), notes


def part_text(pr):
    raw = fetch(pr)
    if raw is None:
        return None
    if pr['part'] == 'field':
        return collapse(raw)
    body, notes = layout(raw)
    if pr['part'] == 'body':
        return body
    n = pr.get('footnote_no')
    return notes[n] if n is not None and n < len(notes) else None


def found(quote, text, loose=False):
    q = collapse(quote).replace('«…»', '…')
    if not q or text is None:
        return False
    pieces = [p.strip() for p in re.split(r'…|\.\.\.', q) if len(p.strip()) >= 3]
    if loose:
        t = norm(text)
        return all(norm(p) in t for p in pieces)
    return all(p in text for p in pieces)


# ---------- walk blocks ----------
def seg_units(segs):
    """Split segments into sentence units ending at a mark. Returns (units, residue_words)."""
    units, cur = [], []
    for s in segs:
        if s['t'] == 'mark':
            units.append(list(s['records']))
            cur = []
        else:
            cur.append(s)
    residue = sum(len(words(s.get('v', ''))) for s in cur if s['t'] in ('text', 'term', 'quote'))
    return units, residue


def iter_paragraphs(blocks):
    """Yield (paragraph_dict, in_details)"""
    for b in blocks:
        if b['type'] == 'paragraph':
            yield b, False
        elif b['type'] == 'details':
            yield {'type': 'paragraph', 'role': 'claim', 'segments': b['title'], '_details_title': True}, True
            for ib in b.get('blocks', []):
                if ib['type'] == 'paragraph':
                    yield ib, True


def block_words(blocks, ayah_text):
    ours = 0
    quran = 0
    for b in blocks:
        t = b['type']
        if t == 'heading':
            ours += len(words(b['text']))
        elif t == 'ayah':
            for k in b['keys']:
                quran += len(words(ayah_text.get(k, '')))
        elif t == 'paragraph':
            ours += len(words(b.get('title', '')))
            for s in b['segments']:
                if s['t'] in ('text', 'quote', 'term'):
                    ours += len(words(s['v']))
                elif s['t'] == 'ayah':
                    quran += len(words(ayah_text.get(s['key'], '')))
        elif t == 'details':
            for s in b['title']:
                if s['t'] in ('text', 'quote', 'term'):
                    ours += len(words(s['v']))
            o2, q2 = block_words(b.get('blocks', []), ayah_text)
            ours += o2
            quran += q2
    return ours, quran


# ---------- mukhtasar ----------
con = sqlite3.connect('file:%s?mode=ro' % os.path.join(ROOT, '.cache/index/sources.sqlite'), uri=True)
mok = {}
for n in SURAHS:
    rows = con.execute("select text from passages where source_id='mokhtasar' and surah_no=? order by row_order", (n,)).fetchall()
    mok[n] = ' '.join(r[0] for r in rows)
mok_rows = {n: con.execute("select count(*) from passages where source_id='mokhtasar' and surah_no=?", (n,)).fetchone()[0] for n in SURAHS}

res = {'surahs': {}, 'mismatches': {}, 'fetch_errors': []}
global_terms = {}  # normalized term -> set of surahs
per_surah_terms = {}

for n in SURAHS:
    ex = json.load(open(f'{ROOT}/content/export/surah-{n}.json', encoding='utf-8'))
    priv = json.load(open(f'{ROOT}/.cache/records/{n}/records.v2.json', encoding='utf-8'))
    P = {r['id']: r for r in priv['records']}
    R = ex['records']
    ayah_text = {a['key']: a['text'] for a in ex['ayahs']}
    row = {'name': ex['surah']['name'], 'ayah_count': ex['surah']['ayah_count'],
           'private_records_total': len(P), 'records_in_text': len(R)}

    # ---- record verbatim status (private quote vs stored passage; public quote vs stored passage)
    rec_status = {}
    pub_status = {}
    for rid in R:
        pr = P[rid]
        ev_res = []
        for e in pr['evidence']:
            if not e.get('quote'):
                continue
            ref = e.get('passage_ref')
            txt = part_text(ref) if ref else None
            if ref and txt is None:
                res['fetch_errors'].append((rid, e['id'], 'passage not readable'))
            ev_res.append((e['id'], found(e['quote'], txt), found(e['quote'], txt, loose=True), txt is not None))
        if not ev_res:
            rec_status[rid] = 'noquote'
        elif all(x[1] for x in ev_res):
            rec_status[rid] = 'verified'
        else:
            rec_status[rid] = 'mismatch'
            res['mismatches'].setdefault(n, []).append({'record': rid, 'evidence': [x[0] for x in ev_res if not x[1]],
                                                         'loose_ok': all(x[2] for x in ev_res if not x[1]),
                                                         'passage_unreadable': any(not x[3] for x in ev_res if not x[1])})
        # public quotes
        pubs = [e.get('quote') for e in R[rid]['evidence'] if e.get('quote') and e.get('icon') != 'ayah']
        texts = [part_text(e['passage_ref']) for e in pr['evidence'] if e.get('passage_ref')]
        ok = all(any(found(q, t) for t in texts if t) for q in pubs) if pubs else None
        pub_status[rid] = ok
    row['record_status'] = dict(collections.Counter(rec_status.values()))
    row['public_quote_status'] = {'ok': sum(1 for v in pub_status.values() if v is True),
                                  'fail': sum(1 for v in pub_status.values() if v is False),
                                  'none': sum(1 for v in pub_status.values() if v is None)}

    # ---- levels
    lv = {}
    stops_q = stops_all = stops_mis = examples = 0
    headings_q = 0
    term_segs = 0
    term_recs = set()
    term_vals = set()
    sent_total = sent_any = sent_all = sent_quote_any = 0
    residue_total = 0
    used_in_text = set()
    rec_levels = collections.defaultdict(set)
    for L in ex['levels']:
        d = L['depth']
        blocks = L['blocks']
        ours, quran = block_words(blocks, ayah_text)
        s_units = s_any = s_all = 0
        stops = stopq = stopm = ex_n = 0
        for b in blocks:
            if b['type'] == 'heading' and b.get('kind') == 'question':
                headings_q += 1
        for p, in_det in iter_paragraphs(blocks):
            if p.get('role') == 'example':
                ex_n += 1
                continue
            units, resid = seg_units(p['segments'])
            residue_total += resid
            for u in units:
                s_units += 1
                st = [rec_status.get(r, 'missing') for r in u]
                if any(x == 'verified' for x in st):
                    s_any += 1
                if st and all(x == 'verified' for x in st):
                    s_all += 1
                used_in_text.update(u)
                for r_ in u:
                    rec_levels[r_].add(d)
            for s in p['segments']:
                if s['t'] == 'term':
                    term_segs += 1
                    term_recs.add(s['record'])
                    term_vals.add(norm(s['v']))
            if not in_det and 'title' in p:
                stops += 1
                if '؟' in p['title'] or '?' in p['title']:
                    stopq += 1
                if p.get('kind') == 'misconception':
                    stopm += 1
        lv[d] = {'sentences': s_units, 'sent_any_verbatim': s_any, 'sent_all_verbatim': s_all,
                 'words': ours, 'quran_words': quran, 'min_at_180': round(ours / 180, 1),
                 'stops': stops, 'stop_questions': stopq, 'stop_misconception': stopm, 'examples': ex_n,
                 'paragraphs': sum(1 for b in blocks if b['type'] == 'paragraph'),
                 'details': sum(1 for b in blocks if b['type'] == 'details')}
        sent_total += s_units
        sent_any += s_any
        sent_all += s_all
        stops_all += stops
        stops_q += stopq
        stops_mis += stopm
        examples += ex_n
    row['levels'] = lv
    row['sent_total'] = sent_total
    row['sent_any_verbatim'] = sent_any
    row['sent_all_verbatim'] = sent_all
    row['unmarked_residue_words'] = residue_total
    row['stops'] = stops_all
    row['stop_questions'] = stops_q
    row['stop_misconception'] = stops_mis
    row['heading_questions'] = headings_q
    row['examples'] = examples
    row['term_links'] = term_segs
    row['term_records'] = len(term_recs)
    row['term_with_definition'] = sum(1 for r in term_recs if r in R and R[r].get('claim'))
    row['term_values'] = sorted(term_vals)
    per_surah_terms[n] = term_vals
    for t in term_vals:
        global_terms.setdefault(t, set()).add(n)

    # ---- sources
    titles = set()
    authors = set()
    for r in R.values():
        for e in r['evidence']:
            titles.add(e['source_title'])
            authors.add(e['author'])
    row['sources_titles'] = sorted(titles)
    row['sources_authors'] = sorted(authors)
    row['sources_distinct'] = len(titles)

    # ---- narrations
    nar = []
    for rid, pub in R.items():
        pr = P[rid]
        is_nar = any(e['ruling_status'] != 'not_narration' for e in pr['evidence']) or any(e['icon'] in ('hadith', 'athar') for e in pr['evidence']) or pub.get('state') == 'report_unjudged'
        if is_nar:
            nar.append(rid)
    cat = collections.Counter()
    for rid in nar:
        pr = P[rid]
        pub = R[rid]
        graded = any(h['kind'] == 'ruling' and h.get('grader') for e in pr['evidence'] for h in e['rulings'])
        unj = pub.get('state') == 'report_unjudged'
        if graded and unj:
            cat['graded_and_unjudged'] += 1
        elif graded:
            cat['graded_by_name'] += 1
        elif unj:
            cat['reported_not_judged'] += 1
        else:
            cat['neither'] += 1
            has_r = any(e['rulings'] for e in pr['evidence'])
            cat['neither_no_ruling_at_all' if not has_r else 'neither_with_unnamed_or_note_ruling'] += 1
            cat['neither_only_depth3' if rec_levels[rid] == {3} else 'neither_other_depths'] += 1
            cat['neither_with_status_text' if pub.get('status_text') else 'neither_no_status_text'] += 1
    row['narrations'] = len(nar)
    row['narration_cats'] = dict(cat)
    row['narration_ids_neither'] = [rid for rid in nar if not (any(h['kind'] == 'ruling' and h.get('grader') for e in P[rid]['evidence'] for h in e['rulings']) or R[rid].get('state') == 'report_unjudged')]
    row['badges'] = dict(collections.Counter(str(r.get('badge')) for r in R.values()))

    # ---- mukhtasar
    mt = mok[n]
    row['mok_rows'] = mok_rows[n]
    row['mok_words'] = len(words(mt))
    row['mok_min_at_180'] = round(len(words(mt)) / 180, 1)
    res['surahs'][n] = row
    res['surahs'][n]['_mok_norm'] = norm(mt)


def count_terms(termset, text):
    hit = {}
    for t in termset:
        if not t:
            continue
        c = len(re.findall(r'(?<![ء-ي])' + re.escape(t) + r'(?![ء-ي])', text))
        if c:
            hit[t] = c
    return hit


for n in SURAHS:
    row = res['surahs'][n]
    mn = row.pop('_mok_norm')
    own = count_terms(per_surah_terms[n], mn)
    glob = count_terms(set(global_terms), mn)
    row['mok_terms_own_distinct'] = len(own)
    row['mok_terms_own_occurrences'] = sum(own.values())
    row['mok_terms_global_distinct'] = len(glob)
    row['mok_terms_global_occurrences'] = sum(glob.values())
    row['own_terms_total'] = len(per_surah_terms[n])
res['global_terms_total'] = len(global_terms)

# stable-key output
json.dump(res, open(f'{SCR}/results-content.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=lambda o: sorted(o) if isinstance(o, set) else str(o))
print('done', len(res['fetch_errors']), 'fetch errors;', sum(len(v) for v in res['mismatches'].values()), 'mismatching records')
