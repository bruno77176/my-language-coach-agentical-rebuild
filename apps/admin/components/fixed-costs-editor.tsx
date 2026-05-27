"use client";
import { useState } from "react";

type Row = {
  id: string;
  service: string;
  amount_usd: string;
  period: "monthly" | "yearly";
  started_on: string;
  ended_on: string | null;
  notes: string | null;
};

export function FixedCostsEditor({ initial }: { initial: Row[] }) {
  const [rows] = useState(initial);
  const [form, setForm] = useState({
    service: "",
    amountUsd: "",
    period: "monthly" as "monthly" | "yearly",
    startedOn: "",
    endedOn: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        service: form.service,
        amountUsd: form.amountUsd,
        period: form.period,
        startedOn: form.startedOn,
        endedOn: form.endedOn || null,
        notes: form.notes || undefined,
      };
      const res = await fetch("/api/proxy/admin/fixed-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      window.location.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this fixed cost?")) return;
    try {
      const res = await fetch(`/api/proxy/admin/fixed-costs/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      window.location.reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div>
      <table className="w-full text-sm bg-white border rounded-xl overflow-hidden mb-4">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="text-left px-3 py-2">Service</th>
            <th className="text-right px-3 py-2">Amount</th>
            <th className="text-left px-3 py-2">Period</th>
            <th className="text-left px-3 py-2">Started</th>
            <th className="text-left px-3 py-2">Ended</th>
            <th className="text-right px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{r.service}</td>
              <td className="px-3 py-2 text-right font-mono">{r.amount_usd}</td>
              <td className="px-3 py-2">{r.period}</td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {new Date(r.started_on).toLocaleDateString()}
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {r.ended_on
                  ? new Date(r.ended_on).toLocaleDateString()
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => remove(r.id)}
                  className="text-red-700 text-xs hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        onSubmit={submit}
        className="bg-white border rounded-xl p-3 flex gap-2 flex-wrap items-end"
      >
        <div>
          <label className="block text-xs text-slate-500">Service</label>
          <input
            value={form.service}
            onChange={(e) => setForm({ ...form, service: e.target.value })}
            className="border rounded px-2 py-1"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Amount USD</label>
          <input
            value={form.amountUsd}
            onChange={(e) => setForm({ ...form, amountUsd: e.target.value })}
            className="border rounded px-2 py-1"
            required
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Period</label>
          <select
            value={form.period}
            onChange={(e) =>
              setForm({
                ...form,
                period: e.target.value as "monthly" | "yearly",
              })
            }
            className="border rounded px-2 py-1"
            required
          >
            <option value="monthly">monthly</option>
            <option value="yearly">yearly</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Started on</label>
          <input
            type="date"
            value={form.startedOn}
            onChange={(e) => setForm({ ...form, startedOn: e.target.value })}
            className="border rounded px-2 py-1"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Ended on</label>
          <input
            type="date"
            value={form.endedOn}
            onChange={(e) => setForm({ ...form, endedOn: e.target.value })}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Notes</label>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="border rounded px-2 py-1"
          />
        </div>
        <button
          disabled={saving}
          className="bg-slate-900 text-white rounded px-3 py-1"
        >
          {saving ? "Saving…" : "Add fixed cost"}
        </button>
        {err && <span className="text-red-700 text-xs">{err}</span>}
      </form>
    </div>
  );
}
