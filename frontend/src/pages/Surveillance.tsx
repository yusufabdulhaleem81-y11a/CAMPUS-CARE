import { useEffect, useState } from 'react';
import { StaffShell } from '../components/Shells';
import { Card, Empty, ErrorMsg, Loading, StatusPill } from '../components/ui';
import { api } from '../lib/api';

interface MonthlyRow { month: string; disease: string; cases: number }
interface WeeklyRow { week: string; disease: string; cases: number }
interface Outbreak { disease: string; current: number; expected: number }

interface Surveillance {
  monthly: MonthlyRow[];
  weekly: WeeklyRow[];
  topDiseases: string[];
  outbreaks: Outbreak[];
}

function casesByDisease(rows: { disease: string; cases: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.disease, (map.get(r.disease) ?? 0) + r.cases);
  return map;
}

export default function Surveillance() {
  const [data, setData] = useState<Surveillance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Surveillance>('/analytics/surveillance')
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load surveillance data.'));
  }, []);

  return (
    <StaffShell title="Disease Surveillance">
      <p className="mb-4 text-sm text-slate-500">
        Aggregated case counts from recorded diagnoses. No patient identifiers are shown here.
      </p>
      <ErrorMsg>{error}</ErrorMsg>
      {!data ? <Loading /> : (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 font-semibold text-navy">Outbreak alerts</h2>
            {data.outbreaks.length === 0 ? <Empty title="No outbreak signals. Weekly case counts are within expected ranges." /> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.outbreaks.map((o) => (
                  <Card key={o.disease} className="border-red-200 bg-red-50">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-red-900">{o.disease}</p>
                      <StatusPill status="critical" />
                    </div>
                    <p className="mt-1 text-sm text-red-800">
                      {o.current} cases this week — about {o.expected ? Math.round((o.current / o.expected) * 10) / 10 : o.current}× the
                      recent weekly average of {o.expected}.
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-semibold text-navy">Top diseases (last 30 days)</h2>
              {data.topDiseases.length === 0 ? <Empty title="No diagnoses recorded recently." /> : (
                (() => {
                  const counts = casesByDisease(data.monthly.filter((m) => m.month >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)));
                  const max = Math.max(...[...counts.values(), 1]);
                  return (
                    <ul className="space-y-2">
                      {data.topDiseases.map((d) => (
                        <li key={d} className="flex items-center gap-3 text-sm">
                          <span className="w-44 shrink-0 truncate font-medium text-navy">{d}</span>
                          <span className="h-2.5 rounded-full bg-primary" style={{ width: `${Math.max(((counts.get(d) ?? 0) / max) * 100, 2)}%` }} />
                          <span className="text-slate-600">{counts.get(d) ?? 0}</span>
                        </li>
                      ))}
                    </ul>
                  );
                })()
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-semibold text-navy">Monthly cases (last 6 months)</h2>
              {data.monthly.length === 0 ? <Empty title="No monthly trend data yet." /> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2">Disease</th>
                      {Object.keys(data.monthly.reduce<Record<string, true>>((acc, m) => { acc[m.month] = true; return acc; }, {}))
                        .sort().slice(-6).map((month) => <th key={month} className="pb-2 text-right">{month.slice(0, 7)}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(() => {
                      const months = Object.keys(data.monthly.reduce<Record<string, true>>((acc, m) => { acc[m.month] = true; return acc; }, {}))
                        .sort().slice(-6);
                      const diseases = [...new Set(data.monthly.map((m) => m.disease))];
                      const lookup = new Map(data.monthly.map((m) => [`${m.disease}|${m.month}`, m.cases]));
                      return diseases.map((d) => (
                        <tr key={d}>
                          <td className="py-2 font-medium text-navy">{d}</td>
                          {months.map((m) => <td key={m} className="py-2 text-right">{lookup.get(`${d}|${m}`) ?? 0}</td>)}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 font-semibold text-navy">Weekly case counts</h2>
            {data.weekly.length === 0 ? <Empty title="No weekly data yet." /> : (
              <ul className="divide-y divide-line">
                {[...data.weekly].sort((a, b) => b.week.localeCompare(a.week)).slice(0, 20).map((w) => (
                  <li key={`${w.week}-${w.disease}`} className="flex justify-between py-2 text-sm">
                    <span className="font-medium text-navy">{w.disease}</span>
                    <span className="text-slate-500">week of {w.week}</span>
                    <span className="font-medium">{w.cases} cases</span>
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
