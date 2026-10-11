import { describe, expect, it } from 'vitest';
import type { Word } from '../domain/schema';
import { meaningChoices, overlapsMeaning } from './wordUtils';

const w = (id: string, kana: string, es: string[]): Word => ({ id, kana, romaji: id, es }) as Word;

describe('meaning distractors (QA-014)', () => {
  const atsui1 = w('atsui1', 'あつい', ['caluroso (clima)']);
  const atsui2 = w('atsui2', 'あつい', ['caliente (cosas)']);
  const toire = w('toire', 'トイレ', ['baño']);
  const furo = w('furo', 'ふろ', ['baño (bañera)']);
  const others = ['perro', 'gato', 'mesa', 'libro'].map((m, i) => w(`o${i}`, `お${i}`, [m]));
  it('flags homophones and glosses that share their first word', () => {
    expect(overlapsMeaning(atsui1, atsui2)).toBe(true);
    expect(overlapsMeaning(toire, furo)).toBe(true);
    expect(overlapsMeaning(toire, others[0]!)).toBe(false);
  });
  it('never offers them as distractors', () => {
    for (let i = 0; i < 100; i++) {
      const texts = meaningChoices(atsui1, 4, [atsui1, atsui2, toire, furo, ...others]).map((c) => c.text);
      expect(texts).not.toContain('caliente (cosas)');
    }
    for (let i = 0; i < 100; i++) {
      const texts = meaningChoices(toire, 4, [toire, furo, ...others]).map((c) => c.text);
      expect(texts).not.toContain('baño (bañera)');
    }
  });
});
