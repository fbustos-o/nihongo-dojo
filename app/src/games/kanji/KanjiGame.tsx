import { useState, type ReactNode } from 'react';
import { JaText } from '../../components/JaText';
import { content } from '../../domain/contentLoader';
import type { Kanji, Word } from '../../domain/schema';
import { checkAnswer } from '../../engine';
import { useProgress } from '../../state/progressStore';
import { ChoiceRound, Feedback, GameFrame, TypingHint, TypingRound, useGameSession, useQuestionPicker, type FeedbackMessage } from '../shared';
import styles from '../shared/games.module.css';
import type { GameProps } from '../types';
import local from './kanji.module.css';
import {
  kanjiOptions,
  kanjiToCredit,
  kanjiWordsFor,
  meaningOptions,
  meaningText,
  readingLabel,
  roundTypeFor,
  sentenceOptions,
  transformSentences,
  type RoundType,
  type TransformSentence,
} from './kanjiLogic';

type Round =
  | { type: 'meaning'; kanji: Kanji; options: { text: string; correct: boolean }[] }
  | { type: 'pick'; kanji: Kanji; options: Kanji[] }
  | { type: 'reading'; word: Word }
  | { type: 'transform'; sentence: TransformSentence; options: { text: string; correct: boolean }[] };

const wordItemId = (word: Word): string => `${word.id}:kanji`;

/**
 * Kanji game. Four kinds of round:
 *  - meaning: a kanji -> pick its Spanish meaning;
 *  - pick: readings + meaning -> pick the kanji among look-alikes;
 *  - reading: a known word written in kanji -> type its reading (kana);
 *  - transform: a sentence from stage 2 whose words now appear in kanji (with furigana) -> pick its meaning.
 * Kanji answers are recorded as `kanji:<char>` (they drive the furigana fade-out at Guru); word answers as
 * `word:<id>:kanji`. With `sequential` (review queue) it walks through the due kanji and then the due words.
 */
