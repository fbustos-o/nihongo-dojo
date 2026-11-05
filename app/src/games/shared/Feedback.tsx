import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import styles from './games.module.css';

export type FeedbackTone = 'ok' | 'bad' | 'near';

const ICON: Record<FeedbackTone, IconName> = { ok: 'check', bad: 'x', near: 'alert' };

export interface FeedbackMessage {
  tone: FeedbackTone;
  text: string;
  /** Rich content shown instead of `text` (e.g. kana through JaText); `text` stays the plain fallback. */
  node?: ReactNode;
  /** Changes with every new message so the animation replays. */
  id: number;
}

/** Result banner: colour + icon + text (never colour alone), announced politely to screen readers. */
export function Feedback({ message }: { message: FeedbackMessage | null }) {
  return (
    <div role="status" aria-live="polite" className={styles.feedbackSlot}>
      {message && (
        <p key={message.id} className={`${styles.feedback} ${styles[message.tone]}`}>
          <span aria-hidden="true" className={styles.icon}>
            <Icon name={ICON[message.tone]} size={18} strokeWidth={3} />
          </span>
          <span>{message.node ?? message.text}</span>
        </p>
      )}
    </div>
  );
}
