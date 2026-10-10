# -*- coding: utf-8 -*-
import json
from lib import *
from kanji_data import KANJI
words=json.load(open(OUT+'/vocab.json',encoding='utf-8'))
LORD=lambda l:(0,int(l[1:])) if l[0]=='G' else (1,int(l[1:]))
out=[]
for k in KANJI:
    c=k['char']
    cand=[w for w in words if c in w.get('kanji','')]
    def score(w):
        n=sum(1 for ch in w['kanji'] if '一'<=ch<='鿿')
        pref=0 if w['source']!='propio' else 1
        return (pref, abs(n-2) if n>2 else n==1 and 0.5 or 0, LORD(w['lesson']))
    cand.sort(key=lambda w:(0 if w['source']!='propio' else 1, 0 if 1<=len([x for x in w['kanji'] if '一'<=x<='鿿'])<=2 else 1, LORD(w['lesson']), w['id']))
    k=dict(k); k['words']=[w['id'] for w in cand[:4]]
    out.append(k)
dump('kanji.json',out); print(len(out))
print([ (k['char'],len(k['words'])) for k in out if len(k['words'])<2])
