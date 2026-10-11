# -*- coding: utf-8 -*-
import json,re
from lib import *
from build_kana import split
V=json.load(open(OUT+'/vocab.json',encoding='utf-8'))
K=json.load(open(OUT+'/kanji.json',encoding='utf-8'))
PT=json.load(open(OUT+'/patterns.json',encoding='utf-8'))
DG=json.load(open(OUT+'/dialogues.json',encoding='utf-8'))
W={w['id']:w for w in V}
lessons=[]
def L(id,stage,title,requires,**kw):
    d=dict(id=id,stage=stage,title=title,requires=requires); d.update(kw); lessons.append(d); return d
LORD=lambda l:(int(l[1:]) if l[0]=='G' else 100+int(l[1:]))
# ---------------- Stage 1: hiragana
H=[('h-a','Hiragana: あ い う え お','あいうえお'),
 ('h-ka','Hiragana: fila か (ka ki ku ke ko)','かきくけこ'),
 ('h-sa','Hiragana: fila さ (sa shi su se so)','さしすせそ'),
 ('h-ta','Hiragana: fila た (ta chi tsu te to)','たちつてと'),
 ('h-na','Hiragana: fila な (na ni nu ne no)','なにぬねの'),
 ('h-ha','Hiragana: fila は (ha hi fu he ho)','はひふへほ'),
 ('h-ma','Hiragana: fila ま (ma mi mu me mo)','まみむめも'),
 ('h-ya-ra','Hiragana: filas や y ら (ya yu yo, ra ri ru re ro)','やゆよらりるれろ'),
 ('h-wa-n','Hiragana: わ, を y ん','わをん'),
 ('h-dakuten-1','Hiragana con dakuten: が行 y ざ行','がぎぐげござじずぜぞ'),
 ('h-dakuten-2','Hiragana con dakuten: だ行 y ば行','だぢづでどばびぶべぼ'),
 ('h-handakuten','Hiragana con handakuten: ぱ行','ぱぴぷぺぽ'),
 ('h-yoon-1','Yōon: きゃ ぎゃ しゃ じゃ ちゃ','きゃきゅきょぎゃぎゅぎょしゃしゅしょじゃじゅじょちゃちゅちょ'),
 ('h-yoon-2','Yōon: にゃ ひゃ びゃ ぴゃ みゃ りゃ','にゃにゅにょひゃひゅひょびゃびゅびょぴゃぴゅぴょみゃみゅみょりゃりゅりょ'),
 ('h-tsu-long','っ pequeña y vocales largas','っ')]
