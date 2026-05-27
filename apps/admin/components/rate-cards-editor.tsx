"use client";
import { useState } from "react";

type Row = {
  id: string;
  provider: string;
  operation: string;
  unit_type: string;
  price_per_unit: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
};

export function RateCardsEditor({ initial }: { initial: Row[] }) {
  const [rows] = useState(initial);
  const [form, setForm] = useState({
    provider: "",
    operation: "",
    unitType: "",
    pricePerUnit: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/proxy/admin/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      window.location.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <table className="w-full text-sm bg-white border rounded-xl overflow-hidden mb-4">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="text-left px-3 py-2">Provider</th>
            <th className="text-left px-3 py-2">Operation</th>
            <th className="text-left px-3 py-2">Unit</th>
            <th className="text-right px-3 py-2">Price</th>
            <th className="text-left px-3 py-2">From</th>
            <th className="text-left px-3 py-2">To</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{r.provider}</td>
              <td className="px-3 py-2">{r.operation}</td>
              <td className="px-3 py-2">{r.unit_type}</td>
              <td className="px-3 py-2 text-right font-mono">
                {r.price_per_unit}
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {new Date(r.effective_from).toLocaleDateString()}
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {r.effective_to
                  ? new Date(r.effective_to).toLocaleDateString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        onSubmit={submit}
        className="bg-white border rounded-xl p-3 flex gap-2 flex-wrap items-end"
      >
        {(
          [
            "provider",
            "operation",
            "unitType",
            "pricePerUnit",
            "notes",
          ] as const
        ).map((k) => (
          <div key={k}>
            <label className="block text-xs text-slate-500 capitalize">
              {k}
            </label>
            <input
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="border rounded px-2 py-1"
              required={k !== "notes"}
            />
          </div>
        ))}
        <button
          disabled={saving}
          className="bg-slate-900 text-white rounded px-3 py-1"
        >
          {saving ? "Saving…" : "Add new rate"}
        </button>
        {err && <span className="text-red-700 text-xs">{err}</span>}
      </form>
    </div>
  );
}
