// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, expect, it } from 'vitest';

const out = mkdtempSync(join(tmpdir(), 'vuelto-api-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

// Vercel runs each compiled file with plain Node ESM, where a bad specifier only fails at import time.
it('every function loads under plain Node like on Vercel', () => {
  execFileSync(
    process.execPath,
    [
      'node_modules/typescript/bin/tsc',
      '-p',
      'api',
      '--noEmit',
      'false',
      '--noCheck',
      '--outDir',
      out,
    ],
    { stdio: 'pipe' },
  );
  writeFileSync(join(out, 'package.json'), '{"type":"module"}');

  const entries = readdirSync(join(out, 'iol')).filter((f) => f.endsWith('.js'));
  expect(entries.length).toBeGreaterThan(0);
  const urls = entries.map((f) => pathToFileURL(join(out, 'iol', f)).href);
  const script = `for (const u of ${JSON.stringify(urls)}) {
    const m = await import(u);
    if (!m.GET && !m.POST) throw new Error(u + ' exports no handler');
  }`;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { stdio: 'pipe' });
});