known=set(); prev=None; used=set()
LONG=re.compile(r'(お[うお]|え[いえ]|ゆう|[うくすつぬふむるぐずぶぷ]う|[ょゅゃ]う)')
def tokens(w): return split(w)
cand_all=[w for w in V if re.fullmatch(r'[ぁ-ゖ]+',w['kana']) and w['pos']!='particle' and '(' not in w['kana']]
for i,(id,title,chars) in enumerate(H):
    new=split(chars); newset=set(new)
    # 'っ' is in chars as single
    known|=newset
    last = id=='h-tsu-long'
    cands=[]
    for w in cand_all:
        if w['id'] in used: continue
        toks=split(w['kana'])
        if not all(t in known for t in toks): continue
        if not any(t in newset for t in toks): continue
        if not last and (LONG.search(w['kana'])): continue
        cands.append(w)
    pref=lambda w:(0 if 'kana-practice' in w['tags'] else 1, len(w['kana']), LORD(w['lesson']), w['id'])
    seenk=set(); cc=[]
    for w in sorted(cands,key=lambda w:(w['source']=='propio',w['id'])):
        if w['kana'] in seenk or w['id'] in ('shi-4','ku-9','shi-ciudad'): continue
        seenk.add(w['kana']); cc.append(w)
    cands=[w for w in cc if len(split(w['kana']))>=2] or cc
    cands.sort(key=pref)
    # keep a balance: prefer genki/profesor useful words first, then kana-practice
    useful=[w for w in cands if 'kana-practice' not in w['tags']]
    pract=[w for w in cands if 'kana-practice' in w['tags']]
    useful.sort(key=lambda w:(len(w['kana']),LORD(w['lesson']),w['id'])); pract.sort(key=lambda w:(len(w['kana']),w['id']))
    n=10 if i>=9 else 8
    pick=(useful[:n//2+1]+pract)[:n] if len(useful)+len(pract)>=n else useful+pract
    # fill up with useful if pract short
    if len(pick)<n: pick=(pick+[w for w in useful if w not in pick])[:n]
    if last:
        # QA-026: the small tsu lesson also practises long vowels (otherwise the lesson drills one kana for 10 rounds)
        tsu=[w for w in pick if 'っ' in w['kana']][:10]
        lng=[w for w in cand_all if w['id'] not in used and 'っ' not in w['kana'] and re.search(r'(ああ|いい|うう|ええ|おお|おう|えい|ゆう|[ゃゅょ]う)',w['kana'])
             and all(t in known for t in split(w['kana'])) and w['id'] not in ('shi-4','ku-9','shi-ciudad')]
        seen2=set(); lng2=[]
        for w in sorted(lng,key=lambda w:(w['source']=='propio','kana-practice' in w['tags'],len(w['kana']),LORD(w['lesson']),w['id'])):
            if w['kana'] in seen2: continue
            seen2.add(w['kana']); lng2.append(w)
        pick=tsu+lng2[:8]
    for w in pick: used.add(w['id'])
    L(id,1,title,[prev] if prev else [],kana=new,words=[w['id'] for w in pick],games=(['kana-write','read-words','listen'] if len(new)==1 else ['kana-recognize','kana-write','read-words','listen']))
    prev=id
h_last=prev
# ---------------- Stage 2
def sel(f): return [w['id'] for w in V if f(w)]
pos_verb=lambda w:w['pos']=='verb'
assigned={}
def take(lessonid,ids):
    out=[]
    for i in ids:
        if i in W and (i not in assigned): assigned[i]=lessonid; out.append(i)
    return out
S2=[]
def S(id,title,req,words,patterns,dialogues,games): S2.append((id,title,req,words,patterns,dialogues,games))
kata=lambda w:re.fullmatch(r'[ァ-ヺー]+',w['kana']) is not None
P_ids=lambda *ls:[w['id'] for w in V if w['lesson'] in ls and w['source']=='profesor']
# explicit particle assignment
PART={'wa-tema':'l-desu','ka':'l-desu','no':'l-desu','mo':'l-kore','ne':'l-kore','yo':'l-kore','o-objeto':'l-verbos-1','ni':'l-verbos-1','e-direccion':'l-verbos-1','de':'l-particulas','to':'l-particulas','ga':'l-aru-iru','ya':'l-aru-iru','kara':'l-te-kudasai','made':'l-fechas'}
# word assignment by rules in order
def rule(w):
    i=w['id'];l=w['lesson'];t=set(w['tags']);p=w['pos']
    if 'kana-practice' in t: return None
    if i=='hatachi': return 'l-contadores'
    if 'kanji-ejemplo' in t: return 'KANJI'
    if i in PART: return PART[i]
    if l=='G0' and 'saludo' in t: return 'l-saludos'
    if l=='G0' and 'numero' in t: return 'l-numeros'
    if i in('sen','man'): return 'l-numeros'
    if i=='hai' : return 'l-saludos'
    if i in('ima','gozen','gogo','ji-hora','ichiji','han','nijihan','nanji','fun'): return 'l-hora'
    if i in('doudemo',): return None
    if t&{'fecha'} and l=='P6' : return 'l-fechas'
    if i in('nenen',) : return 'l-fechas'
    if i in('doyoubi','nichiyoubi','getsuyoubi','kayoubi','suiyoubi','mokuyoubi','kinyoubi','nen','gatsu','nichi','youbi','nannen','nangatsu','nannichi','nanyoubi','kaigi','omatsuri','natsu','natsuyasumi','paatii','shutchou'): return 'l-fechas'
    if i in('hitotsu','futatsu','mittsu','yottsu','itsutsu','muttsu','nanatsu','yattsu','kokonotsu','too','ikutsu','hitori','futari','nin','nannin','kai-piso','ikkai','chika','mai','hatachi'): return 'l-contadores'
    if t&{'transporte','direccion'} and p!='verb' or i in('noru','oriru','magaru','kakaru','shibuya','ginza','oosaka','kyouto'): return 'l-transporte'
    if l=='P7' and (t&{'restaurante','dinero'} or i in('douitashimashite','arigatougozaimashita')) or i in('genkin',): return 'l-restaurante'
    if l=='P7': return 'l-transporte'
    if l=='G1': return 'l-desu'
    if l=='G2': return 'l-kore'
    if l=='P1': return 'l-verbos-1'
    if l=='P2' : return 'l-adjetivos-na'
    if l=='P3': return 'l-adjetivos-i'
    if l=='P4': return 'l-kore'
    if l=='P5': return 'l-aru-iru'
    if l=='P8': return 'l-conj-masu'
    if l=='P9': return 'l-te-imasu-tai'
    if l=='G3':
        if p=='verb': return 'l-verbos-1'
        if p=='i-adj': return 'l-adjetivos-i'
        if p=='adverb' or i in('soudesune','demo','doudesuka','ee'): return 'l-invitar'
        if t&{'comida','ocio'} and p=='noun': return 'l-verbos-1'
        return 'l-particulas'
    if l=='G4':
        if i in('aru','iru'): return 'l-aru-iru'
        if p=='verb': return 'l-conj-masu'
        if i in('gomennasai','sorekara','dakara','takusan','doushite','hitoride','moshimoshi','gurai','toki','kinou','jikan','ichijikan','senshuu'): return 'l-pasado'
        return 'l-aru-iru'
    if l=='G5':
        if p=='i-adj': return 'l-adjetivos-i'
        if p=='na-adj': return 'l-adjetivos-na'
        if i in('issho-ni','daijoubu'): return 'l-invitar'
        return 'l-vacaciones'
    if l=='G6':
        if i in('tabako-wo-suu','hairu','tsukau','motsu','yasumu','shinu','asobu','tsurete-kuru','motte-kuru'): return 'l-permisos'
        return 'l-te-kudasai'
    return None
by={}
leftover=[]
for w in V:
    r=rule(w)
    if r is None:
        if 'kana-practice' not in w['tags']: leftover.append(w['id'])
        continue
    by.setdefault(r,[]).append(w['id'])
print('leftover',leftover)
# weekday words by id check
spec=[
('l-saludos','Saludos y expresiones básicas',[],[],['saludos-manana','llegar-a-casa'],['read-words','listen','dialogues']),
('l-numeros','Números del 0 al 10 000',['l-saludos'],[],[],['numbers','listen','read-words']),
('l-desu','XはYです: presentarse (Genki 1)',['l-saludos'],['noun-desu','ka-question','no-possession'],['presentacion','conocer-profesor','presentar-amigos'],['read-words','syntax','particles','dialogues']),
('l-hora','La hora: じ, はん, ふん',['l-desu','l-numeros'],['nanji-desu-ka'],['preguntar-la-hora'],['clock','numbers','dialogues']),
('l-kore','これ/それ/あれ, compras y precios (Genki 2)',['l-desu','l-numeros'],['kore-sore-are','kono-sono-ano','koko-soko-asoko','dare-no','mo-too','ikura-desu-ka','kudasai'],['comprar-bolso','papeleria'],['read-words','numbers','particles','dialogues']),
('l-verbos-1','Verbos ます: わたしは X を V (profesor + Genki 3)',['l-kore'],['svo-masu','svo-shimasu','go-ni-ikimasu','masu-masen','ni-he-direction'],[],['syntax','conjugation','read-words','particles']),
('l-particulas','Partículas で, に, と y la rutina diaria',['l-verbos-1','l-hora'],['de-place-action','ni-time','question-words','to-with'],['rutina-diaria'],['particles','syntax','dialogues','mini-reading']),
('l-invitar','Invitar: ませんか y ましょう, frecuencia',['l-particulas'],['masen-ka','mashou','frequency'],['planes-cine','invitar-sabado','invitar-cafe'],['dialogues','syntax','mini-reading']),
('l-aru-iru','あります / います y la ubicación (Genki 4)',['l-particulas'],['aru-iru-ni','position-words','nanimo-daremo','ya-etc'],['hay-un-banco','mi-cuarto','en-el-parque'],['syntax','particles','dialogues','mini-reading']),
('l-conj-masu','Tabla de verbos: ます, ました, ません, ませんでした',['l-invitar','l-aru-iru'],['masu-4-tenses','mashita-masendeshita'],[],['conjugation','read-words','syntax']),
('l-pasado','El pasado de です y la conversación de ayer',['l-conj-masu'],['deshita'],[],['conjugation','syntax','mini-reading']),
('l-adjetivos-i','Adjetivos い: tabla de conjugación (Genki 5 + profesor)',['l-pasado'],['adj-desu','adj-kunai','adj-past','adj-modifying'],[],['conjugation','read-words','syntax']),
('l-adjetivos-na','Adjetivos な, すき/きらい y じゃないです',['l-adjetivos-i'],['noun-janai','suki-kirai'],['planes-almuerzo'],['conjugation','particles','dialogues']),
('l-vacaciones','Vacaciones y viajes (Genki 5)',['l-adjetivos-na'],[],['viaje-pasado','vacaciones-kioto','sabado-pasado'],['read-words','dialogues','mini-reading']),
('l-fechas','Calendario: meses, días y semana',['l-pasado','l-hora'],['date-desu','kara-made'],['fecha-cumpleanos','fiesta-fecha','vacaciones-fechas'],['calendar','numbers','dialogues']),
('l-contadores','Contadores: つ, にん, かい, さい',['l-fechas'],['counters'],[],['numbers','syntax','read-words']),
('l-transporte','Transporte y direcciones',['l-contadores'],['de-means','doko-desu-ka','dono-gurai'],['como-llegar','comprar-boleto','en-el-autobus'],['syntax','dialogues','listen','mini-reading']),
('l-restaurante','En el restaurante',['l-contadores','l-conj-masu'],[],['restaurante-pedir','restaurante-cuenta'],['dialogues','numbers','listen']),
('l-te-kudasai','La forma て: ください, secuencias y ofrecimientos (Genki 6)',['l-conj-masu','l-transporte'],['te-kudasai','te-form-connect','mashou-ka-offer','kara-because'],[],['conjugation','syntax','dialogues']),
('l-permisos','Permisos y prohibiciones: てもいい, てはいけません',['l-te-kudasai'],['te-mo-ii','te-wa-ikemasen'],['en-clase','en-la-biblioteca'],['conjugation','syntax','dialogues']),
('l-te-imasu-tai','ています y たいです',['l-permisos'],['te-imasu','tai-desu'],['quiero-ir','que-estas-haciendo','trabajo-y-estudio'],['conjugation','syntax','dialogues','mini-reading']),
]
for id,title,req,pats,dias,games in spec:
    ws=by.get(id,[])
    ws.sort(key=lambda i:(LORD(W[i]['lesson']),0))
    d=dict(words=ws)
    if pats: d['patterns']=pats
    if dias: d['dialogues']=dias
    L(id,2,title,req,**d,games=games)
s2_last='l-te-imasu-tai'
# ---- hiragana gating of stage 2 (data-driven, interleaved). See PLAN_V2 M3 / feedback 3.1.
# Unknown kana render as romaji, so a lesson may open before all its kana are known. For each grammar lesson we
# measure, after each hiragana lesson, which share of the kana of its content (words + pattern examples + dialogue
# lines) is known: distinct kana ("dist") and kana per token occurrence ("occ"). Then:
#   target = first hiragana lesson with dist>=TARGET and occ>=TARGET     (data milestone)
#   floor  = first hiragana lesson with dist>=FLOOR  and occ>=OCC_FLOOR (never go below this readability)
#   cap    = pacing: a new tier of grammar lessons opens every TIER_ROWS hiragana rows after h-na
#   gate   = max(floor, h-na, prerequisites' gates, min(target, cap))
TARGET=0.70; FLOOR=0.50; OCC_FLOOR=0.55; FIRST=4; TIER_SIZE=5; TIER_ROWS=2
PTd={p['id']:p for p in PT}; DGd={d['id']:d for d in DG}
def content_kana(l):
    txt=[W[i]['kana'] for i in l.get('words',[])]
    for p in l.get('patterns',[]): txt+=[e['ja'] for e in PTd[p]['examples']]
    for d in l.get('dialogues',[]): txt+=[ln['ja'] for ln in DGd[d]['lines']]
    return [t for x in txt for t in split(re.sub(r'[^ぁ-ゖ]','',x))]
def readable_at(toks,idx):
    kn=set()
    for h in H[:idx+1]: kn|=set(split(h[2]))
    dist=set(toks)
    return (len([t for t in dist if t in kn])/max(1,len(dist)), len([t for t in toks if t in kn])/max(1,len(toks)))
def first_idx(toks,d_min,o_min):
    for i in range(FIRST,len(H)):
        d,o=readable_at(toks,i)
        if d>=d_min and o>=o_min: return i
    return len(H)-1
GATE={}; GATE_TABLE=[]
s2=[l for l in lessons if l['stage']==2]
for j,l in enumerate(s2):
    toks=content_kana(l)
    target=first_idx(toks,TARGET,TARGET); floor=first_idx(toks,FLOOR,OCC_FLOOR)
    cap=min(len(H)-1,FIRST+TIER_ROWS*((j+TIER_SIZE-1)//TIER_SIZE))
    pre=[GATE[r] for r in l['requires'] if r in GATE]
    g=max(floor,FIRST,max(pre,default=0),min(target,cap))
    GATE[l['id']]=g
    if g>max(pre,default=-1): l['requires']=l['requires']+[H[g][0]]
    d,o=readable_at(toks,g)
    GATE_TABLE.append((l['id'],H[g][0],round(d*100),round(o*100),H[target][0]))
print('hiragana gating of stage 2: lesson -> hiragana lesson, distinct%, occurrence%, (data milestone)')
for r in GATE_TABLE: print('  %-16s %-12s %3d%% %3d%%   target %s'%r)
# ---------------- Stage 3: katakana
KH=[('k-a','Katakana: ア イ ウ エ オ y la vocal larga ー','アイウエオー'),
('k-ka','Katakana: fila カ','カキクケコ'),
('k-sa','Katakana: fila サ','サシスセソ'),
('k-ta','Katakana: fila タ','タチツテト'),
('k-na','Katakana: fila ナ','ナニヌネノ'),
('k-ha','Katakana: fila ハ','ハヒフヘホ'),
('k-ma','Katakana: fila マ','マミムメモ'),
('k-ya-ra','Katakana: filas ヤ y ラ','ヤユヨラリルレロ'),
('k-wa-n','Katakana: ワ, ヲ y ン','ワヲン'),
('k-dakuten-1','Katakana con dakuten: ガ行 y ザ行','ガギグゲゴザジズゼゾ'),
('k-dakuten-2','Katakana con dakuten: ダ行 y バ行','ダヂヅデドバビブベボ'),
('k-handakuten','Katakana con handakuten: パ行','パピプペポ'),
('k-small-tsu','Katakana: la ッ pequeña (doble consonante)','ッ'),
('k-yoon','Katakana: yōon (キャ シャ チャ ジャ ...)','キャキュキョギャギュギョシャシュショジャジュジョチャチュチョニャニュニョヒャヒュヒョビャビュビョピャピュピョミャミュミョリャリュリョ'),
('k-extended','Katakana extendido: ファ ティ ウィ ヴ ジェ ...','ウィウェウォヴァヴィヴヴェヴォジェシェチェツァツィツェツォティトゥディドゥデュファフィフェフォフュイェヴ')]
# k-a needs only the lesson that introduces verbs ます, so katakana and the rest of stage 2 can progress in parallel.
K_GATE='l-verbos-1'
CAP={'k-extended':18}
kknown=set(); prevk=K_GATE
kcand=[w for w in V if re.fullmatch(r'[ァ-ヺー]+',w['kana']) ]
kused=set()
for id,title,chars in KH:
    new=split(chars)
    newset=set(new); kknown|=newset
    picks=[]
    for w in kcand:
        if w['id'] in kused: continue
        toks=split(w['kana'])
        if all(t in kknown for t in toks) and any(t in newset for t in toks): picks.append(w)
    picks.sort(key=lambda w:(len(w['kana']),w['id']))
    if id=='k-extended':
        # cover every extended kana at least once (shortest word first), then fill by length
        cov=[]
        for u in new:
            if len(u)==2 or u=='ヴ':
                c=[w for w in picks if u in split(w['kana']) and w not in cov]
                if c: cov.append(c[0])
        picks=cov+[w for w in picks if w not in cov]
    picks=picks[:CAP.get(id,8)]
    if id=='k-small-tsu':
        # QA-026: also practise the long vowel ー (already taught in k-a), not only ッ
        lv=[w for w in kcand if w['id'] not in kused and w not in picks and 'ー' in w['kana'] and 'ッ' not in w['kana'] and all(t in kknown or t=='ー' for t in split(w['kana']))]
        picks=picks+sorted(lv,key=lambda w:(len(w['kana']),w['id']))[:6]
    for w in picks: kused.add(w['id'])
    # katakana starts after verbs ます (stage 2) AND once hiragana is complete (grammar is now interleaved with hiragana)
    L(id,3,title,[prevk]+([h_last] if id=='k-a' else []),kana=new,words=[w['id'] for w in picks],games=(['kana-write','read-words','listen'] if len(new)==1 else ['kana-recognize','kana-write','read-words','listen']))
    prevk=id
kleft=[w['id'] for w in kcand if w['id'] not in kused]
print('katakana words not used in kana lessons (will go to loan lessons):',len(kleft))
def kw(f): return [w['id'] for w in kcand if f(w)]
def has(*tags): return lambda w:bool(set(w['tags'])&set(tags))
MIXED={'comida':['koohii-wo-nomu'],'lugares':['amerikajin','basutei'],'cosas':['shawaa-wo-abiru'],'ocio':['tenisu-wo-suru','sakkaa-wo-suru','geemu-wo-suru']}
def loan(tagset,excl=()):
    return kw(lambda w:bool(set(w['tags'])&tagset) and not set(w['tags'])&set(excl))
def mixed(k): return [i for i in MIXED[k] if i in W]
L('k-prestamos-comida',3,'Préstamos: comida y bebida',[prevk,'l-particulas'],words=loan({'comida','bebida'})+mixed('comida'),patterns=['de-place-action','to-with'],games=['read-words','listen','syntax'])
L('k-prestamos-lugares',3,'Préstamos: lugares y transporte',['k-prestamos-comida','l-aru-iru'],words=loan({'lugar','transporte','pais'})+mixed('lugares'),games=['read-words','listen','dialogues'])
L('k-prestamos-cosas',3,'Préstamos: cosas, ropa y casa',['k-prestamos-lugares','l-kore'],words=loan({'cosa','ropa','casa'},{'comida','lugar','transporte','pais'})+mixed('cosas'),patterns=['no-possession','dare-no','kore-sore-are'],games=['read-words','listen','particles'])
L('k-prestamos-ocio',3,'Préstamos: ocio, deportes y escuela',['k-prestamos-cosas','l-invitar'],words=loan({'ocio','deporte','escuela','trabajo'},{'comida','lugar','transporte','pais','cosa','ropa','casa'})+mixed('ocio'),patterns=['frequency','masu-masen','de-place-action'],games=['read-words','listen','mini-reading'])
# review: the stage-2 topics whose dialogues it replays (shopping, restaurant, lunch plans)
L('k-repaso',3,'Repaso: diálogos y lecturas con katakana',['k-prestamos-ocio','l-restaurante','l-adjetivos-na'],dialogues=['comprar-bolso','papeleria','restaurante-pedir','restaurante-cuenta','planes-almuerzo'],patterns=['masu-masen','de-place-action','kudasai','counters'],games=['dialogues','mini-reading','syntax','read-words'])
# ---------------- Stage 4: kanji
KL={}
for k in K: KL.setdefault(k['genkiLesson'],[]).append(k['char'])
klev={k['char']:k['genkiLesson'] for k in K}
prev4='k-repaso'
for n in range(3,13):
    ws=[w['id'] for w in V if w.get('kanji') and any('一'<=c<='鿿' for c in w['kanji']) and max(klev[c] for c in w['kanji'] if c in klev)==n and all((c in klev) or not('一'<=c<='鿿') for c in w['kanji'])]
    ws.sort(key=lambda i:(LORD(W[i]['lesson']),i))
    L(f'kanji-{n}',4,f'Kanji de Genki, lección {n}',[prev4]+([s2_last] if n==3 else []),kanji=KL[n],words=ws,games=['kanji','read-words','mini-reading'])
    prev4=f'kanji-{n}'
# KANJI-ejemplo words in vocab are included in kanji-N by the rule above
for l in lessons:
    if l['stage'] in (1,3) and not l.get('words'):
        l['games']=[g for g in l['games'] if g not in('read-words','listen')]
        l.pop('words',None) if False else None
dump('curriculum.json',lessons)
print(len(lessons),'lessons')
for l in lessons: print(l['id'],len(l.get('words',[])),len(l.get('kana',[])),l['requires'])
