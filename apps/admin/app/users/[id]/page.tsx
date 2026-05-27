import { FilterBar } from "@/components/filter-bar";
import { KpiCard, formatUsd } from "@/components/kpi-card";
import { CostAreaChart } from "@/components/cost-area-chart";
import { ServiceDonut } from "@/components/service-donut";
import { apiGet } from "@/lib/api-client";
import { filtersFromSearchParams, filtersToQuery } from "@/lib/filters";

export const dynamic = "force-dynamic";

type Detail = {
  userId: string;
  overview: {
    variableCostUsd: number;
    eventCount: number;
    activeUsers: number;
  };
  byService: Array<{ service: string; costUsd: number }>;
  timeseries: Array<{ day: string; service: string; costUsd: number }>;
};

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const f = { ...filtersFromSearchParams(searchParams), userId: params.id };
  const q = filtersToQuery(f);
  const data = await apiGet<Detail>(`/admin/users/${params.id}?${q}`);

  return (
    <>
      <FilterBar />
      <h1 className="text-xl font-semibold mb-4">
        User {params.id.slice(0, 8)}…
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <KpiCard
          label="Cost"
          value={formatUsd(data.overview.variableCostUsd)}
        />
        <KpiCard label="Events" value={data.overview.eventCount.toString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CostAreaChart data={data.timeseries} />
        </div>
        <ServiceDonut data={data.byService} />
      </div>
    </>
  );
}
