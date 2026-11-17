// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as copilot } from '../ai/copilot.js';
import { POST as receipt } from '../ai/receipt.js';
import { POST as status } from '../ai/status.js';
import { cleanMovement, DEFAULT_MODEL, type Catalog, type Movement } from './ai.js';
import { quotaDay, SealedQuota } from './quota.js';

const KEY = Buffer.alloc(32, 7).toString('base64');
const later = String(Math.floor(Date.now() / 1000) + 600);
const today = new Date().toISOString().slice(0, 10);

const catalog: Catalog = {
  categories: [
    { id: 'super', name: 'Supermercado', type: 'expense' },
    { id: 'sueldo', name: 'Sueldo', type: 'income' },
  ],
  accounts: [
    { id: 'mp', name: 'Mercado Pago', kind: 'wallet', currency: 'ARS' },
    { id: 'visa', name: 'Visa', kind: 'credit', currency: 'ARS' },
  ],
  rules: [{ match: 'coto', categoryId: 'super' }],
};

/** Google says who is calling; the Anthropic API answers with `output`. */
function server(output: unknown, email = 'yo@example.com') {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo'))
      return Response.json({ sub: 'u1', azp: 'gc', exp: later, email, email_verified: 'true' });
    const raw = input instanceof Request ? await input.text() : String(init?.body);
    calls.push({ url, body: JSON.parse(raw) as Record<string, unknown> });
    return Response.json({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: DEFAULT_MODEL,
      content: [
        { type: 'text', text: typeof output === 'string' ? output : JSON.stringify(output) },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    });
  });
  vi.stubGlobal('fetch', fetcher);
  return calls;
}

const post = (handler: (r: Request) => Promise<Response>, body: unknown) =>
  handler(
    new Request('https://x/api/ai', {
      method: 'POST',
      headers: { Authorization: 'Bearer g', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

const movement = (over: Partial<Movement> = {}): Movement => ({
  type: 'expense',
  amount: 23000,
  currency: 'ARS',
  categoryId: 'super',
  accountId: 'mp',
  toAccountId: null,
  date: today,
  installments: null,
  note: 'Super',
  confidence: 0.9,
  ...over,
});

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'gc');
  vi.stubEnv('IOL_TOKEN_KEY', KEY);
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
  vi.stubEnv('ALLOWED_AI_EMAILS', ' Yo@Example.com , otra@example.com');
  vi.stubEnv('COPILOT_DAILY_LIMIT', '2');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AI status', () => {
  it('is off without a key or for other emails, on with the uses left', async () => {
    server({});
    expect(await (await post(status, {})).json()).toEqual({ enabled: true, remaining: 2 });
    server({}, 'intruso@example.com');
    expect(await (await post(status, {})).json()).toEqual({ enabled: false });
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(await (await post(status, {})).json()).toEqual({ enabled: false });
  });
});

describe('AI copilot', () => {
  it('asks the configured model for structured output and cleans what comes back', async () => {
    const calls = server({
      movements: [
        movement(),
        movement({ categoryId: 'invented', accountId: 'nope', confidence: 0.95 }),
      ],
    });
    const res = await post(copilot, { text: 'super 23 lucas con mp', today, catalog });
    expect(res.status).toBe(200);
    const out = (await res.json()) as { movements: Movement[]; quota: string; remaining: number };
    expect(out.movements[0]).toMatchObject({ amount: 23000, categoryId: 'super', accountId: 'mp' });
    // Ids the client did not send are dropped and the card asks to be checked.
    expect(out.movements[1]).toMatchObject({ categoryId: null, accountId: null, confidence: 0.5 });
    expect(out.remaining).toBe(1);
    expect(calls[0]!.url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0]!.body).toMatchObject({
      model: DEFAULT_MODEL,
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    });
    const sent = JSON.stringify(calls[0]!.body.messages);
    expect(sent).toContain('<mensaje>');
    expect(sent).toContain('super 23 lucas con mp');
  });

  it('honours COPILOT_MODEL', async () => {
    vi.stubEnv('COPILOT_MODEL', 'claude-sonnet-5-5');
    const calls = server({ movements: [] });
    await post(copilot, { text: 'algo', today, catalog });
    expect(calls[0]!.body.model).toBe('claude-sonnet-5-5');
  });

  it('refuses other emails, missing config, bad bodies and spent quotas', async () => {
    server({ movements: [] }, 'intruso@example.com');
    expect((await post(copilot, { text: 'x', today, catalog })).status).toBe(403);

    server({ movements: [] });
    expect((await post(copilot, { text: '', today, catalog })).status).toBe(400);
    expect((await post(copilot, { text: 'x'.repeat(501), today, catalog })).status).toBe(400);
    expect((await post(copilot, { text: 'x', today: 'mañana', catalog })).status).toBe(400);

    let quota: string | undefined;
    for (let i = 0; i < 2; i++) {
      const res = await post(copilot, { text: 'x', today, catalog, quota });
      quota = ((await res.json()) as { quota: string }).quota;
    }
    const spent = await post(copilot, { text: 'x', today, catalog, quota });
    expect(spent.status).toBe(429);

    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await post(copilot, { text: 'x', today, catalog })).status).toBe(503);
  });

  it('answers 502 when the model output is not usable', async () => {
    server('esto no es JSON');
    const res = await post(copilot, { text: 'x', today, catalog });
    expect(res.status).toBe(502);
  });
});

