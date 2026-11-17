import { seal, SealError, unseal } from './seal.js';

export interface QuotaResult {
  allowed: boolean;
  /** Uses left today after this one (or none, when not allowed). */
  remaining: number;
  /** What the client must send next time, when the store lives with the client. */
  next?: string;
}

/**
 * Counts AI uses per user and day. Swapping the store (for one with a server-side counter,
 * such as Upstash Redis, once the AI is opened to more people) changes nothing else.
 */
export interface QuotaStore {
  /** Spends one use if any is left. `presented` is the client's token, if this store uses one. */
  consume(user: string, presented?: string): Promise<QuotaResult>;
  /** Uses left without spending one. */
  peek(user: string, presented?: string): Promise<number>;
}

/** Today in Argentina (UTC−3, no daylight saving), so the limit resets at local midnight. */
export const quotaDay = (now = Date.now()) =>
  new Date(now - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

interface Counter {
  sub: string;
  day: string;
  used: number;
  exp: number;
}

/**
 * The counter travels sealed with the client: it cannot be read or forged, but someone who
 * throws it away starts again at zero. Acceptable while only allowed emails get in, with
 * the spending limit in the Anthropic console as the real ceiling.
 */
export class SealedQuota implements QuotaStore {
  constructor(
    private readonly key: string,
    private readonly limit: number,
    private readonly now: () => number = Date.now,
  ) {}

  private async used(user: string, presented?: string) {
    if (!presented) return 0;
    try {
      const c = await unseal<Counter>(presented, this.key, this.now());
      // Another user's counter or yesterday's does not count.
      return c.sub === user && c.day === quotaDay(this.now()) ? c.used : 0;
    } catch (err) {
      if (err instanceof SealError) return 0;
      throw err;
    }
  }

  async peek(user: string, presented?: string) {
    return Math.max(0, this.limit - (await this.used(user, presented)));
  }

  async consume(user: string, presented?: string): Promise<QuotaResult> {
    const used = await this.used(user, presented);
    if (used >= this.limit) return { allowed: false, remaining: 0 };
    const counter: Counter = {
      sub: user,
      day: quotaDay(this.now()),
      used: used + 1,
      exp: this.now() + 2 * 24 * 60 * 60 * 1000,
    };
    return {
      allowed: true,
      remaining: this.limit - counter.used,
      next: await seal(counter, this.key),
    };
  }
}
