import { useDeferredValue, useMemo, useState } from 'react';
import { JaText } from '../components/JaText';
import { SpeakButton } from '../components/SpeakButton';
import { content } from '../domain/contentLoader';
import { glosses } from '../domain/glosses';
import type { Word } from '../domain/schema';
import { useMeaningLang, useT } from '../i18n';
import { itemKey } from '../state/progressSchema';
import { useProgress } from '../state/progressStore';
import { coreKnown, defaultFilters, filterVocab, isKnownStage, RANK_RANGES, statusOfStage, VOCAB_STATUSES, type VocabFilters } from './vocabLogic';
import styles from './vocab.module.css';

const PAGE_SIZE = 50;
const SOURCES = ['genki', 'profesor', 'propio', 'core1000'] as const;

/** Page at /vocabulario: every Core 1000 word (and the rest of the vocabulary) with search, filters, audio and «Ya la sé». */
export function VocabPage({ vocab = content.vocab }: { vocab?: readonly Word[] }) {
  const t = useT();
  const lang = useMeaningLang();
  const items = useProgress((s) => s.items);
  const showRomaji = useProgress((s) => s.settings.showRomaji);
  const [filters, setFilters] = useState<VocabFilters>(defaultFilters);
  const [shown, setShown] = useState(PAGE_SIZE);
  const set = (patch: Partial<VocabFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setShown(PAGE_SIZE);
  };

  const { known, total } = useMemo(() => coreKnown(vocab, items), [vocab, items]);
  // the input stays responsive on slow phones: the 1343-word filter runs on a deferred copy (QA-115)
  const deferred = useDeferredValue(filters);
  const list = useMemo(() => filterVocab(vocab, items, deferred, lang), [vocab, items, deferred, lang]);

  return (
    <>
      <h1>{t('vocab.title')}</h1>

      <section className="card" aria-labelledby="vocab-known">
        <p id="vocab-known" data-testid="vocab-known">
          {t('vocab.known', { n: known, total })}
        </p>
        <div className={styles.bar} role="progressbar" aria-label={t('vocab.knownBar')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={known}>
          <div className={styles.barFill} style={{ width: total ? `${(known / total) * 100}%` : '0%' }} />
        </div>
      </section>

      <div className={styles.tabs} role="group" aria-label={t('vocab.tabs')}>
        <button type="button" className={`btn ${filters.coreOnly ? 'btn-primary' : ''}`} aria-pressed={filters.coreOnly} onClick={() => set({ coreOnly: true })}>
          {t('vocab.tab.core')}
        </button>
        <button type="button" className={`btn ${!filters.coreOnly ? 'btn-primary' : ''}`} aria-pressed={!filters.coreOnly} onClick={() => set({ coreOnly: false })}>
          {t('vocab.tab.all')}
        </button>
      </div>

      <div className={styles.filters}>
        <label className={styles.field}>
          <span>{t('vocab.search')}</span>
          <input type="search" value={filters.query} placeholder={t('vocab.searchPlaceholder')} onChange={(e) => set({ query: e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>{t('vocab.range')}</span>
          <select value={filters.range} onChange={(e) => set({ range: e.target.value })}>
            <option value="">{t('vocab.range.all')}</option>
            {RANK_RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.from}–{r.to}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('vocab.status')}</span>
          <select value={filters.status} onChange={(e) => set({ status: e.target.value as VocabFilters['status'] })}>
            <option value="">{t('vocab.status.all')}</option>
            {VOCAB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`vocab.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('vocab.source')}</span>
          <select value={filters.source} onChange={(e) => set({ source: e.target.value as VocabFilters['source'] })}>
            <option value="">{t('vocab.source.all')}</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`vocab.source.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="muted" role="status" data-testid="vocab-count">
        {t('vocab.count', { n: list.length })}
      </p>

      {list.length === 0 ? (
        <p className="card muted">{t('vocab.empty')}</p>
      ) : (
        <ul className={styles.list} aria-label={t('vocab.list')} data-testid="vocab-list">
          {list.slice(0, shown).map((w) => {
            const stage = items[itemKey('word', w.id)]?.srsStage ?? 0;
            return (
              <VocabRow key={w.id} word={w} stage={stage} lang={lang} showRomaji={showRomaji} />
            );
          })}
        </ul>
      )}
      {list.length > shown && (
        <button type="button" className={`btn ${styles.more}`} onClick={() => setShown((n) => n + PAGE_SIZE)}>
          {t('vocab.more')}
        </button>
      )}
    </>
  );
}

function VocabRow({ word, stage, lang, showRomaji }: { word: Word; stage: number; lang: 'es' | 'en'; showRomaji: boolean }) {
  const t = useT();
  const known = isKnownStage(stage);
  return (
    <li className={styles.row} data-testid="vocab-row">
      <div className={styles.main}>
        <span className={styles.word}>
          <JaText word={word} />
        </span>
        <span className={styles.meaning}>{glosses(word, lang).join('; ')}</span>
        <span className={`muted ${styles.sub}`}>
          {showRomaji && <span>{word.romaji}</span>}
          {word.written && (
            <span>
              {t('vocab.writtenAs')} <span lang="ja">{word.written}</span>
            </span>
          )}
          {word.rank !== undefined && <span className={styles.badge}>{t('vocab.core', { rank: word.rank })}</span>}
          <span className={styles.status}>{t(`vocab.status.${statusOfStage(stage)}`)}</span>
        </span>
      </div>
      <div className={styles.actions}>
        <SpeakButton text={word.kana} label={t('common.listen')} />
        <button
          type="button"
          className={`btn ${known ? 'btn-primary' : ''}`}
          aria-pressed={known}
          aria-label={t('vocab.knowToggleLabel', { word: word.kana })}
          onClick={() => {
            const { markKnown, unmarkKnown } = useProgress.getState();
            if (known) unmarkKnown('word', word.id);
            else markKnown('word', word.id, word.kana);
          }}
        >
          {known ? '✓ ' : ''}
          {t('vocab.knowToggle')}
        </button>
      </div>
    </li>
  );
}
