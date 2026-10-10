import { useEffect, useEffectEvent, useRef, type ComponentProps } from 'react';
import { bind, unbind } from 'wanakana';

interface KanaInputProps extends Omit<ComponentProps<'input'>, 'onChange' | 'type' | 'value' | 'defaultValue'> {
  /** Convert typed romaji to hiragana (default) or katakana. */
  mode?: 'hiragana' | 'katakana';
  onChange?: (value: string) => void;
}

/** Uncontrolled text input that turns romaji into kana while typing (wanakana IME mode). */
export function KanaInput({ mode = 'hiragana', onChange, ...rest }: KanaInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const emitChange = useEffectEvent((value: string) => onChange?.(value));

  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    bind(input, { IMEMode: mode === 'katakana' ? 'toKatakana' : true });
    // Native listener (registered after wanakana's, so it sees the converted text):
    // React's onChange is skipped when wanakana rewrites the value programmatically.
    const handleInput = () => emitChange(input.value);
    input.addEventListener('input', handleInput);
    return () => {
      input.removeEventListener('input', handleInput);
      unbind(input);
    };
  }, [mode]);

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      lang="ja"
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
    />
  );
}
