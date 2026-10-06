import json,sys,re,collections
sys.path.insert(0,'.')
from checks import *
MARK=re.compile(r'﴿([^﴾]+)﴾')
def srcname_of_atom(a):
    if a['id'].startswith('src:'): return (a.get('source') or {}).get('title')
    for r in a.get('records',[]):
        for e in RECS.get(r,{}).get('evidence',[]):
            if e.get('source_title'): return e['source_title']
    return None
def measure_A(body):
    m=dict(sent=0,named=0,quotes=0,q_exact=0,q_norm=0,verse_quotes=0,verse_exact=0,verse_unmarked=0,declined=0,status=body.get('status'))
    if body.get('status')!='answer':
        m['declined']=1 if body.get('status') in ('insufficient','out_of_scope','fatwa','not_arabic') else 0; return m
    atoms={a['id']:a for a in body['atoms']}
    units=[(it.get('text'),it['atom_ids']) for it in body['composed']] if body.get('mode')=='composed' else [(None,[i]) for i in atoms]
    for text,ids in units:
        m['sent']+=1; m['named']+=any(srcname_of_atom(atoms[i]) for i in ids if i in atoms)
        if text: m['verse_unmarked']+=len(verse_ngrams(text))>0
    for a in atoms.values():
        c=check_atom(a)
        for ex,nm,_ in c['quotes']: m['quotes']+=1; m['q_exact']+=ex; m['q_norm']+=nm
        for s in a['segments']:
            if s['t']=='ayah': m['verse_quotes']+=1; m['verse_exact']+=1  # data path
    return m
def measure_B(body):
    m=dict(sent=0,named=0,quotes=0,q_exact=0,q_norm=0,mixed=0,verse_quotes=0,verse_exact=0,verse_unmarked=0,declined=0,status='ok')
    p=body.get('parsed')
    if not p: m['status']='bad'; return m
    m['declined']=1 if p.get('declined') else 0
    for s in p.get('sentences',[]):
        m['sent']+=1
        if (s.get('source') or '').strip(): m['named']+=1
        q=(s.get('quote') or '').strip(); t=s.get('text') or ''
        spans=MARK.findall(t)+MARK.findall(q)
        qfull=norm(q) if q else ''
        if q:
            m['quotes']+=1
            e,n=in_store(q)
            m['q_exact']+=e; m['q_norm']+=n
        cands=[(sp,'marked') for sp in spans]
        if q and not spans:
            cv,nw=coverage(q)
            if cv>=0.8: cands.append((q,'field'))
            elif cv>=0.2: m['mixed']=m.get('mixed',0)+1   # tafsir-like quote with verse words inside; not counted as a verse quotation
        for sp,_ in cands:
            m['verse_quotes']+=1; m['verse_exact']+=quran_match(norm(sp))
        if not spans and not cands and coverage(t)[0]>=0.5: m['verse_unmarked']+=1
    return m
if __name__=='__main__':
    for sysn,f,fn in (('A','part2-A.jsonl',measure_A),('B','part2-B.jsonl',measure_B)):
        tot=collections.Counter(); rows=[]
        for l in open(f):
            r=json.loads(l); m=fn(r['body']); m['surah']=r['surah']; m['refused']=r.get('provider_refused',False); rows.append(m)
            for k,v in m.items():
                if isinstance(v,int): tot[k]+=v
        print(sysn,dict(tot)); 
        for m in rows: print('  ',m)
