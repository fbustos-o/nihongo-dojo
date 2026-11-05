# -*- coding: utf-8 -*-
"""Checks vocab_en.txt against vocab.json: every id exists, no duplicates, no empty `en`,
every word with a Spanish note has a noteEn, and every word of vocab.json is covered."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
VOCAB = os.path.join(HERE, '..', '..', '..', 'app', 'src', 'content', 'vocab.json')
words = {w['id']: w for w in json.load(open(VOCAB, encoding='utf-8'))}
seen = {}; errs = []
for n, line in enumerate(open(os.path.join(HERE, 'vocab_en.txt'), encoding='utf-8'), 1):
    line = line.rstrip('\n')
    if not line.strip() or line.startswith('#'): continue
    parts = [p.strip() for p in line.split(' | ')]
    id_ = parts[0]
    if len(parts) < 2 or len(parts) > 3: errs.append(f'{n}: bad field count'); continue
    if id_ not in words: errs.append(f'{n}: unknown id {id_}')
    if id_ in seen: errs.append(f'{n}: duplicate id {id_} (first at {seen[id_]})')
    seen[id_] = n
    if not [g for g in parts[1].split(';') if g.strip()]: errs.append(f'{n}: empty en for {id_}')
    if id_ in words and words[id_].get('note') and not (len(parts) == 3 and parts[2]):
        errs.append(f'{n}: {id_} has a Spanish note but no noteEn')
    if '-v' in sys.argv and id_ in words and len(parts[1].split(';')) != len(words[id_]['es']):
        print(f'  note: {id_} gloss count differs (es {len(words[id_]["es"])}, en {len(parts[1].split(";"))})')
for id_ in words:
    if id_ not in seen: errs.append(f'missing id {id_}')
print(f'{len(seen)} entries, {len(words)} words, {len(errs)} errors')
for e in errs: print(' ', e)
sys.exit(1 if errs else 0)
