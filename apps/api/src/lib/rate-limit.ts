// In-memory sliding-window burst limiter (BRU-35). Guards against a single
// buggy/abusive client firing unbounded turns → runaway provider spend. This is
// per-machine (with ≥2 Fly machines a user could get up to N× the limit), which
// is fine for a burst guard layered on top of the daily usage quota.

const windows = new Map<string, number[]>();

/**
 * Returns true if a request keyed by `id` is allowed: at most `maxInWindow`
 * requests per `windowMs`. Side-effect: records the request when allowed.
 */
export function allowRequest(
  id: string,
  maxInWindow: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const cutoff = now - windowMs;
  const recent = (windows.get(id) ?? []).filter((t) => t > cutoff);
  if (recent.length >= maxInWindow) {
    windows.set(id, recent);
    return false;
  }
  recent.push(now);
  windows.set(id, recent);
  return true;
}

// Test/maintenance helper — clear all windows.
export function __resetRateLimit(): void {
  windows.clear();
}
