export class TimeoutError extends Error {
  constructor(ms: number, label: string) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Reject if a promise doesn't settle within `ms`. Bounds a provider call's
 * latency so a slow upstream can't hang a turn and hold a concurrency slot
 * (BRU-35). Note: the underlying request isn't aborted (SDKs without signal
 * support), but the caller stops waiting — an acceptable stopgap.
 */
export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms, label)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
