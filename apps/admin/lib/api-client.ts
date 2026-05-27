import { createSupabaseServer } from "./supabase-server";

export async function apiGet<T>(path: string): Promise<T> {
  const sb = createSupabaseServer();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${process.env.API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function apiSend<T>(
  path: string,
  body: unknown,
  method: "POST" | "PATCH" | "DELETE" = "POST",
): Promise<T> {
  const sb = createSupabaseServer();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${process.env.API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: method === "DELETE" ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
