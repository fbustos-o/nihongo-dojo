import { useEffect, useId, useRef, useState } from 'react';
import { GURU_STAGE, stageName } from '../engine/srs';
import { useT } from '../i18n';
import { stageHelpRows } from '../review/memoryLogic';
import styles from './memory.module.css';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** "(?)" button that opens an accessible dialog explaining the SRS stages. */
export function SrsHelp() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const rows = stageHelpRows();
  return (
    <>
      <button ref={triggerRef} type="button" className={styles.helpBtn} aria-haspopup="dialog" aria-label={t('memory.help.aria')} onClick={() => setOpen(true)}>
        <span aria-hidden="true">?</span>
      </button>
      {open && (
        <div className={styles.backdrop} onClick={close}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={styles.dialog} onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
            <h2 id={titleId}>{t('memory.help.title')}</h2>
            <p>{t('memory.help.intro')}</p>
            <table className={styles.helpTable}>
              <caption className={styles.srOnly}>{t('memory.help.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('memory.help.colStage')}</th>
                  <th scope="col">{t('memory.help.colNext')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.stage}>
                    <th scope="row">{r.name}</th>
                    <td>{r.interval ? t('memory.help.after', { interval: r.interval }) : t('memory.help.neverAgain')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>{t('memory.help.rightTitle')}</h3>
            <p>{t('memory.help.rightBody')}</p>
            <h3>{t('memory.help.wrongTitle')}</h3>
            <p>{t('memory.help.wrongBody', { guru: stageName(GURU_STAGE), first: stageName(1) })}</p>
            <h3>{t('memory.help.furiganaTitle')}</h3>
            <p>{t('memory.help.furiganaBody', { guru: stageName(GURU_STAGE) })}</p>
            <button type="button" className="btn btn-primary" onClick={close}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
