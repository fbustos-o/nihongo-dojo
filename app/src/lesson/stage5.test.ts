import type { KanaEntry, Lesson } from '../domain/schema';
import { word } from '../state/testWords';
import { lessonContent, MAX_ESSENTIAL_GAME_WORDS, wordGameRounds, wordsForGame } from './lessonLogic';

const mk = (id: string, requires: string[], words: string[], stage: Lesson['stage'] = 5): Lesson =>
  ({ id, title: id, stage, requires, words, games: ['flashcards', 'read-words'] }) as unknown as Lesson;

describe('stage 5 lessons', () => {
  const vocab = Array.from({ length: 50 }, (_, i) => word(`w${i}`, 'いぬ', i + 1));
  const curriculum = [mk('c-01', [], vocab.slice(0, 25).map((w) => w.id)), mk('c-02', ['c-01'], vocab.slice(25).map((w) => w.id))];

  it('lessonContent gives exactly the lesson\'s own words (25), not the earlier packages', () => {
    const data = lessonContent(curriculum[1]!, new Set(['い', 'ぬ']), { kana: [] as KanaEntry[], vocab, curriculum });
    expect(data.words.map((w) => w.id)).toEqual(vocab.slice(25).map((w) => w.id));
    expect(data.words).toHaveLength(25);
  });

  it('flashcards get all the words and the other games a sample', () => {
    const all = vocab.slice(0, 25);
    const sample = all.slice(0, MAX_ESSENTIAL_GAME_WORDS);
    expect(wordsForGame('flashcards', { stage: 5 }, all, sample)).toHaveLength(25);
    expect(wordsForGame('read-words', { stage: 5 }, all, sample)).toHaveLength(MAX_ESSENTIAL_GAME_WORDS);
    expect(wordsForGame('read-words', { stage: 2 }, all, sample)).toHaveLength(25);
    expect(wordGameRounds('flashcards', 25)).toBe(25);
    expect(wordGameRounds('read-words', 12)).toBe(15);
  });
});
