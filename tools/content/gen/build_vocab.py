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
if __name__=='__main__':
    files=['vocab1.txt','vocab2.txt']+(['vocab3.txt','vocab4.txt'] if os.path.exists('vocab3.txt') else [])
    words,dropped=load(files)
    ids={}
    for w in words:
        if w['id'] in ids: print('DUP',w['id'],w['kana'],ids[w['id']]['kana'])
        ids[w['id']]=w
    from origins_data import ORIGINS
    unknown=[k for k in ORIGINS if k not in ids]
    if unknown: raise SystemExit('origins for unknown word ids: %s'%unknown)
    for w in words:
        if w['id'] in ORIGINS: w['origin']=ORIGINS[w['id']]
    print(len(words),'words; kanji dropped:',len(dropped),'; origins:',sum(1 for w in words if 'origin' in w))
    dump('vocab.json',words)
    json.dump(dropped,open('dropped_kanji.json','w'),ensure_ascii=False)
