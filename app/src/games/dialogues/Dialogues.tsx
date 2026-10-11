import { useEffect, useRef, useState, type ReactNode } from 'react';
import { JaText } from '../../components/JaText';
import { SpeakButton } from '../../components/SpeakButton';
import { content } from '../../domain/contentLoader';
import type { Dialogue } from '../../domain/schema';
import { useProgress } from '../../state/progressStore';
import { shuffle } from '../kanaUtils';
import { ModeChips, useAutoSpeak } from '../numbers/ReadingRound';
import { Feedback, GameFrame, useFirstAttempt, useGameSession, type FeedbackMessage } from '../shared';
import type { GameProps } from '../types';
import styles from './dialogues.module.css';
import { DIALOGUE_ITEM_KIND, cappedRounds, dialogueItemId, eligibleDialogues, hasRoleLine, listenTargets, nextRoleLine, replyOptions, type Line, type ReplyOption, type Speaker } from './dialoguesLogic';

function LineText({ line, showEs }: { line: Line; showEs: boolean }) {
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  return (
    <>
      <p className={styles.ja}>
        <JaText word={{ kana: line.ja }} />
      </p>
      {showRomaji && (
        <p lang="en" className={styles.sub}>
          {line.romaji}
        </p>
      )}
      {showEs && <p className={styles.sub}>{line.es}</p>}
    </>
  );
}

function Chat({ lines, showEs, role }: { lines: readonly Line[]; showEs: boolean; role: Speaker }) {
  // The history is a short scroll area that always shows the latest bubbles (QA-041).
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <ol ref={ref} className={styles.chat} aria-label="Conversación" tabIndex={0}>
      {lines.map((line, i) => (
        <li key={i} className={`${styles.bubble} ${line.speaker === role ? styles.right : styles.left}`}>
          <p className={styles.who}>{line.speaker === role ? `${line.speaker} (tú)` : line.speaker}</p>
          <LineText line={line} showEs={showEs} />
          <SpeakButton text={line.ja.replace(/\s+/g, '')} label="Oír" />
        </li>
      ))}
    </ol>
  );
}

interface ReplyChoiceProps {
  prompt: ReactNode;
  options: ReplyOption[];
  showEs: boolean;
  onReport: (correct: boolean) => void;
  onDone: (firstTry: boolean) => void;
}

