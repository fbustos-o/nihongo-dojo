import { levelFromXp, xpForLevel, xpToNextLevel } from './levels';

describe('levels', () => {
  it('has a gentle quadratic curve', () => {
    expect([1, 2, 3, 4].map(xpToNextLevel)).toEqual([100, 150, 200, 250]);
    expect([1, 2, 3, 4, 10].map(xpForLevel)).toEqual([0, 100, 250, 450, 2700]);
  });
  it('maps XP to a level with progress inside it', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpInto: 0, xpNeeded: 100, progress: 0 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({ level: 2, xpInto: 0, xpNeeded: 150 });
    expect(levelFromXp(175)).toMatchObject({ level: 2, xpInto: 75, progress: 0.5 });
    expect(levelFromXp(2700).level).toBe(10);
  });
  it('is monotonic, consistent with xpForLevel and robust to bad input', () => {
    let last = 1;
    for (let xp = 0; xp < 20000; xp += 37) {
      const { level } = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(last);
      expect(xpForLevel(level)).toBeLessThanOrEqual(xp);
      expect(xpForLevel(level + 1)).toBeGreaterThan(xp);
      last = level;
    }
    expect(levelFromXp(-5).level).toBe(1);
    expect(levelFromXp(NaN).level).toBe(1);
  });
});
