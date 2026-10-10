# -*- coding: utf-8 -*-
from lib import *
ROWS_G=[('a','あいうえお'),('ka','かきくけこ'),('sa','さしすせそ'),('ta','たちつてと'),('na','なにぬねの'),('ha','はひふへほ'),('ma','まみむめも'),('ya','やゆよ'),('ra','らりるれろ'),('wa','わを'),('n','ん')]
ROWS_D=[('ga','がぎぐげご'),('za','ざじずぜぞ'),('da','だぢづでど'),('ba','ばびぶべぼ')]
ROWS_P=[('pa','ぱぴぷぺぽ')]
YO=[('kya','きゃきゅきょ'),('gya','ぎゃぎゅぎょ'),('sha','しゃしゅしょ'),('ja','じゃじゅじょ'),('cha','ちゃちゅちょ'),('nya','にゃにゅにょ'),('hya','ひゃひゅひょ'),('bya','びゃびゅびょ'),('pya','ぴゃぴゅぴょ'),('mya','みゃみゅみょ'),('rya','りゃりゅりょ')]
EXTL=['ウィ','ウェ','ウォ','ヴァ','ヴィ','ヴェ','ヴォ','ジェ','シェ','チェ','ツァ','ツィ','ツェ','ツォ','ティ','トゥ','ディ','ドゥ','デュ','ファ','フィ','フェ','フォ','フュ','イェ']
import re
def split(s):
    out=[];i=0
    while i<len(s):
        if i+1<len(s) and s[i+1] in 'ゃゅょぁぃぅぇぉャュョァィゥェォ': out.append(s[i:i+2]); i+=2
        else: out.append(s[i]); i+=1
    return out
DISP={'を':'o','ぢ':'ji','づ':'zu','ヂ':'ji','ヅ':'zu','ヲ':'o'}
ALT={'を':['wo'],'ぢ':['di'],'づ':['du'],'ヂ':['di'],'ヅ':['du'],'ヲ':['wo'],
 'ウォ':['who'],'ティ':['thi'],'トゥ':['twu'],'ディ':['dhi'],'ドゥ':['dwu'],'デュ':['dhu']}
kana=[]
def add(ch,script,row,group,romaji=None,alt=None):
    r=romaji or to_romaji(ch)
    if ch in DISP: r=DISP[ch]
    e={'char':ch,'romaji':r,'script':script,'row':row,'group':group}
    a=ALT.get(ch)
    if a: e['alt']=a
    kana.append(e)
for script,conv in (('hiragana',lambda x:x),('katakana',h2k)):
    for rows,grp in ((ROWS_G,'gojuon'),(ROWS_D,'dakuten'),(ROWS_P,'handakuten'),(YO,'yoon')):
        for row,chars in rows:
            for ch in split(chars):
                add(conv(ch),script,row,grp)
    if script=='hiragana':
        add('っ','hiragana','special','extended',romaji='xtsu',alt=['ltsu'])  # small tsu: IME input; doubles next consonant
    else:
        for ch in EXTL: add(ch,'katakana','ext','extended')
        add('ヴ','katakana','ext','extended',romaji='vu')
        add('ッ','katakana','special','extended',romaji='xtsu',alt=['ltsu'])
        add('ー','katakana','special','extended',romaji='-')
# ids
for k in kana: pass
dump('kana.json',kana)
print(len(kana))
