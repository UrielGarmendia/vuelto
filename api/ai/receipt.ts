import { aiSetup, body, readReceipt, ReceiptRequest } from '../_lib/ai.js';
import { handle, HttpError, json } from '../_lib/http.js';

/** A receipt the device could not read, read by the AI. The image is not stored or logged. */
export function POST(req: Request) {
  return handle(async () => {
    const input = await body(req, ReceiptRequest);
    const ai = await aiSetup(req);
    const spent = await ai.quota.consume(ai.sub, input.quota);
    if (!spent.allowed) throw new HttpError(429, 'Llegaste al límite de IA de hoy');
    const result = await readReceipt(ai, input);
    return json({ ...result, quota: spent.next, remaining: spent.remaining });
  });
}