/** Pick the right reply among 3-4 lines; a wrong pick is reported once and disabled. */
export function ReplyChoice({ prompt, options, showEs, onReport, onDone }: ReplyChoiceProps) {
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const counter = useRef(0);
  const { wrongKeys, attempt } = useFirstAttempt(onReport, onDone);

  const pick = (option: ReplyOption, index: number) => {
    if (attempt(String(index), option.correct)) return;
    setMessage({ tone: 'bad', text: 'Incorrecto. Elige la respuesta que encaja con la conversación.', id: ++counter.current });
  };

  return (
    <div className={styles.reply}>
      <div data-testid="prompt">{prompt}</div>
      {message && <Feedback message={message} />}
      <div className={styles.options} role="group" aria-label="Respuestas posibles">
        {options.map((option, i) => (
          <button key={option.line.ja + i} type="button" className={styles.option} disabled={wrongKeys.includes(String(i))} onClick={() => pick(option, i)}>
            <JaText word={{ kana: option.line.ja }} />
            {showRomaji && <small lang="en" className={styles.sub}> {option.line.romaji}</small>}
            {showEs && <small className={styles.sub}> {option.line.es}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "Escucha y responde": hear a line (TTS) and pick the reply. */
export function ListenReply({ dialogue, heard, showEs, onReport, onDone }: { dialogue: Dialogue; heard: number; showEs: boolean; onReport: (ok: boolean) => void; onDone: (firstTry: boolean) => void }) {
  const line = dialogue.lines[heard]!;
  const [options] = useState(() => replyOptions(dialogue, heard + 1, content.dialogues, Math.random));
  const available = useAutoSpeak(line.ja.replace(/\s+/g, ''), heard);
  return (
    <ReplyChoice
      showEs={showEs}
      options={options}
      onReport={onReport}
      onDone={onDone}
      prompt={
        <>
          <p>Escucha y elige la respuesta.</p>
          <SpeakButton text={line.ja.replace(/\s+/g, '')} label="Escuchar otra vez" />
          {!available && (
            <div className={styles.bubble}>
              <p className="muted">Sin voz en japonés: lee la frase.</p>
              <LineText line={line} showEs={showEs} />
            </div>
          )}
        </>
      }
    />
  );
}

type Stage = 'talk' | 'listen';
interface Pos {
  d: number;
  /** Index of the learner's line awaiting an answer (lines.length = dialogue finished). */
  cur: number;
  stage: Stage;
  /** Index of the line played in the listening round. */
  heard?: number;
}

export function Dialogues({ words, rounds, dialogueIds, lessonId, onFinish }: GameProps) {
  const [role, setRole] = useState<Speaker>('B');
  const [showEs, setShowEs] = useState(false);
  const [last, setLast] = useState<FeedbackMessage | null>(null);
  const [queue] = useState(() => {
    const list = eligibleDialogues(content.dialogues, content.curriculum, words, dialogueIds, lessonId);
    return rounds === undefined ? shuffle(list) : list;
  });
  const playable = queue.filter((d) => hasRoleLine(d, role));
  // Thin pools would repeat the same turns: never ask for more than ~1.5 rounds per available learner turn (QA-027).
  const session = useGameSession({ rounds: cappedRounds(rounds, playable, role), onFinish });
  const [pos, setPos] = useState<Pos>(() => ({ d: 0, cur: nextRoleLine(playable[0]?.lines ?? [], 0, role), stage: 'talk' }));

  const startDialogue = (d: number, r: Speaker = role): Pos => {
    const list = queue.filter((x) => hasRoleLine(x, r));
    const idx = list.length === 0 ? 0 : d % list.length;
    return { d: idx, cur: nextRoleLine(list[idx]?.lines ?? [], 0, r), stage: 'talk' };
  };

  if (playable.length === 0) return <p className="muted">No hay diálogos para practicar.</p>;
  const dialogue = playable[pos.d % playable.length]!;
  const finished = pos.cur >= dialogue.lines.length;
  const targets = listenTargets(dialogue, role);

  const afterRound = (ok: boolean, ack: string) => {
    setLast(ok ? { tone: 'ok', text: `¡Correcto! ${ack}`, id: session.round } : null);
    session.next();
  };

  const toolbar = (
    <div className={styles.toolbar}>
      {rounds === undefined && (
        <ModeChips
          label="Tu papel"
          value={role}
          onChange={(r) => {
            setRole(r);
            setPos(startDialogue(0, r));
          }}
          options={[
            { value: 'A', label: 'Hablo como A' },
            { value: 'B', label: 'Hablo como B' },
          ]}
        />
      )}
      <label>
        <input type="checkbox" checked={showEs} onChange={(e) => setShowEs(e.target.checked)} /> Mostrar traducción
      </label>
    </div>
  );

  let body: ReactNode;
  if (pos.stage === 'listen' && pos.heard !== undefined) {
    const heard = pos.heard;
    body = (
      <ListenReply
        key={`${session.round}-${dialogue.id}`}
        dialogue={dialogue}
        heard={heard}
        showEs={showEs}
        onReport={(ok) => {
          setLast(null);
          session.report(dialogueItemId(dialogue, heard + 1), DIALOGUE_ITEM_KIND, dialogue.lines[heard + 1]!.ja, ok);
        }}
        onDone={(firstTry) => {
          afterRound(firstTry, dialogue.lines[heard + 1]!.es);
          setPos(startDialogue(pos.d + 1));
        }}
      />
    );
  } else if (finished) {
    body = (
      <div>
        <p role="status">Fin del diálogo.</p>
        <button
          type="button"
          className="btn btn-primary"
          autoFocus
          onClick={() => setPos(targets.length > 0 ? { ...pos, stage: 'listen', heard: targets[Math.floor(Math.random() * targets.length)] } : startDialogue(pos.d + 1))}
        >
          {targets.length > 0 ? 'Escucha y responde' : 'Siguiente diálogo'}
        </button>
      </div>
    );
  } else {
    body = (
      <TurnHolder
        key={`${session.round}-${dialogue.id}-${pos.cur}`}
        dialogue={dialogue}
        index={pos.cur}
        pool={queue}
        showEs={showEs}
        onReport={(ok) => {
          setLast(null);
          session.report(dialogueItemId(dialogue, pos.cur), DIALOGUE_ITEM_KIND, dialogue.lines[pos.cur]!.ja, ok);
        }}
        onDone={(firstTry) => {
          afterRound(firstTry, dialogue.lines[pos.cur]!.es);
          setPos({ ...pos, cur: nextRoleLine(dialogue.lines, pos.cur + 1, role) });
        }}
      />
    );
  }

  const visible = pos.stage === 'listen' ? [] : dialogue.lines.slice(0, finished ? dialogue.lines.length : pos.cur);
  return (
    <GameFrame session={session}>
      {toolbar}
      <h2 className={styles.title}>{dialogue.title}</h2>
      <Feedback message={last} />
      {visible.length > 0 && <Chat lines={visible} showEs={showEs} role={role} />}
      {body}
    </GameFrame>
  );
}

/** Holds the (random) options of one turn so re-renders do not reshuffle them. */
function TurnHolder({ dialogue, index, pool, ...rest }: Omit<ReplyChoiceProps, 'prompt' | 'options'> & { dialogue: Dialogue; index: number; pool: readonly Dialogue[] }) {
  const [fixed] = useState(() => replyOptions(dialogue, index, content.dialogues, Math.random, 4, pool));
  return <ReplyChoice {...rest} options={fixed} prompt={<p>Tu turno: ¿qué respondes?</p>} />;
}
