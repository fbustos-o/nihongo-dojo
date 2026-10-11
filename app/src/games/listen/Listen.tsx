import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { JaText } from '../../components/JaText';
import { SpeakButton } from '../../components/SpeakButton';
import { content } from '../../domain/contentLoader';
import type { KanaEntry, Word } from '../../domain/schema';
import { useSpeech } from '../../hooks/useSpeech';
import { useProgress } from '../../state/progressStore';
import { kanaChoices, knownKanaPool } from '../kanaUtils';
import { ChoiceRound, Feedback, GameFrame, useGameSession, useQuestionPicker, type ChoiceOption, type FeedbackMessage } from '../shared';
import styles from '../shared/games.module.css';
import type { GameProps } from '../types';
import { meaningOf, wordChoices } from '../wordUtils';

type Question =
  | { type: 'kana'; id: string; entry: KanaEntry; choices: KanaEntry[] }
  | { type: 'word'; id: string; word: Word; choices: Word[] };

/** Plays a kana or word with TTS; the learner picks what they heard among 4 options. */
export function Listen({ kana, newKana, words, rounds, sequential, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const { available, speak } = useSpeech();
  const kanaPool = kana.map((entry) => ({ id: entry.char, entry }));
  const wordPool = words.map((word) => ({ id: word.id, word }));
  // Distractors only from what the learner may know: unlocked kana plus the lesson's (and the ones being practised).
  const distractorPool = useMemo(
    () => knownKanaPool(useProgress.getState().knownKana, [...kana.map((k) => k.char), ...(newKana ?? [])]),
    [kana, newKana],
  );
  const pickKana = useQuestionPicker('kana', sequential);
  const pickWord = useQuestionPicker('word', sequential);
  const canWords = wordPool.length >= 2;

  const make = (round: number): Question | null => {
    const useWord = canWords && (kanaPool.length === 0 || round % 2 === 1);
    if (useWord) {
      const { word } = pickWord(wordPool);
      return { type: 'word', id: word.id, word, choices: wordChoices(word, words) };
    }
    if (kanaPool.length === 0) return null;
    const { entry } = pickKana(kanaPool);
    return { type: 'kana', id: entry.char, entry, choices: kanaChoices(entry, 4, distractorPool.length >= 4 ? distractorPool : content.kana.filter((k) => kana.some((l) => l.script === k.script && l.char === k.char))) };
  };

  const [question, setQuestion] = useState<Question | null>(() => make(0));
  const [last, setLast] = useState<FeedbackMessage | null>(null);
  const spoken = question ? (question.type === 'word' ? question.word.kana : question.entry.char) : '';

  useEffect(() => {
    if (available && spoken) speak(spoken);
  }, [available, speak, spoken, session.round]);

  if (!question) return <p className="muted">No hay contenido para practicar.</p>;

  const isWord = question.type === 'word';
  const options: ChoiceOption[] = isWord
    ? question.choices.map((w) => ({ key: w.id, content: <JaText word={w} />, correct: w.id === question.id }))
    : question.choices.map((k) => ({ key: k.char, content: k.char, correct: k.char === question.id }));
  const romaji = isWord ? question.word.romaji : question.entry.romaji;

  /** «Kana: mi» for a single kana; «おなか (onaka) = estómago» for a word (kana through JaText, first meaning). */
  const describe = (q: Question): { text: string; node: ReactNode } =>
    q.type === 'kana'
      ? { text: `Kana: ${q.entry.romaji}`, node: <>Kana: {q.entry.romaji}</> }
      : {
          text: `${q.word.romaji} = ${meaningOf(q.word)}`,
          node: (
            <>
              <JaText word={q.word} /> ({q.word.romaji}) = {meaningOf(q.word)}
            </>
          ),
        };

  const prompt: ReactNode = available ? (
    <SpeakButton text={spoken} label="Escuchar otra vez" />
  ) : (
    <span className={styles.promptText} data-testid="romaji">{romaji}</span>
  );

  return (
    <GameFrame session={session}>
      {!available && (
        <p className={styles.notice} role="note">
          Tu navegador no tiene una voz en japonés: sin audio, se muestra el romaji en su lugar y eliges el kana que corresponde.
        </p>
      )}
      <Feedback message={last} />
      <ChoiceRound
        key={session.round}
        prompt={prompt}
        options={options}
        small={isWord}
        wrongFeedback={(option) => {
          const said = describe(question);
          const picked = isWord ? question.choices.find((w) => w.id === option.key) : question.choices.find((k) => k.char === option.key);
          const pickedNode = picked && 'kana' in picked ? <JaText word={picked} /> : <span lang="ja">{option.key}</span>;
          return {
            text: `Sonó: ${said.text}`,
            node: (
              <>
                Sonó: {said.node} · elegiste {pickedNode}
              </>
            ),
          };
        }}
        onReport={(ok) => {
          setLast(null);
          session.report(question.id, isWord ? 'word' : 'kana', spoken, ok);
        }}
        onDone={(firstTry) => {
          const said = describe(question);
          setLast({ tone: firstTry ? 'ok' : 'near', text: said.text, node: said.node, id: session.round });
          session.next();
          setQuestion(make(session.round + 1));
        }}
      />
    </GameFrame>
  );
}
