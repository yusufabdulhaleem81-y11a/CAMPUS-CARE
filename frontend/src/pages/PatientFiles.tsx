import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StaffShell } from '../components/Shells';
import { Button, Card, Empty, ErrorMsg, Input, Loading, StatusPill, Tabs } from '../components/ui';
import { api } from '../lib/api';

interface PatientRow { id: string; unit_number: string; full_name: string; category: string; university_id: string | null }
interface TimelineEvent { at: string; kind: string; title: string; detail: string }
interface PatientFileData {
  patient: {
    id: string; unit_number: string; full_name: string; category: string; sex: string | null;
    date_of_birth: string | null; phone: string | null; blood_group: string | null; allergies: string | null;
    chronic_conditions: string | null; university_id: string | null; department: string | null;
    next_of_kin_name: string | null; next_of_kin_phone: string | null; is_verified: boolean;
  };
  encounters: { id: string; encounter_type: string; status: string; chief_complaint: string | null; opened_at: string }[];
  appointments: { id: string; reference: string; appointment_date: string; start_time: string; status: string }[];
  diagnoses: { id: string; name: string; code: string | null; diagnosed_at: string }[];
  prescriptions: { id: string; status: string; created_at: string; prescription_items: { medicine_name: string; dosage: string; frequency: string; quantity: number; dispensed_qty: number }[] }[];
  labs: { id: string; status: string; ordered_at: string; lab_tests: { name: string } | { name: string }[]; lab_results: { result_text: string } | { result_text: string }[] | null }[];
  dispensings: { id: string; quantity: number; dispensed_at: string; medicines: { name: string } | { name: string }[] }[];
}

function oneName(obj: unknown): string {
  return Array.isArray(obj) ? (obj[0] as { name?: string })?.name ?? '' : (obj as { name?: string })?.name ?? '';
}

const kindIcon: Record<string, string> = {
  visit: '🏥', diagnosis: '🩺', prescription: '💊', lab: '🧪', dispense: '📦',
};

