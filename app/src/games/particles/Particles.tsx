import { useMemo, useState } from 'react';
import { JaText } from '../../components/JaText';
import { SpeakButton } from '../../components/SpeakButton';
import { content } from '../../domain/contentLoader';
import { checkAnswer } from '../../engine';
import { useProgress } from '../../state/progressStore';
import { ChoiceRound, GameFrame, useGameSession, useQuestionPicker } from '../shared';
import shared from '../shared/games.module.css';
import type { GameProps } from '../types';
import { PARTICLE_EXPLANATIONS, makeBlank, particleEntries, particleOptions, type Blank, type ParticleEntry } from './particleLogic';

interface Question {
  entry: ParticleEntry;
  blank: Blank;
  options: string[];
}

/**
 * A sentence with one particle missing; choose it among は / を / に / で / へ / も / の / と / が / か.
 * Answers are compared strictly (は is not わ, を is not お). After answering, a one-line explanation.
 */
export function Particles({ patterns, rounds, sequential, onFinish }: GameProps) {
  const session = useGameSession({ rounds, onFinish });
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  const pool = useMemo(() => particleEntries(patterns?.length ? patterns : content.patterns), [patterns]);
  const pick = useQuestionPicker('pattern', sequential);

  const make = (): Question => {
    const entry = pick(pool);
    const blank = makeBlank(entry.example.ja)!;
    return { entry, blank, options: particleOptions(blank.answer) };
  };

  const [question, setQuestion] = useState<Question | null>(() => (pool.length ? make() : null));
  const [answered, setAnswered] = useState(false);
  if (!question) return <p className="muted">No hay frases con partículas para esta lección todavía.</p>;

  const { entry, blank, options } = question;
  const sentence = (filled: boolean) =>
    blank.tokens.map((token, i) => (
      <span key={i}>
        {i > 0 && ' '}
        {i === blank.at ? (
          filled ? <strong data-testid="filled"><JaText word={{ kana: token }} /></strong> : <span role="img" aria-label="hueco">＿＿</span>
        ) : (
          <JaText word={{ kana: token }} />
        )}
      </span>
    ));

  const next = () => {
    session.next();
    setQuestion(make());
    setAnswered(false);
  };

  return (
    <GameFrame session={session}>
      {answered ? (
        <div className={shared.round}>
          <p className={shared.promptText} data-testid="prompt">{sentence(true)}。</p>
          <p className="muted">{entry.example.es}</p>
          {showRomaji && <p className={shared.hint}>{entry.example.romaji}</p>}
          <p role="status" data-testid="explanation">
            {PARTICLE_EXPLANATIONS[blank.answer] ?? ''}
          </p>
          <div className={shared.form}>
            <SpeakButton text={entry.example.ja.replace(/\s+/gu, '')} label="Escuchar la frase" />
            <button type="button" className="btn btn-primary" autoFocus onClick={next}>
              Siguiente
            </button>
          </div>
        </div>
      ) : (
        <ChoiceRound
          key={session.round}
          prompt={
            <>
              <span className={shared.promptText}>{sentence(false)}。</span>
              <div className={shared.hint}>{entry.example.es}</div>
            </>
          }
          options={options.map((p) => ({
            key: p,
            content: <JaText word={{ kana: p }} />,
            correct: checkAnswer(p, blank.answer, { strict: true }).correct,
          }))}
          onReport={(ok) => session.report(entry.id, 'pattern', `${blank.answer} · ${entry.example.ja.replace(/\s+/gu, '')}`, ok)}
          onDone={() => setAnswered(true)}
        />
      )}
    </GameFrame>
  );
}
