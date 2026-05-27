"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const PLATFORMS = ["", "ios", "android", "web", "server"];
const SERVICES = ["", "openai", "deepgram", "elevenlabs", "fly", "supabase"];

export function FilterBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  return (
    <div className="flex gap-3 items-end flex-wrap mb-6 bg-white rounded-xl p-4 shadow-sm border">
      <div>
        <label className="block text-xs text-slate-500">From</label>
        <input
          type="date"
          value={sp.get("from") ?? firstOfMonth}
          onChange={(e) => setParam("from", e.target.value)}
          className="border rounded px-2 py-1"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">To</label>
        <input
          type="date"
          value={sp.get("to") ?? today}
          onChange={(e) => setParam("to", e.target.value)}
          className="border rounded px-2 py-1"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Platform</label>
        <select
          value={sp.get("platform") ?? ""}
          onChange={(e) => setParam("platform", e.target.value)}
          className="border rounded px-2 py-1"
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p || "All"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500">Service</label>
        <select
          value={sp.get("service") ?? ""}
          onChange={(e) => setParam("service", e.target.value)}
          className="border rounded px-2 py-1"
        >
          {SERVICES.map((s) => (
            <option key={s} value={s}>
              {s || "All"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
