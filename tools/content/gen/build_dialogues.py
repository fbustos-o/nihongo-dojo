# -*- coding: utf-8 -*-
from lib import *
from dialogues_data import D
import re
out=[]
for id,title,lesson,lines in D:
    out.append(dict(id=id,title=title,lesson=lesson,lines=[dict(speaker=s,ja=ja,romaji=to_romaji(ja,particles=True),es=es) for s,ja,es in lines]))
dump('dialogues.json',out); print(len(out),sum(len(d['lines']) for d in out))
