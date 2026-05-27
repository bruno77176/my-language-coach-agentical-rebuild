"use client";
import { useState } from "react";

type Row = {
  id: string;
  label: string;
  amount_usd: string;
  paid_on: string;
  amortize_months: number | null;
  notes: string | null;
};

export function UpfrontCostsEditor({ initial }: { initial: Row[] }) {
  const [rows] = useState(initial);
  const [form, setForm] = useState({
    label: "",
    amountUsd: "",
    paidOn: "",
    amortizeMonths: "",
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
        label: form.label,
        amountUsd: form.amountUsd,
        paidOn: form.paidOn,
        amortizeMonths: form.amortizeMonths
          ? Number(form.amortizeMonths)
          : null,
        notes: form.notes || undefined,
      };
      const res = await fetch("/api/proxy/admin/upfront-costs", {
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
    if (!confirm("Delete this upfront cost?")) return;
    try {
      const res = await fetch(`/api/proxy/admin/upfront-costs/${id}`, {
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
            <th className="text-left px-3 py-2">Label</th>
            <th className="text-right px-3 py-2">Amount</th>
            <th className="text-left px-3 py-2">Paid on</th>
            <th className="text-right px-3 py-2">Amortize months</th>
            <th className="text-right px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{r.label}</td>
              <td className="px-3 py-2 text-right font-mono">{r.amount_usd}</td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {new Date(r.paid_on).toLocaleDateString()}
              </td>
              <td className="px-3 py-2 text-right">
                {r.amortize_months ?? "—"}
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
          <label className="block text-xs text-slate-500">Label</label>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
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
          <label className="block text-xs text-slate-500">Paid on</label>
          <input
            type="date"
            value={form.paidOn}
            onChange={(e) => setForm({ ...form, paidOn: e.target.value })}
            className="border rounded px-2 py-1"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">
            Amortize months
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={form.amortizeMonths}
            onChange={(e) =>
              setForm({ ...form, amortizeMonths: e.target.value })
            }
            className="border rounded px-2 py-1 w-28"
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
          {saving ? "Saving…" : "Add upfront cost"}
        </button>
        {err && <span className="text-red-700 text-xs">{err}</span>}
      </form>
    </div>
  );
}