export function KanjiGame({ kanji = [], words = [], rounds, sequential, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const unlocked = useProgress((s) => s.unlockedKanji);
  const [credited] = useState(() => new Set<string>());
  const pickKanji = useQuestionPicker('kanji', sequential);
  const pickWord = useQuestionPicker('word', sequential);

  const practice = new Set(kanji.map((k) => k.char));
  const allowed = new Set([...unlocked, ...practice]);
  // Kanji the learner knows: used for distractors.
  const known = content.kanji.filter((k) => allowed.has(k.char));
  const kanjiPool = kanji.map((k) => ({ id: k.char, kanji: k }));
  // In a review of due words there may be no kanji to practise: any allowed word is fine then.
  const typable = kanjiWordsFor(words, allowed, sequential ? new Set() : practice);
  const wordPool = typable.map((word) => ({ id: wordItemId(word), word }));
  const sentences = transformSentences(content.patterns, content.vocab, allowed, sequential && kanji.length === 0 ? new Set(typable.flatMap((w) => [...(w.kanji ?? '')])) : practice);
  const sentencesByWord = new Map<string, TransformSentence[]>();
  for (const s of sentences) sentencesByWord.set(s.target.id, [...(sentencesByWord.get(s.target.id) ?? []), s]);
  const sentenceWords = typable.filter((w) => sentencesByWord.has(w.id));

  const make = (round: number): Round | null => {
    const available: Record<RoundType, boolean> = {
      meaning: kanjiPool.length > 0,
      pick: kanjiPool.length > 0 && known.length >= 2,
      reading: wordPool.length > 0,
      transform: sentenceWords.length > 0,
    };
    let type: RoundType | null;
    let word: Word | undefined;
    let seqKanji: Kanji | undefined;
    if (sequential) {
      // review queue: one item per round, kanji first, then words
      const total = kanjiPool.length + wordPool.length;
      if (total === 0) return null;
      const index = round % total;
      if (index < kanjiPool.length) {
        seqKanji = kanjiPool[index]!.kanji;
        type = round % 2 === 0 || !available.pick ? 'meaning' : 'pick';
      } else {
        word = wordPool[index - kanjiPool.length]!.word;
        type = sentencesByWord.has(word.id) && round % 2 === 1 ? 'transform' : 'reading';
      }
    } else {
      type = roundTypeFor(round, available);
    }
    if (!type) return null;
    switch (type) {
      case 'meaning': {
        const k = seqKanji ?? pickKanji(kanjiPool).kanji;
        return { type, kanji: k, options: meaningOptions(k, known.length > 1 ? known : content.kanji) };
      }
      case 'pick': {
        const k = seqKanji ?? pickKanji(kanjiPool).kanji;
        return { type, kanji: k, options: kanjiOptions(k, known) };
      }
      case 'reading': {
        word ??= pickWord(wordPool).word;
        return { type, word };
      }
      case 'transform': {
        word ??= pickWord(sentenceWords.map((w) => ({ id: wordItemId(w), word: w }))).word;
        const options = sentencesByWord.get(word.id) ?? sentences;
        const sentence = options[Math.floor(Math.random() * options.length)]!;
        return { type, sentence, options: sentenceOptions(sentence, sentences) };
      }
    }
  };

  const [round, setRound] = useState<Round | null>(() => make(0));
  const [last, setLast] = useState<FeedbackMessage | null>(null);
  if (!round) return <p className="muted">No hay kanji para practicar todavía.</p>;

  const advance = (ok: boolean, text: string) => {
    setLast(ok ? { tone: 'ok', text, id: session.round } : null);
    session.next();
    setRound(make(session.round + 1));
  };
  const report = (id: string, kind: 'kanji' | 'word', label: string, word?: Word) => (ok: boolean) => {
    setLast(null);
    session.report(id, kind, label, ok);
    // Partial credit: a word answered right first time counts once per session as a correct review of each
    // unlocked kanji in it. A wrong answer never penalises the kanji.
    if (ok && word) {
      const { unlockedKanji, recordAnswer } = useProgress.getState();
      for (const char of kanjiToCredit(word, unlockedKanji, credited)) {
        credited.add(char);
        recordAnswer(char, 'kanji', true, { partial: true });
      }
    }
  };

  let body: ReactNode;
  switch (round.type) {
    case 'meaning': {
      const k = round.kanji;
      body = (
        <ChoiceRound
          key={session.round}
          prompt={
            <>
              <span lang="ja">{k.char}</span>
              <div className="muted">¿Qué significa?</div>
            </>
          }
          small
          options={round.options.map((o) => ({ key: o.text, content: o.text, correct: o.correct }))}
          onReport={report(k.char, 'kanji', k.char)}
          onDone={(firstTry) => advance(firstTry, `¡Correcto! ${k.char} = ${meaningText(k)} (${readingLabel(k)})`)}
        />
      );
      break;
    }
    case 'pick': {
      const k = round.kanji;
      body = (
        <ChoiceRound
          key={session.round}
          prompt={
            <>
              <div className={local.readings} data-testid="kanji-clue">
                {readingLabel(k)}
              </div>
              <div className={styles.promptText}>{meaningText(k)}</div>
              <div className="muted">¿Qué kanji es?</div>
            </>
          }
          options={round.options.map((o) => ({ key: o.char, content: <span className={local.kanjiChoice} lang="ja">{o.char}</span>, label: o.char, correct: o.char === k.char }))}
          onReport={report(k.char, 'kanji', k.char)}
          onDone={(firstTry) => advance(firstTry, `¡Correcto! ${k.char} = ${meaningText(k)}`)}
        />
      );
      break;
    }
    case 'reading': {
      const w = round.word;
      body = (
        <TypingRound
          key={session.round}
          prompt={
            <>
              <span className={styles.promptText} lang="ja" data-testid="kanji-word" data-word={w.id}>
                {w.kanji}
              </span>
              <div className={styles.hint}>{w.es[0]}</div>
              <div className={styles.hint}>Escribe cómo se lee (en kana)</div>
              <TypingHint text={w.kana} />
            </>
          }
          answer={
            <>
              <span lang="ja">{w.kanji}</span> ({w.kana})
            </>
          }
          evaluate={(input) => {
            const result = checkAnswer(input, w.kana);
            return result.correct ? 'correct' : result.nearMiss ? 'near' : 'wrong';
          }}
          inputMode="hiragana"
          ariaLabel="Lectura en kana"
          placeholder="かな"
          onReport={report(wordItemId(w), 'word', w.kanji ?? w.kana, w)}
          onDone={(firstTry) => advance(firstTry, `¡Correcto! ${w.kanji} = ${w.kana} (${w.es[0]})`)}
        />
      );
      break;
    }
    case 'transform': {
      const { sentence } = round;
      body = (
        <ChoiceRound
          key={session.round}
          prompt={
            <>
              <p className={local.note}>Ya conoces esta frase. Mira cómo se transforman sus palabras con kanji:</p>
              <div className={local.sentence} data-testid="transform-sentence" data-sentence={sentence.id}>
                {sentence.tokens.map((t, i) => (
                  <span key={i} className={t.word && t.word.id === sentence.target.id ? local.target : undefined}>
                    <JaText word={t.word ?? { kana: t.kana }} />
                  </span>
                ))}
              </div>
              <div className="muted">¿Qué significa la frase?</div>
            </>
          }
          small
          options={round.options.map((o) => ({ key: o.text, content: o.text, correct: o.correct }))}
          onReport={report(wordItemId(sentence.target), 'word', sentence.target.kanji ?? sentence.target.kana, sentence.target)}
          onDone={(firstTry) =>
            advance(firstTry, `¡Correcto! ${sentence.target.kana} ahora se escribe ${sentence.target.kanji}. ${sentence.es}`)
          }
        />
      );
      break;
    }
  }

  return (
    <GameFrame session={session}>
      {last && <Feedback message={last} />}
      {body}
    </GameFrame>
  );
}
