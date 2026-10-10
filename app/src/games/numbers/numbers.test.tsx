import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { allReadings, readNumber, readPrice } from '../../engine';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { buildChoices, confusions } from './confusions';
import { Numbers, NumberQuestionView } from './Numbers';
import { availableModes, isIrregularNumber, makeNumberQuestion, modePool, parseTypedNumber, randomNumber, relatedNumbers, tierForRound, TIER_RANGES, type NumberQuestion } from './numbersLogic';
import { PRICE_OBJECTS } from './objects';

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const user = () => userEvent.setup({ delay: null });
beforeEach(() => useProgress.getState().resetProgress());

describe('difficulty tiers', () => {
  it('grows with the round', () => {
    expect([0, 3, 6, 9].map((r) => tierForRound(r, 12))).toEqual([0, 1, 2, 3]);
    expect(tierForRound(100)).toBe(3);
    expect(tierForRound(0)).toBe(0);
  });

  it('draws numbers inside each tier range', () => {
    const rng = seeded(7);
    for (let tier = 0; tier < 4; tier++) {
      for (let i = 0; i < 200; i++) {
        const n = randomNumber(tier, rng);
        expect(n).toBeGreaterThanOrEqual(TIER_RANGES[tier]![0]);
        expect(n).toBeLessThanOrEqual(TIER_RANGES[tier]![1]);
      }
    }
  });

  it('shows irregular hundreds (3/6/8) far more often than chance', () => {
    const rng = seeded(11);
    const hits = Array.from({ length: 400 }, () => randomNumber(2, rng)).filter((n) => [3, 6, 8].includes(Math.floor(n / 100))).length;
    expect(hits / 400).toBeGreaterThan(0.45);
    expect(isIrregularNumber(300) && isIrregularNumber(600) && isIrregularNumber(800) && isIrregularNumber(3000)).toBe(true);
    expect(isIrregularNumber(200)).toBe(false);
  });
});

describe('helpers', () => {
  it('parses typed digits with separators, yen signs and full-width digits', () => {
    expect(parseTypedNumber('3,500')).toBe(3500);
    expect(parseTypedNumber('¥3500円')).toBe(3500);
    expect(parseTypedNumber('７２３４１')).toBe(72341);
    expect(parseTypedNumber('abc')).toBeNull();
  });

  it('knows plausible confusions', () => {
    expect(confusions('さんびゃく')).toContain('さんひゃく');
    expect(confusions('ろっぴゃく')).toContain('ろくひゃく');
    expect(confusions('よじ')).toContain('よんじ');
    expect(confusions('はつか')).toContain('にじゅうにち');
  });

  it('choices contain the answer, the typical mistake, no accepted alternative and no duplicates', () => {
    for (let seed = 1; seed < 30; seed++) {
      const answer = readNumber(300);
      const options = buildChoices(answer, relatedNumbers(300).map((n) => readNumber(n).kana), seeded(seed));
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options).toContain('さんびゃく');
      expect(options).toContain('さんひゃく');
    }
    const seven = readNumber(7);
    for (let seed = 1; seed < 30; seed++) {
      const options = buildChoices(seven, ['しち', 'はち', 'ろく', 'ご'], seeded(seed));
      expect(options).not.toContain('しち');
    }
  });

  it('limits modes to what the lesson words call for', () => {
    expect(availableModes([{ tags: ['numero'] }])).toEqual(['digits', 'hear']);
    expect(availableModes([{ tags: ['cosa'] }])).toContain('price');
    expect(availableModes([{ tags: ['contador'] }])).toContain('counter');
    expect(availableModes([])).toEqual(['digits', 'hear', 'price', 'priceHear', 'counter']);
    expect(modePool([{ tags: ['contador'] }]).filter((m) => m === 'counter').length).toBe(3);
  });

  it('builds every mode of question with item ids in the agreed format', () => {
    const rng = seeded(3);
    expect(makeNumberQuestion('digits', 2, rng).itemId).toMatch(/^number:\d+$/);
    const price = makeNumberQuestion('price', 0, rng);
    expect(price.object).toBeDefined();
    expect(price.reading.kana.endsWith('えん')).toBe(true);
    expect(PRICE_OBJECTS.length).toBeGreaterThan(10);
    for (let i = 0; i < 60; i++) expect(makeNumberQuestion('counter', 0, rng).itemId).toMatch(/^counter:(tsu|nin|kai|sai):\d+$/);
  });
});

function view(over: Partial<NumberQuestion>) {
  const base = makeNumberQuestion('digits', 2, seeded(1));
  const question = { ...base, ...over };
  const onReport = vi.fn();
  const onDone = vi.fn();
  render(<NumberQuestionView question={question} rng={seeded(5)} onReport={onReport} onDone={onDone} />);
  return { onReport, onDone };
}

