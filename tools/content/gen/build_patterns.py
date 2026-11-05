# -*- coding: utf-8 -*-
from lib import *
from patterns_data import P
from patterns_en import EN
out=[]
for p in P:
    tEn,xEn,exEn=EN[p['id']]
    assert len(exEn)==len(p['ex']),p['id']
    e=dict(id=p['id'],title=p['title'],titleEn=tEn,lesson=p['lesson'],
      english=[dict(slot=a,text=b) for a,b in p['en']],
      japanese=[(dict(slot=a,text=b,particle=c) if c else dict(slot=a,text=b)) for a,b,c in p['ja']],
      explanationEs=p['expl'],explanationEn=xEn,
      examples=[dict(es=es,en=en,ja=ja,romaji=to_romaji(ja,particles=True)) for (es,ja),en in zip(p['ex'],exEn)])
    out.append(e)
dump('patterns.json',out); print(len(out), sum(len(x['examples']) for x in out))
