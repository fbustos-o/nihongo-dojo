import { describe, expect, it } from 'vitest';
import { content } from '../domain/contentLoader';
import { NEVER_DUE, STAGE_INTERVAL_MS } from '../engine/srs';
import type { ItemState } from '../state/progressSchema';
import {
  absoluteDate,
  accuracyPct,
  buildLookup,
  categoryCounts,
  formatInterval,
  groupFromSlug,
  itemLabel,
  memoryRows,
  relativeTime,
  sortAndFilter,
  srsGroupOfStage,
  stageHelpRows,
} from './memoryLogic';

const lookup = buildLookup(content);
const item = (kind: ItemState['kind'], itemId: string, extra: Partial<ItemState> = {}): ItemState => ({
  kind,
  itemId,
  srsStage: 1,
  correct: 0,
  wrong: 0,
  lastSeen: 1,
  nextDue: 0,
  weight: 1,
  ...extra,
});
const label = (kind: ItemState['kind'], id: string) => itemLabel({ kind, itemId: id }, lookup);

describe('groups', () => {
  it('maps slugs and stages', () => {
    expect(groupFromSlug('guru')).toBe('Guru');
    expect(groupFromSlug('nada')).toBeNull();
    expect(srsGroupOfStage(0)).toBe('Aprendiz');
    expect(srsGroupOfStage(6)).toBe('Guru');
    expect(srsGroupOfStage(9)).toBe('Quemado');
  });
});

describe('itemLabel', () => {
  const verb = content.vocab.find((w) => w.pos === 'verb' && w.kana === 'たべる')!;
  const pattern = content.patterns.find((p) => p.examples && p.examples.length > 0)!;
  const dialogue = content.dialogues[0]!;

  it('labels kana and kanji', () => {
    expect(label('kana', 'あ')).toMatchObject({ text: 'あ', ja: { kana: 'あ' } });
    expect(label('kanji', '食')).toMatchObject({ text: '食', textIsJa: true });
  });
  it('labels vocabulary and the kanji-game variant', () => {
    expect(verb).toBeDefined();
    const l = label('word', verb.id);
    expect(l.ja).toBe(verb);
    expect(l.detail).toContain(verb.es[0]);
    expect(label('word', `${verb.id}:kanji`).detail).toContain('kanji');
  });
  it('labels conjugations with the form', () => {
    const l = label('word', `verb:${verb.id}:masu`);
    expect(l.text).toBe('たべます');
    expect(l.detail).toContain('ます');
    expect(label('word', 'verb:noexiste:masu').text).toBe('verb:noexiste:masu');
  });
  it('labels numbers, counters, times and dates', () => {
    expect(label('word', 'number:416')).toMatchObject({ text: '416', reading: 'よんひゃくじゅうろく' });
    expect(label('word', 'counter:nin:3')).toMatchObject({ reading: 'さんにん' });
    expect(label('word', 'counter:nin:3').text).toContain('personas');
    expect(label('word', 'time:4:30')).toMatchObject({ text: '4:30', reading: 'よじはん' });
    expect(label('word', 'time:7:05').text).toBe('7:05');
    expect(label('word', 'date:3:14')).toMatchObject({ text: '14 de marzo' });
    expect(label('word', 'date:3:14').reading).toBeTruthy();
    expect(label('word', 'date:3:14:wd').detail).toContain('semana');
    expect(label('word', 'date:wd:2:next').text).toBe('Mañana de martes');
    expect(label('word', 'date:wd:2:prev').text).toBe('Ayer de martes');
  });
  it('labels pattern examples, particles and dialogues', () => {
    const ex = pattern.examples![0]!;
    const l = label('pattern', `${pattern.id}:0`);
    expect(l.text).toBe(ex.ja);
    expect(l.detail).toContain(ex.es);
    expect(label('pattern', `particle:${pattern.id}:0`).text).toBe(ex.ja);
    expect(label('pattern', `${pattern.id}:99`).text).toBe(pattern.title);
    const d = label('dialogue', `dialogue:${dialogue.id}:0`);
    expect(d.text).toBe(dialogue.lines[0]!.ja);
    expect(d.detail).toContain(dialogue.title);
  });
  it('falls back to the raw id', () => {
    expect(label('pattern', 'zzz:0').text).toBe('zzz:0');
    expect(label('word', 'time:99:99').text).toBe('time:99:99');
  });
});

