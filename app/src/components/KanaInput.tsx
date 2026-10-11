import { useEffect, useEffectEvent, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { bind, toHiragana, toKatakana, unbind } from 'wanakana';
import { useProgress } from '../state/progressStore';
import { KanaKeyboard } from './KanaKeyboard';
import { backspace, type KanaScript } from './kanaKeyboardLogic';
import styles from './KanaInput.module.css';

export type ResolvedKanaInput = 'teclado' | 'romaji';

/** `auto` means the on-screen keyboard on touch devices (`pointer: coarse`) and the romaji IME elsewhere. */
export function resolveKanaInput(setting: 'auto' | ResolvedKanaInput, coarsePointer: boolean): ResolvedKanaInput {
  return setting === 'auto' ? (coarsePointer ? 'teclado' : 'romaji') : setting;
}

const isCoarse = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

/** The effective kana input mode and a setter that stores an explicit choice in the settings. */
export function useKanaInputMode(): { mode: ResolvedKanaInput; toggle: () => void } {
  const setting = useProgress((s) => s.settings.kanaInput);
  const updateSettings = useProgress((s) => s.updateSettings);
  const mode = resolveKanaInput(setting, isCoarse());
  return { mode, toggle: () => updateSettings({ kanaInput: mode === 'teclado' ? 'romaji' : 'teclado' }) };
}

/** Quick switch between the on-screen kana keyboard and romaji typing (stored in the settings). */
export function KanaModeToggle() {
  const { mode, toggle } = useKanaInputMode();
  const teclado = mode === 'teclado';
  return (
    <button
      type="button"
      className={styles.toggle}
      onMouseDown={(e) => e.preventDefault()}
      onClick={toggle}
      aria-label={teclado ? 'Cambiar a escribir en romaji' : 'Cambiar al teclado de kana'}
      title={teclado ? 'Escribir en romaji' : 'Teclado de kana'}
    >
      <span aria-hidden="true">{teclado ? 'abc' : 'あ'}</span>
    </button>
  );
}

interface KanaInputProps extends Omit<ComponentProps<'input'>, 'onChange' | 'type' | 'value' | 'defaultValue'> {
  /** Convert typed romaji to hiragana (default) or katakana; also the keyboard's starting script. */
  mode?: 'hiragana' | 'katakana';
  onChange?: (value: string) => void;
  /** Hide the quick mode switch (e.g. very tight table cells). */
  noToggle?: boolean;
}

/**
 * Kana text field with two input methods, chosen by `settings.kanaInput`:
 * - teclado: read-only input (`inputMode="none"`, so the system keyboard stays closed) driven by the on-screen
 *   kana keyboard, shown while the field has focus;
 * - romaji: wanakana converts romaji to kana while typing. Conversion is held back during IME composition
 *   (Android Gboard) and done once on `compositionend`.
 * A small button next to the field switches between both (stored in the settings).
 */
export function KanaInput({ mode = 'hiragana', onChange, noToggle, className, ...rest }: KanaInputProps) {
  const { mode: method } = useKanaInputMode();
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  // The on-screen keyboard is driven by the round, not by the input focus: it opens when the field is focused and
  // stays until the explicit hide button (so tapping other controls never closes it or moves the layout).
  const [kbOpen, setKbOpen] = useState(false);
  const [script, setScript] = useState<KanaScript>(mode);
  const handleChange = onChange;
  const emitChange = useEffectEvent((value: string) => onChange?.(value));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Method switched: start clean and keep the focus where the learner is typing.
    setText('');
    emitChange('');
    ref.current?.focus();
  }, [method]);

  useEffect(() => {
    const input = ref.current;
    if (!input || method !== 'romaji') return;
    let composing = false;
    // Registered before wanakana's listener: while composing, nobody downstream sees the input event.
    const guard = (event: Event) => {
      if (composing || (event as InputEvent).isComposing) event.stopImmediatePropagation();
    };
    const start = () => {
      composing = true;
    };
    const end = () => {
      composing = false;
      // Convert now that the composition is committed (wanakana + our change emitter listen to `input`).
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    input.addEventListener('input', guard);
    input.addEventListener('compositionstart', start);
    input.addEventListener('compositionend', end);
    bind(input, { IMEMode: mode === 'katakana' ? 'toKatakana' : true });
    // Native listener (registered after wanakana's, so it sees the converted text):
    // React's onChange is skipped when wanakana rewrites the value programmatically.
    const handleInput = () => emitChange(input.value);
    input.addEventListener('input', handleInput);
    return () => {
      input.removeEventListener('input', guard);
      input.removeEventListener('compositionstart', start);
      input.removeEventListener('compositionend', end);
      input.removeEventListener('input', handleInput);
      unbind(input);
    };
  }, [mode, method]);

  const update = (value: string) => {
    setText(value);
    handleChange?.(value);
  };

  const submit = () => {
    ref.current?.form?.requestSubmit();
  };

  const common = {
    ...rest,
    ref,
    type: 'text' as const,
    lang: 'ja',
    autoCapitalize: 'off' as const,
    autoComplete: 'off',
    autoCorrect: 'off',
    spellCheck: false,
    enterKeyHint: 'done' as const,
    onFocus: () => setKbOpen(true),
    onClick: () => setKbOpen(true),
  };

  const teclado = method === 'teclado';
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!teclado) return;
    if (event.key === 'Backspace') {
      event.preventDefault();
      update(backspace(text));
      return;
    }
    if (event.key === 'Escape') {
      setKbOpen(false);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    // Physical keyboard: romaji is converted (wanakana, `n` stays pending) and direct kana is appended as is.
    if (/^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault();
      const convert = script === 'katakana' ? toKatakana : toHiragana;
      const tail = /[a-zA-Z]*$/.exec(text)![0];
      update(text.slice(0, text.length - tail.length) + convert(tail + event.key.toLowerCase(), { IMEMode: true }));
    } else if (/^[ぁ-ゖァ-ヺー]$/u.test(event.key)) {
      event.preventDefault();
      update(text + event.key);
    }
  };

  return (
    <span className={styles.wrap}>
      {teclado ? (
        <input
          key="teclado"
          {...common}
          className={className}
          readOnly
          inputMode="none"
          value={text}
          onKeyDown={onKeyDown}
          aria-describedby={undefined}
        />
      ) : (
        <input key="romaji" {...common} className={className} inputMode="text" />
      )}
      {!noToggle && <KanaModeToggle />}
      {teclado &&
        kbOpen &&
        createPortal(
          <KanaKeyboard value={text} onChange={update} onSubmit={submit} script={script} onScriptChange={setScript} onHide={() => setKbOpen(false)} />,
          document.body,
        )}
    </span>
  );
}
