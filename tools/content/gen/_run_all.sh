#!/bin/sh
cd "$(dirname "$0")"
python3 build_kana.py && python3 build_numbers.py && python3 build_vocab.py && python3 build_patterns.py && python3 build_dialogues.py && python3 build_curriculum.py > /dev/null && python3 build_curriculum.py | tail -n 80 | head -n 30
