import { typingHints } from '../kanaUtils';
import styles from './games.module.css';

/**
 * IME spelling help for text the learner has to TYPE: katakana such as ティ / ディ / ウォ are not produced by
 * their usual romaji (`ti` gives チ), so the keys to press are shown inline ("ティ → «thi»").
 * Renders nothing when the text needs no help.
 */
export function TypingHint({ text }: { text: string }) {
  const hints = typingHints(text);
  if (hints.length === 0) return null;
  return (
    <div className={styles.hint} data-testid="typing-hint">
      Para escribirlo: {hints.map((h) => `${h.char} → «${h.typing}»`).join(' · ')}
    </div>
  );
}
