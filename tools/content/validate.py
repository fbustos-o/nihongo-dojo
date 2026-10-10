# -*- coding: utf-8 -*-
import json,re,sys,subprocess,os
C=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','app','src','content')+'/'
errs=[];warns=[]
def E(m): errs.append(m)
def Wn(m): warns.append(m)
def load(n):
    try: return json.load(open(C+n,encoding='utf-8'))
    except Exception as e: E(f'{n}: invalid JSON: {e}'); return None
kana=load('kana.json');vocab=load('vocab.json');pats=load('patterns.json');dial=load('dialogues.json')
nums=load('numbers.json');kanji=load('kanji.json');cur=load('curriculum.json')
if errs: print('\n'.join(errs)); sys.exit(1)
HK=re.compile(r'[一-鿿]')
# ---- unique ids
def uniq(lst,key,name):
    seen={}
    for x in lst:
        k=key(x)
        if k in seen: E(f'{name}: duplicate {k}')
        seen[k]=x
    return seen
K=uniq(kana,lambda k:(k['char']),'kana'); 
for k in kana:
    for f in('char','romaji','script','row','group'):
        if f not in k: E(f'kana {k}: missing {f}')
    if k['group'] not in('gojuon','dakuten','handakuten','yoon','extended'): E(f"kana {k['char']}: bad group")
V=uniq(vocab,lambda w:w['id'],'vocab')
for w in vocab:
    if not re.fullmatch(r'[a-z0-9-]+',w['id']): E(f"vocab id not lowercase ascii: {w['id']}")
    for f in('id','kana','romaji','es','pos','lesson','tags','source'):
        if f not in w: E(f"vocab {w['id']}: missing {f}")
    if w['pos']=='verb' and w.get('verbGroup') not in('u','ru','irregular'): E(f"verb without verbGroup: {w['id']}")
    if w['pos']!='verb' and 'verbGroup' in w: E(f"non-verb with verbGroup: {w['id']}")
    if w['pos'] not in('noun','verb','i-adj','na-adj','adverb','expression','counter','particle','pronoun'): E(f"bad pos {w['id']}")
    if not re.fullmatch(r'G(\d|1[0-2])|P[1-9]',w['lesson']): E(f"bad lesson {w['id']} {w['lesson']}")
    if w['source'] not in('genki','profesor','propio'): E(f"bad source {w['id']}")
    if not w['es'] or any(not s for s in w['es']): E(f"empty meaning {w['id']}")
    if HK.search(w['kana']): E(f"kanji in kana field: {w['id']}")
    if w['pos']=='i-adj' and not w['kana'].endswith('い'): E(f"i-adj not ending い: {w['id']}")
IE='[いきしちにひみりぎじぢびぴえけせてねへめれげぜでべぺ]'
WHITE_U_RU={'かえる','はいる','いる','きる','しる','はしる','かぎる','へる','しゃべる','ける','にぎる','ちる','まいる','ひねる'}
for w in vocab:
    if w['pos']!='verb': continue
    k=w['kana'];g=w['verbGroup']
    if g=='irregular':
        if not re.search(r'(する|くる)$',k): E(f"irregular verb odd: {w['id']}")
    elif g=='ru':
        if not re.search(IE+'る$',k): E(f"ru-verb must end in i-row/e-row + る: {w['id']} {k}")
        if k in WHITE_U_RU and not (w['id'] in ('iru',)): E(f"known u-verb marked ru: {w['id']} {k}")
    else:
        base=k.split('を')[-1]
        if re.search(IE+'る$',base) and base not in WHITE_U_RU: E(f"u-verb ends in iru/eru but not whitelisted: {w['id']} {k}")
        if w['id']=='iru': E('iru (be) must be ru')
# iru be=ru, iru-necesitar=u
if V['iru']['verbGroup']!='ru' or V['iru-necesitar']['verbGroup']!='u': E('iru groups wrong')
for i,g in (('kaeru','u'),('hairu','u'),('suwaru','u'),('hashiru','u'),('shiru','u'),('okiru','ru'),('taberu','ru'),('kariru','ru'),('suru','irregular'),('kuru','irregular'),('wakaru','u'),('kau','u'),('iku','u')):
    if i in V and V[i]['verbGroup']!=g: E(f'group of {i} should be {g}')
