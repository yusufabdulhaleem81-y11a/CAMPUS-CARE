import { useEffect, useState } from 'react';
import { StaffShell } from '../components/Shells';
import { Card, Empty, ErrorMsg, Loading, StatusPill } from '../components/ui';
import { api } from '../lib/api';

interface Overview {
  kpis: { label: string; value: number; unit?: string }[];
  flowByDay: { date: string; encounters: number }[];
  staffOnDuty: { id: string; profiles: { full_name: string; role: string } | { full_name: string; role: string }[] }[];
  stockAlerts: { id: string; alert_level: string; medicines: { name: string } | { name: string }[] }[];
}

interface Insight {
  severity: 'info' | 'warning' | 'critical';
  area: string;
  metric: string;
  insight: string;
  recommendation: string;
}

interface Insights { insights: Insight[] }

function relationName(value: { full_name?: string; name?: string } | { full_name?: string; name?: string }[]): string {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.full_name ?? row?.name ?? 'Unknown';
}

export default function Management() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Overview>('/analytics/overview'), api<Insights>('/analytics/insights')])
      .then(([summary, recommendations]) => {
        setOverview(summary);
        setInsights(recommendations.insights);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load management data.'));
  }, []);

  return (
    <StaffShell title="Management">
      <ErrorMsg>{error}</ErrorMsg>
      {!overview || !insights ? <Loading /> : (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 font-semibold text-navy">Clinic overview</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {overview.kpis.map((kpi) => (
                <Card key={kpi.label}>
                  <p className="text-sm text-slate-500">{kpi.label}</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-navy">{kpi.value}{kpi.unit ? ` ${kpi.unit}` : ''}</p>
                </Card>
              ))}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-semibold text-navy">Recent patient flow</h2>
              {overview.flowByDay.length === 0 ? <Empty title="No patient-flow data yet." /> : (
                <ul className="divide-y divide-line">
                  {overview.flowByDay.slice(-14).reverse().map((day) => (
                    <li key={day.date} className="flex justify-between py-2 text-sm">
                      <time dateTime={day.date}>{day.date}</time>
                      <span className="font-medium">{day.encounters} patients</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold text-navy">Staff on duty</h2>
              {overview.staffOnDuty.length === 0 ? <Empty title="No staff are currently on duty." /> : (
                <ul className="space-y-2">
                  {overview.staffOnDuty.map((staff) => (
                    <li key={staff.id} className="flex justify-between rounded-lg bg-bg px-3 py-2 text-sm">
                      <span>{relationName(staff.profiles)}</span>
                      <span className="text-slate-500">{Array.isArray(staff.profiles) ? staff.profiles[0]?.role : staff.profiles.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 font-semibold text-navy">Stock alerts</h2>
            {overview.stockAlerts.length === 0 ? <Empty title="No active stock alerts." /> : (
              <ul className="space-y-2">
                {overview.stockAlerts.map((alert) => (
                  <li key={alert.id} className="flex items-center justify-between gap-3 rounded-lg bg-bg px-3 py-2 text-sm">
                    <span>{relationName(alert.medicines)}</span>
                    <StatusPill status={alert.alert_level} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-navy">Operational insights</h2>
            {insights.length === 0 ? <Empty title="No recommendations right now." /> : (
              <ul className="space-y-3">
                {insights.map((item, index) => (
                  <li key={`${item.area}-${index}`} className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={item.severity} />
                      <span className="text-sm font-medium text-navy">{item.area} · {item.metric}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{item.insight}</p>
                    <p className="mt-1 text-sm text-slate-700"><strong>Recommendation:</strong> {item.recommendation}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </StaffShell>
  );
}
