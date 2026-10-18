import { expect, it } from 'vitest';
import { dictionaries, t } from './i18n';

it('every language has exactly the Czech keys, none empty', () => {
  const keys = Object.keys(dictionaries.cs).sort();
  for (const [lang, d] of Object.entries(dictionaries)) {
    expect(Object.keys(d).sort(), lang).toEqual(keys);
    for (const [k, v] of Object.entries(d)) expect(v.trim(), `${lang}.${k}`).not.toBe('');
  }
});

it('falls back to Czech', () => {
  expect(t('login.submit', 'xx')).toBe('Přihlásit');
  expect(t('login.submit', 'en')).toBe('Sign in');
});
