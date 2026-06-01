export type Filters = {
  from: string;
  to: string;
  platform?: string;
  service?: string;
  userId?: string;
};

export function filtersFromSearchParams(
  sp: URLSearchParams | Record<string, string | undefined>,
): Filters {
  const get = (k: string): string | undefined =>
    sp instanceof URLSearchParams ? (sp.get(k) ?? undefined) : sp[k];
  const now = new Date();
  // Anchored start so the default view never accidentally hides activity.
  // Bump forward when 2026 data stops being relevant.
  const defaultFrom = "2026-01-01";
  const today = now.toISOString().slice(0, 10);
  return {
    from: get("from") ?? defaultFrom,
    to: get("to") ?? today,
    platform: get("platform"),
    service: get("service"),
    userId: get("userId"),
  };
}

export function filtersToQuery(f: Filters): string {
  const sp = new URLSearchParams();
  sp.set("from", f.from);
  sp.set("to", f.to);
  if (f.platform) sp.set("platform", f.platform);
  if (f.service) sp.set("service", f.service);
  if (f.userId) sp.set("userId", f.userId);
  return sp.toString();
}