export default function PatientFiles() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientRow[] | null>(null);
  const [fileId, setFileId] = useState<string | null>(params.get('file'));
  const [file, setFile] = useState<PatientFileData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [tab, setTab] = useState('timeline');
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback((id: string) => {
    setError(null);
    Promise.all([
      api<PatientFileData>(`/patients/${id}`),
      api<TimelineEvent[]>(`/patients/${id}/timeline`),
    ]).then(([f, t]) => { setFile(f); setTimeline(t); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => { if (fileId) loadFile(fileId); else setFile(null); }, [fileId, loadFile]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    api<PatientRow[]>(`/patients/search?q=${encodeURIComponent(query.trim())}`)
      .then(setResults).catch((err) => setError(err.message));
  }

  const p = file?.patient;

  return (
    <StaffShell title={p ? `Patient File — ${p.unit_number}` : 'Patient Files'}>
      {!p ? (
        <div className="mx-auto max-w-xl">
          <Card>
            <h2 className="mb-3 font-semibold text-navy">Open a clinic file</h2>
            <form onSubmit={search} className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Unit Number, ID, phone or name" aria-label="Search" />
              <Button type="submit">Search</Button>
            </form>
            <ErrorMsg>{error}</ErrorMsg>
            <div className="mt-4 flex flex-col gap-2">
              {results === null ? <p className="text-sm text-slate-500">Search opens the patient's complete digital file.</p>
                : results.length === 0 ? <Empty title="No patient matches that search." />
                  : results.map((r) => (
                    <button key={r.id} onClick={() => setFileId(r.id)}
                      className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-left hover:border-primary">
                      <span className="font-medium text-navy">{r.full_name}</span>
                      <span className="text-sm text-slate-500">{r.unit_number} · {r.category.replace('_', ' ')}</span>
                    </button>
                  ))}
            </div>
          </Card>
        </div>
      ) : (
        <>
          <button onClick={() => { setFileId(null); setFile(null); setQuery(''); setResults(null); }}
            className="mb-3 text-sm text-primary hover:underline no-print">← Search another file</button>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <p className="font-display text-xl font-bold text-primary-dark">{p.unit_number}</p>
              <p className="font-semibold text-navy">{p.full_name}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Category</dt><dd className="capitalize">{p.category.replace('_', ' ')}</dd></div>
                {p.university_id && <div className="flex justify-between"><dt className="text-slate-500">University ID</dt><dd>{p.university_id}</dd></div>}
                {p.department && <div className="flex justify-between"><dt className="text-slate-500">Department</dt><dd>{p.department}</dd></div>}
                <div className="flex justify-between"><dt className="text-slate-500">Sex</dt><dd className="capitalize">{p.sex ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Blood group</dt><dd>{p.blood_group ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd>{p.phone ?? '—'}</dd></div>
              </dl>
              {(p.allergies || p.chronic_conditions) && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  {p.allergies && <p><strong>Allergies:</strong> {p.allergies}</p>}
                  {p.chronic_conditions && <p><strong>Chronic:</strong> {p.chronic_conditions}</p>}
                </div>
              )}
              {(p.next_of_kin_name || p.next_of_kin_phone) && (
                <p className="mt-3 text-xs text-slate-500">Next of kin: {p.next_of_kin_name} {p.next_of_kin_phone ? `(${p.next_of_kin_phone})` : ''}</p>
              )}
              {file!.encounters.find((e) => e.status === 'open') && (
                <Link to={`/encounters/${file!.encounters.find((e) => e.status === 'open')!.id}`}
                  className="mt-4 block"><Button className="w-full">Open active encounter</Button></Link>
              )}
            </Card>

            <div className="lg:col-span-2">
              <Tabs active={tab} onChange={setTab} tabs={[
                { id: 'timeline', label: 'Timeline' },
                { id: 'visits', label: `Visits (${file!.encounters.length})` },
                { id: 'diagnoses', label: `Diagnoses (${file!.diagnoses.length})` },
                { id: 'meds', label: `Medicines (${file!.prescriptions.length})` },
                { id: 'labs', label: `Labs (${file!.labs.length})` },
              ]} />

              {tab === 'timeline' && (
                file === null || timeline.length === 0 && file!.encounters.length === 0 ? <Empty title="No history yet for this patient." /> : (
                  <ol className="relative ml-3 border-l-2 border-line">
                    {timeline.map((ev, i) => (
                      <li key={i} className="mb-4 ml-4">
                        <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-primary-light text-[9px]">{kindIcon[ev.kind] ?? '•'}</span>
                        <p className="text-sm font-medium text-navy">{ev.title}</p>
                        {ev.detail && <p className="text-sm text-slate-600">{ev.detail}</p>}
                        <p className="text-xs text-slate-400">{new Date(ev.at).toLocaleString()}</p>
                      </li>
                    ))}
                  </ol>
                )
              )}

              {tab === 'visits' && (file!.encounters.length === 0 ? <Empty title="No visits recorded." /> : (
                <div className="flex flex-col gap-2">
                  {file!.encounters.map((e) => (
                    <Card key={e.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-navy">{new Date(e.opened_at).toLocaleDateString()} · {e.encounter_type.replace('_', ' ')}</p>
                        <p className="text-sm text-slate-500">{e.chief_complaint || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill status={e.status} />
                        <Link to={`/encounters/${e.id}`}><Button size="sm" variant="secondary">Open</Button></Link>
                      </div>
                    </Card>
                  ))}
                </div>
              ))}

              {tab === 'diagnoses' && (file!.diagnoses.length === 0 ? <Empty title="No diagnoses recorded." /> : (
                <div className="flex flex-col gap-2">
                  {file!.diagnoses.map((d) => (
                    <Card key={d.id} className="py-3">
                      <p className="font-medium text-navy">{d.name} {d.code && <span className="text-sm text-slate-400">({d.code})</span>}</p>
                      <p className="text-xs text-slate-400">{new Date(d.diagnosed_at).toLocaleString()}</p>
                    </Card>
                  ))}
                </div>
              ))}

              {tab === 'meds' && (file!.prescriptions.length === 0 && file!.dispensings.length === 0 ? <Empty title="No prescriptions yet." /> : (
                <div className="flex flex-col gap-2">
                  {file!.prescriptions.map((rx) => (
                    <Card key={rx.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-navy">{new Date(rx.created_at).toLocaleDateString()}</p>
                        <StatusPill status={rx.status} />
                      </div>
                      <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                        {rx.prescription_items.map((it, idx) => (
                          <li key={idx}>{it.medicine_name} — {it.dosage}, {it.frequency} ({it.dispensed_qty}/{it.quantity} dispensed)</li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              ))}

              {tab === 'labs' && (file!.labs.length === 0 ? <Empty title="No lab orders yet." /> : (
                <div className="flex flex-col gap-2">
                  {file!.labs.map((l) => {
                    const result = Array.isArray(l.lab_results) ? l.lab_results[0] : l.lab_results;
                    return (
                      <Card key={l.id} className="py-3">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-navy">{oneName(l.lab_tests)}</p>
                          <StatusPill status={l.status} />
                        </div>
                        {result && l.status === 'released' && <p className="mt-2 text-sm text-slate-600">{result.result_text}</p>}
                      </Card>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {file === null && fileId && <Loading />}
    </StaffShell>
  );
}
