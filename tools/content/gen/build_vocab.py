# -*- coding: utf-8 -*-
import re,sys,json
from lib import *
from kanji_data import CHARS,KANJI
KL={k['char']:k['genkiLesson'] for k in KANJI}
POS={'n':'noun','vu':'verb','vru':'verb','virr':'verb','i':'i-adj','na':'na-adj','adv':'adverb','e':'expression','c':'counter','p':'particle','pr':'pronoun'}
GRP={'vu':'u','vru':'ru','virr':'irregular'}
def split_gloss(es):
    # split on ';' only outside parentheses so glosses like "madre (de otro; o ...)" stay whole
    out=[];d=0;cur=''
    for ch in es:
        if ch=='(': d+=1
        elif ch==')': d=max(0,d-1)
        if ch==';' and d==0: out.append(cur.strip()); cur=''
        else: cur+=ch
    out.append(cur.strip())
    return [x for x in out if x]
def load(files):
    words=[];sec=None;dropped=[]
    for fn in files:
        for ln in open(fn,encoding='utf-8'):
            ln=ln.rstrip('\n')
            if not ln.strip() or ln.startswith('#') and not ln.startswith('##'): continue
            if ln.startswith('##'):
                p=ln[2:].split(); sec=(p[0],p[1]); continue
            c=[x.strip() for x in ln.split('|')]
            c+=['']*(8-len(c))
            kana,kanji,es,pos,tags,wid,rom,src=c[:8]
            lesson,kind=sec
            tg=[t for t in tags.split(',') if t]
            prof=False
            if tg and tg[-1].endswith('+P'): tg[-1]=tg[-1][:-2]; prof=True
            elif tags.endswith('+P'): prof=True
            if lesson=='PART':
                m=[t for t in tg if re.fullmatch(r'[GP]\d+',t)][0]; tg.remove(m); lesson=m; kind='profesor' if m[0]=='P' else 'genki'
            if lesson=='KA':
                ls=[KL[ch] for ch in kanji if ch in KL]
                lesson='G%d'%max(ls) if ls else 'G12'
            source={'genki':'genki','profesor':'profesor','propio':'propio'}[kind]
            if src: source=src
            if prof: tg.append('profesor')
            if False and kanji and not all((ch in CHARS) or not ('一'<=ch<='鿿') for ch in kanji):
                dropped.append((kana,kanji)); kanji=''
            if kanji and not all((ch in CHARS) or not ('\u4e00'<=ch<='\u9fff') for ch in kanji):
                dropped.append((kana,kanji)); kanji=''
            note=''
            if ' @@ ' in es: es,note=[x.strip() for x in es.split(' @@ ',1)]
            r=rom or to_romaji(kana)
            w=dict(id=wid or slug(r),kana=kana)
            if kanji: w['kanji']=kanji
            w.update(romaji=r,es=split_gloss(es),pos=POS[pos])
            if note: w['note']=note
            if pos in GRP: w['verbGroup']=GRP[pos]
            w.update(lesson=lesson,tags=tg,source=source)
            words.append(w)
    return words,dropped

# ---------------------------------------------------------------- Kanjikana Core 1000 (CC BY 4.0)
import unicodedata
HERE=os.path.dirname(os.path.abspath(__file__))
CORE_FILE=os.path.join(HERE,'core1000','kanjikana-core-1000.json')
HK_RE=re.compile('[\u4e00-\u9fff々]')
def split_commas(s,seps=',;'):
    """split a gloss on commas/semicolons outside parentheses"""
    out=[];d=0;cur=''
    for ch in s:
        if ch in '(（': d+=1
        elif ch in ')）': d=max(0,d-1)
        if ch in seps and d==0: out.append(cur.strip()); cur=''
        else: cur+=ch
    out.append(cur.strip())
    return [x for x in out if x]
def lemmas(t):
    t=re.sub(r'\(.*?\)','',t)
    t=re.sub(r'[¿?¡!…]|\.\.\.','',t)
    return {x.strip().lower() for x in re.split(r'[,;/]',t) if x.strip()}
def ascii_slug(t):
    t=unicodedata.normalize('NFKD',t).encode('ascii','ignore').decode()
    return slug(t)
def table(fn):
    """rows of `a | b | c` (comments with #, blank lines ignored)"""
    p=os.path.join(HERE,fn)
    if not os.path.exists(p): return []
    rows=[]
    for ln in open(p,encoding='utf-8'):
        ln=ln.split('#',1)[0].strip() if not ln.lstrip().startswith('##') else ''
        if ln: rows.append([x.strip() for x in ln.split('|')])
    return rows
def load_matches():
    """core1000_matches.txt: `rank | existing-id` or `rank | NEW [| new-id]` (overrides the automatic rule)"""
    out={}
    for r in table('core1000_matches.txt'):
        out[int(r[0])]=(r[1],r[2] if len(r)>2 and r[2] else None)
    return out
def load_pos():
    """core1000_pos.txt: `rank | pos | verbGroup | tags [| es]` for every NEW Core word. The optional 5th column
    replaces the Core Spanish glosses (separated by ;) when they are wrong or too technical for a beginner."""
    out={}
    for r in table('core1000_pos.txt'):
        r+=['']*(5-len(r))
        out[int(r[0])]=(r[1],r[2],[t for t in r[3].split(',') if t],split_gloss(r[4]) if r[4] else None)
    return out
