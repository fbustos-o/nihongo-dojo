/**
 * Player level from XP, with a gentle (quadratic) curve: reaching level L+1 from L costs
 * `100 + 50 * (L - 1)` XP, so level 2 needs 100 XP, level 3 250, level 4 450, level 10 2700...
 * Pure functions, no state.
 */

export const BASE_LEVEL_XP = 100;
export const LEVEL_XP_STEP = 50;
export const MAX_LEVEL = 200;

/** XP needed to go from `level` to `level + 1`. */
export const xpToNextLevel = (level: number): number => BASE_LEVEL_XP + LEVEL_XP_STEP * (Math.max(1, Math.floor(level)) - 1);

/** Total XP at which `level` starts (level 1 starts at 0). */
export function xpForLevel(level: number): number {
  const steps = Math.max(1, Math.floor(level)) - 1;
  return BASE_LEVEL_XP * steps + (LEVEL_XP_STEP * steps * (steps - 1)) / 2;
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level. */
  xpInto: number;
  /** XP the current level needs to be completed. */
  xpNeeded: number;
  /** 0..1 */
  progress: number;
}

export function levelFromXp(xp: number): LevelInfo {
  const total = Math.max(0, Number.isFinite(xp) ? Math.floor(xp) : 0);
  let level = 1;
  while (level < MAX_LEVEL && total >= xpForLevel(level + 1)) level++;
  const xpInto = total - xpForLevel(level);
  const xpNeeded = xpToNextLevel(level);
  return { level, xpInto, xpNeeded, progress: Math.min(1, xpInto / xpNeeded) };
}
