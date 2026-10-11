import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '../domain/contentLoader';
import { useProgress } from '../state/progressStore';
import { kanaReinforcement, knownKanaPool, writePrompt } from './kanaUtils';
import { KanaWrite, modeFor } from './kana-write/KanaWrite';
import { Listen } from './listen';
import { ReadWords } from './read-words';

const kana = (c: string) => content.kana.find((k) => k.char === c)!;
const word = (id: string) => content.vocab.find((w) => w.id === id)!;
const user = () => userEvent.setup({ delay: null });

function withJapaneseVoice() {
  const synth = {
    getVoices: () => [{ lang: 'ja-JP' }],
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    cancel: () => undefined,
    speak: () => undefined,
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(public text: string) {}
    },
  );
}

beforeEach(() => useProgress.getState().resetProgress());
afterEach(() => {
  Reflect.deleteProperty(window, 'speechSynthesis');
  vi.unstubAllGlobals();
});

describe('kana helpers', () => {
  it('disambiguates the prompts of を ぢ づ and their katakana twins', () => {
    expect(writePrompt(kana('を'))).toMatchObject({ romaji: 'wo' });
    expect(writePrompt(kana('ぢ'))).toMatchObject({ romaji: 'di' });
    expect(writePrompt(kana('づ'))).toMatchObject({ romaji: 'du' });
    expect(writePrompt(kana('ヲ')).romaji).toBe('wo');
    expect(writePrompt(kana('ヂ')).romaji).toBe('di');
    expect(writePrompt(kana('ヅ')).romaji).toBe('du');
    expect(writePrompt(kana('を')).note).toMatch(/partícula/);
    expect(writePrompt(kana('か'))).toEqual({ romaji: 'ka' });
  });

  it('builds the condensed reinforcement', () => {
    expect(kanaReinforcement(kana('し'))).toBe('し = shi · fila さ');
    expect(kanaReinforcement(kana('ぱ'))).toBe('ぱ = pa · fila ぱ');
    expect(kanaReinforcement(kana('ー'))).not.toMatch(/fila/);
  });

  it('knownKanaPool keeps only known + lesson kana', () => {
    const pool = knownKanaPool(['あ', 'い'], ['か']).map((k) => k.char);
    expect(pool.sort()).toEqual(['あ', 'い', 'か'].sort());
  });

  it('modeFor: new kana are read, seen ones dictated, ambiguous ones never dictated', () => {
    expect(modeFor('mixto', false, false)).toBe('lectura');
    expect(modeFor('mixto', true, false)).toBe('dictado');
    expect(modeFor('mixto', true, true)).toBe('lectura');
    expect(modeFor('dictado', false, false)).toBe('dictado');
    expect(modeFor('lectura', true, false)).toBe('lectura');
  });
});

