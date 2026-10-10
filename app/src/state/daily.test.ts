import { bumpDaily, dailyAccuracy, DAILY_KEEP_DAYS, lastSevenDays, WEEKDAY_INITIALS_ES } from './daily';
import { createInitialProgress, ProgressSchema } from './progressSchema';

const at = (d: string) => new Date(`${d}T12:00:00`);

describe('daily activity', () => {
  it('adds up counters per local date', () => {
    let daily = bumpDaily({}, at('2026-03-01'), { correct: 1, reviews: 1 });
    daily = bumpDaily(daily, at('2026-03-01'), { wrong: 1 });
    daily = bumpDaily(daily, at('2026-03-02'), { lessons: 1 });
    expect(daily['2026-03-01']).toEqual({ reviews: 1, lessons: 0, correct: 1, wrong: 1 });
    expect(daily['2026-03-02']).toEqual({ reviews: 0, lessons: 1, correct: 0, wrong: 0 });
    expect(dailyAccuracy(daily['2026-03-01']!)).toBe(0.5);
    expect(dailyAccuracy(daily['2026-03-02']!)).toBe(0);
  });
  it('drops entries older than the retention window', () => {
    const old = bumpDaily({}, at('2026-01-01'), { correct: 1 });
    const daily = bumpDaily(old, at('2026-06-01'), { correct: 1 });
    expect(Object.keys(daily)).toEqual(['2026-06-01']);
    expect(DAILY_KEEP_DAYS).toBeGreaterThan(30);
  });
  it('lists the last 7 days with Spanish weekday initials', () => {
    expect(WEEKDAY_INITIALS_ES.join('')).toBe('DLMXJVS');
    const daily = bumpDaily({}, at('2026-03-04'), { correct: 1 }); // Wednesday
    const week = lastSevenDays(daily, { lastStudyDate: null, count: 0 }, at('2026-03-07')); // Saturday
    expect(week.map((d) => d.date)[0]).toBe('2026-03-01');
    expect(week.map((d) => d.label).join('')).toBe('DLMXJVS');
    expect(week.filter((d) => d.active).map((d) => d.date)).toEqual(['2026-03-04']);
    expect(week.at(-1)).toMatchObject({ today: true, label: 'S' });
  });
  it('counts days inside the streak as active even without daily data (old saves)', () => {
    const week = lastSevenDays({}, { lastStudyDate: '2026-03-07', count: 3 }, at('2026-03-07'));
    expect(week.filter((d) => d.active).map((d) => d.date)).toEqual(['2026-03-05', '2026-03-06', '2026-03-07']);
  });
  it('old saves without `daily` still parse', () => {
    const { daily: _daily, ...old } = createInitialProgress();
    void _daily;
    const parsed = ProgressSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.daily).toEqual({});
  });
});