def load_en():
    """vocab_en.txt (from the English agent): `id | en (;) | noteEn`; takes priority over the Core English"""
    out={}
    for r in table('vocab_en.txt'):
        r+=['']*(3-len(r))
        if r[1]: out[r[0]]=(split_gloss(r[1]),r[2])
    return out
def merge_core(words):
    core=json.load(open(CORE_FILE,encoding='utf-8'))['words']
    matches=load_matches(); posf=load_pos(); enf=load_en()
    W={w['id']:w for w in words}
    taken={}   # existing id -> rank
    decisions={}; ambiguous=[]
    for c in core:
        r=c['rank']
        if r in matches:
            tgt,nid=matches[r]
            if tgt!='NEW' and tgt not in W: raise SystemExit('core1000_matches: unknown id %s (rank %d)'%(tgt,r))
            decisions[r]=(tgt,nid); continue
        has_kanji=bool(HK_RE.search(c['word']))
        cl=lemmas(c['meanings']['es'])
        good=[]
        for w in words:
            if w['kana']!=c['reading']: continue
            if has_kanji and w.get('kanji')==c['word']: good.append(w)
            elif not has_kanji: good.append(w)
            elif not w.get('kanji') and set().union(*[lemmas(g) for g in w['es']])&cl: good.append(w)
        if len(good)==1: decisions[r]=(good[0]['id'],None)
        elif not good: decisions[r]=('NEW',None)
        else: ambiguous.append((r,c['word'],[g['id'] for g in good]))
    if ambiguous: raise SystemExit('ambiguous Core matches, decide them in core1000_matches.txt:\n'+'\n'.join(map(str,ambiguous)))
    for r,(tgt,_) in decisions.items():
        if tgt!='NEW':
            if tgt in taken: raise SystemExit('existing word %s matched by Core ranks %d and %d; decide in core1000_matches.txt'%(tgt,taken[tgt],r))
            taken[tgt]=r
    extra=sorted(set(posf)-{r for r,(t,_) in decisions.items() if t=='NEW'})
    if extra: raise SystemExit('core1000_pos.txt has ranks that are not NEW: %s'%extra)
    ids=set(W); added=[]; stats=dict(matched=len(taken),new=0,written=0)
    for c in core:
        r=c['rank']; tgt,nid=decisions[r]; word=c['word']
        en=split_commas(c['meanings']['en'])
        if tgt!='NEW':
            w=W[tgt]; w['rank']=r
            if tgt in enf: en=enf[tgt][0]
            w['en']=en
            if tgt in enf and enf[tgt][1]: w['noteEn']=enf[tgt][1]
            if HK_RE.search(word) and not all(ch in CHARS or not HK_RE.match(ch) for ch in word) and word!=w.get('kanji'):
                w['written']=word; stats['written']+=1
            continue
        if r not in posf: raise SystemExit('rank %d (%s) is NEW but missing in core1000_pos.txt'%(r,word))
        pos,grp,tags,es_fix=posf[r]
        if pos not in set(POS.values()): raise SystemExit('rank %d: bad pos %s'%(r,pos))
        rom=to_romaji(c['reading'])
        es=es_fix or split_commas(c['meanings']['es'])[:5]
        if not nid:
            nid=slug(rom)
            if nid in ids or nid in enf and False:
                suf=ascii_slug(re.sub(r'\(.*?\)','',es[0]).strip()) if es else ''
                suf='-'.join(suf.split('-')[:2])
                nid=slug(rom)+('-'+suf if suf else '')
                if nid in ids: nid+='-%d'%r
        if nid in ids: raise SystemExit('duplicate id %s (rank %d)'%(nid,r))
        ids.add(nid)
        w=dict(id=nid,kana=c['reading'])
        if HK_RE.search(word):
            if all(ch in CHARS or not HK_RE.match(ch) for ch in word): w['kanji']=word
            else: w['written']=word; stats['written']+=1
        en=enf[nid][0] if nid in enf else en[:5]
        w.update(romaji=rom,es=es,en=en,pos=pos)
        if nid in enf and enf[nid][1]: w['noteEn']=enf[nid][1]
        if grp: w['verbGroup']=grp
        w.update(lesson='C%d'%((r+24)//25),tags=tags or ['core'],source='core1000',rank=r)
        added.append(w); stats['new']+=1
    # English for the words that are not in Core 1000 (Genki / teacher vocabulary): vocab_en.txt
    missing=0
    for w in words:
        if 'en' in w: continue
        if w['id'] in enf:
            w['en']=enf[w['id']][0]
            if enf[w['id']][1]: w['noteEn']=enf[w['id']][1]
        else: missing+=1
    stats['without_en']=missing
    return words+added,stats

if __name__=='__main__':
    files=['vocab1.txt','vocab2.txt']+(['vocab3.txt','vocab4.txt'] if os.path.exists('vocab3.txt') else [])
    words,dropped=load(files)
    ids={}
    for w in words:
        if w['id'] in ids: print('DUP',w['id'],w['kana'],ids[w['id']]['kana'])
        ids[w['id']]=w
    words,stats=merge_core(words)
    print('Core 1000:',stats)
    from origins_data import ORIGINS
    unknown=[k for k in ORIGINS if k not in ids]
    if unknown: raise SystemExit('origins for unknown word ids: %s'%unknown)
    for w in words:
        if w['id'] in ORIGINS: w['origin']=ORIGINS[w['id']]
    print(len(words),'words; kanji dropped:',len(dropped),'; origins:',sum(1 for w in words if 'origin' in w))
    dump('vocab.json',words)
    json.dump(dropped,open('dropped_kanji.json','w'),ensure_ascii=False)
