# -*- coding: utf-8 -*-
from lib import *
D={0:'ぜろ',1:'いち',2:'に',3:'さん',4:'よん',5:'ご',6:'ろく',7:'なな',8:'はち',9:'きゅう'}
KJ={0:'〇',1:'一',2:'二',3:'三',4:'四',5:'五',6:'六',7:'七',8:'八',9:'九',10:'十'}
HUND={1:'ひゃく',2:'にひゃく',3:'さんびゃく',4:'よんひゃく',5:'ごひゃく',6:'ろっぴゃく',7:'ななひゃく',8:'はっぴゃく',9:'きゅうひゃく'}
THOU={1:'せん',2:'にせん',3:'さんぜん',4:'よんせん',5:'ごせん',6:'ろくせん',7:'ななせん',8:'はっせん',9:'きゅうせん'}
def below100(n):
    if n==0: return ''
    t,o=divmod(n,10)
    s=''
    if t: s+=('' if t==1 else D[t])+'じゅう'
    if o: s+=D[o]
    return s
def below10000(n):
    th,r=divmod(n,1000); h,r=divmod(r,100)
    s=''
    if th: s+=THOU[th]
    if h: s+=HUND[h]
    return s+below100(r)
def read(n):
    if n==0: return 'ぜろ'
    m,r=divmod(n,10000)
    s=''
    if m: s+=below10000(m)+'まん' if m!=1 else 'いちまん'
    # ten-thousand: 10000 = いちまん; 100000 = じゅうまん
    return s+below10000(r)
KANJI_DIGIT=lambda n:''.join(KJ[int(c)] for c in str(n))
out={}
out['meta']={
 'description':'Tablas de datos para el motor de números, hora, fechas y contadores. Todas las lecturas están en hiragana (formas preferidas por el profesor). `alt` lista lecturas alternativas válidas; `avoid` lista lecturas que el profesor tachó en su hoja (no usarlas al componer).',
 'notes':{
  'numbers':'value+reading. Compose with the powers tables; see rules.',
  'teacherStrikeouts':'En su hoja de numerales el profesor tachó: れい (usar ぜろ), し/しち para 4 y 7, く para 9 en las composiciones (じゅうし, じゅうしち, しちじゅう, じゅうく). Usar よん, なな, きゅう. Excepción: en los días del mes se usan じゅうしちにち (17), じゅうくにち (19), にじゅうしちにち (27), にじゅうくにち (29) y en しがつ/しちがつ/くがつ.',
  'romaji':'No se incluye romaji: se genera con to-romaji del kana.'}}
out['digits']=[]
for i in range(10):
    d=dict(value=i,kanji=KJ[i],reading=D[i])
    if i==0: d['alt']=['れい','ゼロ']
    if i in(4,7,9): d['avoid']={4:['し'],7:['しち'],9:['く']}[i]
    out['digits'].append(d)
out['digits'][0]['reading']='ぜろ'
out['powers']={
 'ten':[dict(multiplier=i,reading=('' if i==1 else D[i])+'じゅう',kanjiValue=i*10) for i in range(1,10)],
 'hundred':[dict(multiplier=i,reading=HUND[i],irregular=i in(3,6,8)) for i in range(1,10)],
 'thousand':[dict(multiplier=i,reading=THOU[i],irregular=i in(3,8)) for i in range(1,10)],
 'tenThousand':{'unit':'まん','kanji':'万','note':'1万 se lee いちまん (el いち NO se omite, a diferencia de 100 = ひゃく y 1000 = せん). 10 000 = いちまん, 100 000 = じゅうまん, 1 000 000 = ひゃくまん.'}}
out['rules']=[
 'Del 11 al 19: じゅう + dígito (じゅういち … じゅうきゅう). Decenas: 20 にじゅう … 90 きゅうじゅう; 10 = じゅう (sin いち).',
 'Centenas: 100 ひゃく (sin いち), 300 さんびゃく, 600 ろっぴゃく, 800 はっぴゃく, resto: dígito + ひゃく (4 = よん, 7 = なな, 9 = きゅう).',
 'Millares: 1000 せん (sin いち), 3000 さんぜん, 8000 はっせん, resto: dígito + せん.',
 'Decenas de millar: grupo de hasta 4 cifras + まん (いちまん obligatorio). 72 341 = ななまん にせん さんびゃく よんじゅういち.',
 'Precios: número + えん. 4 円 = よえん; 14 円 = じゅうよえん; 40 円 = よんじゅうえん.',
 'Años: número + ねん (にせんにじゅうろくねん = 2026). 4 años = よねん; 7 = ななねん/しちねん; 9 = きゅうねん/くねん.']
