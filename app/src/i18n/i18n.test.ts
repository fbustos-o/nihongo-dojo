import { describe, expect, it } from 'vitest';
import { AREAS, MESSAGES } from './messages';
import { translate } from './index';

describe('i18n dictionaries', () => {
  it('every area has the same keys in es and en, and no empty strings', () => {
    for (const [name, area] of Object.entries(AREAS)) {
      const es = Object.keys(area.es).sort();
      const en = Object.keys(area.en).sort();
      expect(en, `area ${name}: en keys differ from es`).toEqual(es);
      for (const [k, v] of [...Object.entries(area.es), ...Object.entries(area.en)]) expect(v, `${name}.${k}`).not.toBe('');
    }
  });

  it('keys are unique across areas', () => {
    const seen = new Map<string, string>();
    for (const [name, area] of Object.entries(AREAS)) {
      for (const k of Object.keys(area.es)) {
        expect(seen.has(k), `key ${k} defined in ${seen.get(k)} and ${name}`).toBe(false);
        seen.set(k, name);
      }
    }
    expect(Object.keys(MESSAGES.es).length).toBe(seen.size);
  });

  it('interpolates and falls back', () => {
    expect(translate('en', 'nav.home')).toBe('Home');
    expect(translate('es', 'nav.home')).toBe('Inicio');
    expect(translate('en', 'missing.key')).toBe('missing.key');
    expect(translate('es', 'Hola {name}', { name: 'Ana' })).toBe('Hola Ana');
  });
});
