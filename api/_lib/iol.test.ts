// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { googleUser } from './google';
import { HttpError } from './http';
import { blobFromTokens, withIol, type IolBlob } from './iol';
import { ALLOWED_TOOLS, callTool, MCP_URL } from './mcp';
import { seal, unseal } from './seal';

const KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');

beforeEach(() => {
  vi.stubEnv('IOL_TOKEN_KEY', KEY);
  vi.stubEnv('IOL_CLIENT_ID', 'iol-client');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client');
});
afterEach(() => vi.unstubAllEnvs());

describe('seal', () => {
  it('round-trips and rejects tampering, other keys and expiry', async () => {
    const blob = await seal({ a: 1, exp: Date.now() + 1000 }, KEY);
    expect(await unseal<{ a: number; exp: number }>(blob, KEY)).toMatchObject({ a: 1 });
    const flipped = blob.slice(0, -2) + (blob.endsWith('A') ? 'BA' : 'AA');
    await expect(unseal(flipped, KEY)).rejects.toThrow();
    await expect(unseal(blob, OTHER_KEY)).rejects.toThrow();
    await expect(unseal(blob, KEY, Date.now() + 5000)).rejects.toThrow('expired');
    await expect(unseal('nonsense', KEY)).rejects.toThrow();
  });
});

/** Everything the IOL connector offers that Vuelto must never reach. */
const FORBIDDEN = [
  'update_access_mode',
  'validate_order',
  'validate_caucion',
  'validate_fci_subscription',
  'validate_fci_redemption',
  'simulate_fixed_income_by_amount',
  'simulate_fixed_income_by_nominals',
  'get_access_mode',
  'get_activities',
  'get_order_status',
  'get_ddjj',
];

describe('allowlist', () => {
  it('is only balance, portfolio and quotes', () => {
    expect([...ALLOWED_TOOLS]).toEqual(['get_balance', 'get_portfolio', 'get_asset_quote']);
  });

  it('blocks every other tool before any request leaves', async () => {
    const fetcher = vi.fn();
    for (const name of FORBIDDEN) {
      await expect(callTool('t', name, {}, fetcher)).rejects.toMatchObject({ status: 403 });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});

/** A fake MCP server: initialize gives a session, tools/call the given result, JSON or SSE. */
function mcpServer(result: unknown, { sse = false } = {}) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe(MCP_URL);
    const msg = JSON.parse(String(init?.body)) as { id?: number; method: string };
    if (!msg.id) return new Response(null, { status: 202 });
    const body = {
      jsonrpc: '2.0',
      id: msg.id,
      result:
        msg.method === 'initialize'
          ? { protocolVersion: '2025-06-18', capabilities: {} }
          : { content: [{ type: 'text', text: JSON.stringify(result) }] },
    };
    return sse
      ? new Response(`event: message\ndata: ${JSON.stringify(body)}\n\n`, {
          headers: { 'content-type': 'text/event-stream', 'mcp-session-id': 's1' },
        })
      : Response.json(body, { headers: { 'mcp-session-id': 's1' } });
  });
}

describe('callTool', () => {
  it('reads JSON and SSE answers and keeps the session', async () => {
    const plain = mcpServer({ total: 5 });
    expect(await callTool('tok', 'get_balance', {}, plain as typeof fetch)).toEqual({ total: 5 });
    const sse = mcpServer({ total: 6 }, { sse: true });
    expect(await callTool('tok', 'get_balance', {}, sse as typeof fetch)).toEqual({ total: 6 });
    const last = sse.mock.calls.at(-1)![1]!.headers as Record<string, string>;
    expect(last['Mcp-Session-Id']).toBe('s1');
    expect(last.Authorization).toBe('Bearer tok');
  });
});

const tokeninfo = (info: Record<string, string>, ok = true) =>
  Response.json(info, { status: ok ? 200 : 400 });
const req = (body?: unknown, token = 'g-token') =>
  new Request('https://x/api/iol/balance', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
const later = String(Math.floor(Date.now() / 1000) + 600);

describe('googleUser', () => {
  it('accepts tokens issued to our client only, unexpired', async () => {
    const ok = vi.fn(async () => tokeninfo({ sub: 'u1', azp: 'google-client', exp: later }));
    expect(await googleUser(req(), 'google-client', ok as typeof fetch)).toBe('u1');
    const foreign = vi.fn(async () =>
      tokeninfo({ sub: 'u1', azp: 'other', aud: 'other', exp: later }),
    );
    await expect(googleUser(req(), 'google-client', foreign as typeof fetch)).rejects.toThrow(
      HttpError,
    );
    const past = String(Math.floor(Date.now() / 1000) - 10);
    const expired = vi.fn(async () => tokeninfo({ sub: 'u1', azp: 'google-client', exp: past }));
    await expect(googleUser(req(), 'google-client', expired as typeof fetch)).rejects.toThrow(
      HttpError,
    );
    const bad = vi.fn(async () => tokeninfo({ error_description: 'invalid' }, false));
    await expect(googleUser(req(), 'google-client', bad as typeof fetch)).rejects.toThrow(
      HttpError,
    );
    await expect(
      googleUser(new Request('https://x', { method: 'POST' }), 'google-client'),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('withIol', () => {
  function server(user: string, mcp = mcpServer({ cuentas: [] })) {
    return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.startsWith('https://oauth2.googleapis.com/tokeninfo'))
        return tokeninfo({ sub: user, azp: 'google-client', exp: later });
      if (u === 'https://mcp.invertironline.com/token')
        return Response.json({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        });
      return mcp(u, init);
    }) as unknown as typeof fetch;
  }

  it('answers with the tool result for the blob owner', async () => {
    const { sealed } = await blobFromTokens({ access_token: 'a', refresh_token: 'r' }, 'u1');
    const res = await withIol(req({ blob: sealed }), 'get_balance', {}, server('u1'));
    expect(await res.json()).toEqual({ data: { cuentas: [] } });
  });

  it('rejects a blob from another Google user', async () => {
    const { sealed } = await blobFromTokens({ access_token: 'a' }, 'u1');
    await expect(
      withIol(req({ blob: sealed }), 'get_balance', {}, server('u2')),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('refreshes an expired access token and returns the new blob', async () => {
    const old: IolBlob = {
      access: 'a',
      refresh: 'r',
      accessExp: 0,
      sub: 'u1',
      exp: Date.now() + 1e6,
    };
    const res = await withIol(req({ blob: await seal(old, KEY) }), 'get_balance', {}, server('u1'));
    const body = (await res.json()) as { blob: string };
    const next = await unseal<IolBlob>(body.blob, KEY);
    expect(next).toMatchObject({ access: 'new-access', refresh: 'new-refresh', sub: 'u1' });
  });

  it('asks to reconnect when the blob does not open', async () => {
    await expect(
      withIol(req({ blob: 'garbage.blob' }), 'get_balance', {}, server('u1')),
    ).rejects.toMatchObject({ status: 401 });
  });
});