# ---- kanji field consistency
kset={k['char'] for k in kanji}|{'々'}
for w in vocab:
    for ch in w.get('kanji',''):
        if HK.match(ch) and ch not in kset: E(f"vocab {w['id']}: kanji {ch} not in Genki I list")
    if 'kanji' in w and not HK.search(w['kanji']): E(f"vocab {w['id']}: kanji field has no kanji")
    if w['source']=='genki' and re.search(r'[A-Za-z]',w['kana']): E(f"latin in kana {w['id']}")
# ---- kanji.json
uniq(kanji,lambda k:k['char'],'kanji')
for k in kanji:
    for f in('char','on','kun','es','genkiLesson','words'):
        if f not in k: E(f"kanji {k.get('char')}: missing {f}")
    if not (3<=k['genkiLesson']<=12): E(f"kanji lesson {k['char']}")
    for wid in k['words']:
        if wid not in V: E(f"kanji {k['char']}: unknown word {wid}")
        elif k['char'] not in V[wid].get('kanji',''): E(f"kanji {k['char']}: word {wid} does not contain it")
    if len(k['words'])<2: Wn(f"kanji {k['char']} has <2 example words")
    if not isinstance(k.get('strokes'),int) or k['strokes']<1: E(f"kanji {k['char']}: missing strokes")
    if not k.get('teach'): Wn(f"kanji {k['char']}: no teach (Genki readings)")
    for r in k.get('teach',[]):
        if r not in k['on']+k['kun']: E(f"kanji {k['char']}: teach {r} not in on/kun")
    for x in k.get('similar',[]):
        if x not in kset: E(f"kanji {k['char']}: similar {x} not in Genki set")
# ---- patterns
P=uniq(pats,lambda p:p['id'],'patterns')
SL={'S','V','O','DIR','BE','ADJ','N'}
for p in pats:
    for f in('id','title','lesson','english','japanese','explanationEs','examples'):
        if f not in p: E(f"pattern {p['id']}: missing {f}")
    for s in p['english']+p['japanese']:
        if s['slot'] not in SL: E(f"pattern {p['id']}: slot {s['slot']}")
    for ex in p['examples']:
        if HK.search(ex['ja']): E(f"pattern {p['id']}: kanji in example {ex['ja']}")
        if not all(ex[f] for f in('es','ja','romaji')): E(f"pattern {p['id']}: empty example field")
    if not (3<=len(p['examples'])<=6) : Wn(f"pattern {p['id']}: {len(p['examples'])} examples")
# ---- dialogues
D=uniq(dial,lambda d:d['id'],'dialogues')
for d in dial:
    for l in d['lines']:
        if HK.search(l['ja']): E(f"dialogue {d['id']}: kanji in {l['ja']}")
        if l['speaker'] not in('A','B'): E(f"dialogue {d['id']} speaker")
        if not (l['romaji'] and l['es']): E(f"dialogue {d['id']} empty")
# ---- curriculum
Lm=uniq(cur,lambda l:l['id'],'curriculum')
GAMES={'kana-recognize','kana-write','read-words','listen','syntax','particles','conjugation','numbers','clock','calendar','dialogues','mini-reading','kanji'}
kanas={k['char'] for k in kana}
for l in cur:
    if l['stage'] not in(1,2,3,4): E(f"lesson {l['id']} stage")
    for r in l['requires']:
        if r not in Lm: E(f"lesson {l['id']}: unknown requires {r}")
        elif Lm[r]['stage']>l['stage']: E(f"lesson {l['id']} requires later stage {r}")
    for g in l['games']:
        if g not in GAMES: E(f"lesson {l['id']}: bad game {g}")
    for w in l.get('words',[]):
        if w not in V: E(f"lesson {l['id']}: unknown word {w}")
    for p in l.get('patterns',[]):
        if p not in P: E(f"lesson {l['id']}: unknown pattern {p}")
    for d in l.get('dialogues',[]):
        if d not in D: E(f"lesson {l['id']}: unknown dialogue {d}")
    for k in l.get('kanji',[]):
        if k not in kset: E(f"lesson {l['id']}: unknown kanji {k}")
    for k in l.get('kana',[]):
        if k not in kanas: E(f"lesson {l['id']}: unknown kana {k}")
