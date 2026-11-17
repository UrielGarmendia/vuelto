import { aiSetup, body } from '../_lib/ai.js';
import { handle, HttpError, json } from '../_lib/http.js';
import { z } from 'zod';

/** Whether the AI is on for the caller, and how many uses are left today. Spends none. */
export function POST(req: Request) {
  return handle(async () => {
    const { quota: presented } = await body(
      req,
      z.object({ quota: z.string().max(400).optional() }),
    );
    try {
      const ai = await aiSetup(req);
      return json({ enabled: true, remaining: await ai.quota.peek(ai.sub, presented) });
    } catch (err) {
      // Not configured or not allowed: the app simply shows no AI.
      if (err instanceof HttpError && (err.status === 503 || err.status === 403))
        return json({ enabled: false });
      throw err;
    }
  });
}
