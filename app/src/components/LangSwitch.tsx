import { useProgress } from '../state/progressStore';
import { LangSchema, type Lang } from '../state/progressSchema';
import { useT, useLang } from '../i18n';
import styles from './LangSwitch.module.css';

const LANGS: readonly Lang[] = LangSchema.options;

/** Classic flags drawn inline (emoji flags render as letters on Windows). */
function Flag({ lang }: { lang: Lang }) {
  if (lang === 'es') {
    return (
      <svg className={styles.flag} viewBox="0 0 3 2" aria-hidden="true" focusable="false">
        <rect width="3" height="2" fill="#c60b1e" />
        <rect y="0.5" width="3" height="1" fill="#ffc400" />
      </svg>
    );
  }
  return (
    <svg className={styles.flag} viewBox="0 0 60 30" aria-hidden="true" focusable="false">
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0L60 30M60 0L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0L60 30M60 0L0 30" stroke="#c8102e" strokeWidth="2" />
      <path d="M30 0V30M0 15H60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0V30M0 15H60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}

/**
 * Quick language toggle (flags + ES/EN) shown in the app shell. It sets both the interface and the meanings
 * language at once; Ajustes keeps the two independent controls for finer choices.
 */
export function LangSwitch() {
  const t = useT();
  const current = useLang();
  const updateSettings = useProgress((s) => s.updateSettings);
  return (
    <div className={styles.group} role="group" aria-label={t('layout.lang')} data-testid="lang-switch">
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          className={lang === current ? `${styles.option} ${styles.current}` : styles.option}
          aria-pressed={lang === current}
          aria-label={t(`lang.${lang}`)}
          title={t(`lang.${lang}`)}
          onClick={() => updateSettings({ uiLang: lang, meaningLang: lang })}
        >
          <Flag lang={lang} />
          <span className={styles.code} aria-hidden="true">
            {lang.toUpperCase()}
          </span>
        </button>
      ))}
    </div>
  );
}
