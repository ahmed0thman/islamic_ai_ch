import json, re, glob, os
R=os.environ.get('HUDA_ROOT', '.') + '/'
DIAC=re.compile('[ً-ٰٟـۖ-ۭ]')
def norm(s):
    s=DIAC.sub('',s)
    s=re.sub('[أإآٱ]','ا',s).replace('ى','ي').replace('ة','ه').replace('ؤ','و').replace('ئ','ي')
    s=re.sub(r'[^\w\s]',' ',s)  # drop punctuation
    return re.sub(r'\s+',' ',s).strip()
def wsq(s): return re.sub(r'\s+',' ',s).strip()
# stores
PASS={}
for l in open(os.environ['HUDA_PASSAGES_JSONL'])  # private cache of book passages, not in the repo:
    o=json.loads(l); PASS[o['id']]=o['text']
PASS_NORM_ALL=None
def passnorm_all():
    global PASS_NORM_ALL
    if PASS_NORM_ALL is None: PASS_NORM_ALL=[norm(t) for t in PASS.values()]
    return PASS_NORM_ALL
RECS={}
for f in glob.glob(R+'app/src/content/surah-*.json'):
    d=json.load(open(f))
    for k,v in d['records'].items(): RECS[k]=v
def rec_texts(r):
    out=[r.get('claim') or '']
    for e in r.get('evidence',[]): out.append(e.get('quote') or '')
    return out
RECS_NORM_ALL=None
def recnorm_all():
    global RECS_NORM_ALL
    if RECS_NORM_ALL is None: RECS_NORM_ALL=[norm(t) for r in RECS.values() for t in rec_texts(r)]
    return RECS_NORM_ALL
QURAN=json.load(open(R+'app/src/content/quran-plain.json'))  # one plain-text ayah each, 6236
QJOIN=' '+' | '.join(norm(a) for a in QURAN)+' '   # | separates ayahs
QJOIN_FLAT=' '+' '.join(norm(a) for a in QURAN)+' '
def pieces(q):
    return [p.strip() for p in re.split(r'«…»|…|\.\.\.',q) if len(p.strip())>=4]
def in_store(q):
    """quote found (exact raw, normalized) in any passage or record text"""
    exact=any(q in t for t in PASS.values()) or any(q in x for r in RECS.values() for x in rec_texts(r))
    n=norm(q)
    normd=exact or any(n in t for t in passnorm_all()) or any(n in t for t in recnorm_all())
    return exact, normd
def quran_match(n):
    """normalized text n is a contiguous run of mushaf words"""
    return (' '+n+' ') in QJOIN_FLAT
def verse_ngrams(text, k=4):
    w=norm(text).split(); hits=[]
    for i in range(len(w)-k+1):
        if (' '+' '.join(w[i:i+k])+' ') in QJOIN_FLAT: hits.append(i)
    return hits

def coverage(text,k=3):
    """fraction of normalized words covered by some k-gram that is contiguous in the mushaf"""
    w=norm(text).split()
    if len(w)<k: return (1.0 if w and quran_match(' '.join(w)) else 0.0), 0
    cov=[False]*len(w)
    for i in range(len(w)-k+1):
        if (' '+' '.join(w[i:i+k])+' ') in QJOIN_FLAT:
            for j in range(i,i+k): cov[j]=True
    return sum(cov)/len(w), len(w)
