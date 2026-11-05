import { useT } from '../i18n';

export function AboutPage() {
  const t = useT();
  return (
    <>
      <h1>
        {t('about.title')} <span lang="ja">日本語道場</span>
      </h1>
      <section className="card">
        <p>{t('about.intro')}</p>
      </section>
      <section className="card">
        <h2>{t('about.attributions')}</h2>
        <ul>
          <li>
            {t('about.jmdictPre')}<a href="https://www.edrdg.org/jmdict/j_jmdict.html">JMdict</a>
            {t('about.jmdictPost')}
          </li>
          <li>
            {t('about.kanaPre')}<a href="https://github.com/vedxyz/kana">vedxyz/kana</a>{t('about.kanaPost')}
          </li>
          <li>{t('about.wanakana')}</li>
          <li>{t('about.genki')}</li>
          <li>{t('about.font')}</li>
        </ul>
      </section>
    </>
  );
}