# hours
H={1:'いちじ',2:'にじ',3:'さんじ',4:'よじ',5:'ごじ',6:'ろくじ',7:'しちじ',8:'はちじ',9:'くじ',10:'じゅうじ',11:'じゅういちじ',12:'じゅうにじ'}
out['hours']=dict(
 items=[dict(value=k,reading=v,kanji=('十'*(k//10) if False else None) or None,irregular=k in(4,7,9)) for k,v in H.items()],
 half=dict(reading='はん',kanji='半',example='にじはん'),
 ampm=[dict(reading='ごぜん',kanji='午前',es='a.m.'),dict(reading='ごご',kanji='午後',es='p.m.')],
 ask=dict(reading='なんじ',kanji='何時',es='¿qué hora?'),
 note='Irregulares: よじ (4), しちじ (7), くじ (9). 4:30 = よじはん. Pregunta: いま なんじ ですか.')
for it in out['hours']['items']: it.pop('kanji')
# minutes
ONE={1:'いっぷん',2:'にふん',3:'さんぷん',4:'よんぷん',5:'ごふん',6:'ろっぷん',7:'ななふん',8:'はっぷん',9:'きゅうふん'}
TENP={1:'じゅう',2:'にじゅう',3:'さんじゅう',4:'よんじゅう',5:'ごじゅう'}
mins=[]
for m in range(1,60):
    t,o=divmod(m,10)
    if o==0: r=TENP[t]+'っぷん' if t>1 or True else ''
    else: r=(TENP[t] if t else '')+ONE[o]
    if o==0: r={'じゅうっぷん':'じゅっぷん'}.get(r,r.replace('じゅうっぷん','じゅっぷん'))
    item=dict(value=m,reading=r)
    alt=[]
    if o==0: alt.append(r.replace('じゅっ','じっ'))
    if o==8: alt.append(r.replace('はっぷん','はちふん'))
    if o==7: pass
    if alt: item['alt']=alt
    mins.append(item)
out['minutes']=dict(items=mins,
  rules='ふん/ぷん: 1 いっぷん, 2 にふん, 3 さんぷん, 4 よんぷん, 5 ごふん, 6 ろっぷん, 7 ななふん, 8 はっぷん, 9 きゅうふん, 10 じゅっぷん (じっぷん también). 15 = じゅうごふん, 30 = さんじゅっぷん / はん.',
  ask='なんぷん')
# days
DAYS={1:'ついたち',2:'ふつか',3:'みっか',4:'よっか',5:'いつか',6:'むいか',7:'なのか',8:'ようか',9:'ここのか',10:'とおか',14:'じゅうよっか',20:'はつか',24:'にじゅうよっか'}
dd=[]
for d in range(1,32):
    if d in DAYS: r=DAYS[d]; irr=True
    else:
        t,o=divmod(d,10)
        pre={1:'じゅう',2:'にじゅう',3:'さんじゅう'}[t]
        ones={1:'いち',2:'に',3:'さん',5:'ご',6:'ろく',7:'しち',8:'はち',9:'く',0:''}[o]
        r=pre+ones+'にち'; irr=False
    dd.append(dict(value=d,reading=r,irregular=irr))
out['days']=dict(items=dd,ask=dict(reading='なんにち',es='¿qué día del mes?'),note='1–10 y 14, 20, 24 son irregulares (ついたち … とおか, じゅうよっか, はつか, にじゅうよっか). Del resto: número + にち; 17 y 27 = しちにち, 19 y 29 = くにち.')
MON={1:'いちがつ',2:'にがつ',3:'さんがつ',4:'しがつ',5:'ごがつ',6:'ろくがつ',7:'しちがつ',8:'はちがつ',9:'くがつ',10:'じゅうがつ',11:'じゅういちがつ',12:'じゅうにがつ'}
out['months']=dict(items=[dict(value=k,reading=v,kanji=KANJI_DIGIT(k).replace('〇','')and None,irregular=k in(4,7,9)) for k,v in MON.items()],ask=dict(reading='なんがつ',es='¿qué mes?'),note='Irregulares: しがつ (4), しちがつ (7), くがつ (9).')
for it in out['months']['items']: it.pop('kanji')
WK=[('にちようび','日曜日','domingo','sol'),('げつようび','月曜日','lunes','luna'),('かようび','火曜日','martes','fuego'),('すいようび','水曜日','miércoles','agua'),('もくようび','木曜日','jueves','madera'),('きんようび','金曜日','viernes','oro/metal'),('どようび','土曜日','sábado','tierra')]
out['weekdays']=dict(items=[dict(index=i,reading=r,kanji=k,es=es,element=el) for i,(r,k,es,el) in enumerate(WK)],ask=dict(reading='なんようび',es='¿qué día de la semana?'),note='index 0 = domingo (como en la hoja del profesor). La palabra ようび se puede omitir en la escritura abreviada: 日, 月, 火…')
out['years']=dict(suffix=dict(reading='ねん',kanji='年'),ask=dict(reading='なんねん'),
  irregular=[dict(value=4,reading='よねん'),dict(value=7,reading='しちねん',alt=['ななねん']),dict(value=9,reading='くねん',alt=['きゅうねん'])],
  examples=[dict(value=1998,reading='せんきゅうひゃくきゅうじゅうはちねん'),dict(value=2006,reading='にせんろくねん'),dict(value=2026,reading='にせんにじゅうろくねん')],
  note='Año = número completo + ねん. La hoja del profesor lee 1998 como せん きゅうひゃく きゅうじゅう はち ねん.')
# counters
TSU=['ひとつ','ふたつ','みっつ','よっつ','いつつ','むっつ','ななつ','やっつ','ここのつ','とお']
NIN={1:'ひとり',2:'ふたり',3:'さんにん',4:'よにん',5:'ごにん',6:'ろくにん',7:'ななにん',8:'はちにん',9:'きゅうにん',10:'じゅうにん'}
KAI={1:'いっかい',2:'にかい',3:'さんがい',4:'よんかい',5:'ごかい',6:'ろっかい',7:'ななかい',8:'はっかい',9:'きゅうかい',10:'じゅっかい'}
SAI={1:'いっさい',2:'にさい',3:'さんさい',4:'よんさい',5:'ごさい',6:'ろくさい',7:'ななさい',8:'はっさい',9:'きゅうさい',10:'じゅっさい'}
alts={'nin':{7:['しちにん'],4:['よんにん'] if False else []},'kai':{8:['はちかい'],10:['じっかい'],7:['しちかい'],6:[]},'sai':{10:['じっさい'],7:['しちさい'],8:['はちさい']}}
def items(d,al):
    r=[]
    for k,v in d.items():
        i=dict(value=k,reading=v)
        if al.get(k): i['alt']=al[k]
        r.append(i)
    return r
out['counters']=dict(
 tsu=dict(kanji='つ',use='objetos en general (hasta 10; desde 11 se usan los números normales)',items=[dict(value=i+1,reading=r) for i,r in enumerate(TSU)],ask='いくつ',note='No existe forma en つ para 11 o más: じゅういち, じゅうに… (sin contador).'),
 nin=dict(kanji='人',use='personas',items=items(NIN,alts['nin']),ask='なんにん',note='1 = ひとり y 2 = ふたり son irregulares; 4 = よにん (NO よんにん). Desde 3 se usa el número + にん.'),
 kai=dict(kanji='階',use='pisos de un edificio',items=items(KAI,alts['kai']),ask='なんがい',note='3 = さんがい (kai→gai), 6 = ろっかい, 8 = はっかい (también はちかい), 10 = じゅっかい (también じっかい). Sótano: ちか いっかい (B1).'),
 sai=dict(kanji='歳',use='edad',items=items(SAI,alts['sai']),ask='なんさい',special=[dict(value=20,reading='はたち',note='20 años se dice はたち (también にじゅっさい)')],note='1 = いっさい, 8 = はっさい, 10 = じゅっさい (también じっさい). Más de 10: decenas + unidad + さい (じゅういっさい, じゅうにさい, にじゅういっさい…). 20 = はたち.'))
# samples (test vectors)
samples=[9,23,416,7890,72341,618905,100,300,600,800,1000,3000,8000,10000,15000,100000,260,280,1400,1500,2800,25000,450,2500,8000]
out['samples']=[dict(value=n,reading=read(n)) for n in sorted(set(samples))]
# prices spot
dump('numbers.json',out)
for n in [9,23,416,7890,72341,618905]: print(n,read(n))
print([m['reading'] for m in mins[:25]])
print([d['reading'] for d in dd])
