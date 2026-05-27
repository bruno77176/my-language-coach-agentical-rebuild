"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

type Point = { day: string; service: string; costUsd: number };
type Row = { day: string } & Record<string, number | string>;

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9"];

export function CostAreaChart({ data }: { data: Point[] }) {
  // Pivot: rows = day, cols = service
  const services = Array.from(new Set(data.map((d) => d.service)));
  const byDay = new Map<string, Row>();
  for (const p of data) {
    const row: Row = byDay.get(p.day) ?? { day: p.day };
    row[p.service] = p.costUsd;
    byDay.set(p.day, row);
  }
  const pivoted = Array.from(byDay.values());

  return (
    <div className="bg-white border rounded-xl p-4">
      <h3 className="text-sm font-medium text-slate-600 mb-2">
        Daily cost by service
      </h3>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <AreaChart data={pivoted}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend />
            {services.map((s, i) => (
              <Area
                key={s}
                type="monotone"
                dataKey={s}
                stackId="1"
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
