import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KanaInput, resolveKanaInput } from './KanaInput';
import { SettingsSchema } from '../state/progressSchema';
import { useProgress } from '../state/progressStore';

beforeEach(() => {
  useProgress.getState().resetProgress();
});

function Harness({ onSubmit = () => undefined, mode = 'hiragana' as const }: { onSubmit?: (v: string) => void; mode?: 'hiragana' | 'katakana' }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <KanaInput aria-label="kana" mode={mode} onChange={setValue} />
      <output data-testid="out">{value}</output>
      <button type="submit">Comprobar</button>
    </form>
  );
}

describe('resolveKanaInput', () => {
  it('auto picks the keyboard on touch devices only', () => {
    expect(resolveKanaInput('auto', true)).toBe('teclado');
    expect(resolveKanaInput('auto', false)).toBe('romaji');
    expect(resolveKanaInput('romaji', true)).toBe('romaji');
    expect(resolveKanaInput('teclado', false)).toBe('teclado');
  });

  it('old saves without the setting still parse with the default', () => {
    expect(SettingsSchema.parse({ showRomaji: true, ttsRate: 0.9, theme: 'system' }).kanaInput).toBe('auto');
  });
});

describe('KanaInput mobile attributes', () => {
  it('turns off autocorrect and friends and sets lang', () => {
    render(<Harness />);
    const input = screen.getByLabelText('kana');
    expect(input).toHaveAttribute('autocapitalize', 'none');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
    expect(input).toHaveAttribute('enterkeyhint', 'done');
    expect(input).toHaveAttribute('lang', 'ja');
  });
});

describe('KanaInput romaji mode: IME composition', () => {
  it('does not convert mid-composition and converts on compositionend', () => {
    const onChange = vi.fn();
    render(<KanaInput aria-label="kana" onChange={onChange} />);
    const input = screen.getByLabelText<HTMLInputElement>('kana');
    fireEvent.compositionStart(input);
    input.value = 'ka';
    fireEvent.input(input);
    expect(input.value).toBe('ka');
    expect(onChange).not.toHaveBeenCalled();
    input.value = 'kan';
    fireEvent.input(input);
    expect(input.value).toBe('kan');
    fireEvent.compositionEnd(input);
    expect(input.value).toBe('かn');
    expect(onChange).toHaveBeenLastCalledWith('かn');
  });

  it('still converts live outside composition', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('kana'), 'nihon');
    expect(screen.getByTestId('out')).toHaveTextContent('にほn');
  });
});

describe('KanaInput on-screen keyboard mode', () => {
  beforeEach(() => {
    useProgress.getState().updateSettings({ kanaInput: 'teclado' });
  });

  it('is read-only with inputMode none and shows the keyboard on focus', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('kana');
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('inputmode', 'none');
    expect(screen.queryByRole('group', { name: 'Teclado de kana' })).toBeNull();
    await userEvent.click(input);
    expect(screen.getByRole('group', { name: 'Teclado de kana' })).toBeInTheDocument();
  });

  it('types with the keys: row, vowel, dakuten, small, long vowel, backspace and submit', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.click(screen.getByLabelText('kana'));
    const press = (name: string) => userEvent.click(screen.getByRole('button', { name }));
    await press('Fila か');
    await press('か');
    await press('Dakuten (゛) en el último kana');
    expect(screen.getByTestId('out')).toHaveTextContent('が');
    await press('Fila た');
    await press('つ');
    await press('Kana pequeño (ゃゅょっぁ) en el último');
    await press('Alargamiento ー');
    expect(screen.getByTestId('out')).toHaveTextContent('がっー');
    await press('Borrar último carácter');
    expect(screen.getByTestId('out')).toHaveTextContent('がっ');
    await press('Enter: comprobar');
    expect(onSubmit).toHaveBeenCalledWith('がっ');
  });

  it('switches to katakana and clears', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText('kana'));
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar a katakana' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fila カ' }));
    await userEvent.click(screen.getByRole('button', { name: 'カ' }));
    expect(screen.getByTestId('out')).toHaveTextContent('カ');
    await userEvent.click(screen.getByRole('button', { name: 'Borrar todo' }));
    expect(screen.getByTestId('out')).toBeEmptyDOMElement();
  });

  it('starts in katakana for mode katakana and the quick toggle flips the setting', async () => {
    render(<Harness mode="katakana" />);
    await userEvent.click(screen.getByLabelText('kana'));
    expect(screen.getByRole('button', { name: 'Cambiar a hiragana' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar a escribir en romaji' }));
    expect(useProgress.getState().settings.kanaInput).toBe('romaji');
    expect(screen.getByLabelText('kana')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('kana')).toHaveFocus();
  });

  it('every key is a labelled button of at least 40 px (min-height in CSS) and the grid has 5 columns', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText('kana'));
    const group = screen.getByRole('group', { name: 'Teclado de kana' });
    for (const b of group.querySelectorAll('button')) expect(b).toHaveAccessibleName();
    // 10 row keys + 5 vowels + 5 tools + 4 bottom keys + the hide tab
    expect(group.querySelectorAll('button').length).toBe(10 + 5 + 5 + 4 + 1);
  });

  it('QA-035: the keyboard stays open when another control is tapped (first tap works, no layout change)', async () => {
    const onOther = vi.fn();
    render(
      <>
        <Harness />
        <button type="button" onClick={onOther}>
          Escuchar otra vez
        </button>
      </>,
    );
    await userEvent.click(screen.getByLabelText('kana'));
    expect(document.documentElement.dataset.kanaKb).toBe('open');
    // pointerdown blurs the input; the keyboard must not unmount, and the click must land
    await userEvent.click(screen.getByRole('button', { name: 'Escuchar otra vez' }));
    expect(onOther).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('kana')).not.toHaveFocus();
    expect(screen.getByRole('group', { name: 'Teclado de kana' })).toBeInTheDocument();
    expect(document.documentElement.dataset.kanaKb).toBe('open');
  });

  it('the hide button closes the keyboard and tapping the field reopens it', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('kana');
    await userEvent.click(input);
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar teclado' }));
    expect(screen.queryByRole('group', { name: 'Teclado de kana' })).toBeNull();
    await userEvent.click(input);
    expect(screen.getByRole('group', { name: 'Teclado de kana' })).toBeInTheDocument();
  });

  it('QA-040: a physical keyboard types romaji (converted) and direct kana', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('kana');
    await userEvent.click(input);
    await userEvent.keyboard('kyonn');
    expect(screen.getByTestId('out')).toHaveTextContent('きょん');
    await userEvent.keyboard('{Backspace}あ');
    expect(screen.getByTestId('out')).toHaveTextContent('きょあ');
  });

  it('QA-040: katakana script converts physical romaji to katakana', async () => {
    render(<Harness mode="katakana" />);
    await userEvent.click(screen.getByLabelText('kana'));
    await userEvent.keyboard('ka');
    expect(screen.getByTestId('out')).toHaveTextContent('カ');
  });
});
