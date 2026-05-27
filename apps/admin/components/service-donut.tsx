"use client";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function ServiceDonut({
  data,
}: {
  data: Array<{ service: string; costUsd: number }>;
}) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <h3 className="text-sm font-medium text-slate-600 mb-2">By service</h3>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="costUsd"
              nameKey="service"
              innerRadius={50}
              outerRadius={80}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
