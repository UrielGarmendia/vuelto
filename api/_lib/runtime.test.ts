// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, expect, it } from 'vitest';

// Inside the project, so packages (the Anthropic SDK, zod) resolve from node_modules as on Vercel.
const cache = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, 'vuelto-api-'));
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

  const urls = ['iol', 'ai'].flatMap((dir) =>
    readdirSync(join(out, dir))
      .filter((f) => f.endsWith('.js'))
      .map((f) => pathToFileURL(join(out, dir, f)).href),
  );
  expect(urls.length).toBeGreaterThan(5);
  const script = `for (const u of ${JSON.stringify(urls)}) {
    const m = await import(u);
    if (!m.GET && !m.POST) throw new Error(u + ' exports no handler');
  }`;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { stdio: 'pipe' });
}, 30_000); // compiling every function and loading the SDK takes a while under a full run
