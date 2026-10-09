import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StaffShell } from '../components/Shells';
import { Button, Card, Empty, ErrorMsg, Loading, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Vitals { temperature_c: string | null; systolic: number | null; diastolic: number | null; pulse: number | null; spo2: number | null }
interface QueueRow {
  id: string;
  queue_number: number;
  status: string;
  priority: number;
  patient_id: string;
  encounter_id: string;
  created_at: string;
  patients: { unit_number: string; full_name: string; category: string } | { unit_number: string; full_name: string; category: string }[];
  encounters: {
    chief_complaint: string | null; encounter_type: string; status: string;
    vitals: Vitals | Vitals[] | null;
    nursing_assessments: { assessment: string; escalated_to_doctor: boolean } | { assessment: string; escalated_to_doctor: boolean }[] | null;
    consultations: { id: string } | { id: string }[] | null;
  } | { chief_complaint: string; encounter_type: string; status: string; vitals: never[]; nursing_assessments: never[]; consultations: never[] }[];
}

function one<T>(obj: T | T[] | null | undefined): T | null {
  if (obj == null) return null;
  return Array.isArray(obj) ? (obj[0] ?? null) : obj;
}

export default function Queue() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<QueueRow[]>('/queue').then(setRows).catch((e) => { setError(e.message); setRows([]); });
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, action: string) {
    setBusyId(id); setError(null);
    try {
      await api(`/queue/${id}/${action}`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  if (!profile) return null;

  return (
    <StaffShell title="Clinic Queue">
      <ErrorMsg>{error}</ErrorMsg>
      {rows === null ? <Loading /> : rows.length === 0 ? (
        <Empty title="The queue is empty. Check in patients at reception." />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const patient = one(row.patients);
            const enc = one(row.encounters);
            const vitals = one(enc?.vitals ?? null);
            const nursing = one(enc?.nursing_assessments ?? null);
            const consult = one(enc?.consultations ?? null);
            const isEmergency = row.priority === 1;
            return (
              <Card key={row.id} className={isEmergency ? 'border-red-300 bg-red-50/60' : ''}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl font-display font-bold ${isEmergency ? 'bg-red-700 text-white' : 'bg-navy text-white'}`}>
                      <span className="text-lg leading-none">{row.queue_number}</span>
                      <span className="text-[10px] uppercase opacity-80">queue</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-navy">{patient?.full_name}</p>
                        <span className="text-sm text-slate-500">{patient?.unit_number}</span>
                        {isEmergency && <StatusPill status="critical" />}
                      </div>
                      <p className="text-sm text-slate-600">{enc?.chief_complaint || 'No complaint recorded'}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{enc?.encounter_type.replace('_', ' ')}</span>
                        {vitals && <span>· Vitals ✓</span>}
                        {nursing && <span>· Nursing notes ✓</span>}
                        {nursing?.escalated_to_doctor && <span className="font-semibold text-red-700">· Escalated to doctor</span>}
                        {consult && <span>· Consultation ✓</span>}
                      </div>
                      {vitals && (
                        <p className="mt-1 text-xs text-slate-500">
                          {vitals.temperature_c && `Temp ${vitals.temperature_c}°C `}
                          {vitals.systolic && `BP ${vitals.systolic}/${vitals.diastolic} `}
                          {vitals.pulse && `Pulse ${vitals.pulse} `}
                          {vitals.spo2 && `SpO₂ ${vitals.spo2}%`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusPill status={row.status} />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link to={`/encounters/${row.encounter_id}`}>
                        <Button size="sm" variant="secondary">Open encounter</Button>
                      </Link>
                      {row.status === 'waiting' && (
                        <Button size="sm" busy={busyId === row.id} onClick={() => act(row.id, 'call')}>Call</Button>
                      )}
                      {row.status === 'called' && (
                        <Button size="sm" busy={busyId === row.id} onClick={() => act(row.id, 'start')}>Start</Button>
                      )}
                      {(row.status === 'in_consult' || row.status === 'called') && (
                        <Button size="sm" variant="danger" busy={busyId === row.id} onClick={() => act(row.id, 'complete')}>Complete</Button>
                      )}
                      {row.status === 'waiting' && (
                        <Button size="sm" variant="ghost" busy={busyId === row.id} onClick={() => act(row.id, 'skip')}>Skip</Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </StaffShell>
  );
}
