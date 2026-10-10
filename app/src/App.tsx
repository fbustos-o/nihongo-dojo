import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { content } from './domain/contentLoader';
import { LessonRunner } from './lesson/LessonRunner';
import { syncKnownKana, syncKnownKanji } from './lesson/lessonLogic';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { PathPage } from './pages/PathPage';
import { PracticePage } from './pages/PracticePage';
import { SettingsPage } from './pages/SettingsPage';
import { useProgress } from './state/progressStore';

export function App() {
  const theme = useProgress((s) => s.settings.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = theme;
  }, [theme]);

  const completedCount = useProgress((s) => s.completedLessons.length);
  useEffect(() => {
    syncKnownKana(content.curriculum);
    syncKnownKanji(content.curriculum);
  }, [completedCount]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="camino" element={<PathPage />} />
        <Route path="leccion/:id" element={<LessonRunner />} />
        <Route path="practica" element={<PracticePage />} />
        <Route path="ajustes" element={<SettingsPage />} />
        <Route path="acerca-de" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
