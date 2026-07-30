import { useEffect, useState } from 'react';
import { dashboardSummaryApi } from '../api/client';
import type { DashboardSummary } from '../api/types';

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardSummaryApi
      .get()
      .then(setSummary)
      .catch(() => setError('Failed to load dashboard summary.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error) return <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!summary) return null;

  const totalCerts = Object.values(summary.certification_counts).reduce((a, b) => a + b, 0);
  const activePct = totalCerts > 0 ? Math.round((summary.certification_counts.ACTIVE / totalCerts) * 100) : 0;
  const maxDeptTotal = Math.max(1, ...summary.by_department.map((d) => d.total));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Org Capability Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total positions" value={summary.total_positions} />
        <StatTile label="Vacant positions" value={summary.vacant_positions} />
        <StatTile label="Employees on the bench" value={summary.bench_count} />
        <StatTile label="Certification compliance" value={`${activePct}%`} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Positions by department (vacancies highlighted)</h2>
        <div className="space-y-2">
          {summary.by_department.map((d) => (
            <div key={d.department} className="flex items-center gap-3 text-sm">
              <div className="w-32 shrink-0">{d.department}</div>
              <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                <div
                  className="h-full bg-orange-400"
                  style={{ width: `${(d.total / maxDeptTotal) * 100}%` }}
                  title={`${d.total} positions, ${d.vacant} vacant`}
                />
              </div>
              <div className="w-24 shrink-0 text-gray-500">
                {d.total} total, {d.vacant} vacant
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Certification status breakdown</h2>
        <div className="flex gap-4 text-sm">
          {Object.entries(summary.certification_counts).map(([status, count]) => (
            <div key={status}>
              <span className="font-semibold">{count}</span> {status.replaceAll('_', ' ').toLowerCase()}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
