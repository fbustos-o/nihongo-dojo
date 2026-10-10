import { content } from '../domain/contentLoader';
import type { ItemKind, ItemState } from '../state/progressSchema';
import { entriesFromIds } from '../games/conjugation/conjugationLogic';
import { MAX_REVIEW, batchProps, classifyItem, dialogueIdOf, dueCountsByGroup, groupOfItem, patternIdOf, planReview, srsDistribution } from './reviewLogic';

const item = (kind: ItemKind, itemId: string, over: Partial<ItemState> = {}): ItemState => ({
  itemId, kind, srsStage: 1, correct: 0, wrong: 0, lastSeen: 1000, nextDue: 2000, weight: 1, ...over,
});
const NOW = 10_000;

describe('classifyItem (id conventions)', () => {
  it.each([
    ['kana', 'あ', 'kana'],
    ['kanji', '食', 'kanji'],
    ['word', 'taberu:kanji', 'kanji'],
    ['word', 'taberu', 'word'],
    ['word', 'verb:taberu:te', 'conjugation'],
    ['word', 'iadj:oishii:past', 'conjugation'],
    ['word', 'naadj:genki:present', 'conjugation'],
    ['word', 'noun:gakusei:negative', 'conjugation'],
    ['word', 'number:416', 'number'],
    ['word', 'counter:nin:3', 'number'],
    ['word', 'time:7:30', 'clock'],
    ['word', 'date:3:14', 'calendar'],
    ['word', 'date:wd:2:next', 'calendar'],
    ['pattern', 'svo-masu:2', 'syntax'],
    ['pattern', 'particle:svo-masu:2', 'particle'],
    ['dialogue', 'dialogue:como-llegar:3', 'dialogue'],
  ] as const)('%s %s -> %s', (kind, id, expected) => {
    expect(classifyItem({ kind, itemId: id })).toBe(expected);
  });
  it('groups for the dashboard', () => {
    expect(groupOfItem({ kind: 'word', itemId: 'number:5' })).toBe('words');
    expect(groupOfItem({ kind: 'word', itemId: 'taberu:kanji' })).toBe('kanji');
    expect(groupOfItem({ kind: 'dialogue', itemId: 'dialogue:x:1' })).toBe('patterns');
    expect(groupOfItem({ kind: 'pattern', itemId: 'particle:x:1' })).toBe('patterns');
  });
  it('every real vocabulary id is a plain word', () => {
    for (const w of content.vocab) expect(classifyItem({ kind: 'word', itemId: w.id })).toBe('word');
  });
  it('parses pattern and dialogue ids', () => {
    expect(patternIdOf('svo-masu:2')).toBe('svo-masu');
    expect(patternIdOf('particle:svo-masu:2')).toBe('svo-masu');
    expect(dialogueIdOf('dialogue:como-llegar:3')).toBe('como-llegar');
  });
});

describe('planReview', () => {
  const items = [
    item('kana', 'あ', { nextDue: 100 }),
    item('kana', 'い', { nextDue: 300 }),
    item('word', 'taberu', { nextDue: 200 }),
    item('word', 'number:5', { nextDue: 400 }),
    item('pattern', 'x:0', { nextDue: 500 }),
    item('kanji', '食', { nextDue: NOW + 1 }), // not due
    item('kana', 'う', { srsStage: 9, nextDue: 1 }), // burned
  ];
  it('groups the due items by target game, most overdue first', () => {
    const plan = planReview(items, NOW);
    expect(plan.total).toBe(5);
    expect(plan.batches.map((b) => b.game)).toEqual(['kana-recognize', 'read-words', 'numbers', 'syntax']);
    expect(plan.batches[0]!.itemIds).toEqual(['あ', 'い']);
  });
  it('can be limited to a dashboard group', () => {
    expect(planReview(items, NOW, { group: 'kana' }).total).toBe(2);
    expect(planReview(items, NOW, { group: 'kanji' }).total).toBe(0);
  });
  it('caps the session at 50 keeping the most overdue', () => {
    const many = Array.from({ length: 80 }, (_, i) => item('kana', `k${i}`, { nextDue: 100 + i }));
    const plan = planReview(many, NOW);
    expect(MAX_REVIEW).toBe(50);
    expect(plan.total).toBe(50);
    expect(plan.batches[0]!.itemIds.at(-1)).toBe('k49');
  });
  it('counts due items per group', () => {
    expect(dueCountsByGroup(items, NOW)).toEqual({ kana: 2, words: 2, patterns: 1, kanji: 0, total: 5 });
  });
});

describe('srsDistribution', () => {
  it('counts the five groups; stage 0 counts as Aprendiz', () => {
    const list = [0, 1, 4, 5, 6, 7, 8, 9, 9].map((srsStage, i) => item('kana', `k${i}`, { srsStage }));
    expect(srsDistribution(list)).toEqual({ Aprendiz: 3, Guru: 2, Maestro: 1, Iluminado: 1, Quemado: 2 });
  });
});

describe('batchProps', () => {
  const data = content;
  it('kana and words', () => {
    expect(batchProps({ game: 'kana-recognize', itemIds: ['あ', 'zz'] }, data)).toMatchObject({ rounds: 1, kana: [{ char: 'あ' }] });
    expect(batchProps({ game: 'read-words', itemIds: ['taberu', 'nope'] }, data)!.words.map((w) => w.id)).toEqual(['taberu']);
    expect(batchProps({ game: 'read-words', itemIds: ['nope'] }, data)).toBeNull();
  });
  it('patterns: syntax and particles get the patterns and the exact item ids', () => {
    const p = content.patterns.find((x) => (x.examples?.length ?? 0) > 1)!;
    const props = batchProps({ game: 'particles', itemIds: [`particle:${p.id}:1`] }, data)!;
    expect(props.patterns!.map((x) => x.id)).toEqual([p.id]);
    expect(props.onlyItems).toEqual([`particle:${p.id}:1`]);
  });
  it('conjugation, dialogues and random games', () => {
    expect(batchProps({ game: 'conjugation', itemIds: ['verb:taberu:te'] }, data)).toMatchObject({ onlyItems: ['verb:taberu:te'], rounds: 1 });
    const d = content.dialogues[0]!;
    expect(batchProps({ game: 'dialogues', itemIds: [`dialogue:${d.id}:1`, `dialogue:${d.id}:3`] }, data)).toMatchObject({ dialogueIds: [d.id], rounds: 2 });
    expect(batchProps({ game: 'clock', itemIds: ['time:1:0', 'time:2:0', 'time:3:0'] }, data)!.rounds).toBe(3);
  });
});

describe('entriesFromIds', () => {
  it('rebuilds conjugation questions and skips unknown words or forms', () => {
    const entries = entriesFromIds(['verb:taberu:te', 'verb:nope:te', 'verb:taberu:zzz', 'iadj:oishii:past'], content.vocab);
    expect(entries.map((e) => e.id)).toEqual(['verb:taberu:te', ...(content.vocab.some((w) => w.id === 'oishii') ? ['iadj:oishii:past'] : [])]);
    expect(entries[0]).toMatchObject({ category: 'verb', form: 'te' });
  });
});
