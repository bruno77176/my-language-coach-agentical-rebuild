"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function PlatformBar({
  data,
}: {
  data: Array<{ platform: string; costUsd: number }>;
}) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <h3 className="text-sm font-medium text-slate-600 mb-2">By platform</h3>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="platform" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="costUsd" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
