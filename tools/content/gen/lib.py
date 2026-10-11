# -*- coding: utf-8 -*-
import re, json, os
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'app', 'src', 'content')
HIRA_BASE = {
'あ':'a','い':'i','う':'u','え':'e','お':'o',
'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
'や':'ya','ゆ':'yu','よ':'yo',
'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
'わ':'wa','を':'wo','ん':'n',
'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
'だ':'da','ぢ':'di','づ':'du','で':'de','ど':'do',
'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
'ゔ':'vu',
}
def h2k(s):
    return ''.join(chr(ord(c)+0x60) if 'ぁ'<=c<='ゖ' else c for c in s)
def k2h(s):
    return ''.join(chr(ord(c)-0x60) if 'ァ'<=c<='ヶ' else c for c in s)
YOON = {'きゃ':'kya','きゅ':'kyu','きょ':'kyo','しゃ':'sha','しゅ':'shu','しょ':'sho','ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
'にゃ':'nya','にゅ':'nyu','にょ':'nyo','ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo','みゃ':'mya','みゅ':'myu','みょ':'myo',
'りゃ':'rya','りゅ':'ryu','りょ':'ryo','ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo','じゃ':'ja','じゅ':'ju','じょ':'jo',
'ぢゃ':'dya','ぢゅ':'dyu','ぢょ':'dyo','びゃ':'bya','びゅ':'byu','びょ':'byo','ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo'}
EXT_IME = {'うぃ':'wi','うぇ':'we','うぉ':'who','ゔぁ':'va','ゔぃ':'vi','ゔぇ':'ve','ゔぉ':'vo','じぇ':'je','しぇ':'she','ちぇ':'che',
'つぁ':'tsa','つぃ':'tsi','つぇ':'tse','つぉ':'tso','てぃ':'thi','とぅ':'twu','でぃ':'dhi','どぅ':'dwu','でゅ':'dhu',
'ふぁ':'fa','ふぃ':'fi','ふぇ':'fe','ふぉ':'fo','ふゅ':'fyu','いぇ':'ye'}
EXT = dict(EXT_IME); EXT.update({'うぉ':'wo','てぃ':'ti','とぅ':'tu','でぃ':'di','どぅ':'du','でゅ':'dyu'})
MODE={'ime':False}
PART = {'は':'wa','を':'o','へ':'e'}
def to_romaji(text, particles=False):
    """kana (hira or kata) -> IME-style hepburn romaji. particles=True: standalone は/を/へ tokens -> wa/o/e"""
    out=[]; toks=re.split(r'(\s+)', text)
    for tok in toks:
        if tok.strip()=='' : out.append(tok); continue
        if particles:
            m=re.fullmatch(r'(.*?)([?？!！。.…]*)',tok)
            core,tail=m.group(1),m.group(2)
            if core in PART: out.append(PART[core]+_word(tail) if tail else PART[core]); continue
            # Vては / Vでは (te-wa-ikemasen): the は is the topic particle -> wa
            if re.fullmatch(r'.+[てで]は',core): out.append(_word(core[:-1])+'wa'+(_word(tail) if tail else '')); continue
        out.append(_word(tok))
    r=''.join(out)
    if particles: r=re.sub(r'\s+,',',',r); r=re.sub(r',(?=\S)',', ',r)
    return r
PUNCT={'。':'.','、':',','？':'?','！':'!','〜':'~','・':' ','「':'"','」':'"'}
def _word(w):
    s=k2h(w.replace('ー','ー')); # keep ー
    # preserve katakana long mark
    res=[]; i=0; geminate=False
    def add(r):
        nonlocal geminate
        if geminate:
            if r.startswith('ch'): r='t'+r
            else: r=r[0]+r
            geminate=False
        res.append(r)
    while i<len(s):
        c=s[i]
        if c in PUNCT: res.append(PUNCT[c]); i+=1; continue
        if c in 'ー':
            # repeat last vowel
            last=''.join(res)
            m=re.search(r'([aiueo])[^aiueo]*$',last)
            res.append(m.group(1) if m else ''); i+=1; continue
        if c=='っ':
            geminate=True; i+=1; continue
        two=s[i:i+2]
        if two in YOON: add(YOON[two]); i+=2; continue
        E=EXT_IME if MODE['ime'] else EXT
        if two in E: add(E[two]); i+=2; continue
        if c=='ん':
            nxt=s[i+1:i+2]
            nr = _word_first(s[i+1:])
            r='n'
            if nr and (nr[0] in 'aiueoy'): r="n'"
            res.append(r); i+=1; continue
        if c in HIRA_BASE: add(HIRA_BASE[c]); i+=1; continue
        if c in 'ぁぃぅぇぉゃゅょ': raise ValueError('stray small kana in '+w)
        res.append(c); i+=1  # latin/digits
    return ''.join(res)
def _word_first(rest):
    if not rest: return ''
    c=rest[0]
    if c=='っ': return ''
    two=rest[:2]
    if two in YOON: return YOON[two]
    if two in EXT: return EXT[two]
    if c in HIRA_BASE: return HIRA_BASE[c]
    return ''
def slug(r):
    r=r.replace("'",'')
    r=re.sub(r'[^a-z0-9]+','-',r.lower()).strip('-')
    return r
def dump(name, data):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT,name),'w',encoding='utf-8') as f:
        json.dump(data,f,ensure_ascii=False,indent=1)
        f.write('\n')
