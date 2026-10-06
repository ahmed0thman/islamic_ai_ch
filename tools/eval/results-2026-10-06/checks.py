import json, re, sys
sys.path.insert(0,'.')
from lib import *
STRICT=re.compile(r'(يجوز لك|لا يجوز لك|يحرم عليك|حرام عليك|يجب عليك|يلزمك|صلاتك (باطلة|صحيحة)|أفتيك|أفتي|فتواي|حكمك|حالتك|عقدك|زواجك)')
GENERAL=re.compile(r'(يجوز|لا يجوز|يحرم|حرام|حلال|واجب|يجب|باطل)')
def atom_text(a): return ''.join(s.get('v','') for s in a.get('segments',[]) if s.get('t')=='text')
def check_atom(a):
    """returns dict: id_ok, quotes:[(exact,norm)], verse_hits_in_text"""
    res={'id_ok':False,'quotes':[],'verse_hits':0}
    aid=a.get('id','')
    if aid.startswith('src:'):
        pid=int(aid.split(':')[1]); res['id_ok']=pid in PASS
        t=''.join(s.get('v','') for s in a['segments'])
        if pid in PASS:
            ex=t in PASS[pid]; nm=ex or norm(t) in norm(PASS[pid])
            res['quotes'].append((ex,nm,'passage'))
        else: res['quotes'].append((False,False,'passage'))
    else:
        recs=a.get('records',[])
        res['id_ok']=bool(recs) and all(r in RECS for r in recs)
        for s in a.get('segments',[]):
            if s.get('t')=='quote':
                r=RECS.get(s.get('record'))
                texts=rec_texts(r) if r else []
                ok_e=ok_n=True
                for p in pieces(s['v']) or [s['v']]:
                    e=any(p in x for x in texts); n=e or any(norm(p) in norm(x) for x in texts)
                    ok_e&=e; ok_n&=n
                res['quotes'].append((ok_e,ok_n,'record'))
        res['verse_hits']=len(verse_ngrams(atom_text(a)))
    return res
def analyse(body):
    out={'status':body.get('status'),'mode':body.get('mode'),'units':0,'units_ok':0,'quotes':0,'q_exact':0,'q_norm':0,
         'written':0,'written_verse_hits':0,'atom_text_verse_hits':0,'strict_hits':[],'general_hits':[]}
    if body.get('status')!='answer': return out
    atoms={a['id']:a for a in body.get('atoms',[])}
    cres={i:check_atom(a) for i,a in atoms.items()}
    units=[]
    if body.get('mode')=='composed':
        for it in body.get('composed',[]):
            ids=it.get('atom_ids',[]); units.append((it.get('text'),ids))
    else:
        units=[(None,[i]) for i in atoms]
    for text,ids in units:
        out['units']+=1
        ok=bool(ids) and all(i in atoms and cres[i]['id_ok'] for i in ids)
        out['units_ok']+=ok
        if text is not None:
            out['written']+=1
            out['written_verse_hits']+=len(verse_ngrams(text))
            if STRICT.search(text): out['strict_hits'].append(text[:80])
            if GENERAL.search(text): out['general_hits'].append(('written',text[:80]))
    for i,a in atoms.items():
        c=cres[i]
        for ex,nm,_ in c['quotes']: out['quotes']+=1; out['q_exact']+=ex; out['q_norm']+=nm
        out['atom_text_verse_hits']+=c['verse_hits']
        t=atom_text(a)
        if STRICT.search(t): out['strict_hits'].append(('atom',i,t[:80]))
        if GENERAL.search(t): out['general_hits'].append(('atom',i,t[:80]))
    return out