describe('time and accuracy', () => {
  const now = new Date(2026, 0, 10, 12, 0).getTime();
  const H = 3_600_000;
  it('formats relative times in Spanish', () => {
    expect(relativeTime(now - 1, now)).toBe('vencido');
    expect(relativeTime(now + 10 * 60_000, now)).toBe('en 10 min');
    expect(relativeTime(now + 3 * H, now)).toBe('en 3 h');
    expect(relativeTime(now + 30 * H, now)).toBe('mañana');
    expect(relativeTime(now + 5 * 24 * H, now)).toBe('en 5 días');
    expect(relativeTime(now + 120 * 24 * H, now)).toBe('en 4 meses');
    expect(relativeTime(NEVER_DUE, now)).toBe('nunca');
    expect(relativeTime(now + H, now, true)).toBe('nunca');
  });
  it('formats the absolute date', () => {
    expect(absoluteDate(now)).toMatch(/2026/);
    expect(absoluteDate(NEVER_DUE)).toMatch(/No se vuelve/);
  });
  it('computes accuracy', () => {
    expect(accuracyPct({ correct: 3, wrong: 1 })).toBe(75);
    expect(accuracyPct({ correct: 0, wrong: 0 })).toBeNull();
  });
  it('formats intervals', () => {
    expect(formatInterval(4 * H)).toBe('4 horas');
    expect(formatInterval(24 * H)).toBe('1 día');
    expect(formatInterval(48 * H)).toBe('2 días');
    expect(formatInterval(7 * 24 * H)).toBe('1 semana');
    expect(formatInterval(14 * 24 * H)).toBe('2 semanas');
    expect(formatInterval(30 * 24 * H)).toBe('1 mes');
    expect(formatInterval(120 * 24 * H)).toBe('4 meses');
  });
  it('builds the help rows from STAGE_INTERVAL_MS', () => {
    const rows = stageHelpRows();
    expect(rows).toHaveLength(STAGE_INTERVAL_MS.length - 1);
    expect(rows[0]).toEqual({ stage: 1, name: 'Aprendiz 1', interval: '4 horas' });
    expect(rows.at(-1)).toEqual({ stage: 9, name: 'Quemado', interval: null });
  });
});

describe('rows, sorting and filtering', () => {
  const items = {
    a: item('kana', 'あ', { srsStage: 2, correct: 1, wrong: 1, nextDue: 300 }),
    b: item('kana', 'い', { srsStage: 3, correct: 3, wrong: 1, nextDue: 100 }),
    c: item('word', 'number:5', { srsStage: 1, nextDue: 200 }),
    d: item('word', 'time:4:30', { srsStage: 5 }),
  };
  it('keeps only the group', () => {
    const rows = memoryRows(items, 'Aprendiz', lookup);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.item.itemId === 'あ')).toMatchObject({ stageName: 'Aprendiz 2', accuracy: 50, category: 'kana' });
    expect(memoryRows(items, 'Guru', lookup)).toHaveLength(1);
    expect(memoryRows(items, 'Quemado', lookup)).toEqual([]);
  });
  it('sorts by next review, accuracy (unanswered last) and name', () => {
    const rows = memoryRows(items, 'Aprendiz', lookup);
    const ids = (s: 'next' | 'accuracy' | 'name') => sortAndFilter(rows, s).map((r) => r.item.itemId);
    expect(ids('next')).toEqual(['い', 'number:5', 'あ']);
    expect(ids('accuracy')).toEqual(['あ', 'い', 'number:5']);
    expect(ids('name')[0]).toBe('number:5');
  });
  it('filters by type and counts types', () => {
    const rows = memoryRows(items, 'Aprendiz', lookup);
    expect(sortAndFilter(rows, 'next', 'number').map((r) => r.item.itemId)).toEqual(['number:5']);
    expect(sortAndFilter(rows, 'next', 'kana')).toHaveLength(2);
    expect(categoryCounts(rows)).toEqual({ kana: 2, number: 1 });
  });
});
