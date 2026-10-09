import { useEffect, useState } from 'react';
import { PatientShell } from '../components/Shells';
import { Card, Empty, ErrorMsg, Loading } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface LabOrder {
  id: string;
  ordered_at: string;
  status: string;
  lab_tests: { name: string; code: string } | { name: string; code: string }[];
  lab_results: { result_text: string; remarks: string | null; entered_at: string } | { result_text: string; remarks: string | null; entered_at: string }[] | null;
}

export default function PortalResults() {
  const { patient } = useAuth();
  const [orders, setOrders] = useState<LabOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<LabOrder[]>('/lab/orders/mine')
      .then(setOrders)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load your results.'));
  }, [patient]);

  if (orders === null) return <PatientShell>{error ? <ErrorMsg>{error}</ErrorMsg> : <Loading />}</PatientShell>;

  return (
    <PatientShell>
      <h1 className="font-display text-2xl font-semibold text-navy">Test results</h1>
      <p className="mt-1 text-sm text-slate-500">Results appear here only after the laboratory releases them.</p>

      <div className="mt-4 flex flex-col gap-3">
        {orders.length === 0 ? (
          <Empty title="No released results yet. We will tell you when ready. No need to queue." />
        ) : orders.map((o) => {
          const test = Array.isArray(o.lab_tests) ? o.lab_tests[0] : o.lab_tests;
          const result = Array.isArray(o.lab_results) ? o.lab_results[0] : o.lab_results;
          return (
            <Card key={o.id}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-navy">{test?.name ?? 'Test'} <span className="text-sm text-slate-400">({test?.code})</span></p>
                <span className="text-sm text-slate-500">{new Date(o.ordered_at).toLocaleDateString()}</span>
              </div>
              {result ? (
                <div className="mt-3 rounded-lg bg-bg p-3">
                  <p className="text-sm text-slate-700">{result.result_text}</p>
                  {result.remarks && <p className="mt-1 text-xs text-slate-500">Remarks: {result.remarks}</p>}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Result pending release.</p>
              )}
            </Card>
          );
        })}
      </div>
    </PatientShell>
  );
}
