// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../iol/callback.js';
import { POST as portfolio } from '../iol/portfolio.js';
import { googleUser, mask } from './google.js';
import { env, HttpError } from './http.js';
import { blobFromTokens, withIol, type IolBlob } from './iol.js';
import { ALLOWED_TOOLS, callTool, DEFAULT_MCP_URL, listTools, McpAuthError } from './mcp.js';
import { seal, unseal } from './seal.js';

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

/**
 * A fake IOL MCP server at the resource root, shaped like Streamable HTTP: initialize gives a
 * session, the notification gets 202 with no body, tools/list the tools IOL offers and
 * tools/call the given result, as JSON or SSE.
 */
function mcpServer(result: unknown, { sse = false } = {}) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe('https://mcp.invertironline.com');
    const msg = JSON.parse(String(init?.body)) as { id?: number; method: string };
    if (!msg.id) return new Response(null, { status: 202 });
    const body = {
      jsonrpc: '2.0',
      id: msg.id,
      result:
        msg.method === 'initialize'
          ? {
              protocolVersion: '2025-06-18',
              capabilities: { tools: {} },
              serverInfo: { name: 'iol', version: '1' },
            }
          : msg.method === 'tools/list'
            ? { tools: [...ALLOWED_TOOLS, ...FORBIDDEN].map((name) => ({ name })) }
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

  it('initializes, confirms and calls in one go with the negotiated protocol headers', async () => {
    const server = mcpServer({ total: 5 });
    await callTool('tok', 'get_balance', {}, server as typeof fetch);
    const calls = server.mock.calls.map(([, init]) => ({
      method: (JSON.parse(String(init?.body)) as { method: string }).method,
      headers: init?.headers as Record<string, string>,
    }));
    expect(calls.map((c) => c.method)).toEqual([
      'initialize',
      'notifications/initialized',
      'tools/call',
    ]);
    for (const { headers } of calls)
      expect(headers.Accept).toBe('application/json, text/event-stream');
    expect(calls[0]!.headers['MCP-Protocol-Version']).toBeUndefined();
    for (const { headers } of calls.slice(1)) {
      expect(headers['Mcp-Session-Id']).toBe('s1');
      expect(headers['MCP-Protocol-Version']).toBe('2025-06-18');
    }
  });

  it('uses IOL_MCP_URL when set', async () => {
    vi.stubEnv('IOL_MCP_URL', 'https://mcp.example.com/v2 ');
    const server = vi.fn(async () =>
      Response.json({ jsonrpc: '2.0', id: 1, result: { content: [] } }),
    );
    await callTool('tok', 'get_balance', {}, server as unknown as typeof fetch);
    expect(String(server.mock.calls[0]?.at(0))).toBe('https://mcp.example.com/v2');
    expect(DEFAULT_MCP_URL).toBe('https://mcp.invertironline.com');
  });

  it('logs each failed step with status, headers and body, never the token', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const notFound = vi.fn(async () =>
        Response.json(
          { error: 'not found' },
          { status: 404, headers: { 'x-other': 'skip', 'mcp-session-id': 's9' } },
        ),
      );
      await expect(
        callTool('secret-token', 'get_balance', {}, notFound as unknown as typeof fetch),
      ).rejects.toMatchObject({ status: 502, message: 'IOL respondió 404 en initialize' });
      const [title, detail] = log.mock.calls[0] as [string, string];
      expect(title).toBe('IOL MCP initialize failed');
      expect(JSON.parse(detail)).toEqual({
        url: 'https://mcp.invertironline.com',
        status: 404,
        headers: { 'content-type': 'application/json', 'mcp-session-id': 's9' },
        body: '{"error":"not found"}',
      });

      // A failure after initialize names its own step.
      const server = mcpServer({});
      const failsOnCall = vi.fn(async (url: string, init?: RequestInit) =>
        String(init?.body).includes('tools/call')
          ? new Response('x'.repeat(800), { status: 500 })
          : server(url, init),
      );
      await expect(
        callTool('secret-token', 'get_balance', {}, failsOnCall as unknown as typeof fetch),
      ).rejects.toMatchObject({ message: 'IOL respondió 500 en tools/call' });
      const [title2, detail2] = log.mock.calls[1] as [string, string];
      expect(title2).toBe('IOL MCP tools/call failed');
      expect((JSON.parse(detail2) as { body: string }).body).toHaveLength(500);

      expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
    } finally {
      log.mockRestore();
    }
  });

  it('still asks for a refresh when IOL rejects the token', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const unauthorized = vi.fn(async () => new Response('', { status: 401 }));
    await expect(
      callTool('tok', 'get_balance', {}, unauthorized as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(McpAuthError);
    vi.restoreAllMocks();
  });

  it('lists the tool names IOL offers', async () => {
    const server = mcpServer({});
    expect(await listTools('tok', server as typeof fetch)).toEqual(
      expect.arrayContaining(['get_balance', 'get_portfolio']),
    );
    const methods = server.mock.calls.map(
      ([, init]) => (JSON.parse(String(init?.body)) as { method: string }).method,
    );
    expect(methods).toEqual(['initialize', 'notifications/initialized', 'tools/list']);
  });
});

