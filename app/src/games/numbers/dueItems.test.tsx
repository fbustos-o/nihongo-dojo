import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readNumber } from '../../engine';
import { itemKey } from '../../state/progressSchema';
import { useProgress } from '../../state/progressStore';
import { Calendar } from '../calendar/Calendar';
import { makeCalendarQuestion, parseDateItemId } from '../calendar/calendarLogic';
import { Clock } from '../clock/Clock';
import { makeClockQuestion, parseTimeItemId } from '../clock/clockLogic';
import { Numbers, NumberQuestionView } from './Numbers';
import { makeNumberQuestion, makeNumberQuestionForItem, parseNumberItemId } from './numbersLogic';

// A Japanese voice is available in this file (QA-006: with audio the kana of "hear" questions stays hidden).
let voice = true;
vi.mock('../../hooks/useSpeech', () => ({ useSpeech: () => ({ available: voice, speak: vi.fn(), cancel: vi.fn() }) }));

const user = () => userEvent.setup({ delay: null });
beforeEach(() => {
  voice = true;
  useProgress.getState().resetProgress();
  useProgress.getState().unlockKana([...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽゃゅょっー']);
});

describe('QA-005: review generates the exact due questions', () => {
  it('parses number / counter ids', () => {
    expect(parseNumberItemId('number:416')).toEqual({ value: 416 });
    expect(parseNumberItemId('counter:nin:3')).toEqual({ counter: 'nin', n: 3 });
    expect(parseNumberItemId('counter:zzz:3')).toBeNull();
    expect(parseNumberItemId('counter:nin:99')).toBeNull();
    expect(parseNumberItemId('time:4:30')).toBeNull();
  });
  it.each(['number:416', 'number:4173', 'number:0', 'counter:nin:3', 'counter:sai:20', 'counter:kai:12'])('%s -> a question with that item id', (id) => {
    for (let i = 0; i < 20; i++) expect(makeNumberQuestionForItem(id, Math.random)!.itemId).toBe(id);
  });
  it('unknown ids give no question (random fallback)', () => {
    expect(makeNumberQuestionForItem('time:4:30', Math.random)).toBeNull();
  });
  it('time ids', () => {
    expect(parseTimeItemId('time:4:30')).toEqual({ h: 4, m: 30 });
    expect(parseTimeItemId('time:13:30')).toBeNull();
    expect(parseTimeItemId('date:4:1')).toBeNull();
    expect(makeClockQuestion('read', 0, Math.random, { h: 4, m: 30 }).itemId).toBe('time:4:30');
  });
  it('date ids', () => {
    expect(parseDateItemId('date:4:1')).toEqual({ kind: 'date', today: { month: 4, day: 1 } });
    expect(parseDateItemId('date:4:1:wd')).toEqual({ kind: 'weekday', today: { month: 4, day: 1 } });
    expect(parseDateItemId('date:2:30')).toBeNull();
    for (const id of ['date:4:1', 'date:4:1:wd', 'date:wd:3:next', 'date:wd:0:prev', 'date:12:24']) {
      const fixed = parseDateItemId(id)!;
      for (let i = 0; i < 20; i++) expect(makeCalendarQuestion(fixed.kind, Math.random, fixed).itemId).toBe(id);
    }
  });

  it('Numbers asks the due ids in order, one per round', async () => {
    const onFinish = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    render(<Numbers kana={[]} words={[]} rounds={2} onlyItems={['number:416', 'counter:nin:3']} onFinish={onFinish} sequential />);
    // Math.random = 0.9 -> the number is asked in "hear" mode (typed digits)
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    await user().type(screen.getByLabelText('Número con cifras'), '416{Enter}');
    vi.restoreAllMocks();
    expect(useProgress.getState().items[itemKey('word', 'number:416')]).toMatchObject({ correct: 1 });
    expect(screen.getByText(/3 personas/)).toBeInTheDocument();
  });

  it('Clock asks the due time', () => {
    render(<Clock kana={[]} words={[]} rounds={1} onlyItems={['time:4:30']} sequential />);
    const text = document.body.textContent ?? '';
    // read: the reading is typed (clock face); set: the kana is displayed
    expect(text.includes('よじはん') || screen.queryByLabelText('Hora en hiragana') !== null).toBe(true);
  });

  it('Calendar asks the due date', () => {
    render(<Calendar kana={[]} words={[]} rounds={1} onlyItems={['date:4:1']} sequential />);
    expect(screen.getByText(/1 de abril/)).toBeInTheDocument();
  });
});

describe('QA-006: Numbers "hear" mode does not show the answer text while it can be heard', () => {
  const render_ = (afterVoice: boolean) => {
    voice = afterVoice;
    const q = { ...makeNumberQuestion('hear', 0, () => 0.5), value: 72341, reading: readNumber(72341) };
    render(<NumberQuestionView question={q} onReport={vi.fn()} onDone={vi.fn()} />);
  };
  it('with a voice: only the audio button, no kana', () => {
    render_(true);
    expect(screen.getByRole('button', { name: /Escuchar otra vez/ })).toBeInTheDocument();
    expect(screen.queryByText(readNumber(72341).kana)).toBeNull();
  });
  it('without a voice: the kana is shown as a fallback', () => {
    render_(false);
    expect(screen.getByText(readNumber(72341).kana)).toBeInTheDocument();
  });
  it('after answering, the kana is revealed with the digits', async () => {
    render_(true);
    await user().type(screen.getByLabelText('Número con cifras'), '1{Enter}');
    expect(screen.getByTestId('correct-answer')).toHaveTextContent(readNumber(72341).kana);
  });
});
