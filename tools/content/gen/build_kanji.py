# -*- coding: utf-8 -*-
import json, os, sqlite3
from lib import *
from kanji_data import KANJI
words=json.load(open(OUT+'/vocab.json',encoding='utf-8'))
LORD=lambda l:(0,int(l[1:])) if l[0]=='G' else (1,int(l[1:]))
DICT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','..','LightKanji','assets','dictionaries')
KANJIDIC=json.load(open(os.path.join(DICT,'kanji_jlpt_only.json'),encoding='utf-8'))
DB=sqlite3.connect(os.path.join(DICT,'kanjidb.sqlite'))
def strokes(c):
    # KANJIDIC (via LightKanji) first; Kanjium's kanjidict for kanji outside the JLPT file (分)
    if c in KANJIDIC: return KANJIDIC[c]['stroke_count']
    return DB.execute('select strokes from kanjidict where kanji=?',(c,)).fetchone()[0]
CHARS_SET={k['char'] for k in KANJI}
def lookalikes(c):
    # Kanjium look-alikes restricted to the Genki set (distractors must be kanji the learner can meet)
    r=DB.execute('select similar from lookalikes where kanji=?',(c,)).fetchone()
    out=[x for x in (r[0].split(',') if r else []) if x in CHARS_SET and x!=c]
    # fill with Genki kanji sharing the same radical (Kanjium kanjidict), up to 4
    rad=DB.execute('select radical from kanjidict where kanji=?',(c,)).fetchone()
    if rad:
        for (x,) in DB.execute('select kanji from kanjidict where radical=?',(rad[0],)):
            if x in CHARS_SET and x!=c and x not in out and len(out)<4: out.append(x)
    return out
out=[]
for k in KANJI:
    c=k['char']
    cand=[w for w in words if c in w.get('kanji','')]
    def score(w):
        n=sum(1 for ch in w['kanji'] if '一'<=ch<='鿿')
        pref=0 if w['source']!='propio' else 1
        return (pref, abs(n-2) if n>2 else n==1 and 0.5 or 0, LORD(w['lesson']))
    cand.sort(key=lambda w:(0 if w['source']!='propio' else 1, 0 if 1<=len([x for x in w['kanji'] if '一'<=x<='鿿'])<=2 else 1, LORD(w['lesson']), w['id']))
    k=dict(k); k['words']=[w['id'] for w in cand[:4]]; k['strokes']=strokes(c)
    sim=lookalikes(c)
    if sim: k['similar']=sim
    out.append(k)
dump('kanji.json',out); print(len(out))
print([ (k['char'],len(k['words'])) for k in out if len(k['words'])<2])