# DAG
state={}
def dfs(n,path):
    if state.get(n)==1: E('cycle: '+' > '.join(path+[n])); return
    if state.get(n)==2: return
    state[n]=1
    for r in Lm[n]['requires']:
        if r in Lm: dfs(r,path+[n])
    state[n]=2
for n in Lm: dfs(n,[])
# stage 1 / 3 kana-only constraint
sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)),'gen'))
from build_kana import split
for stage,pred in((1,lambda c:'ぁ'<=c[0]<='ゖ'),(3,lambda c:'ァ'<=c[0]<='ヺ' or c[0]=='ー')):
    known=set()
    for l in cur:
        if l['stage']!=stage or 'kana' not in l: continue
        known|=set(l['kana'])
        for wid in l.get('words',[]):
            w=V[wid]
            toks=split(w['kana'])
            bad=[t for t in toks if t not in known]
            if bad: E(f"stage {stage} lesson {l['id']}: word {wid} {w['kana']} uses unknown kana {bad}")
            if stage==1 and re.search(r'[゠-ヿ]',w['kana']): E(f"stage1 word with katakana {wid}")
            if stage==3 and re.search(r'[ぁ-ゖ]',w['kana']): E(f"stage3 kana lesson word with hiragana {wid}")
# stage 3 audit: loanword lessons (hiragana known from stage 1, all katakana of the stage), ー in the first lesson,
# enough words in the extended-kana lesson, each extended kana covered, mixed-script words allowed.
s1=set()
for l in cur:
    if l['stage']==1: s1|=set(l.get('kana',[]))
s3_all=set()
for l in cur:
    if l['stage']==3: s3_all|=set(l.get('kana',[]))
for l in cur:
    if l['stage']==3 and 'kana' not in l:
        for wid in l.get('words',[]):
            bad=[t for t in split(V[wid]['kana']) if t not in s1|s3_all]
            if bad: E(f"stage 3 lesson {l['id']}: word {wid} {V[wid]['kana']} uses unknown kana {bad}")
            if not re.search(r'[゠-ヿ]',V[wid]['kana']): E(f"stage 3 lesson {l['id']}: word {wid} has no katakana")
k_lessons=[l for l in cur if l['stage']==3 and 'kana' in l]
if not k_lessons or 'ー' not in k_lessons[0]['kana']: E('the long-vowel mark ー must be taught in the first katakana lesson')
elif not k_lessons[0].get('words'): E('first katakana lesson has no word that uses ー')
else:
    if not any('ー' in V[w]['kana'] for w in k_lessons[0]['words']): E('first katakana lesson: no word uses ー')
ext=[l for l in k_lessons if 'ファ' in l['kana']]
if len(ext)!=1: E('extended-kana lesson not found')
else:
    ws=ext[0].get('words',[])
    if len(ws)<12: E(f"extended-kana lesson has only {len(ws)} words (need >= 12)")
    text=''.join(V[w]['kana'] for w in ws)
    for unit in ['ウィ','ウェ','ウォ','ジェ','シェ','チェ','ティ','ディ','デュ','ファ','フィ','フェ','フォ']:
        if unit not in text: Wn(f"extended-kana lesson: no word with {unit}")
    for must in ['パーティー','フォーク','チェック','シェフ','ウィーン']:
        if must not in [V[w]['kana'] for w in ws]: E(f"extended-kana lesson lacks {must}")
