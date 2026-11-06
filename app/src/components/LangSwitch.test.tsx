import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProgress } from '../state/progressStore';
import { LangSwitch } from './LangSwitch';

beforeEach(() => {
  useProgress.getState().resetProgress();
});

describe('LangSwitch', () => {
  it('marks the current language and switches interface + meanings together', async () => {
    render(<LangSwitch />);
    const es = screen.getByRole('button', { name: 'Español' });
    const en = screen.getByRole('button', { name: 'English' });
    expect(es).toHaveAttribute('aria-pressed', 'true');
    expect(en).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('group', { name: 'Idioma / Language' })).toBeInTheDocument();

    await userEvent.click(en);
    expect(useProgress.getState().settings.uiLang).toBe('en');
    expect(useProgress.getState().settings.meaningLang).toBe('en');
    expect(en).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Language / Idioma' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Español' }));
    expect(useProgress.getState().settings.uiLang).toBe('es');
    expect(useProgress.getState().settings.meaningLang).toBe('es');
  });
});
