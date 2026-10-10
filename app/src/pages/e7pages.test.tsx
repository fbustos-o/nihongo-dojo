import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { content } from '../domain/contentLoader';
import { useProgress } from '../state/progressStore';
import { loadProgress, loadIssue } from '../state/persistence';
import { localDateString } from '../state/streak';

const user = () => userEvent.setup({ delay: null });
const renderAt = async (path: string) => {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
  return result;
};

beforeEach(() => useProgress.getState().resetProgress());

describe('Home dashboard', () => {
  it('starts empty: level 1, no streak, no reviews, next lesson', async () => {
    await renderAt('/');
    expect(screen.getByTestId('level')).toHaveTextContent('1');
    expect(screen.getByRole('progressbar', { name: 'Experiencia del nivel' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByTestId('streak')).toHaveTextContent('0 días');
    expect(screen.getByTestId('due-total')).toHaveTextContent('0');
    expect(screen.getByText(/Nada pendiente/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Empezar' })).toHaveAttribute('href', '/leccion/h-a');
    expect(screen.getAllByRole('listitem', { name: /estudiaste|sin estudio/ })).toHaveLength(7);
    expect(screen.getByTestId('today-accuracy')).toHaveTextContent('–');
    expect(screen.getByRole('progressbar', { name: 'Progreso de Kanji' })).toBeInTheDocument();
  });

  it('shows level, XP, streak, today counters, due reviews by type and the SRS distribution', async () => {
    const { recordAnswer, completeLesson } = useProgress.getState();
    recordAnswer('あ', 'kana', false); // due at once
    recordAnswer('taberu', 'word', false);
    recordAnswer('number:5', 'word', false);
    recordAnswer('x:0', 'pattern', false);
    for (let i = 0; i < 10; i++) recordAnswer(`k${i}`, 'kana', true);
    completeLesson('h-a');
    await renderAt('/');
    expect(screen.getByTestId('level')).toHaveTextContent('2'); // 100 + 30 XP
    expect(screen.getByTestId('xp-text')).toHaveTextContent('30 / 150 XP');
    expect(screen.getByTestId('streak')).toHaveTextContent('1 día');
    expect(screen.getByTestId('due-total')).toHaveTextContent('4');
    const chips = screen.getByRole('list', { name: 'Pendientes por tipo' });
    expect(chips).toHaveTextContent('Kana 1');
    expect(chips).toHaveTextContent('Palabras 2');
    expect(chips).toHaveTextContent('Patrones 1');
    expect(screen.getByRole('link', { name: /Repasar ahora \(4\)/ })).toHaveAttribute('href', '/repaso');
    expect(screen.getByTestId('today-lessons')).toHaveTextContent('1');
    expect(screen.getByTestId('today-reviews')).toHaveTextContent('0');
    expect(screen.getByTestId('today-accuracy')).toHaveTextContent('71%'); // 10 right of 14
    expect(screen.getByTestId('srs-Aprendiz')).toHaveTextContent('14');
    const today = screen.getAllByRole('listitem', { name: /\(hoy\)/ });
    expect(today).toHaveLength(1);
    expect(today[0]).toHaveAccessibleName(/estudiaste/);
    expect(screen.getByRole('progressbar', { name: 'Progreso de Hiragana' })).toHaveAttribute('aria-valuenow', '1');
  });

  it('a streak that is not alive shows 0', async () => {
    useProgress.setState({ streak: { lastStudyDate: '2020-01-01', count: 9 } });
    await renderAt('/');
    expect(screen.getByTestId('streak')).toHaveTextContent('0 días');
    expect(localDateString(new Date())).not.toBe('2020-01-01');
  });
});

describe('Camino as a path', () => {
  it('highlights the current lesson', async () => {
    await renderAt('/camino');
    const current = screen.getByRole('link', { name: /Siguiente lección/ });
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(current).toHaveAttribute('href', '/leccion/h-a');
  });
});

describe('/repaso', () => {
  it('shows an empty state when nothing is due', async () => {
    await renderAt('/repaso');
    expect(screen.getByTestId('review-empty')).toHaveTextContent('No tienes repasos pendientes');
    expect(screen.getByRole('link', { name: 'Ir al camino' })).toBeInTheDocument();
  });

  it('runs a mixed session group by group and ends with a summary', async () => {
    const u = user();
    useProgress.getState().unlockKana(content.kana.flatMap((k) => [...k.char]));
    useProgress.getState().recordAnswer('あ', 'kana', false);
    useProgress.getState().recordAnswer('verb:taberu:masu', 'word', false);
    await renderAt('/repaso');
    expect(screen.getByRole('heading', { name: '2 ítems por repasar' })).toBeInTheDocument();
    const plan = screen.getByRole('list');
    expect(plan).toHaveTextContent('Reconocer kana');
    expect(plan).toHaveTextContent('Conjugación');
    await u.click(screen.getByRole('button', { name: 'Empezar repaso' }));
    // both are due at once; the batch order follows the queue (ties by id), so answer whichever comes
    for (let part = 1; part <= 2; part++) {
      await waitFor(() => expect(screen.getByTestId('review-step')).toHaveTextContent(`Parte ${part} de 2`));
      await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
      const conj = await screen.findByLabelText(/Conjugación en kana|Romaji/);
      await u.type(conj, conj.getAttribute('aria-label') === 'Romaji' ? 'a{Enter}' : 'tabemasu{Enter}');
    }
    expect(await screen.findByRole('heading', { name: 'Repaso terminado' })).toBeInTheDocument();
    expect(screen.getByText(/Aciertos: 2 de 2/)).toBeInTheDocument();
    expect(useProgress.getState().daily[localDateString(new Date())]!.reviews).toBe(2);
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toBeInTheDocument();
  });

  it('the filter only reviews one group', async () => {
    useProgress.getState().recordAnswer('あ', 'kana', false);
    useProgress.getState().recordAnswer('taberu', 'word', false);
    await renderAt('/repaso?grupo=palabras');
    expect(screen.getByRole('heading', { name: '1 ítem por repasar de palabras' })).toBeInTheDocument();
  });
});

describe('Práctica links into the unified review', () => {
  it('has a link per group with its count', async () => {
    useProgress.getState().recordAnswer('taberu', 'word', false);
    await renderAt('/practica');
    const card = screen.getByRole('heading', { name: 'Repasos pendientes' }).closest('section')!;
    expect(within(card).getByRole('link', { name: /Palabras \(1\)/ })).toHaveAttribute('href', '/repaso?grupo=palabras');
  });
});

describe('error and empty states', () => {
  it('ErrorBoundary shows a recoverable message instead of a blank page', () => {
    const Boom = () => {
      throw new Error('boom');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal');
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('a corrupted saved progress is ignored with a visible notice and a raw backup', async () => {
    localStorage.setItem('nihongo-dojo:v1', '{"version": 1, "items": 5}');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadProgress()).toBeNull();
    expect(loadIssue.message).toMatch(/dañado/);
    expect(localStorage.getItem('nihongo-dojo:v1:corrupto')).toContain('"items": 5');
    await renderAt('/');
    expect(screen.getByTestId('issue-banner')).toHaveTextContent('dañado');
    await user().click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByTestId('issue-banner')).not.toBeInTheDocument();
    warn.mockRestore();
    loadIssue.message = null;
  });

  it('a corrupted import is rejected and keeps the progress', async () => {
    useProgress.getState().unlockKana(['あ']);
    expect(useProgress.getState().importProgress('{"version":1,"items":[]}')).toMatch(/inválido/);
    expect(useProgress.getState().knownKana).toEqual(['あ']);
  });

  it('settings explain the missing Japanese voice', async () => {
    await renderAt('/ajustes');
    expect(screen.getByTestId('no-voice')).toHaveTextContent('no tiene una voz en japonés');
  });

  it('an unknown route goes home', async () => {
    await renderAt('/nope/nada');
    expect(screen.getByTestId('level')).toBeInTheDocument();
  });
});