# gating: k-a depends on the stage-2 lesson that introduces verbs ます (not on the whole stage 2)
ka=Lm.get('k-a')
if not ka or [Lm[r]['stage'] for r in ka['requires']]!=[2]: E('k-a must require exactly one stage-2 lesson')
# loanword origin: optional but must be a non-empty string
for w in vocab:
    if 'origin' in w and (not isinstance(w['origin'],str) or not w['origin'].strip()): E(f"empty origin {w['id']}")
# stage-1 words must be hiragana-only; stage 3 prerequisites chain contiguous
# coverage: every non-practice word in some lesson
inl=set()
for l in cur: inl|=set(l.get('words',[]))
for w in vocab:
    if 'kana-practice' in w['tags']:
        if w['id'] not in inl: Wn(f"kana-practice word not used in any lesson: {w['id']}")
    elif w['id'] not in inl: E(f"vocab word {w['id']} ({w['kana']}) not in any lesson")
# every Genki G0-G6 / teacher P word covered above. kanji lessons cover all kanji
kl={c for l in cur for c in l.get('kanji',[])}
if kl!={k['char'] for k in kanji}: E('kanji lessons do not cover all kanji')
# patterns and dialogues all used
usedp={p for l in cur for p in l.get('patterns',[])};usedd={d for l in cur for d in l.get('dialogues',[])}
for p in P:
    if p not in usedp: E(f'pattern {p} unused in curriculum')
for d in D:
    if d not in usedd: E(f'dialogue {d} unused in curriculum')
# ---- numbers.json spot checks vs teacher sheets
S={s['value']:s['reading'] for s in nums['samples']}
exp={9:'きゅう',416:'よんひゃくじゅうろく',7890:'ななせんはっぴゃくきゅうじゅう',72341:'ななまんにせんさんびゃくよんじゅういち',618905:'ろくじゅういちまんはっせんきゅうひゃくご',23:'にじゅうさん'}
for k,v in exp.items():
    if S.get(k)!=v: E(f'numbers sample {k}: {S.get(k)} != {v}')
days={d['value']:d['reading'] for d in nums['days']['items']}
for k,v in {1:'ついたち',2:'ふつか',4:'よっか',7:'なのか',8:'ようか',9:'ここのか',10:'とおか',14:'じゅうよっか',17:'じゅうしちにち',19:'じゅうくにち',20:'はつか',24:'にじゅうよっか',31:'さんじゅういちにち'}.items():
    if days[k]!=v: E(f'day {k}: {days[k]}')
if len(days)!=31: E('days != 31')
mo={m['value']:m['reading'] for m in nums['months']['items']}
if (mo[4],mo[7],mo[9])!=('しがつ','しちがつ','くがつ'): E('months irregular')
hrs={h['value']:h['reading'] for h in nums['hours']['items']}
if (hrs[4],hrs[7],hrs[9])!=('よじ','しちじ','くじ'): E('hours irregular')
# ---- wanakana roundtrip
r=subprocess.run(['node',os.path.join(os.path.dirname(os.path.abspath(__file__)),'wk','roundtrip.js')],capture_output=True,text=True,env={**os.environ,'NODE_PATH':os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','app','node_modules')})
print(r.stdout.strip(), r.stderr.strip()[:300])
bad=[l for l in r.stdout.splitlines() if l.startswith('["')]
for b in bad:
    if 'shutchou' in b: Wn('roundtrip: shutchou uses Hepburn "tch" (IME needs "cch")'); continue
    E('roundtrip '+b)
# counts
from collections import Counter
print('COUNTS kana',len(kana),'vocab',len(vocab),'patterns',len(pats),'examples',sum(len(p['examples']) for p in pats),'dialogues',len(dial),'lines',sum(len(d['lines']) for d in dial),'kanji',len(kanji),'lessons',len(cur))
print('vocab by source',dict(Counter(w['source'] for w in vocab)))
print('lessons by stage',dict(Counter(l['stage'] for l in cur)))
print('WARNINGS',len(warns));[print(' -',w) for w in warns[:40]]
print('ERRORS',len(errs));[print(' !',e) for e in errs[:80]]
sys.exit(1 if errs else 0)
