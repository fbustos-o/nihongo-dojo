import curriculumRaw from '../content/curriculum.json';
import { parseList } from './parseList';
import { LessonSchema } from './schema';

/**
 * The lesson path alone. The home page, the router shell and the path logic only need this small file, so the
 * big vocabulary / kanji / pattern files stay out of the initial bundle (they load with the lazy pages and games).
 */
export const curriculum = parseList('curriculum.json', LessonSchema, curriculumRaw);
