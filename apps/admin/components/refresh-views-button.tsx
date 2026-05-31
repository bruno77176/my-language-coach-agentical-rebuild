"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Manual trigger for REFRESH MATERIALIZED VIEW CONCURRENTLY daily_cost_by_user.
// Useful when the pg_cron job hasn't run yet (or is misconfigured) and you want
// to see today's events in the dashboard now. Calls through /api/proxy so the
// existing server-side Supabase session attaches the bearer for us.
export function RefreshViewsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const isWorking = busy || pending;

  async function onClick() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/proxy/admin/refresh-views`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      setStatus("Refreshed");
      startTransition(() => router.refresh());
    } catch (e) {
      setStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {status ? (
        <span
          className={`text-xs ${status.startsWith("Failed") ? "text-red-600" : "text-slate-500"}`}
        >
          {status}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={isWorking}
        className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
      >
        {isWorking ? "Refreshing…" : "Refresh data"}
      </button>
    </div>
  );
}
