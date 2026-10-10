#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Re-checks app/src/content/kanji.json (and the kanji spellings in vocab.json) against authoritative data.

  python3 tools/content/verify_kanji.py          # exit code 1 on any ERROR

Checks
  1. Per-lesson kanji lists == Genki I table of contents (gen/genki_kanji.py, transcribed from the PDF).
  2. Every on-yomi is in KANJIDIC (LightKanji/assets/dictionaries/kanji_jlpt_only.json; Kanjium kanjidict for
     kanji outside that file) or is a documented Genki-only reading (GENKI_ONLY).
  3. Every kun-yomi has the right stem(okurigana) split according to KANJIDIC.
  4. `teach` (Genki's readings) is a subset of on+kun and equals Genki's printed readings.
  5. Stroke counts match KANJIDIC / Kanjium.
  6. Every vocab word with `kanji` has a (spelling, reading) pair in JMdict (jmdict_kanji_index.json), the Kanjium
     edict/jukugo tables, or is a compound whose parts are all verified (rendaku, counters, dates handled by
     MANUAL_OK, which was checked against Genki's own tables / dictionaries).
  7. Example words of each kanji contain that kanji.
"""
import json, os, re, sqlite3, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'gen'))
from genki_kanji import GENKI_LISTS, TEACH, GENKI_ONLY
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
DICT = os.path.join(ROOT, 'LightKanji', 'assets', 'dictionaries')
CONTENT = os.path.join(ROOT, 'app', 'src', 'content')
load = lambda p: json.load(open(p, encoding='utf-8'))
kanji = load(os.path.join(CONTENT, 'kanji.json'))
vocab = load(os.path.join(CONTENT, 'vocab.json'))
KD = load(os.path.join(DICT, 'kanji_jlpt_only.json'))
JM = load(os.path.join(DICT, 'jmdict_kanji_index.json'))
DB = sqlite3.connect(os.path.join(DICT, 'kanjidb.sqlite'))
K = lambda c: ord(c) >= 0x4E00 and ord(c) <= 0x9FFF
def k2h(s): return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)

errors, warns = [], []
E = errors.append; W = warns.append

def dict_readings(c):
    """(on set in hiragana, set of (stem, okurigana)) from KANJIDIC, else Kanjium."""
    if c in KD:
        e = KD[c]
        on = {k2h(x) for x in e['on_readings']}
        kun = set()
        for x in e['kun_readings']:
            x = x.replace('-', '')
            stem, _, ok = x.partition('.')
            kun.add((stem, ok))
        return on, kun
    row = DB.execute('select onyomi,kunyomi from kanjidict where kanji=?', (c,)).fetchone()
    if not row: return None
    on = {k2h(re.sub(r'[（(].*?[）)]', '', x)) for x in re.split('[、,]', row[0]) if x}
    kun = set()
    for x in re.split('[、,]', row[1]):
        m = re.fullmatch(r'([^（(]+)(?:[（(]([^）)]*)[）)])?', x.strip())
        if m: kun.add((m.group(1), m.group(2) or ''))
    return on, kun

def dict_strokes(c):
    if c in KD: return KD[c]['stroke_count']
    r = DB.execute('select strokes from kanjidict where kanji=?', (c,)).fetchone()
    return r[0] if r else None

# 1 ---------------------------------------------------------------- lesson lists
by_lesson = {}
for k in kanji: by_lesson.setdefault(k['genkiLesson'], []).append(k['char'])
for n, s in GENKI_LISTS.items():
    if ''.join(by_lesson.get(n, [])) != s:
        E(f'lesson {n}: kanji list differs from Genki TOC: {"".join(by_lesson.get(n, []))} != {s}')
print(f'[1] lesson lists vs Genki TOC: {sum(len(s) for s in GENKI_LISTS.values())} kanji in {len(GENKI_LISTS)} lessons')

# 2-5 -------------------------------------------------------------- readings, teach, strokes
n_on = n_kun = 0
for k in kanji:
    c = k['char']
    d = dict_readings(c)
    if d is None: E(f'{c}: not found in KANJIDIC/Kanjium'); continue
    on, kun = d
    for r in k['on']:
        n_on += 1
        if r not in on and (c, r) not in GENKI_ONLY: E(f'{c}: on-yomi {r} not in KANJIDIC {sorted(on)}')
    for r in k['kun']:
        n_kun += 1
        m = re.fullmatch(r'([^()]+)(?:\(([^()]*)\))?', r)
        pair = (m.group(1), m.group(2) or '')
        if pair not in kun and (c, r) not in GENKI_ONLY: E(f'{c}: kun-yomi {r} not in KANJIDIC {sorted(kun)}')
    t_on, t_kun = TEACH[c]
    if k.get('teach') != t_on + t_kun: E(f'{c}: teach {k.get("teach")} != Genki {t_on + t_kun}')
    for r in k.get('teach', []):
        if r not in k['on'] + k['kun']: E(f'{c}: teach {r} missing from on/kun')
    if not k.get('teach') and k['on'] + k['kun']: E(f'{c}: no teach')
    s = dict_strokes(c)
    if s is None or k.get('strokes') != s: E(f'{c}: strokes {k.get("strokes")} != {s}')
    if c in KD:
        for g in KD[c]['on_readings']: pass
print(f'[2-5] {len(kanji)} kanji: {n_on} on-yomi, {n_kun} kun-yomi, teach and strokes checked')

# 6 ---------------------------------------------------------------- words
# Compounds whose reading involves rendaku / gemination / counters / dates, checked by hand against Genki's
# kanji tables (pp. 304-358) and the dictionaries (jukugo rows), plus words made only of verified parts.
MANUAL_OK = {
    '二時半': 'にじはん', '何時': 'なんじ', '一人で': 'ひとりで', '大好き': 'だいすき', '何年': 'なんねん',
    '何日': 'なんにち', '何曜日': 'なんようび', '何人': 'なんにん', '別々': 'べつべつ', '時々': 'ときどき',
    '二日': 'ふつか', '三日': 'みっか', '五日': 'いつか', '九日': 'ここのか', '十日': 'とおか', '十四日': 'じゅうよっか',
    '二十日': 'はつか', '二十四日': 'にじゅうよっか', '一年生': 'いちねんせい', '百円': 'ひゃくえん',
    '一万': 'いちまん', '一万円': 'いちまんえん', '山田': 'やまだ', '田中': 'たなか', '京子': 'きょうこ',
    '子牛': 'こうし', '町中': 'まちなか', '何時間': 'なんじかん', '色々': 'いろいろ',
}
def known_pair(spelling, reading):
    for ch in spelling:
        if not K(ch): continue
        e = JM.get(ch)
        if e and any(r['word'] == spelling and r['kana'] == reading for r in e['readings'] + e['examples']): return True
        for t, col in (('edict', "kanji||okurigana"), ('jukugo', 'jukugo')):
            if DB.execute(f'select 1 from {t} where {col}=? and k2h(reading)=? limit 1', (spelling, reading)).fetchone(): return True
    return False
DB.create_function('k2h', 1, k2h)
def verified(spelling, reading, depth=0):
    if not any(K(ch) for ch in spelling): return k2h(spelling) == reading
    if known_pair(spelling, reading): return True
    if MANUAL_OK.get(spelling) == reading: return True
    if depth > 3: return False
    # split into two parts at every position (kana particles/okurigana pass through literally)
    for i in range(1, len(spelling)):
        a, b = spelling[:i], spelling[i:]
        if all(not K(ch) for ch in a):
            if reading.startswith(k2h(a)) and verified(b, reading[len(a):], depth + 1): return True
            continue
        for j in range(1, len(reading)):
            if verified(a, reading[:j], depth + 1) and verified(b, reading[j:], depth + 1): return True
    return False
ids = {w['id']: w for w in vocab}
bad = 0; n = 0
for w in vocab:
    if 'kanji' not in w: continue
    n += 1
    sp, rd = w['kanji'], w['kana']
    # dictionary form check for inflected entries (ます-forms etc. are stored in their own form in vocab)
    if not verified(sp, rd):
        # try stripping する / で / の-particle suffixes already handled by the splitter; flag the rest
        bad += 1; E(f'word {w["id"]}: {sp} / {rd} not verifiable in JMdict/Kanjium')
print(f'[6] {n} kanji words: {n - bad} verified against JMdict/Kanjium (+{len(MANUAL_OK)} manual entries), {bad} unverified')

# 7 ---------------------------------------------------------------- example words
for k in kanji:
    for wid in k['words']:
        w = ids.get(wid)
        if not w: E(f'{k["char"]}: unknown word {wid}')
        elif k['char'] not in w.get('kanji', ''): E(f'{k["char"]}: example {wid} lacks the kanji')
    if len(k['words']) < 2: W(f'{k["char"]}: only {len(k["words"])} example word(s)')
print(f'[7] example words checked ({sum(len(k["words"]) for k in kanji)} entries)')

for m in warns: print('WARN ', m)
for m in errors: print('ERROR', m)
print(f'{len(errors)} errors, {len(warns)} warnings')
sys.exit(1 if errors else 0)
