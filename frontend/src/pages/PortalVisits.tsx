import { useEffect, useState } from 'react';
import { PatientShell } from '../components/Shells';
import { Card, Empty, ErrorMsg, Loading, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Visit {
  encounters: { id: string; encounter_type: string; status: string; chief_complaint: string | null; opened_at: string }[];
  prescriptions: { id: string; status: string; created_at: string; prescription_items: { medicine_name: string; dosage: string; frequency: string }[] }[];
  dispensings: { id: string; quantity: number; dispensed_at: string; medicines: { name: string } | { name: string }[]; prescription_items: { dosage: string; frequency: string } | { dosage: string; frequency: string }[] }[];
}

function name(obj: unknown): string {
  if (Array.isArray(obj)) return (obj[0] as { name?: string })?.name ?? '';
  return (obj as { name?: string })?.name ?? '';
}

export default function PortalVisits() {
  const { patient } = useAuth();
  const [data, setData] = useState<Visit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patient) api<Visit>(`/patients/${patient.id}/visits`)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load your visits.'));
  }, [patient]);

  if (!patient) return null;
  if (!data) return <PatientShell>{error ? <ErrorMsg>{error}</ErrorMsg> : <Loading />}</PatientShell>;

  return (
    <PatientShell>
      <h1 className="font-display text-2xl font-semibold text-navy">My visits</h1>

      <div className="mt-4">
        <h2 className="mb-2 font-semibold text-navy">Clinic visits</h2>
        {data.encounters.length === 0 ? <Empty title="No visit yet. Book your first visit." /> : (
          <div className="flex flex-col gap-2">
            {data.encounters.map((e) => (
              <Card key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-navy">{new Date(e.opened_at).toLocaleDateString()} · {e.encounter_type.replace('_', ' ')}</p>
                  <p className="text-sm text-slate-500">{e.chief_complaint || '—'}</p>
                </div>
                <StatusPill status={e.status} />
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-2 font-semibold text-navy">Prescriptions & medicines</h2>
        {data.prescriptions.length === 0 && data.dispensings.length === 0 ? (
          <Empty title="No medicines yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {data.prescriptions.map((rx) => (
              <Card key={rx.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-navy">{new Date(rx.created_at).toLocaleDateString()}</p>
                  <StatusPill status={rx.status} />
                </div>
                <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                  {rx.prescription_items.map((it, i) => (
                    <li key={i}>{it.medicine_name} — {it.dosage}, {it.frequency}</li>
                  ))}
                </ul>
              </Card>
            ))}
            {data.dispensings.length > 0 && (
              <Card className="py-3">
                <p className="font-medium text-navy">Dispensed medicines</p>
                <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                  {data.dispensings.map((d) => (
                    <li key={d.id}>{name(d.medicines)} × {d.quantity} — {new Date(d.dispensed_at).toLocaleDateString()}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>
    </PatientShell>
  );
}
