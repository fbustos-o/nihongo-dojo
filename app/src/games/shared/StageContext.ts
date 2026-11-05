import { createContext, useContext } from 'react';

export type StageNumber = 1 | 2 | 3 | 4 | 5;

/** Stage of the lesson being played; `GameFrame` uses it to tint its progress bar. Undefined in free practice / review. */
export const StageContext = createContext<StageNumber | undefined>(undefined);

export const useStage = (): StageNumber | undefined => useContext(StageContext);
