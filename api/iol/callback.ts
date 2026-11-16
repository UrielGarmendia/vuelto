import { env } from '../_lib/http.js';
import { blobFromTokens, exchangeCode } from '../_lib/iol.js';
import { ALLOWED_TOOLS, listTools } from '../_lib/mcp.js';
import { unseal } from '../_lib/seal.js';

const back = (fragment: string) =>
  new Response(null, { status: 302, headers: { Location: `/ajustes/cuentas#${fragment}` } });

/** Step 2: IOL sends the user back with a code; it is exchanged and the tokens go to the
 * client sealed, in the URL fragment (never sent to any server, not even ours). */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (params.get('error')) return back('iol-error=denied');
  try {
    const state = await unseal<{ v: string; sub: string; exp: number }>(
      params.get('state') ?? '',
      env('IOL_TOKEN_KEY'),
    );
    const tokens = await exchangeCode(params.get('code') ?? '', state.v);
    await logTools(tokens.access_token!);
    const { sealed } = await blobFromTokens(tokens, state.sub);
    return back(`iol=${sealed}`);
  } catch (err) {
    console.error(err);
    return back('iol-error=failed');
  }
}

/** Confirms in the logs which tools IOL offers this token; never blocks the connection. */
async function logTools(accessToken: string) {
  try {
    const names = await listTools(accessToken);
    console.info(`IOL MCP tools: ${names.join(', ') || '(none)'}`);
    const missing = ALLOWED_TOOLS.filter((t) => !names.includes(t));
    if (missing.length) console.error(`IOL MCP lacks expected tools: ${missing.join(', ')}`);
  } catch (err) {
    console.error('IOL MCP tools/list failed', err instanceof Error ? err.message : err);
  }
}
