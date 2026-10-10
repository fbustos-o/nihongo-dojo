import { create } from 'zustand';

export type CelebrationKind = 'level' | 'streak' | 'lesson';

export interface Celebration {
  id: number;
  kind: CelebrationKind;
  title: string;
  detail?: string;
}

interface CelebrationStore {
  queue: Celebration[];
  push: (c: Omit<Celebration, 'id'>) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;

/** Transient (not persisted) queue of small celebrations shown as toasts. */
export const useCelebrations = create<CelebrationStore>()((set) => ({
  queue: [],
  push: (c) => set((s) => ({ queue: [...s.queue, { ...c, id: nextId++ }].slice(-5) })),
  dismiss: (id) => set((s) => ({ queue: s.queue.filter((c) => c.id !== id) })),
  clear: () => set({ queue: [] }),
}));
