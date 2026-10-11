import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { localDateString } from './streak';
import { parseProgress, saveProgress, useSaveStatus } from './persistence';
import { PROGRESS_VERSION, createInitialProgress, migrate } from './progressSchema';
import { useProgress } from './progressStore';

describe('QA-017: progress migration', () => {
  it('version 1 passes through unchanged', () => {
    const json = createInitialProgress();
    expect(migrate(json)).toEqual({ ok: true, json });
    expect(parseProgress(JSON.stringify(json))).toMatchObject({ ok: true });
  });
  it('an unknown newer version is rejected with a clear message', () => {
    const result = migrate({ ...createInitialProgress(), version: PROGRESS_VERSION + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/versión más nueva \(2\).*Actualiza la app/);
    const parsed = parseProgress(JSON.stringify({ ...createInitialProgress(), version: 7 }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/versión más nueva/);
  });
  it('things without a numeric version are left to the schema to reject', () => {
    expect(migrate({ foo: 1 })).toEqual({ ok: true, json: { foo: 1 } });
    expect(migrate(null)).toEqual({ ok: true, json: null });
    expect(parseProgress(JSON.stringify({ foo: 1 })).ok).toBe(false);
    expect(parseProgress(JSON.stringify({ ...createInitialProgress(), version: 0 })).ok).toBe(false);
  });
});

describe('QA-018: save failures are exposed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useSaveStatus.setState({ failed: false });
  });

  it('flags a failing save and clears the flag on the next success', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    saveProgress(createInitialProgress());
    expect(useSaveStatus.getState().failed).toBe(true);
    spy.mockRestore();
    saveProgress(createInitialProgress());
    expect(useSaveStatus.getState().failed).toBe(false);
  });

  it('the Layout shows a banner with an export suggestion while saving fails', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
    expect(screen.queryByTestId('save-banner')).toBeNull();
    useSaveStatus.setState({ failed: true });
    const banner = await screen.findByTestId('save-banner');
    expect(banner).toHaveTextContent('Tu progreso no se está guardando');
    expect(banner).toHaveTextContent('Exporta');
    expect(banner.querySelector('a')).toHaveAttribute('href', '/ajustes');
    useSaveStatus.setState({ failed: false });
    await waitFor(() => expect(screen.queryByTestId('save-banner')).toBeNull());
  });
});

describe('QA-019: replaying a lesson', () => {
  it('only the first completion counts as a lesson of the day', () => {
    useProgress.getState().resetProgress();
    const { completeLesson } = useProgress.getState();
    completeLesson('h-a');
    completeLesson('h-a');
    completeLesson('h-a');
    expect(useProgress.getState().daily[localDateString(new Date())]!.lessons).toBe(1);
    completeLesson('h-ka');
    expect(useProgress.getState().daily[localDateString(new Date())]!.lessons).toBe(2);
  });
  it('a replay still keeps the streak alive and gives no bonus XP', () => {
    useProgress.getState().resetProgress();
    useProgress.getState().completeLesson('h-a');
    const xp = useProgress.getState().xp;
    useProgress.getState().completeLesson('h-a');
    expect(useProgress.getState().xp).toBe(xp);
    expect(useProgress.getState().streak.count).toBe(1);
  });
});
