/**
 * Local-midnight daily-window helpers, built on the platform `Intl` API (no
 * extra dependency).
 *
 * The free/Pro daily voice cap resets at the user's local midnight (their
 * `profiles.timezone`) rather than on a rolling 24h timer — otherwise a user who
 * exhausts their allowance just before a rolling boundary gets a fresh one
 * minutes later. The day-key comparison is always exact; the reset *instant*
 * can drift up to ~1h around a DST transition (twice a year), which we accept.
 */

/** `"YYYY-MM-DD"` for `instant` in the given IANA `timeZone`. */
export function localDayKey(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Offset in ms (local wall-clock − UTC) of `timeZone` at `instant`. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const f: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") f[p.type] = Number(p.value);
  const asUtc = Date.UTC(
    f.year!,
    f.month! - 1,
    f.day!,
    f.hour!,
    f.minute!,
    f.second!,
  );
  return asUtc - instant.getTime();
}

/** UTC instant of the next 00:00 local time in `timeZone` strictly after `instant`. */
export function nextLocalMidnightUtc(instant: Date, timeZone: string): Date {
  const key = localDayKey(instant, timeZone); // today's local Y-M-D in tz
  const [y, m, d] = key.split("-").map(Number);
  // Tomorrow's local calendar date (date math in UTC to avoid host-tz effects).
  const tomorrow = new Date(Date.UTC(y!, m! - 1, d!) + 24 * 60 * 60 * 1000);
  // Wall-clock "tomorrow 00:00 local", expressed first as if it were UTC...
  const wallAsUtc = Date.UTC(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth(),
    tomorrow.getUTCDate(),
    0,
    0,
    0,
  );
  // ...then shifted by the tz offset near that instant to get the true UTC time.
  const offset = tzOffsetMs(new Date(wallAsUtc), timeZone);
  return new Date(wallAsUtc - offset);
}