describe('AI receipt', () => {
  it('reads an image into one expense and never echoes the image', async () => {
    const calls = server({
      merchant: 'Coto',
      date: today,
      total: 8000,
      currency: 'ARS',
      payment: 'Visa',
      categoryId: 'super',
      accountId: 'visa',
      items: [{ description: 'Leche', amount: 1250 }],
      confidence: 0.8,
    });
    const res = await post(receipt, { image: 'AAAA', mediaType: 'image/webp', today, catalog });
    const out = (await res.json()) as { movement: Movement; payment: string };
    expect(out.movement).toMatchObject({
      amount: 8000,
      categoryId: 'super',
      accountId: 'visa',
      note: 'Coto',
    });
    expect(out.payment).toBe('Visa');
    expect(JSON.stringify(out)).not.toContain('AAAA');
    const image = (calls[0]!.body.messages as { content: { type: string }[] }[])[0]!.content[0];
    expect(image).toMatchObject({
      type: 'image',
      source: { media_type: 'image/webp', data: 'AAAA' },
    });
  });

  it('rejects other formats', async () => {
    server({});
    const res = await post(receipt, { image: 'AAAA', mediaType: 'image/gif', today, catalog });
    expect(res.status).toBe(400);
  });
});

describe('cleanMovement', () => {
  it('keeps dates and amounts in range and installments only on credit', () => {
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect(cleanMovement(movement({ date: tomorrow }), catalog, today).date).toBe(today);
    expect(cleanMovement(movement({ amount: -5 }), catalog, today)).toMatchObject({
      amount: 0,
      confidence: 0.5,
    });
    expect(cleanMovement(movement({ installments: 12 }), catalog, today).installments).toBeNull();
    expect(
      cleanMovement(movement({ installments: 12, accountId: 'visa' }), catalog, today).installments,
    ).toBe(12);
    // An income category on an expense is not kept.
    expect(cleanMovement(movement({ categoryId: 'sueldo' }), catalog, today).categoryId).toBeNull();
  });
});

describe('SealedQuota', () => {
  it('counts per user and day and cannot be reused by someone else', async () => {
    let now = Date.parse('2026-11-16T15:00:00Z');
    const q = new SealedQuota(KEY, 2, () => now);
    const a = await q.consume('u1');
    const b = await q.consume('u1', a.next);
    expect([a.remaining, b.remaining]).toEqual([1, 0]);
    expect((await q.consume('u1', b.next)).allowed).toBe(false);
    // Another user's counter means nothing for you.
    expect((await q.consume('u2', b.next)).remaining).toBe(1);
    // A forged token counts as zero, not as an error.
    expect(await q.peek('u1', 'nonsense')).toBe(2);
    // A new day in Argentina (UTC−3) starts again.
    now = Date.parse('2026-11-17T03:30:00Z');
    expect(quotaDay(now)).toBe('2026-11-17');
    expect((await q.consume('u1', b.next)).remaining).toBe(1);
  });
});
