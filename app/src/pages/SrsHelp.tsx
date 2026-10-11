import { useEffect, useId, useRef, useState } from 'react';
import { GURU_STAGE, stageName } from '../engine/srs';
import { stageHelpRows } from '../review/memoryLogic';
import styles from './memory.module.css';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** "(?)" button that opens an accessible dialog explaining the SRS stages. */
export function SrsHelp() {
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
      <button ref={triggerRef} type="button" className={styles.helpBtn} aria-haspopup="dialog" aria-label="Ayuda: cómo funciona la memoria" onClick={() => setOpen(true)}>
        <span aria-hidden="true">?</span>
      </button>
      {open && (
        <div className={styles.backdrop} onClick={close}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={styles.dialog} onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
            <h2 id={titleId}>Cómo funciona tu memoria</h2>
            <p>Cada ítem sube o baja por etapas. Cuanto más alta la etapa, más tiempo pasa hasta que vuelve a tocarte repasarlo.</p>
            <table className={styles.helpTable}>
              <caption className={styles.srOnly}>Etapas y tiempo hasta el siguiente repaso</caption>
              <thead>
                <tr>
                  <th scope="col">Etapa</th>
                  <th scope="col">Siguiente repaso</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.stage}>
                    <th scope="row">{r.name}</th>
                    <td>{r.interval ? `a los ${r.interval}` : 'ya no se repasa'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Si aciertas</h3>
            <p>El ítem sube una etapa y el siguiente repaso se programa con el intervalo de la tabla. Solo cuenta cuando el ítem está pendiente de repaso: practicar antes (en una lección o en la práctica libre) no lo sube ni lo baja.</p>
            <h3>Si fallas</h3>
            <p>
              El ítem baja una etapa por cada dos errores en el repaso (redondeando hacia arriba) y el doble si ya estaba en {stageName(GURU_STAGE)} o más. Nunca baja de {stageName(1)}. Un ítem nuevo que
              fallas se queda en Nuevo y vuelve a salir enseguida. Aunque no toque repasar, un error sigue contando: el ítem sale con más frecuencia en los juegos.
            </p>
            <h3>Furigana</h3>
            <p>Desde {stageName(GURU_STAGE)} se considera que ya conoces el kanji y deja de mostrarse su furigana (con el ajuste automático).</p>
            <button type="button" className="btn btn-primary" onClick={close}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