describe('NumberQuestionView', () => {
  it('typed reading: accepts the primary reading', async () => {
    const { onReport, onDone } = view({ mode: 'digits', value: 416, format: 'type', reading: readNumber(416), related: [] });
    expect(screen.getByText('416')).toBeInTheDocument();
    await user().type(screen.getByLabelText('Lectura en hiragana'), 'yonhyakujuuroku{Enter}');
    expect(onReport).toHaveBeenCalledWith(true);
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('typed reading: accepts an alternative reading (しち)', async () => {
    const { onReport } = view({ mode: 'digits', value: 7, format: 'type', reading: readNumber(7), related: [] });
    await user().type(screen.getByLabelText('Lectura en hiragana'), 'shichi{Enter}');
    expect(onReport).toHaveBeenCalledWith(true);
  });

  it('typed reading: a wrong answer reports once, shows the answer and waits for the retype', async () => {
    const { onReport, onDone } = view({ mode: 'digits', value: 300, format: 'type', reading: readNumber(300), related: [] });
    await user().type(screen.getByLabelText('Lectura en hiragana'), 'sanhyaku{Enter}');
    expect(onReport).toHaveBeenCalledWith(false);
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId('correct-answer')).toHaveTextContent('さんびゃく');
    await user().type(screen.getByLabelText('Lectura en hiragana'), 'sanbyaku{Enter}');
    expect(onDone).toHaveBeenCalledWith(false);
    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it('choice: offers さんひゃく as a trap for 300 and accepts the right pick', async () => {
    const { onReport, onDone } = view({ mode: 'digits', value: 300, format: 'choice', reading: readNumber(300), related: relatedNumbers(300).map((n) => readNumber(n).kana) });
    expect(screen.getAllByRole('button')).toHaveLength(4);
    await user().click(screen.getByRole('button', { name: 'さんひゃく' }));
    expect(onReport).toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'さんひゃく' })).toBeDisabled();
    await user().click(screen.getByRole('button', { name: 'さんびゃく' }));
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('price: shows the object with its yen price and accepts よえん-type alternatives', async () => {
    const { onReport } = view({
      mode: 'price',
      value: 4,
      format: 'type',
      reading: readPrice(4),
      object: PRICE_OBJECTS[0]!,
      related: [],
    });
    expect(screen.getByText('いくらですか？')).toBeInTheDocument();
    expect(screen.getByText('¥4')).toBeInTheDocument();
    expect(allReadings(readPrice(4))).toContain('よんえん');
    await user().type(screen.getByLabelText('Lectura en hiragana'), 'yoen{Enter}');
    expect(onReport).toHaveBeenCalledWith(true);
  });

  it('hear: shows the kana and takes the number with digits', async () => {
    const { onReport } = view({ mode: 'priceHear', value: 3500, format: 'digits', reading: readPrice(3500), object: PRICE_OBJECTS[6]!, related: [] });
    expect(within(screen.getByTestId('prompt')).getByText('さんぜんごひゃくえん')).toBeInTheDocument();
    await user().type(screen.getByLabelText('Número con cifras'), '3,500{Enter}');
    expect(onReport).toHaveBeenCalledWith(true);
  });

  it('hear: wrong digits are wrong', async () => {
    const { onReport } = view({ mode: 'hear', value: 618905, format: 'digits', reading: readNumber(72341), related: [] });
    await user().type(screen.getByLabelText('Número con cifras'), '72340{Enter}');
    expect(onReport).toHaveBeenCalledWith(false);
  });

  it('counter: 3 personas → さんにん', async () => {
    const q = makeNumberQuestion('counter', 0, seeded(1));
    const { onReport } = view({ ...q, counter: { spec: { counter: 'nin', max: 10, hot: [], display: (n: number) => `${n} personas` }, n: 3 }, value: 3, format: 'type', reading: { kana: 'さんにん', romaji: 'sannin', alternatives: [] }, related: [] });
    expect(screen.getByText('3 personas')).toBeInTheDocument();
    await user().type(screen.getByLabelText('Lectura en hiragana'), 'sannnin{Enter}');
    expect(onReport).toHaveBeenCalledWith(true);
  });

  it('respects showRomaji for the shown answer', async () => {
    useProgress.getState().updateSettings({ showRomaji: false });
    view({ mode: 'digits', value: 5, format: 'type', reading: readNumber(5), related: [] });
    await user().type(screen.getByLabelText('Lectura en hiragana'), 'x{Enter}');
    expect(screen.getByTestId('correct-answer')).not.toHaveTextContent('go');
    useProgress.getState().updateSettings({ showRomaji: true });
  });
});

describe('Numbers game', () => {
  it('runs a round, records `number:<n>` and finishes', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const onFinish = vi.fn();
    render(<Numbers kana={[]} words={[]} rounds={1} onFinish={onFinish} />);
    await user().click(screen.getByRole('button', { name: 'ぜろ' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(useProgress.getState().items[itemKey('word', 'number:0')]).toMatchObject({ correct: 1, wrong: 0 });
    vi.restoreAllMocks();
  });

  it('free practice has a mode selector and a finish button', async () => {
    const onFinish = vi.fn();
    render(<Numbers kana={[]} words={[]} onFinish={onFinish} />);
    expect(screen.getByRole('group', { name: 'Modo' })).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Contadores' }));
    expect(screen.getByTestId('prompt')).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Terminar' }));
    expect(onFinish).toHaveBeenCalled();
  });
});
