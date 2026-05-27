import { FilterBar } from "@/components/filter-bar";
import { formatUsd } from "@/components/kpi-card";
import { CostAreaChart } from "@/components/cost-area-chart";
import { apiGet } from "@/lib/api-client";
import { filtersFromSearchParams, filtersToQuery } from "@/lib/filters";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const f = filtersFromSearchParams(searchParams);
  const q = filtersToQuery(f);
  const [rows, ts] = await Promise.all([
    apiGet<Array<{
      service: string;
      costUsd: number;
      units: number;
      eventCount: number;
    }>>(`/admin/by-service?${q}`),
    apiGet<Array<{ day: string; service: string; costUsd: number }>>(
      `/admin/timeseries?${q}`,
    ),
  ]);

  return (
    <>
      <FilterBar />
      <CostAreaChart data={ts} />
      <div className="bg-white border rounded-xl mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">Service</th>
              <th className="text-right px-4 py-2">Cost</th>
              <th className="text-right px-4 py-2">Units</th>
              <th className="text-right px-4 py-2">Events</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.service} className="border-t">
                <td className="px-4 py-2 font-medium">{r.service}</td>
                <td className="px-4 py-2 text-right">{formatUsd(r.costUsd)}</td>
                <td className="px-4 py-2 text-right">
                  {Number(r.units).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">{r.eventCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
