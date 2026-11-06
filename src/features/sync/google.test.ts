import { describe, expect, it } from 'vitest';
import { availability } from './google';

describe('availability', () => {
  it('needs a client id', () => {
    expect(availability('http://localhost:5173', '')).toBe('no-client');
  });

  it('offers login only in production and on localhost', () => {
    expect(availability('https://vuelto-gestor-gastos.vercel.app', 'id')).toBe('ready');
    expect(availability('http://localhost:4173', 'id')).toBe('ready');
    expect(availability('http://127.0.0.1:5173', 'id')).toBe('ready');
    expect(availability('https://vuelto-git-feature-x.vercel.app', 'id')).toBe('wrong-origin');
    expect(availability('https://vuelto-gestor-gastos.vercel.app.evil.com', 'id')).toBe(
      'wrong-origin',
    );
  });
});
