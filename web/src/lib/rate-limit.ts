/**
 * Fixed-window limiter held in process memory. It blunts password guessing and
 * share-token enumeration against a single instance; a multi-instance
 * deployment needs a shared store to make this a real guarantee.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const MAX_TRACKED_KEYS = 10_000;

export type RateLimit = { ok: boolean; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimit {
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size > MAX_TRACKED_KEYS) {
      for (const [candidate, window] of windows) {
        if (window.resetAt <= now) windows.delete(candidate);
      }
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { ok: true, retryAfterSeconds: 0 };
}

/** Best-effort client identity for limiting. Spoofable, but not by a browser. */
export function clientKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}

export function resetRateLimits() {
  windows.clear();
}
