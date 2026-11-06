import { HttpError } from './http';

/**
 * Read-only on purpose. Anything that could trade, move money or change the account
 * (validate_*, simulate_*, update_access_mode, …) is rejected before reaching IOL.
 * Widen this list only for a concrete feature.
 */
export const ALLOWED_TOOLS = ['get_balance', 'get_portfolio', 'get_asset_quote'] as const;
export type AllowedTool = (typeof ALLOWED_TOOLS)[number];

export function assertAllowed(name: string): asserts name is AllowedTool {
  if (!(ALLOWED_TOOLS as readonly string[]).includes(name))
    throw new HttpError(403, `Herramienta no permitida: ${name}`);
}

export const MCP_URL = 'https://mcp.invertironline.com/mcp';

/** IOL rejected the access token: refresh it and try again. */
export class McpAuthError extends Error {}

interface RpcResponse {
  result?: {
    content?: { type: string; text?: string }[];
    structuredContent?: unknown;
    isError?: boolean;
  };
  error?: { message?: string };
}

/** Streamable HTTP answers either plain JSON or an SSE stream; take the JSON-RPC message. */
async function readRpc(res: Response): Promise<RpcResponse> {
  const text = await res.text();
  if (!(res.headers.get('content-type') ?? '').includes('text/event-stream'))
    return JSON.parse(text) as RpcResponse;
  const data = text
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim());
  const last = data.reverse().find((d) => d.includes('"jsonrpc"'));
  if (!last) throw new Error('Respuesta MCP vacía');
  return JSON.parse(last) as RpcResponse;
}

/** Minimal MCP client: initialize, then one tools/call. Returns the tool's parsed result. */
export async function callTool(
  accessToken: string,
  name: string,
  args: Record<string, unknown> = {},
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  assertAllowed(name);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  const post = async (body: unknown) => {
    const res = await fetcher(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.status === 401) throw new McpAuthError('IOL rechazó el token');
    if (!res.ok && res.status !== 202) throw new HttpError(502, `IOL respondió ${res.status}`);
    return res;
  };

  const init = await post({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'vuelto', version: '1.0.0' },
    },
  });
  const session = init.headers.get('mcp-session-id');
  if (session) headers['Mcp-Session-Id'] = session;
  await readRpc(init);
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' });

  const rpc = await readRpc(
    await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } }),
  );
  if (rpc.error || rpc.result?.isError)
    throw new HttpError(
      502,
      rpc.error?.message ?? rpc.result?.content?.[0]?.text ?? 'Error de IOL',
    );
  if (rpc.result?.structuredContent !== undefined) return rpc.result.structuredContent;
  const text = rpc.result?.content?.find((c) => c.type === 'text')?.text ?? 'null';
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
