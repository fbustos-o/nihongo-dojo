import { useCallback, useState } from 'react';
import { candidateFromItem, createPicker } from '../../engine';
import { itemKey, type ItemKind } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';

/**
 * Picks the next question from a pool with the weighted picker (errors and low SRS stage come
 * back sooner, never the same item twice in a row). With `sequential`, walks the pool in order.
 */
export function useQuestionPicker(kind: ItemKind, sequential = false) {
  // The picker (and the sequential cursor) live in a closure created once, outside of render.
  const [state] = useState(() => ({ picker: createPicker(), next: (() => { let i = 0; return () => i++; })() }));
  return useCallback(
    <T extends { id: string }>(pool: readonly T[]): T => {
      if (sequential) return pool[state.next() % pool.length]!;
      const items = useProgress.getState().items;
      const candidates = pool.map((entry) => ({ ...candidateFromItem(entry.id, items[itemKey(kind, entry.id)]), entry }));
      return state.picker.next(candidates).entry;
    },
    [kind, sequential, state],
  );
}
