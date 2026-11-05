import { useProgress } from '../state/progressStore';
import { localeOf } from './index';

/** Keeps `<html lang>` equal to the interface language (set now and on every change of the setting). Call once at startup. */
export function syncHtmlLang(): () => void {
  const apply = () => {
    document.documentElement.lang = localeOf(useProgress.getState().settings.uiLang);
  };
  apply();
  return useProgress.subscribe(apply);
}
