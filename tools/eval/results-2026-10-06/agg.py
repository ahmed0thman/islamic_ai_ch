import json,statistics as st
sets={'orig-held':'retrieval-held-run{}.json','orig-all':'retrieval-all-run{}.json','extra':'retrieval-extra-run{}.json','combined':'retrieval-combined-run{}.json'}
res={}
for name,pat in sets.items():
    runs=[json.load(open(pat.format(r))) for r in (1,2)]
    print('==',name,runs[0]['counts'])
    same=all(x['top_ids']==y['top_ids'] and x['mrr_at_10']==y['mrr_at_10'] and x['recall']==y['recall'] for x,y in zip(runs[0]['per_case'],runs[1]['per_case']))
    print(' identical per-case rankings run1 vs run2:',same)
    for m in ('lexical','semantic','hybrid'):
        for r,run in enumerate(runs,1):
            rows=[x for x in run['per_case'] if x['mode']==m]
            sc=[x for x in rows if not x['exclusion'] and not x['title_is_gold']]
            lat=[x['latency_ms'] for x in rows]
            mean=lambda k:sum(x[k] if k=='mrr_at_10' else x['recall'][k] for x in sc)/len(sc)
            lat_s=sorted(lat)
            p=lambda q:lat_s[min(len(lat_s)-1,int(round(q*(len(lat_s)-1))))]
            print(f"  {m:8s} run{r} n={len(sc)} r@8={mean('recall_at_8'):.4f} r@24={mean('recall_at_24'):.4f} mrr10={mean('mrr_at_10'):.4f} p50={st.median(lat):.1f} p95={p(.95):.1f} max={max(lat):.1f} (all {len(rows)} attempted)")
    # paired (run1) hybrid vs others
    pc=lambda m:{x['id']:x for x in runs[0]['per_case'] if x['mode']==m and not x['exclusion'] and not x['title_is_gold']}
    H=pc('hybrid')
    for o in ('lexical','semantic'):
        O=pc(o)
        for key in ('recall_at_8','recall_at_24'):
            w=sum(H[i]['recall'][key]>O[i]['recall'][key]+1e-9 for i in H); l=sum(H[i]['recall'][key]<O[i]['recall'][key]-1e-9 for i in H)
            print(f"  hybrid vs {o} {key}: hybrid better in {w}, worse in {l}, equal {len(H)-w-l}")
        w=sum(H[i]['mrr_at_10']>O[i]['mrr_at_10']+1e-9 for i in H); l=sum(H[i]['mrr_at_10']<O[i]['mrr_at_10']-1e-9 for i in H)
        print(f"  hybrid vs {o} mrr10: better {w}, worse {l}, equal {len(H)-w-l}")
    # title_is_gold block
    for m in ('lexical','semantic','hybrid'):
        rows=[x for x in runs[0]['per_case'] if x['mode']==m and x['title_is_gold'] and not x['exclusion']]
        if rows: print('  title_is_gold',m,len(rows),round(sum(x['recall']['recall_at_8'] for x in rows)/len(rows),4),round(sum(x['recall']['recall_at_24'] for x in rows)/len(rows),4),round(sum(x['mrr_at_10'] for x in rows)/len(rows),4))
