import { useCallback, useRef, useState } from 'react';
import { itemKey, type ItemKind } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { emptyStats, type GameStats } from '../types';

interface SessionOptions {
  rounds?: number;
  onFinish?: (stats: GameStats) => void;
}

/**
 * Round counter, stats and streak of one game session. `report` records the first-attempt result
 * of a round (store + stats); `next` moves on or finishes the session.
 */
export function useGameSession({ rounds, onFinish }: SessionOptions) {
  const [round, setRound] = useState(0);
  const [stats, setStats] = useState<GameStats>(emptyStats);
  const [streak, setStreak] = useState(0);
  const statsRef = useRef(stats);
  const streakRef = useRef(0);
  const finishedRef = useRef(false);

  const report = useCallback((itemId: string, kind: ItemKind, label: string, correct: boolean) => {
    useProgress.getState().recordAnswer(itemId, kind, correct);
    const prev = statsRef.current;
    const key = itemKey(kind, itemId);
    const tally = prev.items[key] ?? { label, correct: 0, wrong: 0 };
    streakRef.current = correct ? streakRef.current + 1 : 0;
    const next: GameStats = {
      total: prev.total + 1,
      correct: prev.correct + (correct ? 1 : 0),
      bestStreak: Math.max(prev.bestStreak, streakRef.current),
      items: { ...prev.items, [key]: { label, correct: tally.correct + (correct ? 1 : 0), wrong: tally.wrong + (correct ? 0 : 1) } },
    };
    statsRef.current = next;
    setStats(next);
    setStreak(streakRef.current);
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish?.(statsRef.current);
  }, [onFinish]);

  const next = useCallback(() => {
    if (rounds !== undefined && statsRef.current.total >= rounds) finish();
    else setRound((r) => r + 1);
  }, [rounds, finish]);

  return { round, stats, streak, report, next, finish, rounds };
}

export type GameSession = ReturnType<typeof useGameSession>;
