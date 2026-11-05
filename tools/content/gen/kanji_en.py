# -*- coding: utf-8 -*-
# English meanings (1-3 per kanji) taken from KANJIDIC (LightKanji kanjidb.sqlite, table kanjidict),
# chosen to match the senses of the Spanish `es` in kanji_data.py. build_kanji.py checks that every kanji has an entry
# and that each meaning is attested in KANJIDIC (warning otherwise: the few hand-written glosses are listed in HAND).
RAW = """
一|one
二|two
三|three
四|four
五|five
六|six
七|seven
八|eight
九|nine
十|ten
百|hundred
千|thousand
万|ten thousand
円|yen;circle
時|time;hour
日|day;sun
本|book;origin
人|person
月|month;moon
火|fire
水|water
木|tree;wood
金|gold;money;metal
土|soil;earth;ground
曜|day of the week
上|above;up
下|below;down
中|inside;middle;center
半|half;middle
山|mountain
川|river;stream
元|origin;beginning
気|spirit;mind;air
天|heavens;sky
私|I;me;private
今|now;present
田|rice field
女|woman;female
男|man;male
見|see;look at
行|go;going
食|eat;food;meal
飲|drink
東|east
西|west
南|south
北|north
口|mouth
出|go out;leave;put out
右|right
左|left
分|minute of time;part;understand
先|before;ahead;previous
生|life;be born;student
大|big;large
学|study;learning
外|outside
国|country
京|capital
子|child
小|small;little
会|meet;meeting
社|company;shrine
父|father
母|mother
高|tall;high;expensive
校|school
毎|every
語|language;word
文|sentence;writing;letter
帰|return;returning home
入|enter;put in
員|member;employee
新|new
聞|hear;ask;listen
作|make;prepare
仕|serve;do;attend
事|matter;thing;business
電|electricity
車|car;vehicle
休|rest;day off
言|say;speech
読|read
思|think
次|next
何|what;how many
午|noon
後|after;behind;later
前|before;in front
名|name
白|white
雨|rain
書|write;book
友|friend
間|interval;between;space
家|house;home;family
話|talk;speak;tale
少|few;little
古|old
知|know
来|come
住|live;reside;dwell
正|correct;right
年|year
売|sell
買|buy
町|town;village
長|long;chief
道|road;way;street
雪|snow
立|stand up;stand;establish
自|oneself;self
夜|night;evening
朝|morning
持|hold;have
手|hand
紙|paper
好|like;fond
近|near;recent
明|bright;clear;light
病|ill;sick;illness
院|institution;temple
映|reflect;project;reflection
画|picture;brush-stroke
歌|song;sing
市|city;market;town
所|place
勉|strive;make effort;diligent
強|strong
有|have;possess;exist
旅|trip;travel
昔|long ago;once upon a time;old times
神|gods;mind;soul
早|early;fast;quick
起|get up;wake up;rouse
牛|cow;cattle
使|use;messenger
働|work
連|take along;connect;link
別|separate;another;extra
度|time;occurrence;degrees
赤|red
青|blue;green
色|color
"""
EN = {}
for _l in RAW.strip().splitlines():
    _c, _m = _l.split('|')
    EN[_c] = _m.split(';')
