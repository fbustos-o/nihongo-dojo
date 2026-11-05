# -*- coding: utf-8 -*-
from lib import *
from dialogues_data import D
from dialogues_en import EN
import re
out=[]
for id,title,lesson,lines in D:
    tEn,linesEn=EN[id]
    assert len(linesEn)==len(lines),(id,len(linesEn),len(lines))
    out.append(dict(id=id,title=title,titleEn=tEn,lesson=lesson,lines=[dict(speaker=s,ja=ja,romaji=to_romaji(ja,particles=True),es=es,en=en) for (s,ja,es),en in zip(lines,linesEn)]))
dump('dialogues.json',out); print(len(out),sum(len(d['lines']) for d in out))
