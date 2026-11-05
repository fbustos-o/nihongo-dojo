import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useT } from '../i18n';
import { backspace, GYO, toggleDakuten, toggleHandakuten, toggleSmall, toScript, type KanaScript } from './kanaKeyboardLogic';
import styles from './KanaKeyboard.module.css';

interface KanaKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter key: submit the answer. */
  onSubmit?: () => void;
  script?: KanaScript;
  onScriptChange?: (script: KanaScript) => void;
  /** Explicit «hide keyboard» button (the keyboard stays open while the round is active). */
  onHide?: () => void;
}

/** Keeps the focus on the text input: pressing a key must not blur it (which would hide the keyboard). */
const keepFocus = (e: MouseEvent) => e.preventDefault();

interface KeyProps {
  label: string;
  aria: string;
  onClick: () => void;
  className?: string;
  pressed?: boolean;
  disabled?: boolean;
}

function Key({ label, aria, onClick, className = '', pressed, disabled }: KeyProps) {
  return (
    <button
      type="button"
      className={`${styles.key} ${className}`}
      aria-label={aria}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={keepFocus}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/**
 * On-screen kana keyboard (controlled by `value`). Pick a row (gyō) in the first two lines, then the vowel.
 * ゛ ゜ 小 act on the last character; ー, script switch, backspace, clear, space and Enter are one tap.
 * Fixed to the bottom of the viewport (above the safe area) and publishes its height as `--kana-kb-h` on <html>.
 */
export function KanaKeyboard({ value, onChange, onSubmit, script: scriptProp, onScriptChange, onHide }: KanaKeyboardProps) {
  const t = useT();
  const [script, setScript] = useState<KanaScript>(scriptProp ?? 'hiragana');
  const [gyo, setGyo] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const current = scriptProp ?? script;

  useEffect(() => {
    const root = ref.current;
    const html = document.documentElement;
    if (!root) return;
    const publish = () => html.style.setProperty('--kana-kb-h', `${root.offsetHeight}px`);
    publish();
    html.dataset.kanaKb = 'open';
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null;
    ro?.observe(root);
    return () => {
      ro?.disconnect();
      delete html.dataset.kanaKb;
      html.style.removeProperty('--kana-kb-h');
    };
  }, []);

  const as = (char: string) => toScript(char, current);
  const switchScript = () => {
    const next: KanaScript = current === 'hiragana' ? 'katakana' : 'hiragana';
    setScript(next);
    onScriptChange?.(next);
  };

  return (
    <div ref={ref} className={styles.root} role="group" aria-label={t('games.kbName')} lang="ja">
      {GYO.map((g, i) => (
        <Key key={g.label} label={as(g.label)} aria={t('games.kbRow', { row: as(g.label) })} onClick={() => setGyo(i)} className={styles.row} pressed={gyo === i} />
      ))}
      {GYO[gyo]!.kana.map((k, i) =>
        k ? (
          <Key key={`${gyo}-${i}`} label={as(k)} aria={as(k)} onClick={() => onChange(value + as(k))} />
        ) : (
          <span key={`${gyo}-${i}`} className={`${styles.key} ${styles.empty}`} aria-hidden="true" />
        ),
      )}
      <Key label="゛" aria={t('games.kbDakuten')} onClick={() => onChange(toggleDakuten(value))} className={styles.tool} />
      <Key label="゜" aria={t('games.kbHandakuten')} onClick={() => onChange(toggleHandakuten(value))} className={styles.tool} />
      <Key label="小" aria={t('games.kbSmall')} onClick={() => onChange(toggleSmall(value))} className={styles.tool} />
      <Key label="ー" aria={t('games.kbLong')} onClick={() => onChange(value + 'ー')} className={styles.tool} />
      <Key
        label={current === 'hiragana' ? 'ア' : 'あ'}
        aria={t(current === 'hiragana' ? 'games.kbToKata' : 'games.kbToHira')}
        onClick={switchScript}
        className={styles.tool}
      />
      <Key label="⌫" aria={t('games.kbBackspace')} onClick={() => onChange(backspace(value))} className={styles.tool} />
      <Key label="✕" aria={t('games.kbClear')} onClick={() => onChange('')} className={styles.tool} disabled={value === ''} />
      <Key label="␣" aria={t('games.kbSpace')} onClick={() => onChange(value + ' ')} className={styles.tool} />
      {onHide && (
        <button type="button" className={styles.hide} aria-label={t('games.kbHide')} onMouseDown={keepFocus} onClick={onHide}>
          <span aria-hidden="true">⌄</span>
        </button>
      )}
      <Key label={`${t('common.check')} ⏎`} aria={t('games.kbEnter')} onClick={() => onSubmit?.()} className={`${styles.wide} ${styles.enter} ${styles.tool}`} />
    </div>
  );
}
