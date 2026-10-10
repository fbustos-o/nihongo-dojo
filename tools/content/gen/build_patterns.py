# -*- coding: utf-8 -*-
from lib import *
from patterns_data import P
out=[]
for p in P:
    e=dict(id=p['id'],title=p['title'],lesson=p['lesson'],
      english=[dict(slot=a,text=b) for a,b in p['en']],
      japanese=[(dict(slot=a,text=b,particle=c) if c else dict(slot=a,text=b)) for a,b,c in p['ja']],
      explanationEs=p['expl'],
      examples=[dict(es=es,ja=ja,romaji=to_romaji(ja,particles=True)) for es,ja in p['ex']])
    out.append(e)
dump('patterns.json',out); print(len(out), sum(len(x['examples']) for x in out))
