# Builds the blind kit. Run from the repo root: python3 tools/eval/results-2026-10-06/build_kit.py
# Reads content/export/surah-N.json (level depth 1) and .cache/index/sources.sqlite (read-only).
import json, sqlite3, re, os, secrets, unicodedata
SIM = os.path.dirname(os.path.abspath(__file__))
SURAHS = [93, 103, 107, 108]
NAMES = {93: 'الضحى', 103: 'العصر', 107: 'الماعون', 108: 'الكوثر'}

def clean_ayah(t):
    t = ''.join(ch for ch in t if not (0xFB50 <= ord(ch) <= 0xFDFF and unicodedata.category(ch) in ('Co','Cn','Lo') and ord(ch) >= 0xFC00) )
    return t.replace('\xa0', ' ').strip()

def ayah_lines(d, s):
    out = []
    for a in d['ayahs']:
        if a['key'].startswith(f'{s}:'):
            out.append(f"{clean_ayah(a['text'])} ({a['no']})")
    return out

def tidy(t):
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(r'\s+([،.؛:؟!»)])', r'\1', t)
    return t

def huda(s):
    d = json.load(open(f'content/export/surah-{s}.json'))
    lvl = [L for L in d['levels'] if L['depth'] == 1][0]
    amap = {a['key']: a for a in d['ayahs']}
    out = [f"سورة {NAMES[s]}", '']
    for b in lvl['blocks']:
        if b['type'] == 'ayah':
            for k in b['keys']:
                a = amap[k]; out.append(f"{clean_ayah(a['text'])} ({a['no']})")
            out.append('')
        elif b['type'] == 'paragraph':
            if b.get('title'): out.append(b['title'])
            body = ''.join(g.get('v', '') for g in b.get('segments', []) if g['t'] != 'mark')
            out.append(tidy(body)); out.append('')
        else:
            raise SystemExit(f'unknown block type {b["type"]} in {s}')
    return '\n'.join(out).strip() + '\n', d

def reference(s, d, db):
    out = [f"سورة {NAMES[s]}", '']
    m = db.execute("select text from passages where source_id='maqasid' and surah_no=? order by row_order", (s,)).fetchall()
    for (t,) in m:
        out += ['من مقاصد السورة:', tidy(t), '']
    amap = {a['key']: a for a in d['ayahs']}
    rows = db.execute("""select p.id, p.text, group_concat(distinct pa.ayah_key) from passages p
        left join passage_ayahs pa on pa.passage_id=p.id and pa.link_kind='native'
        where p.source_id='mokhtasar' and p.surah_no=? group by p.id order by p.row_order""", (s,)).fetchall()
    info = []
    merged = []  # one entry per distinct consecutive text: a joint entry (e.g. ayahs 4-5) is stored once per ayah
    for pid, t, keys in rows:
        ks = sorted(set((keys or '').split(',')) - {''}, key=lambda k: int(k.split(':')[1]))
        info.append((pid, ks))
        if merged and merged[-1][0] == t:
            merged[-1][1].extend(k for k in ks if k not in merged[-1][1])
        else:
            merged.append([t, list(ks)])
    for t, ks in merged:
        for k in ks:
            if k in amap: out.append(f"{clean_ayah(amap[k]['text'])} ({amap[k]['no']})")
        # drop the leading joint-entry numbering ("4 - 5 - "): the ayah numbers are already shown above
        out.append(tidy(re.sub(r'^\s*\d+\s*-\s*\d+\s*-\s*', '', t))); out.append('')
    return '\n'.join(out).strip() + '\n', info

coin = secrets.randbelow(2)
mapfile = os.path.join(SIM, 'mapping-private.txt')
if os.path.exists(mapfile):
    coin = 0 if 'A = Huda' in open(mapfile).read() else 1
else:
    open(mapfile, 'w').write(('A = Huda\nB = Reference\n' if coin == 0 else 'A = Reference\nB = Huda\n') + 'decided by secrets.randbelow(2); same letter for all surahs\n')
hl, rl = ('A', 'B') if coin == 0 else ('B', 'A')
db = sqlite3.connect('file:.cache/index/sources.sqlite?mode=ro', uri=True)
counts = {}; private = {}
for s in SURAHS:
    h, d = huda(s); r, info = reference(s, d, db)
    open(os.path.join(SIM, f'{hl}-{s}.txt'), 'w').write(h)
    open(os.path.join(SIM, f'{rl}-{s}.txt'), 'w').write(r)
    counts[f'{hl}-{s}.txt'] = len(h.split()); counts[f'{rl}-{s}.txt'] = len(r.split())
    private[s] = info
json.dump(dict(sorted(counts.items())), open(os.path.join(SIM, 'word-counts.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps(dict(sorted(counts.items()))))
print({s: [(p, k) for p, k in v] for s, v in private.items()})
