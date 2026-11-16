import { HttpError } from './http.js';

/**
 * Read-only on purpose. Anything that could trade, move money or change the account
 * (validate_*, simulate_*, update_access_mode, …) is rejected before reaching IOL.
 * Widen this list only for a concrete feature.
 */
export const ALLOWED_TOOLS = [
  'get_balance',
  'get_portfolio',
  'get_asset_quote',
  'get_price_history',
  'get_aum_evolution',
] as const;
export type AllowedTool = (typeof ALLOWED_TOOLS)[number];

export function assertAllowed(name: string): asserts name is AllowedTool {
  if (!(ALLOWED_TOOLS as readonly string[]).includes(name))
    throw new HttpError(403, `Herramienta no permitida: ${name}`);
}

/** The `resource` that IOL's protected-resource metadata declares: the root, not /mcp. */
export const DEFAULT_MCP_URL = 'https://mcp.invertironline.com';
export const mcpUrl = () => process.env.IOL_MCP_URL?.trim() || DEFAULT_MCP_URL;
const PROTOCOL_VERSION = '2025-06-18';

/** IOL rejected the access token: refresh it and try again. */
export class McpAuthError extends Error {}

type Step = 'initialize' | 'initialized' | 'tools/list' | 'tools/call';

interface RpcResponse {
  result?: {
    protocolVersion?: string;
    tools?: { name: string }[];
    content?: { type: string; text?: string }[];
    structuredContent?: unknown;
    isError?: boolean;
  };
  error?: { code?: number; message?: string };
}

const LOGGED_HEADERS = [
  'content-type',
  'mcp-session-id',
  'mcp-protocol-version',
  'www-authenticate',
];

/** What a failed exchange looked like, for the runtime logs. Never includes our token. */
function logFailure(step: Step, url: string, res: Response, body: string, note?: string) {
  const headers: Record<string, string> = {};
  for (const h of LOGGED_HEADERS) {
    const v = res.headers.get(h);
    if (v) headers[h] = v;
  }
  console.error(
    `IOL MCP ${step} failed${note ? ` (${note})` : ''}`,
    JSON.stringify({ url, status: res.status, headers, body: body.slice(0, 500) }),
  );
}

/** Streamable HTTP answers either plain JSON or an SSE stream; take the JSON-RPC message. */
function parseRpc(text: string, contentType: string): RpcResponse {
  if (!contentType.includes('text/event-stream')) return JSON.parse(text) as RpcResponse;
  const data = text
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim());
  const last = data.reverse().find((d) => d.includes('"jsonrpc"'));
  if (!last) throw new Error('no JSON-RPC message in the stream');
  return JSON.parse(last) as RpcResponse;
}

/**
 * One MCP session per invocation: initialize, then notifications/initialized, forwarding the
 * session id and the negotiated protocol version. Returns a function for the next request.
 */
async function openSession(accessToken: string, fetcher: typeof fetch) {
  const url = mcpUrl();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  let id = 0;

  const send = async (step: Step, method: string, params?: unknown) => {
    const notice = step === 'initialized';
    const message = notice
      ? { jsonrpc: '2.0', method }
      : { jsonrpc: '2.0', id: ++id, method, ...(params ? { params } : {}) };
    const res = await fetcher(url, {
      method: 'POST',
      headers: { ...headers },
      body: JSON.stringify(message),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      logFailure(step, url, res, text);
      if (res.status === 401) throw new McpAuthError('IOL rechazó el token');
      throw new HttpError(502, `IOL respondió ${res.status} en ${step}`);
    }
    if (notice) return { res, rpc: {} as RpcResponse };
    let rpc: RpcResponse;
    try {
      rpc = parseRpc(text, res.headers.get('content-type') ?? '');
    } catch {
      logFailure(step, url, res, text, 'unreadable answer');
      throw new HttpError(502, `IOL respondió algo ilegible en ${step}`);
    }
    if (rpc.error) {
      logFailure(step, url, res, text, 'JSON-RPC error');
      throw new HttpError(502, rpc.error.message ?? `Error de IOL en ${step}`);
    }
    return { res, rpc };
  };

  const init = await send('initialize', 'initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'vuelto', version: '1.0.0' },
  });
  const session = init.res.headers.get('mcp-session-id');
  if (session) headers['Mcp-Session-Id'] = session;
  // Every request after initialize must carry the negotiated version.
  headers['MCP-Protocol-Version'] = init.rpc.result?.protocolVersion ?? PROTOCOL_VERSION;
  await send('initialized', 'notifications/initialized');

  return async (step: 'tools/list' | 'tools/call', params?: unknown) =>
    (await send(step, step, params)).rpc;
}

/** Names of the tools IOL offers to this token (no account data). */
export async function listTools(accessToken: string, fetcher: typeof fetch = fetch) {
  const request = await openSession(accessToken, fetcher);
  const rpc = await request('tools/list');
  return (rpc.result?.tools ?? []).map((t) => t.name);
}

/** Minimal MCP client: a fresh session, then one allowed tools/call. Returns the parsed result. */
export async function callTool(
  accessToken: string,
  name: string,
  args: Record<string, unknown> = {},
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  assertAllowed(name);
  const request = await openSession(accessToken, fetcher);
  const rpc = await request('tools/call', { name, arguments: args });
  if (rpc.result?.isError) {
    const message = rpc.result.content?.find((c) => c.type === 'text')?.text;
    console.error(`IOL MCP tools/call ${name} returned an error`, (message ?? '').slice(0, 500));
    throw new HttpError(502, message ?? 'Error de IOL');
  }
  if (rpc.result?.structuredContent !== undefined) return rpc.result.structuredContent;
  const text = rpc.result?.content?.find((c) => c.type === 'text')?.text ?? 'null';
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