describe('kana-write modes', () => {
  it('Lectura (new kana): romaji visible, audio hidden until answered wrong', async () => {
    withJapaneseVoice();
    render(<KanaWrite kana={[kana('あ')]} words={[]} rounds={3} />);
    expect(screen.getByTestId('romaji')).toHaveTextContent('a');
    expect(screen.getByTestId('write-mode')).toHaveTextContent('Lectura');
    expect(screen.queryByRole('button', { name: /Escuchar/ })).toBeNull();
    await user().type(screen.getByLabelText('Escribe en kana'), 'i{Enter}');
    expect(within(screen.getByTestId('correct-answer')).getByRole('button', { name: 'Escuchar' })).toBeInTheDocument();
  });

  it('Dictado (already seen kana): only audio, no romaji and no kana before answering', async () => {
    withJapaneseVoice();
    useProgress.getState().recordAnswer('あ', 'kana', true);
    render(<KanaWrite kana={[kana('あ')]} words={[]} rounds={3} />);
    expect(screen.getByTestId('write-mode')).toHaveTextContent('Dictado');
    expect(screen.queryByTestId('romaji')).toBeNull();
    expect(screen.getByRole('button', { name: 'Escuchar otra vez' })).toBeEnabled();
    expect(screen.getByTestId('prompt')).not.toHaveTextContent('あ');
    await user().type(screen.getByLabelText('Escribe en kana'), 'a{Enter}');
    expect(screen.getByText(/Correcto/)).toBeInTheDocument();
  });

  it('free practice has mode chips; Dictado without a voice falls back to Lectura with a notice', async () => {
    render(<KanaWrite kana={[kana('あ')]} words={[]} />);
    const chips = screen.getByRole('group', { name: 'Modo de escritura' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['Mixto', 'Lectura', 'Dictado']);
    await user().click(within(chips).getByRole('button', { name: 'Dictado' }));
    expect(screen.getByTestId('dictado-fallback')).toBeInTheDocument();
    expect(screen.getByTestId('romaji')).toHaveTextContent('a');
  });

  it('QA-009: を is asked as «wo» with a note and typing it counts', async () => {
    render(<KanaWrite kana={[kana('を')]} words={[]} rounds={1} />);
    expect(screen.getByTestId('romaji')).toHaveTextContent('wo');
    expect(screen.getByTestId('write-note')).toHaveTextContent(/partícula/);
    await user().type(screen.getByLabelText('Escribe en kana'), 'wo{Enter}');
    expect(useProgress.getState().items['kana:を']).toMatchObject({ correct: 1 });
  });

  it('types with the on-screen keyboard in teclado mode', async () => {
    useProgress.getState().updateSettings({ kanaInput: 'teclado' });
    render(<KanaWrite kana={[kana('か')]} words={[]} rounds={1} />);
    const input = screen.getByLabelText('Escribe en kana');
    expect(input).toHaveAttribute('inputmode', 'none');
    expect(input).toHaveFocus();
    await user().click(screen.getByRole('button', { name: 'Fila か' }));
    await user().click(screen.getByRole('button', { name: 'か' }));
    await user().click(screen.getByRole('button', { name: 'Enter: comprobar' }));
    expect(useProgress.getState().items['kana:か']).toMatchObject({ correct: 1 });
  });
});

describe('listen feedback and distractors', () => {
  it('QA-003: distractors are only known + lesson kana', () => {
    useProgress.getState().unlockKana([...'あいうえお']);
    render(<Listen kana={[kana('あ')]} words={[]} rounds={1} />);
    const options = screen.getAllByRole('button').filter((b) => /^[぀-ゟ]$/.test(b.textContent ?? ''));
    expect(options.length).toBeGreaterThanOrEqual(4);
    for (const o of options) expect('あいうえお').toContain(o.textContent);
  });

  it('single kana: «Kana: a»', async () => {
    useProgress.getState().unlockKana([...'あいうえお']);
    render(<Listen kana={[kana('あ')]} words={[]} rounds={2} />);
    await user().click(screen.getByRole('button', { name: 'あ' }));
    expect(screen.getByText('Kana: a')).toBeInTheDocument();
  });

  it('word: «おなか (onaka) = estómago» for right and wrong answers', async () => {
    useProgress.getState().unlockKana([...'おなかふねいえ']);
    render(<Listen kana={[]} words={[word('onaka'), word('fune')]} rounds={2} />);
    // the spoken word is not shown: find the option buttons
    const buttons = screen.getAllByRole('button').filter((b) => /^(おなか|ふね)$/.test(b.textContent ?? ''));
    expect(buttons).toHaveLength(2);
    const wrong = buttons[0]!;
    await user().click(wrong);
    // random order: the first pick is either wrong ("Sonó ... elegiste") or right (the word line)
    const said = screen.getAllByRole('status').map((s) => s.textContent).join(' ');
    expect(said).toMatch(/Sonó: .* \(.*\) = .* · elegiste|(おなか \(onaka\) = estómago|ふね \(fune\) = barco)/);
    const right = screen.queryAllByRole('button').find((b) => /^(おなか|ふね)$/.test(b.textContent ?? '') && !b.hasAttribute('disabled'));
    if (right && said.includes('Sonó')) await user().click(right);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/(おなか \(onaka\) = estómago|ふね \(fune\) = barco)/);
  });
});

describe('read-words feedback follows the unlock rules (QA-008)', () => {
  it('does not print raw katakana for a word the learner cannot read yet', async () => {
    useProgress.getState().unlockKana([...'あいうえお']);
    render(<ReadWords kana={[]} words={[word('terebi')]} rounds={2} />);
    await user().click(screen.getByRole('button', { name: 'TV' }));
    const status = screen.getAllByRole('status')[0]!;
    expect(status).toHaveTextContent('= TV');
    expect(status.textContent).not.toMatch(/テレビ/);
  });
});
