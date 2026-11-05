import { useRef, useState } from 'react';
import { SpeakButton } from '../components/SpeakButton';
import { useSpeech } from '../hooks/useSpeech';
import { useT } from '../i18n';
import { FuriganaModeSchema, KanaInputModeSchema, LangSchema, ThemeSchema, type Lang } from '../state/progressSchema';
import { downloadProgress } from '../state/download';
import { useProgress } from '../state/progressStore';

const LANGS: readonly Lang[] = LangSchema.options;

export function SettingsPage() {
  const t = useT();
  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);
  const importProgress = useProgress((s) => s.importProgress);
  const resetProgress = useProgress((s) => s.resetProgress);
  const { available: hasVoice } = useSpeech();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  // free-typing buffer of the daily goal (so the field can be emptied while editing); committed when it is a valid 0-100 number
  const [newWordsText, setNewWordsText] = useState<string | null>(null);

  const handleImport = async (file: File) => {
    const error = importProgress(await file.text());
    setMessage(error ? { text: error, error: true } : { text: t('settings.imported'), error: false });
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <>
      <h1>{t('settings.title')}</h1>

      <section className="card">
        <h2>{t('settings.language')}</h2>
        <label className="row">
          {t('settings.uiLang')}
          <select aria-label={t('settings.uiLangAria')} value={settings.uiLang} onChange={(e) => updateSettings({ uiLang: LangSchema.parse(e.target.value) })}>
            {LANGS.map((lang) => (
              <option key={lang} value={lang}>
                {t(`lang.${lang}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="row">
          {t('settings.meaningLang')}
          <select aria-label={t('settings.meaningLangAria')} value={settings.meaningLang} onChange={(e) => updateSettings({ meaningLang: LangSchema.parse(e.target.value) })}>
            {LANGS.map((lang) => (
              <option key={lang} value={lang}>
                {t(`lang.${lang}`)}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">{t('settings.meaningLangNote')}</p>
        <label className="row">
          {t('settings.newWords')}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            aria-label={t('settings.newWordsAria')}
            value={newWordsText ?? String(settings.newWordsPerDay)}
            onChange={(e) => {
              setNewWordsText(e.target.value);
              const n = Math.round(Number(e.target.value));
              if (e.target.value.trim() !== '' && Number.isFinite(n)) updateSettings({ newWordsPerDay: Math.min(100, Math.max(0, n)) });
            }}
            onBlur={() => setNewWordsText(null)}
            style={{ width: '5rem' }}
          />
        </label>
        <p className="muted">{t('settings.newWordsNote')}</p>
      </section>

      <section className="card">
        <h2>{t('settings.reading')}</h2>
        <label className="row">
          <input
            type="checkbox"
            checked={settings.showRomaji}
            onChange={(e) => updateSettings({ showRomaji: e.target.checked })}
          />
          {t('settings.showRomaji')}
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => updateSettings({ sound: e.target.checked })}
          />
          {t('settings.sound')}
        </label>
        <label className="row">
          {t('settings.furigana')}
          <select
            aria-label={t('settings.furiganaAria')}
            value={settings.furigana}
            onChange={(e) => updateSettings({ furigana: FuriganaModeSchema.parse(e.target.value) })}
          >
            {FuriganaModeSchema.options.map((mode) => (
              <option key={mode} value={mode}>
                {t(`settings.furigana.${mode}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="row">
          {t('settings.kanaInput')}
          <select
            aria-label={t('settings.kanaInputAria')}
            value={settings.kanaInput}
            onChange={(e) => updateSettings({ kanaInput: KanaInputModeSchema.parse(e.target.value) })}
          >
            {KanaInputModeSchema.options.map((mode) => (
              <option key={mode} value={mode}>
                {t(`settings.kanaInput.${mode}`)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>{t('settings.voice')}</h2>
        <div className="row">
          <label className="row">
            {t('settings.speed', { rate: settings.ttsRate.toFixed(1) })}
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.1}
              value={settings.ttsRate}
              onChange={(e) => updateSettings({ ttsRate: Number(e.target.value) })}
            />
          </label>
          <SpeakButton text="こんにちは。日本語を勉強しましょう。" label={t('settings.tryVoice')} />
        </div>
        {!hasVoice && (
          <p className="muted" role="note" data-testid="no-voice">
            {t('settings.noVoice')}
          </p>
        )}
      </section>

      <section className="card">
        <h2>{t('settings.theme')}</h2>
        <select
          aria-label={t('settings.theme')}
          value={settings.theme}
          onChange={(e) => updateSettings({ theme: ThemeSchema.parse(e.target.value) })}
        >
          {ThemeSchema.options.map((theme) => (
            <option key={theme} value={theme}>
              {t(`settings.theme.${theme}`)}
            </option>
          ))}
        </select>
      </section>

      <section className="card">
        <h2>{t('settings.progress')}</h2>
        <p className="muted">{t('settings.progressNote')}</p>
        <div className="row">
          <button type="button" className="btn" onClick={downloadProgress}>
            {t('settings.export')}
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            {t('settings.import')}
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
        <h2>{t('settings.danger')}</h2>
        {confirmingReset ? (
          <div role="alertdialog" aria-label={t('settings.confirmAria')}>
            <p>{t('settings.confirmText')}</p>
            <div className="row">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  resetProgress();
                  setConfirmingReset(false);
                  setMessage({ text: t('settings.resetDone'), error: false });
                }}
              >
                {t('settings.confirmYes')}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmingReset(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmingReset(true)}>
            {t('settings.reset')}
          </button>
        )}
      </section>
    </>
  );
}
