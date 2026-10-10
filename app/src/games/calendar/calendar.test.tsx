import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readDate, readDayOfWeek } from '../../engine';
import { useProgress } from '../../state/progressStore';
import { Calendar, CalendarQuestionView } from './Calendar';
import { daysInMonth, isSpecialDay, makeCalendarQuestion, monthGrid, randomDay, shiftDay, weekdayOf, type CalendarQuestion } from './calendarLogic';

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const user = () => userEvent.setup({ delay: null });
beforeEach(() => useProgress.getState().resetProgress());

describe('calendar logic', () => {
  it('computes weekdays and month shapes for 2026', () => {
    expect(weekdayOf({ month: 4, day: 1 })).toBe(3); // Wednesday
    expect(weekdayOf({ month: 1, day: 1 })).toBe(4); // Thursday
    expect(daysInMonth(2)).toBe(28);
    const grid = monthGrid(4);
    expect(grid.every((row) => row.length === 7)).toBe(true);
    expect(grid[0]![3]).toBe(1);
    expect(grid.flat().filter((c) => c !== null)).toHaveLength(30);
    expect(shiftDay({ month: 1, day: 31 }, 1)).toEqual({ month: 2, day: 1 });
  });

  it('draws the special days (ついたち–とおか, 14, 20, 24) far more often than chance', () => {
    const rng = seeded(21);
    const hits = Array.from({ length: 600 }, () => randomDay(rng)).filter((d) => isSpecialDay(d.day)).length;
    expect(hits / 600).toBeGreaterThan(0.6);
  });

  it('builds every kind of question without errors, with sensible ids', () => {
    const rng = seeded(8);
    for (let i = 0; i < 400; i++) {
      for (const kind of ['date', 'weekday', 'relWeekday', 'relDate'] as const) {
        const q = makeCalendarQuestion(kind, rng);
        expect(q.itemId).toMatch(/^date:/);
        expect(q.related.length).toBeGreaterThan(1);
        expect(q.related).not.toContain(q.reading.kana);
      }
    }
  });

  it('yesterday / tomorrow answers follow the calendar', () => {
    for (let seed = 1; seed < 60; seed++) {
      const q = makeCalendarQuestion('relWeekday', seeded(seed));
      expect(q.reading.kana).toBe(readDayOfWeek((weekdayOf(q.today) + q.direction + 7) % 7).kana);
    }
  });
});

function mount(over: Partial<CalendarQuestion>) {
  const base = makeCalendarQuestion('date', seeded(1));
  const onReport = vi.fn();
  const onDone = vi.fn();
  render(<CalendarQuestionView question={{ ...base, format: 'type', related: [], ...over }} rng={seeded(2)} onReport={onReport} onDone={onDone} />);
  return { onReport, onDone };
}

describe('CalendarQuestionView', () => {
  it('shows the month grid with the date highlighted and accepts しがつ ついたち', async () => {
    const { onReport } = mount({ kind: 'date', today: { month: 4, day: 1 }, reading: readDate(4, 1) });
    const grid = screen.getByTestId('month-grid');
    expect(within(grid).getByText(/abril 2026/)).toBeInTheDocument();
    const current = grid.querySelector('[aria-current="date"]');
    expect(current).toHaveTextContent('1');
    await user().type(screen.getByLabelText('Lectura en hiragana'), 'shigatsu tsuitachi{Enter}');
    expect(onReport).toHaveBeenCalledWith(true);
  });

  it('accepts the alternative reading なながつ', async () => {
    const { onReport } = mount({ kind: 'date', today: { month: 7, day: 5 }, reading: readDate(7, 5) });
    await user().type(screen.getByLabelText('Lectura en hiragana'), 'nanagatsuitsuka{Enter}');
    expect(onReport).toHaveBeenCalledWith(true);
  });

  it('wrong date reading: shows the answer', async () => {
    const { onReport, onDone } = mount({ kind: 'date', today: { month: 5, day: 20 }, reading: readDate(5, 20) });
    await user().type(screen.getByLabelText('Lectura en hiragana'), 'gogatsu nijuunichi{Enter}');
    expect(onReport).toHaveBeenCalledWith(false);
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId('correct-answer')).toHaveTextContent('ごがつはつか');
  });

  it('weekday question: すいようび for April 1st', async () => {
    const { onReport } = mount({ kind: 'weekday', today: { month: 4, day: 1 }, reading: readDayOfWeek(3) });
    await user().type(screen.getByLabelText('Día de la semana en hiragana'), 'suiyoubi{Enter}');
    expect(onReport).toHaveBeenCalledWith(true);
  });

  it('relative question: きょうは かようびです → あしたは すいようび', async () => {
    const { onReport } = mount({ kind: 'relWeekday', today: { month: 3, day: 31 }, direction: 1, reading: readDayOfWeek(3) });
    expect(screen.getByText(/きょうは かようびです。あしたは？/)).toBeInTheDocument();
    await user().type(screen.getByLabelText('Día de la semana en hiragana'), 'suiyoubi{Enter}');
    expect(onReport).toHaveBeenCalledWith(true);
  });

  it('choice format: the right weekday among options', async () => {
    const q = makeCalendarQuestion('weekday', seeded(1));
    const { onReport } = mount({ ...q, format: 'choice' });
    await user().click(screen.getByRole('button', { name: q.reading.kana }));
    expect(onReport).toHaveBeenCalledWith(true);
  });
});

describe('Calendar game', () => {
  it('runs a round (choice format) and stores a `date:` item', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const onFinish = vi.fn();
    render(<Calendar kana={[]} words={[]} rounds={1} onFinish={onFinish} />);
    const group = screen.getAllByRole('button');
    expect(group).toHaveLength(4);
    for (const button of group) {
      if (onFinish.mock.calls.length > 0) break;
      if (!(button as HTMLButtonElement).disabled) await user().click(button);
    }
    expect(onFinish).toHaveBeenCalledTimes(1);
    const keys = Object.keys(useProgress.getState().items);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^word:date:\d+:\d+$/);
    vi.restoreAllMocks();
  });

  it('free practice offers the kinds of question', async () => {
    render(<Calendar kana={[]} words={[]} />);
    expect(screen.getByRole('button', { name: 'Ayer / mañana (día)' })).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Día de la semana' }));
    expect(screen.getByTestId('prompt')).toHaveTextContent('día de la semana');
  });
});
