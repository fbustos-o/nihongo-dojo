import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { content } from '../domain/contentLoader';
import { useProgress } from '../state/progressStore';

const user = () => userEvent.setup({ delay: null });
const renderAt = async (path: string) => {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  // pages are lazy chunks: wait for the Suspense fallback to go away
  await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
  return result;
};
const settle = () => waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
const kanaByRomaji = (r: string) => content.kana.find((k) => k.romaji === r || k.alt?.includes(r))!;

beforeEach(() => useProgress.getState().resetProgress());

describe('Camino', () => {
  it('shows the four stages with progress and lesson states', async () => {
    await renderAt('/camino');
    for (const name of ['1. Hiragana', '2. Gramática en hiragana', '3. Katakana', '4. Kanji']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    const first = screen.getByRole('link', { name: /Hiragana: あ/ });
    expect(first).toHaveAttribute('href', '/leccion/h-a');
    expect(within(first).getByText('Siguiente lección')).toBeInTheDocument();
    expect(screen.getAllByText('Bloqueada').length).toBeGreaterThan(10);
    expect(screen.getByRole('progressbar', { name: 'Progreso de Hiragana' })).toHaveAttribute('aria-valuenow', '0');
  });

  it('reflects completed lessons', async () => {
    useProgress.getState().completeLesson('h-a');
    await renderAt('/camino');
    expect(screen.getByRole('progressbar', { name: 'Progreso de Hiragana' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /fila か/ })).toBeInTheDocument();
  });
});

describe('LessonRunner', () => {
  it('blocks a locked lesson and reports a missing one', async () => {
    const { unmount } = await renderAt('/leccion/h-ka');
    expect(screen.getByText(/bloqueada/)).toBeInTheDocument();
    unmount();
    await renderAt('/leccion/nope');
    expect(screen.getByText('Lección no encontrada')).toBeInTheDocument();
  });

  it('intro shows the new kana with romaji, audio and the row chart', async () => {
    await renderAt('/leccion/h-a');
    expect(screen.getByRole('heading', { name: 'Kana nuevos' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Oír/ })).toHaveLength(5);
    const chart = screen.getByRole('group', { name: 'Tabla de filas' });
    expect(chart).toHaveTextContent('あいうえお');
    expect(screen.getByRole('button', { name: 'Empezar práctica' })).toBeInTheDocument();
  });

  /** Plays whatever game is on screen, answering correctly (or wrongly when `fail`). */
  async function playLesson(fail: boolean, lessonId: string, maxSteps = 400) {
    const u = user();
    const lesson = content.curriculum.find((l) => l.id === lessonId)!;
    await u.click(screen.getByRole('button', { name: 'Empezar práctica' }));
    for (let step = 0; step < maxSteps; step++) {
      await settle();
      if (screen.queryByRole('heading', { name: /Lección completada|Casi lo logras/ })) return;
      const game = screen.getByText(/^Juego \d+ de \d+:/).textContent!;
      if (game.includes('Reconocer kana')) {
        const target = screen.getByTestId('prompt').textContent!;
        const romaji = content.kana.find((k) => k.char === target)!.romaji;
        const input = screen.queryByLabelText('Romaji');
        if (input) {
          await u.type(input, `${fail ? 'zzz' : romaji}{Enter}`);
          if (fail) await u.type(screen.getByLabelText('Romaji'), `${romaji}{Enter}`);
        } else {
          if (fail) {
            const wrong = screen.getAllByRole('button').find((x) => /^[a-z]{1,3}$/.test(x.textContent ?? '') && x.textContent !== romaji)!;
            await u.click(wrong);
          }
          await u.click(screen.getByRole('button', { name: romaji }));
        }
      } else if (game.includes('Escribir kana')) {
        const romaji = screen.getByTestId('romaji').textContent!;
        await u.type(screen.getByLabelText('Escribe en kana'), `${fail ? 'nn' : romaji}{Enter}`);
        if (fail) await u.type(screen.getByLabelText('Escribe en kana'), `${romaji}{Enter}`);
      } else if (game.includes('Escuchar')) {
        const romaji = screen.getByTestId('romaji').textContent!;
        const word = content.vocab.find((w) => w.romaji === romaji && lesson.words !== undefined);
        const answer = word && !kanaByRomaji(romaji)?.char ? word.kana : (kanaByRomaji(romaji)?.char ?? word!.kana);
        await u.click(screen.getByRole('button', { name: answer }));
      } else if (game.includes('Leer palabras')) {
        const typed = screen.queryByLabelText('Lectura en romaji');
        const shownText = screen.getByTestId('word-prompt').textContent!;
        const w = content.vocab.find((x) => x.kana === shownText && lesson.words!.includes(x.id))!;
        if (typed) await u.type(typed, `${fail ? 'zzz' : w.romaji}{Enter}`);
        else await u.click(screen.getByRole('button', { name: w.es[0]! }));
        if (fail && typed) await u.type(screen.getByLabelText('Lectura en romaji'), `${w.romaji}{Enter}`);
      }
    }
    throw new Error('lesson did not finish');
  }

  it('completing a lesson with good accuracy marks it done, unlocks its kana and awards XP', async () => {
    await renderAt('/leccion/h-a');
    await playLesson(false, 'h-a');
    expect(screen.getByRole('heading', { name: '¡Lección completada!' })).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    const s = useProgress.getState();
    expect(s.completedLessons).toContain('h-a');
    expect(s.knownKana).toEqual(expect.arrayContaining([...'あいうえお']));
    expect(s.xp).toBeGreaterThan(100);
    expect(screen.getByRole('link', { name: /Continuar/ })).toHaveAttribute('href', '/leccion/h-ka');
  }, 60_000);

  it('a bad run does not complete the lesson and offers a retry', async () => {
    await renderAt('/leccion/h-a');
    await playLesson(true, 'h-a');
    expect(screen.getByRole('heading', { name: 'Casi lo logras' })).toBeInTheDocument();
    expect(useProgress.getState().completedLessons).toEqual([]);
    expect(useProgress.getState().knownKana).toEqual([]);
    expect(screen.getByRole('button', { name: 'Repetir lección' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Para repasar' })).toBeInTheDocument();
  }, 60_000);
});

describe('Lecciones de katakana', () => {
  /** Completes every lesson `id` requires (directly or not) and unlocks their kana. */
  function completeAncestors(id: string) {
    const byId = new Map(content.curriculum.map((l) => [l.id, l]));
    const seen = new Set<string>();
    const visit = (lid: string) => byId.get(lid)!.requires.forEach((r) => !seen.has(r) && (seen.add(r), visit(r)));
    visit(id);
    seen.forEach((lid) => {
      useProgress.getState().completeLesson(lid);
      useProgress.getState().unlockKana(byId.get(lid)!.kana ?? []);
    });
  }

  it('k-a is available after the verbs ます lesson, without finishing stage 2', async () => {
    completeAncestors('k-a');
    expect(useProgress.getState().completedLessons).not.toContain('l-conj-masu');
    await renderAt('/leccion/k-a');
    expect(screen.getByRole('heading', { name: 'Kana nuevos' })).toBeInTheDocument();
    expect(screen.getAllByText(/vocal larga/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Empezar práctica' })).toBeInTheDocument();
  });

  it('the intro of a lesson with look-alikes warns about them', async () => {
    completeAncestors('k-ta');
    await renderAt('/leccion/k-ta');
    expect(screen.getByTestId('look-alikes')).toHaveTextContent('シ / ツ');
  });

  it('the first game of a katakana lesson is kana recognition with the katakana of the lesson', async () => {
    completeAncestors('k-ka');
    await renderAt('/leccion/k-ka');
    await user().click(screen.getByRole('button', { name: 'Empezar práctica' }));
    await settle();
    expect(screen.getByText(/^Juego 1 de 4:/)).toHaveTextContent('Reconocer kana');
    expect('カキクケコ').toContain(screen.getByTestId('prompt').textContent!.charAt(0));
  });
});

describe('Práctica', () => {
  it('starts free practice with the selected rows and ends with a summary', async () => {
    const u = user();
    await renderAt('/practica');
    expect(screen.getByText(/No tienes repasos pendientes/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Empezar' }));
    await settle();
    expect(screen.getByText(/0 respondidas/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Terminar' }));
    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Volver a la práctica' })).toBeInTheDocument());
  });

  it('links the pending reviews to the unified /repaso session', async () => {
    useProgress.getState().recordAnswer('あ', 'kana', false); // stage 0 and wrong -> due now
    await renderAt('/practica');
    expect(screen.getByTestId('due-summary')).toHaveTextContent('1 ítems');
    expect(screen.getByRole('link', { name: /Repasar todo \(1\)/ })).toHaveAttribute('href', '/repaso');
    expect(screen.getByRole('link', { name: /Kana \(1\)/ })).toHaveAttribute('href', '/repaso?grupo=kana');
    expect(screen.getByRole('link', { name: /Kanji \(0\)/ })).toHaveAttribute('aria-disabled', 'true');
  });
});
