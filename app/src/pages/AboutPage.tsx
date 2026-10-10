export function AboutPage() {
  return (
    <>
      <h1>
        Acerca de <span lang="ja">日本語道場</span>
      </h1>
      <section className="card">
        <p>Nihongo Dojo es una aplicación personal para aprender japonés paso a paso, de hiragana a kanji.</p>
      </section>
      <section className="card">
        <h2>Atribuciones</h2>
        <ul>
          <li>
            Datos de vocabulario y kanji derivados de <a href="https://www.edrdg.org/jmdict/j_jmdict.html">JMdict</a>{' '}
            (EDRDG), bajo licencia CC BY-SA 4.0.
          </li>
          <li>
            Ideas y datos de kana de <a href="https://github.com/vedxyz/kana">vedxyz/kana</a> (licencia MIT).
          </li>
          <li>Conversión romaji/kana: WanaKana (MIT).</li>
          <li>Genki (3.ª ed.) se usa únicamente como referencia personal de estudio.</li>
          <li>Tipografía: Noto Sans JP (SIL Open Font License).</li>
        </ul>
      </section>
    </>
  );
}
