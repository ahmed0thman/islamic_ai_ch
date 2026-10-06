# Second kit. Run from repo root. Reuses the extraction logic of sim/build_kit.py (copied; that script runs on import).
import json, sqlite3, re, os, secrets, unicodedata
SIM = os.environ.get('HUDA_OUT', '.')  # output folder for the kit (the kit holds reference text: keep it outside the repo)
SURAHS = [100, 101, 102, 104, 105, 106, 109, 110]
NAMES = {100:'العاديات',101:'القارعة',102:'التكاثر',104:'الهمزة',105:'الفيل',106:'قريش',109:'الكافرون',110:'النصر'}
def clean_ayah(t):
    t = ''.join(ch for ch in t if not (0xFB50 <= ord(ch) <= 0xFDFF and unicodedata.category(ch) in ('Co','Cn','Lo') and ord(ch) >= 0xFC00) )
    return t.replace('\xa0', ' ').strip()
def tidy(t):
    t = re.sub(r'\s+', ' ', t).strip()
    return re.sub(r'\s+([،.؛:؟!»)])', r'\1', t)
def huda(s, depth):
    d = json.load(open(f'content/export/surah-{s}.json'))
    lvl = [L for L in d['levels'] if L['depth'] == depth][0]
    amap = {a['key']: a for a in d['ayahs']}
    out = [f"سورة {NAMES[s]}", '']
    for b in lvl['blocks']:
        if b['type'] == 'ayah':
            for k in b['keys']:
                a = amap[k]; out.append(f"{clean_ayah(a['text'])} ({a['no']})")
            out.append('')
        elif b['type'] == 'paragraph':
            if b.get('title'): out.append(b['title'])
            # inline ayah segments carry a key, not text: the app shows the ayah there (the first kit dropped them)
            body = ''.join((' ﴿' + clean_ayah(amap[g['key']]['text']) + '﴾ ') if g['t'] == 'ayah' else g.get('v', '') for g in b.get('segments', []) if g['t'] != 'mark')
            out.append(tidy(body)); out.append('')
        else:
            raise SystemExit(f'unknown block type {b["type"]} in {s} depth {depth}')
    return '\n'.join(out).strip() + '\n', d
def reference(s, d, db):
    out = [f"سورة {NAMES[s]}", '']
    for (t,) in db.execute("select text from passages where source_id='maqasid' and surah_no=? order by row_order", (s,)):
        out += ['من مقاصد السورة:', tidy(t), '']
    amap = {a['key']: a for a in d['ayahs']}
    rows = db.execute("""select p.id, p.text, group_concat(distinct pa.ayah_key) from passages p
        left join passage_ayahs pa on pa.passage_id=p.id and pa.link_kind='native'
        where p.source_id='mokhtasar' and p.surah_no=? group by p.id order by p.row_order""", (s,)).fetchall()
    merged = []
    for pid, t, keys in rows:
        ks = sorted(set((keys or '').split(',')) - {''}, key=lambda k: int(k.split(':')[1]))
        if merged and merged[-1][0] == t:
            merged[-1][1].extend(k for k in ks if k not in merged[-1][1])
        else:
            merged.append([t, list(ks)])
    for t, ks in merged:
        for k in ks:
            if k in amap: out.append(f"{clean_ayah(amap[k]['text'])} ({amap[k]['no']})")
        out.append(tidy(re.sub(r'^\s*\d+\s*-\s*\d+\s*-\s*', '', t))); out.append('')
    return '\n'.join(out).strip() + '\n', len(rows), len(merged)
mapfile = os.path.join(SIM, 'mapping-private.txt')
conds = ['Huda-fahm(depth1)', 'Huda-lamha(depth0)', 'Reference(mokhtasar+maqasid)']
if os.path.exists(mapfile):
    m = dict(l.strip().split(' = ') for l in open(mapfile) if ' = ' in l)
else:
    order = conds[:]; secrets.SystemRandom().shuffle(order)
    m = dict(zip('XYZ', order))
    open(mapfile, 'w').write(''.join(f'{k} = {v}\n' for k, v in m.items()) + 'decided by secrets.SystemRandom().shuffle; same letters for all surahs\n')
inv = {v: k for k, v in m.items()}
db = sqlite3.connect('file:.cache/index/sources.sqlite?mode=ro', uri=True)
counts = {}
for s in SURAHS:
    h1, d = huda(s, 1); h0, _ = huda(s, 0); r, n, nm = reference(s, d, db)
    for c, t in zip(conds, (h1, h0, r)):
        fn = f'{inv[c]}-{s}.txt'; open(os.path.join(SIM, fn), 'w').write(t); counts[fn] = len(t.split())
    print(s, 'levels', [(L['depth'], L.get('label') or L.get('id') or L.get('key')) for L in d['levels']], 'ref rows', n, 'merged', nm, 'ayahs', len([a for a in d['ayahs'] if a['key'].startswith(f'{s}:')]))
json.dump(dict(sorted(counts.items())), open(os.path.join(SIM, 'word-counts.json'), 'w'), ensure_ascii=False, indent=1)
for L in 'XYZ': print(L, [counts[f'{L}-{s}.txt'] for s in SURAHS])
