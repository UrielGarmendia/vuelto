import { env } from '../_lib/http';
import { blobFromTokens, exchangeCode } from '../_lib/iol';
import { unseal } from '../_lib/seal';

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
    const { sealed } = await blobFromTokens(tokens, state.sub);
    return back(`iol=${sealed}`);
  } catch (err) {
    console.error(err);
    return back('iol-error=failed');
  }
}
