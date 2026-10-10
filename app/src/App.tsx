import { lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { curriculum } from './domain/curriculumContent';
import { syncKnownKana, syncKnownKanji } from './lesson/lessonLogic';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { useProgress } from './state/progressStore';

// Route-level code splitting: only the home page is in the initial bundle.
const LessonRunner = lazy(() => import('./lesson/LessonRunner').then((m) => ({ default: m.LessonRunner })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const PathPage = lazy(() => import('./pages/PathPage').then((m) => ({ default: m.PathPage })));
const PracticePage = lazy(() => import('./pages/PracticePage').then((m) => ({ default: m.PracticePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ReviewPage = lazy(() => import('./review/ReviewPage').then((m) => ({ default: m.ReviewPage })));

export function App() {
  const theme = useProgress((s) => s.settings.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = theme;
  }, [theme]);

  const completedCount = useProgress((s) => s.completedLessons.length);
  useEffect(() => {
    syncKnownKana(curriculum);
    syncKnownKanji(curriculum);
  }, [completedCount]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="camino" element={<PathPage />} />
        <Route path="leccion/:id" element={<LessonRunner />} />
        <Route path="repaso" element={<ReviewPage />} />
        <Route path="practica" element={<PracticePage />} />
        <Route path="ajustes" element={<SettingsPage />} />
        <Route path="acerca-de" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
