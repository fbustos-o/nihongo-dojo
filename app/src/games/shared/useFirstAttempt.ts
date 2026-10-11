import { useState } from 'react';
import { playSfx } from './sfx';

/**
 * "First try + disable the wrong ones" (QA-030): the first pick of a round is reported once (right or wrong), wrong
 * picks are disabled and the learner must find the right one before `onDone(firstTry)` fires.
 * `attempt` returns whether the pick was right; the caller shows its own message for a wrong one.
 */
export function useFirstAttempt(onReport: (correct: boolean) => void, onDone: (firstTry: boolean) => void) {
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const attempt = (key: string, correct: boolean): boolean => {
    if (correct) {
      if (wrongKeys.length === 0) {
        onReport(true);
        playSfx('ok');
      }
      onDone(wrongKeys.length === 0);
      return true;
    }
    if (wrongKeys.length === 0) onReport(false);
    playSfx('bad');
    setWrongKeys((keys) => [...keys, key]);
    return false;
  };
  return { wrongKeys, attempt };
}
