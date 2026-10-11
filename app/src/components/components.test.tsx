import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { useProgress } from '../state/progressStore';
import { JaText } from './JaText';
import { KanaInput } from './KanaInput';
import { SpeakButton } from './SpeakButton';

beforeEach(() => {
  useProgress.getState().resetProgress();
});

describe('JaText', () => {
  it('shows kana with romaji ruby by default and furigana once the kanji is unlocked', () => {
    const word = { kana: 'たべる', kanji: '食べる' };
    const { container, rerender } = render(<JaText word={word} />);
    // locked kana stay kana, each with its romaji as ruby (QA-036)
    expect(container.querySelectorAll('[data-testid="kana-ruby"]').length).toBe(3);
    expect(container).toHaveTextContent('たtaべbeるru');
    expect(container.querySelector('ruby')).not.toBeNull();

    useProgress.getState().unlockKana([...'たべる']);
    useProgress.getState().unlockKanji(['食']);
    rerender(<JaText word={word} />);
    expect(container.querySelector('ruby')).toHaveTextContent('食た');
    expect(container).toHaveTextContent('べる');
    expect(container.querySelector('[data-testid="kana-ruby"]')).toBeNull();
  });

  it("romajiMode='inline' keeps the old romaji", () => {
    const { container } = render(<JaText word={{ kana: 'たべる' }} romajiMode="inline" />);
    expect(container).toHaveTextContent('taberu');
    expect(container.querySelector('ruby')).toBeNull();
  });

  it('accepts plain kana through `text`', () => {
    const { container } = render(<JaText text="で" />);
    expect(container.querySelector('ruby')).toHaveTextContent('でde');
  });
});

describe('KanaInput', () => {
  it('converts typed romaji to hiragana', async () => {
    const onChange = vi.fn();
    render(<KanaInput aria-label="kana" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('kana'), 'nihongo');
    expect(screen.getByLabelText('kana')).toHaveValue('にほんご');
    expect(onChange).toHaveBeenLastCalledWith('にほんご');
  });

  it('converts to katakana in katakana mode', async () => {
    render(<KanaInput aria-label="kana" mode="katakana" />);
    await userEvent.type(screen.getByLabelText('kana'), 'tenisu');
    expect(screen.getByLabelText('kana')).toHaveValue('テニス');
  });
});

describe('SpeakButton', () => {
  it('stays enabled without a voice (a static clip may exist) and gives up once no clip plays', async () => {
    vi.stubGlobal('Audio', class { play() { return Promise.reject(new Error('404')); } });
    render(<SpeakButton text="こんにちは" />);
    const button = screen.getByRole('button', { name: 'Escuchar' });
    expect(button).toBeEnabled();
    await userEvent.click(button); // jsdom has no Audio: nothing plays
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('title', expect.stringContaining('voz'));
  });
});

describe('App shell', () => {
  it('navigates to settings and resets progress through an in-page confirmation', async () => {
    useProgress.getState().unlockKana(['あ']);
    render(
      <MemoryRouter initialEntries={['/ajustes']}>
        <App />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Reiniciar progreso' }));
    expect(useProgress.getState().knownKana).toEqual(['あ']);
    await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar todo' }));
    expect(useProgress.getState().knownKana).toEqual([]);
  });

  it('lists the main sections', async () => {
    render(
      <MemoryRouter initialEntries={['/camino']}>
        <App />
      </MemoryRouter>,
    );
    for (const name of ['Inicio', 'Camino', 'Repaso', 'Práctica', 'Ajustes', 'Acerca de']) {
      expect(screen.getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(await screen.findByRole('heading', { name: 'Camino' })).toBeInTheDocument();
  });
});

describe('JaText with a stage 2 sentence containing katakana', () => {
  it('renders コーヒー in hiragana, then in katakana after unlocking it', () => {
    useProgress.getState().unlockKana([...'わたしはをのみません', ...'こひ']);
    const word = { kana: 'わたし は コーヒー を のみません。' };
    const { container, rerender } = render(<JaText word={word} />);
    expect(container).toHaveTextContent('こーひー');
    expect(container).not.toHaveTextContent('コーヒー');
    useProgress.getState().unlockKana([...'コヒ']);
    rerender(<JaText word={word} />);
    expect(container).toHaveTextContent('コーヒー');
    expect(container).not.toHaveTextContent('こーひー');
  });
});
