import { useEffect, useState, type ReactNode } from 'react';
import { JaText } from '../../components/JaText';
import { SpeakButton } from '../../components/SpeakButton';
import { content } from '../../domain/contentLoader';
import type { KanaEntry, Word } from '../../domain/schema';
import { useSpeech } from '../../hooks/useSpeech';
import { kanaChoices } from '../kanaUtils';
import { ChoiceRound, Feedback, GameFrame, useGameSession, useQuestionPicker, type ChoiceOption, type FeedbackMessage } from '../shared';
import styles from '../shared/games.module.css';
import type { GameProps } from '../types';
import { wordChoices } from '../wordUtils';

type Question =
  | { type: 'kana'; id: string; entry: KanaEntry; choices: KanaEntry[] }
  | { type: 'word'; id: string; word: Word; choices: Word[] };

/** Plays a kana or word with TTS; the learner picks what they heard among 4 options. */
export function Listen({ kana, words, rounds, sequential, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const { available, speak } = useSpeech();
  const kanaPool = kana.map((entry) => ({ id: entry.char, entry }));
  const wordPool = words.map((word) => ({ id: word.id, word }));
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
    return { type: 'kana', id: entry.char, entry, choices: kanaChoices(entry, 4, content.kana) };
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
        onReport={(ok) => {
          setLast(null);
          session.report(question.id, isWord ? 'word' : 'kana', spoken, ok);
        }}
        onDone={(firstTry) => {
          setLast(firstTry ? { tone: 'ok', text: `¡Correcto! ${spoken} (${romaji})`, id: session.round } : null);
          session.next();
          setQuestion(make(session.round + 1));
        }}
      />
    </GameFrame>
  );
}
