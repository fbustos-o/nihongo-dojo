import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCelebrations } from '../state/celebrations';
import { useProgress } from '../state/progressStore';
import { Celebrations, CELEBRATION_MS } from './Celebrations';

beforeEach(() => {
  useProgress.getState().resetProgress();
  useCelebrations.getState().clear();
});
afterEach(() => vi.useRealTimers());

describe('Celebrations', () => {
  it('shows one toast at a time as a polite status and dismisses it', async () => {
    render(<Celebrations />);
    act(() => {
      useCelebrations.getState().push({ kind: 'level', title: '¡Nivel 2!' });
      useCelebrations.getState().push({ kind: 'streak', title: '¡Racha de 7 días!' });
    });
    expect(screen.getByRole('status')).toHaveTextContent('¡Nivel 2!');
    expect(screen.queryByText('¡Racha de 7 días!')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.getByRole('status')).toHaveTextContent('¡Racha de 7 días!');
  });
  it('disappears by itself', () => {
    vi.useFakeTimers();
    render(<Celebrations />);
    act(() => useCelebrations.getState().push({ kind: 'lesson', title: '¡Lección completada!' }));
    expect(screen.getByTestId('celebration-lesson')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(CELEBRATION_MS + 10));
    expect(screen.queryByTestId('celebration-lesson')).not.toBeInTheDocument();
  });
  it('makes no sound unless the setting is on', () => {
    const create = vi.fn(() => {
      throw new Error('should not be used');
    });
    vi.stubGlobal('AudioContext', create);
    render(<Celebrations />);
    act(() => useCelebrations.getState().push({ kind: 'level', title: 'x' }));
    expect(create).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
