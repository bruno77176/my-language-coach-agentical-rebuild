import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { formatUsd } from "@/components/kpi-card";
import { apiGet } from "@/lib/api-client";
import { filtersFromSearchParams, filtersToQuery } from "@/lib/filters";

export const dynamic = "force-dynamic";
export const revalidate = 30;

type UserRow = {
  userId: string | null;
  costUsd: number;
  eventCount: number;
  lastSeenAt: string | null;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const f = filtersFromSearchParams(searchParams);
  const q = filtersToQuery(f);
  const rows = await apiGet<UserRow[]>(`/admin/by-user?${q}`);

  return (
    <>
      <FilterBar />
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">User</th>
              <th className="text-right px-4 py-2">Cost</th>
              <th className="text-right px-4 py-2">Events</th>
              <th className="text-right px-4 py-2">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-2">
                  {r.userId ? (
                    <Link
                      href={`/users/${r.userId}?${q}`}
                      className="text-blue-700 underline"
                    >
                      {r.userId.slice(0, 8)}…
                    </Link>
                  ) : (
                    <span className="text-slate-400">unattributed</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">{formatUsd(r.costUsd)}</td>
                <td className="px-4 py-2 text-right">{r.eventCount}</td>
                <td className="px-4 py-2 text-right text-slate-500">
                  {r.lastSeenAt
                    ? new Date(r.lastSeenAt).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
