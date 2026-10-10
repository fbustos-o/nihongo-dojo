import { useState } from 'react';
import { KanaInput } from '../components/KanaInput';
import { SpeakButton } from '../components/SpeakButton';

export function PracticePage() {
  const [typed, setTyped] = useState('');

  return (
    <>
      <h1>Práctica</h1>
      <p className="muted">Los juegos se irán añadiendo en las próximas etapas.</p>
      <section className="card">
        <h2>Prueba de entrada de kana</h2>
        <div className="row">
          <KanaInput aria-label="Escribe en romaji" placeholder="escribe: konnichiwa" onChange={setTyped} />
          <SpeakButton text={typed || 'こんにちは'} />
        </div>
      </section>
    </>
  );
}
