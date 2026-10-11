import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { allReadings, readTime } from '../../engine';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { Clock, ClockReadView, ClockSetView } from './Clock';
import { handPoint, hourAngle, makeClockQuestion, minuteAngle, randomClockTime, relatedTimes, sameTime, stepHour, stepMinute, timeItemId } from './clockLogic';

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const user = () => userEvent.setup({ delay: null });
beforeEach(() => {
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana([...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽゃゅょっー']);
});

describe('clock geometry', () => {
  it('computes hand angles', () => {
    expect(hourAngle(3, 0)).toBe(90);
    expect(hourAngle(12, 0)).toBe(0);
    expect(hourAngle(4, 30)).toBe(135);
    expect(minuteAngle(0)).toBe(0);
    expect(minuteAngle(30)).toBe(180);
    expect(minuteAngle(45)).toBe(270);
  });

  it('places hand end points', () => {
    const top = handPoint(0, 50);
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(50);
    const right = handPoint(90, 50);
    expect(right.x).toBeCloseTo(150);
    expect(right.y).toBeCloseTo(100);
  });

  it('wraps hour and minute steps', () => {
    expect(stepHour(12, 1)).toBe(1);
    expect(stepHour(1, -1)).toBe(12);
    expect(stepMinute(55, 5)).toBe(0);
    expect(stepMinute(0, -5)).toBe(55);
    expect(sameTime({ h: 12, m: 0 }, { h: 12, m: 0 })).toBe(true);
  });
});

describe('difficulty', () => {
  it('o\'clock → half → 5-minute steps → any minute', () => {
    const rng = seeded(2);
    const times = (tier: number) => Array.from({ length: 300 }, () => randomClockTime(tier, rng));
    expect(times(0).every((t) => t.m === 0)).toBe(true);
    expect(times(1).every((t) => t.m === 0 || t.m === 30)).toBe(true);
    expect(times(2).every((t) => t.m % 5 === 0)).toBe(true);
    expect(new Set(times(3).map((t) => t.m)).size).toBeGreaterThan(30);
    expect(times(3).every((t) => t.h >= 1 && t.h <= 12 && t.m <= 59)).toBe(true);
  });

  it('shows the irregular hours 4, 7 and 9 often', () => {
    const rng = seeded(9);
    const hits = Array.from({ length: 600 }, () => randomClockTime(0, rng)).filter((t) => [4, 7, 9].includes(t.h)).length;
    expect(hits / 600).toBeGreaterThan(0.4);
  });

  it('builds questions with the agreed item id and the engine reading', () => {
    const q = makeClockQuestion('read', 2, seeded(4));
    expect(q.itemId).toBe(timeItemId(q.time));
    expect(q.itemId).toMatch(/^time:\d+:\d+$/);
    expect(q.reading.kana).toBe(readTime(q.time.h, q.time.m).kana);
    expect(relatedTimes(q.time).length).toBeGreaterThan(2);
  });
});

function read(h: number, m: number, format: 'type' | 'choice' = 'type') {
  const q = { ...makeClockQuestion('read', 0, seeded(1)), time: { h, m }, reading: readTime(h, m), format, related: relatedTimes({ h, m }).map((t) => readTime(t.h, t.m).kana) };
  const onReport = vi.fn();
  const onDone = vi.fn();
  render(<ClockReadView question={q} rng={seeded(3)} onReport={onReport} onDone={onDone} />);
  return { onReport, onDone };
}

describe('ClockReadView', () => {
  it('draws the hands for the time and hides the time from the text alternative until a miss', async () => {
    read(4, 30);
    const svg = screen.getByRole('img', { name: /Reloj analógico/ });
    expect(svg.getAttribute('aria-label')).not.toMatch(/4:30/);
    expect(screen.getByText('いま なんじですか？')).toBeInTheDocument();
    const minute = screen.getByTestId('minute-hand');
    expect(Number(minute.getAttribute('x2'))).toBeCloseTo(100, 3);
    expect(Number(minute.getAttribute('y2'))).toBeGreaterThan(100);
    await user().type(screen.getByLabelText('Hora en hiragana'), 'sanji{Enter}');
    expect(screen.getByRole('img', { name: /las 4:30/ })).toBeInTheDocument();
  });

  it('accepts the primary reading, with or without spaces', async () => {
    const { onReport, onDone } = read(4, 30);
    await user().type(screen.getByLabelText('Hora en hiragana'), 'yoji han{Enter}');
    expect(onReport).toHaveBeenCalledWith(true);
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('accepts alternative readings (よじ さんじゅっぷん)', async () => {
    expect(allReadings(readTime(4, 30)).length).toBeGreaterThan(1);
    const { onReport } = read(4, 30);
    await user().type(screen.getByLabelText('Hora en hiragana'), 'yoji sanjuppun{Enter}');
    expect(onReport).toHaveBeenCalledWith(true);
  });

  it('rejects よんじ for 4:00 style mistakes and shows the right answer', async () => {
    const { onReport, onDone } = read(4, 0);
    await user().type(screen.getByLabelText('Hora en hiragana'), 'yonji{Enter}');
    expect(onReport).toHaveBeenCalledWith(false);
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId('correct-answer')).toHaveTextContent('よじ');
  });

  it('choice format offers yoji and the trap よんじ', async () => {
    const { onReport } = read(4, 0, 'choice');
    expect(screen.getByRole('button', { name: 'よんじ' })).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'よじ' }));
    expect(onReport).toHaveBeenCalledWith(true);
  });
});

describe('ClockSetView', () => {
  const setup = (h: number, m: number) => {
    const q = { ...makeClockQuestion('set', 0, seeded(1)), time: { h, m }, reading: readTime(h, m) };
    const onReport = vi.fn();
    const onDone = vi.fn();
    render(<ClockSetView question={q} onReport={onReport} onDone={onDone} />);
    return { onReport, onDone };
  };
  const press = async (name: string, times: number) => {
    for (let i = 0; i < times; i++) await user().click(screen.getByRole('button', { name }));
  };

  it('sets 4:30 with the buttons and is right first time', async () => {
    const { onReport, onDone } = setup(4, 30);
    expect(screen.getByTestId('prompt')).toHaveTextContent('よじはん');
    await press('Hora +', 4);
    await press('5 min +', 6);
    expect(screen.getByTestId('set-time')).toHaveTextContent('4:30');
    expect(screen.getByRole('img', { name: 'Reloj ajustado: las 4:30' })).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(onReport).toHaveBeenCalledWith(true);
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('a wrong check reports once and lets the learner fix it', async () => {
    const { onReport, onDone } = setup(1, 1);
    await user().click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(onReport).toHaveBeenCalledWith(false);
    expect(screen.getByText(/Todavía no/)).toBeInTheDocument();
    await press('Hora +', 1);
    await press('1 min +', 1);
    await user().click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(onDone).toHaveBeenCalledWith(false);
    expect(onReport).toHaveBeenCalledTimes(1);
  });
});

describe('Clock game', () => {
  it('plays one round and stores `time:<h>:<m>`', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const onFinish = vi.fn();
    render(<Clock kana={[]} words={[]} rounds={1} onFinish={onFinish} />);
    // random=0 → hour 1, tier 0 → 1:00, read format choice
    expect(screen.getByRole('img', { name: /Reloj analógico/ })).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'いちじ' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(useProgress.getState().items[itemKey('word', 'time:1:0')]).toMatchObject({ correct: 1 });
    vi.restoreAllMocks();
  });
});