describe('mask', () => {
  it('keeps only the ends of an id', () => {
    expect(mask('123456789-abcdef.apps.googleusercontent.com')).toBe('123456…nt.com');
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

// What oauth2.googleapis.com/tokeninfo?access_token= returns for a GIS token-client access token.
const CLIENT = '123-abc.apps.googleusercontent.com';
const realTokeninfo = () =>
  tokeninfo({
    azp: CLIENT,
    aud: CLIENT,
    sub: '110248495921238986420',
    scope:
      'https://www.googleapis.com/auth/drive.appdata openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    exp: later,
    expires_in: '3599',
    email: 'someone@gmail.com',
    email_verified: 'true',
    access_type: 'online',
  });

describe('googleUser', () => {
  it('accepts the real tokeninfo response for an access token of our client', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => realTokeninfo());
    expect(await googleUser(req(), CLIENT, fetcher)).toBe('110248495921238986420');
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://oauth2.googleapis.com/tokeninfo?access_token=g-token',
    );
  });

  it('matches the client id even when the env value has a trailing newline', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', `${CLIENT}\n`);
    const fetcher = vi.fn(async () => realTokeninfo());
    expect(await googleUser(req(), env('GOOGLE_CLIENT_ID'), fetcher as typeof fetch)).toBe(
      '110248495921238986420',
    );
  });

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

describe('callback', () => {
  const callback = (query: string) => GET(new Request(`https://x/api/iol/callback?${query}`));
  const location = (res: Response) => res.headers.get('location');

  it('sends a clear error back when the code is invalid, expired or denied', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'invalid_grant' }, { status: 400 })),
    );
    try {
      const state = await seal({ v: 'verifier', sub: 'u1', exp: Date.now() + 60_000 }, KEY);
      const res = await callback(`code=used&state=${encodeURIComponent(state)}`);
      expect(res.status).toBe(302);
      expect(location(res)).toBe('/ajustes/cuentas#iol-error=failed');
      expect(location(await callback('code=x&state=tampered'))).toBe(
        '/ajustes/cuentas#iol-error=failed',
      );
      expect(location(await callback('error=access_denied'))).toBe(
        '/ajustes/cuentas#iol-error=denied',
      );
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it('logs the tools IOL offers on connect, and connects even if listing them fails', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mcp = mcpServer({});
    let mcpDown = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/token'))
          return Response.json({
            access_token: 'iol-access',
            refresh_token: 'r',
            expires_in: 3600,
          });
        return mcpDown ? new Response('gone', { status: 404 }) : mcp(url, init);
      }),
    );
    try {
      const state = () => seal({ v: 'verifier', sub: 'u1', exp: Date.now() + 60_000 }, KEY);
      const ok = await callback(`code=good&state=${encodeURIComponent(await state())}`);
      expect(location(ok)).toMatch(/^\/ajustes\/cuentas#iol=/);
      expect(info).toHaveBeenCalledWith(expect.stringContaining('get_balance, get_portfolio'));
      expect(error).not.toHaveBeenCalled();

      mcpDown = true;
      const still = await callback(`code=good&state=${encodeURIComponent(await state())}`);
      expect(location(still)).toMatch(/^\/ajustes\/cuentas#iol=/);
      expect(error).toHaveBeenCalledWith('IOL MCP tools/list failed', expect.any(String));
      expect(JSON.stringify([...info.mock.calls, ...error.mock.calls])).not.toContain('iol-access');
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
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

describe('portfolio endpoint', () => {
  it('asks get_portfolio for the requested market, Argentina unless it is the US', async () => {
    const asked: unknown[] = [];
    const mcp = mcpServer({ country: 'ARG', positions: [] });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith('https://oauth2.googleapis.com/tokeninfo'))
          return tokeninfo({ sub: 'u1', azp: 'google-client', exp: later });
        const msg = JSON.parse(String(init?.body)) as { method: string; params?: unknown };
        if (msg.method === 'tools/call') asked.push(msg.params);
        return mcp(url, init);
      }),
    );
    try {
      const { sealed } = await blobFromTokens({ access_token: 'a' }, 'u1');
      const call = (query: string) =>
        portfolio(
          new Request(`https://x/api/iol/portfolio${query}`, {
            method: 'POST',
            headers: { Authorization: 'Bearer g' },
            body: JSON.stringify({ blob: sealed }),
          }),
        );
      for (const q of ['?country=estados_Unidos', '?country=argentina', '?country=mars', '']) {
        expect((await call(q)).status).toBe(200);
      }
      expect(asked).toEqual([
        { name: 'get_portfolio', arguments: { country: 'estados_Unidos' } },
        { name: 'get_portfolio', arguments: { country: 'argentina' } },
        { name: 'get_portfolio', arguments: { country: 'argentina' } },
        { name: 'get_portfolio', arguments: { country: 'argentina' } },
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
