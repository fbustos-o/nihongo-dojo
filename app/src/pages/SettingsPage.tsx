import { useRef, useState } from 'react';
import { SpeakButton } from '../components/SpeakButton';
import { FuriganaModeSchema, ThemeSchema, type Theme } from '../state/progressSchema';
import { downloadProgress } from '../state/download';
import { useProgress } from '../state/progressStore';

const FURIGANA_LABELS: Record<(typeof FuriganaModeSchema.options)[number], string> = {
  auto: 'Automático (se quita al llegar a Guru)',
  siempre: 'Siempre',
  nunca: 'Nunca',
};

const THEME_LABELS: Record<Theme, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
};

export function SettingsPage() {
  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);
  const importProgress = useProgress((s) => s.importProgress);
  const resetProgress = useProgress((s) => s.resetProgress);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleImport = async (file: File) => {
    const error = importProgress(await file.text());
    setMessage(error ? { text: error, error: true } : { text: 'Progreso importado correctamente.', error: false });
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <>
      <h1>Ajustes</h1>

      <section className="card">
        <h2>Lectura</h2>
        <label className="row">
          <input
            type="checkbox"
            checked={settings.showRomaji}
            onChange={(e) => updateSettings({ showRomaji: e.target.checked })}
          />
          Mostrar romaji como ayuda
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => updateSettings({ sound: e.target.checked })}
          />
          Efectos de sonido en los juegos
        </label>
        <label className="row">
          Furigana sobre los kanji:
          <select
            aria-label="Furigana"
            value={settings.furigana}
            onChange={(e) => updateSettings({ furigana: FuriganaModeSchema.parse(e.target.value) })}
          >
            {FuriganaModeSchema.options.map((mode) => (
              <option key={mode} value={mode}>
                {FURIGANA_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Voz</h2>
        <div className="row">
          <label className="row">
            Velocidad: {settings.ttsRate.toFixed(1)}×
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.1}
              value={settings.ttsRate}
              onChange={(e) => updateSettings({ ttsRate: Number(e.target.value) })}
            />
          </label>
          <SpeakButton text="こんにちは。日本語を勉強しましょう。" label="Probar voz" />
        </div>
      </section>

      <section className="card">
        <h2>Tema</h2>
        <select
          aria-label="Tema"
          value={settings.theme}
          onChange={(e) => updateSettings({ theme: ThemeSchema.parse(e.target.value) })}
        >
          {ThemeSchema.options.map((theme) => (
            <option key={theme} value={theme}>
              {THEME_LABELS[theme]}
            </option>
          ))}
        </select>
      </section>

      <section className="card">
        <h2>Progreso</h2>
        <p className="muted">Se guarda solo en este navegador. Exporta una copia para respaldarlo o moverlo.</p>
        <div className="row">
          <button type="button" className="btn" onClick={downloadProgress}>
            Exportar progreso
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            Importar progreso
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="import-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
        </div>
        {message && (
          <p role="status" style={{ color: message.error ? 'var(--danger)' : 'var(--ok)' }}>
            {message.text}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Zona peligrosa</h2>
        {confirmingReset ? (
          <div role="alertdialog" aria-label="Confirmar reinicio">
            <p>¿Seguro? Se borrará todo tu progreso y no se puede deshacer.</p>
            <div className="row">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  resetProgress();
                  setConfirmingReset(false);
                  setMessage({ text: 'Progreso reiniciado.', error: false });
                }}
              >
                Sí, borrar todo
              </button>
              <button type="button" className="btn" onClick={() => setConfirmingReset(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmingReset(true)}>
            Reiniciar progreso
          </button>
        )}
      </section>
    </>
  );
}
