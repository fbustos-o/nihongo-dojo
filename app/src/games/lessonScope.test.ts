import { content } from '../domain/contentLoader';
import { eligibleDialogues } from './dialogues/dialoguesLogic';
import { ancestorLessons, gameHasMaterial, scopedDialogues, scopedPatterns } from './lessonScope';

const lesson = (id: string) => content.curriculum.find((l) => l.id === id)!;
const own = (id: string) => content.patterns.filter((p) => lesson(id).patterns?.includes(p.id));

describe('QA-015: lessons without material of their own only use what their ancestors teach', () => {
  it('ancestorLessons follows requires transitively', () => {
    const ids = ancestorLessons('l-vacaciones', content.curriculum).map((l) => l.id);
    expect(ids).not.toContain('l-vacaciones');
    for (const l of ancestorLessons('l-vacaciones', content.curriculum)) expect(l.id).not.toBe('l-vacaciones');
    expect(ids.length).toBeGreaterThan(0);
  });

  it('every lesson: scoped patterns are its own, else a subset of its ancestors (never the whole corpus)', () => {
    for (const l of content.curriculum) {
      const scoped = scopedPatterns(own(l.id), l.id, content.curriculum, content.patterns);
      if ((l.patterns ?? []).length > 0) {
        expect(scoped.map((p) => p.id)).toEqual(own(l.id).map((p) => p.id));
        continue;
      }
      const allowed = new Set(ancestorLessons(l.id, content.curriculum).flatMap((a) => a.patterns ?? []));
      for (const p of scoped) expect(allowed.has(p.id)).toBe(true);
      if (allowed.size < content.patterns.length) expect(scoped.length).toBeLessThan(content.patterns.length);
    }
  });

  it('free practice (no lesson) keeps using the given patterns or the corpus', () => {
    expect(scopedPatterns(undefined, undefined, content.curriculum, content.patterns)).toHaveLength(content.patterns.length);
    expect(scopedPatterns(content.patterns.slice(0, 2), undefined, content.curriculum, content.patterns)).toHaveLength(2);
  });

  it('a lesson with no patterns and no ancestors with patterns gets none', () => {
    const curriculum = [{ id: 'a', requires: [], patterns: [], dialogues: [] }, { id: 'b', requires: ['a'], patterns: [], dialogues: [] }];
    expect(scopedPatterns(undefined, 'b', curriculum, content.patterns)).toEqual([]);
    expect(scopedDialogues(content.dialogues, 'b', undefined, curriculum)).toEqual([]);
  });

  it('dialogues: a lesson without its own ones plays the ancestors\', not all', () => {
    for (const l of content.curriculum.filter((x) => (x.dialogues ?? []).length === 0)) {
      const got = eligibleDialogues(content.dialogues, content.curriculum, [], undefined, l.id);
      const allowed = new Set(ancestorLessons(l.id, content.curriculum).flatMap((a) => a.dialogues ?? []));
      expect(got.every((d) => allowed.has(d.id))).toBe(true);
    }
    // the own dialogues of a lesson always win
    const withOwn = content.curriculum.find((l) => (l.dialogues ?? []).length > 0)!;
    expect(eligibleDialogues(content.dialogues, content.curriculum, [], withOwn.dialogues, withOwn.id).map((d) => d.id).sort()).toEqual([...withOwn.dialogues!].sort());
  });

  it('gameHasMaterial: the games that would have nothing to play are skipped', () => {
    const curriculum = [
      { id: 'a', requires: [], patterns: [], dialogues: [] },
      { id: 'b', requires: ['a'], patterns: [], dialogues: [] },
    ];
    const data = { curriculum, patterns: content.patterns, dialogues: content.dialogues };
    for (const game of ['syntax', 'mini-reading', 'dialogues'] as const) expect(gameHasMaterial(game, curriculum[1]!, data)).toBe(false);
    expect(gameHasMaterial('read-words', curriculum[1]!, data)).toBe(true);
  });

  it('every playable game of every lesson has material or is skipped (no empty game is left in a lesson)', () => {
    const data = { curriculum: content.curriculum, patterns: content.patterns, dialogues: content.dialogues };
    for (const l of content.curriculum) {
      for (const game of l.games.filter((g) => gameHasMaterial(g, l, data))) {
        if (game === 'syntax' || game === 'mini-reading') expect(scopedPatterns(own(l.id), l.id, content.curriculum, content.patterns).length).toBeGreaterThan(0);
        if (game === 'dialogues') expect(scopedDialogues(content.dialogues, l.id, l.dialogues, content.curriculum).length).toBeGreaterThan(0);
      }
    }
  });
});
