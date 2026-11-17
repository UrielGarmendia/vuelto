import { aiSetup, body, CopilotRequest, readMessage } from '../_lib/ai.js';
import { handle, HttpError, json } from '../_lib/http.js';

/** "Mejorar con IA" for what the on-device copilot could not settle. */
export function POST(req: Request) {
  return handle(async () => {
    const input = await body(req, CopilotRequest);
    const ai = await aiSetup(req);
    const spent = await ai.quota.consume(ai.sub, input.quota);
    if (!spent.allowed) throw new HttpError(429, 'Llegaste al límite de IA de hoy');
    const movements = await readMessage(ai, input);
    return json({ movements, quota: spent.next, remaining: spent.remaining });
  });
}
