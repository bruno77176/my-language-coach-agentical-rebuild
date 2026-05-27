import { FilterBar } from "@/components/filter-bar";
import { KpiCard, formatUsd } from "@/components/kpi-card";
import { CostAreaChart } from "@/components/cost-area-chart";
import { ServiceDonut } from "@/components/service-donut";
import { PlatformBar } from "@/components/platform-bar";
import { apiGet } from "@/lib/api-client";
import { filtersFromSearchParams, filtersToQuery } from "@/lib/filters";

export const dynamic = "force-dynamic";
export const revalidate = 30; // poll-ish

type Overview = {
  variableCostUsd: number;
  fixedCostUsd: number;
  upfrontCostUsd: number;
  totalCostUsd: number;
  activeUsers: number;
  eventCount: number;
  costPerActiveUser: number;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const f = filtersFromSearchParams(searchParams);
  const q = filtersToQuery(f);
  const [overview, byService, byPlatform, ts] = await Promise.all([
    apiGet<Overview>(`/admin/overview?${q}`),
    apiGet<Array<{ service: string; costUsd: number }>>(
      `/admin/by-service?${q}`,
    ),
    apiGet<Array<{ platform: string; costUsd: number }>>(
      `/admin/by-platform?${q}`,
    ),
    apiGet<Array<{ day: string; service: string; costUsd: number }>>(
      `/admin/timeseries?${q}`,
    ),
  ]);

  return (
    <>
      <FilterBar />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total" value={formatUsd(overview.totalCostUsd)} />
        <KpiCard label="Variable" value={formatUsd(overview.variableCostUsd)} />
        <KpiCard
          label="Infra"
          value={formatUsd(overview.fixedCostUsd + overview.upfrontCostUsd)}
          sub={
            f.userId
              ? "Hidden — not per-user attributable"
              : "Fixed + amortized upfront"
          }
        />
        <KpiCard
          label="Active users"
          value={overview.activeUsers.toString()}
          sub={
            overview.activeUsers > 0
              ? `${formatUsd(overview.costPerActiveUser)} / user`
              : "—"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <CostAreaChart data={ts} />
        </div>
        <ServiceDonut data={byService} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlatformBar data={byPlatform} />
      </div>
    </>
  );
}
