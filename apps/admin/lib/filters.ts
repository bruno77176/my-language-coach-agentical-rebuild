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
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  return {
    from: get("from") ?? firstOfMonth,
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
