import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StaffShell } from '../components/Shells';
import { Button, Card, ErrorMsg, Field, Input, Loading, StatusPill, SuccessMsg, Tabs, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface EncounterData {
  encounter: { id: string; patient_id: string; encounter_type: string; status: string; chief_complaint: string | null; opened_at: string };
  patient: { id: string; unit_number: string; full_name: string; allergies: string | null; chronic_conditions: string | null; blood_group: string | null; date_of_birth: string | null; sex: string | null };
  vitals: { temperature_c: string | null; systolic: number | null; diastolic: number | null; pulse: number | null; resp_rate: number | null; spo2: number | null; weight_kg: string | null; height_cm: string | null; recorded_at: string }[];
  nursing: { assessment: string; intervention: string | null; escalated_to_doctor: boolean; recorded_at: string }[];
  consultation: { presentation: string; examination: string | null; treatment_plan: string | null; follow_up_date: string | null } | null;
  diagnoses: { id: string; name: string; code: string | null; diagnosed_at: string }[];
  prescriptions: { id: string; status: string; created_at: string; prescription_items: { id: string; medicine_name: string; dosage: string; frequency: string; duration_days: number | null; quantity: number; dispensed_qty: number }[] }[];
  labOrders: { id: string; status: string; ordered_at: string; lab_tests: { name: string; code: string } | { name: string; code: string }[] }[];
}

function oneName(obj: unknown): string {
  return Array.isArray(obj) ? (obj[0] as { name?: string })?.name ?? '' : (obj as { name?: string })?.name ?? '';
}

const commonDiagnoses = ['Malaria', 'Typhoid fever', 'Upper respiratory tract infection', 'Gastroenteritis', 'Urinary tract infection', 'Hypertension', 'Peptic ulcer disease', 'Anaemia'];

export default function Encounter() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<EncounterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState('overview');

  const isNurse = profile?.role === 'nurse';
  const isDoctor = profile?.role === 'doctor';

  const load = () => {
    api<EncounterData>(`/encounters/${id}`).then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, [id]);

  if (!data) return <StaffShell title="Encounter"><Loading /></StaffShell>;

  const { patient, encounter } = data;
  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 86400000)) : null;

  return (
    <StaffShell title={`Encounter — ${patient.unit_number}`}>
      <button onClick={() => navigate(-1)} className="mb-3 text-sm text-primary hover:underline no-print">← Back</button>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold text-navy">{patient.full_name} <span className="text-sm font-normal text-slate-500">{age != null ? `· ${age}y` : ''} {patient.sex ? `· ${patient.sex}` : ''}</span></p>
            <p className="text-sm text-slate-500">{patient.unit_number} · {encounter.encounter_type.replace('_', ' ')} · {new Date(encounter.opened_at).toLocaleString()}</p>
            <p className="mt-1 text-sm text-navy"><strong>Complaint:</strong> {encounter.chief_complaint || '—'}</p>
          </div>
          <StatusPill status={encounter.status} />
        </div>
        {(patient.allergies || patient.chronic_conditions) && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {patient.allergies && <p><strong>Allergies:</strong> {patient.allergies}</p>}
            {patient.chronic_conditions && <p><strong>Chronic conditions:</strong> {patient.chronic_conditions}</p>}
          </div>
        )}
      </Card>

      <ErrorMsg>{error}</ErrorMsg>
      <SuccessMsg>{message}</SuccessMsg>

      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'vitals', label: `Vitals (${data.vitals.length})` },
        { id: 'nursing', label: `Nursing (${data.nursing.length})` },
        { id: 'consult', label: 'Consultation' },
        { id: 'meds', label: `Prescriptions (${data.prescriptions.length})` },
        { id: 'labs', label: `Lab orders (${data.labOrders.length})` },
      ]} />

      {tab === 'overview' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <h3 className="font-semibold text-navy">Recorded vitals</h3>
            {data.vitals.length === 0 ? <p className="mt-2 text-sm text-slate-500">None yet.</p> : (
              <ul className="mt-2 space-y-2 text-sm">
                {data.vitals.map((v, i) => (
                  <li key={i}>
                    <span className="text-slate-400">{new Date(v.recorded_at).toLocaleTimeString()} — </span>
                    {[v.temperature_c && `T ${v.temperature_c}°C`, v.systolic && `BP ${v.systolic}/${v.diastolic}`, v.pulse && `P ${v.pulse}`, v.spo2 && `SpO₂ ${v.spo2}%`, v.weight_kg && `W ${v.weight_kg}kg`]
                      .filter(Boolean).join(' · ')}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h3 className="font-semibold text-navy">Diagnoses</h3>
            {data.diagnoses.length === 0 ? <p className="mt-2 text-sm text-slate-500">None yet.</p> : (
              <ul className="mt-2 space-y-1 text-sm">
                {data.diagnoses.map((d) => <li key={d.id}>🩺 {d.name} {d.code && <span className="text-slate-400">({d.code})</span>}</li>)}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'vitals' && <VitalsForm encounterId={encounter.id} onSaved={() => { load(); setMessage('Vitals recorded.'); setTab('overview'); }} />}
      {tab === 'nursing' && <NursingForm encounterId={encounter.id} existing={data.nursing} onSaved={() => { load(); setMessage('Nursing assessment saved.'); setTab('overview'); }} />}
      {tab === 'consult' && <ConsultForm
        encounterId={encounter.id}
        initial={data.consultation}
        diagnoses={data.diagnoses}
        locked={!isDoctor && profile?.role !== 'admin' && profile?.role !== 'super_admin'}
        onSaved={() => { load(); setMessage('Consultation saved.'); setTab('overview'); }} />}
      {tab === 'meds' && <PrescriptionForm
        encounterId={encounter.id}
        prescriptions={data.prescriptions}
        canPrescribe={isDoctor || profile?.role === 'admin' || profile?.role === 'super_admin'}
        onSaved={() => { load(); setMessage('Prescription created. Pharmacy has been notified.'); setTab('overview'); }} />}
      {tab === 'labs' && <LabOrderForm
        encounterId={encounter.id}
        orders={data.labOrders}
        canOrder={isDoctor || isNurse || profile?.role === 'admin' || profile?.role === 'super_admin'}
        onSaved={() => { load(); setMessage('Lab order created.'); setTab('overview'); }} />}
    </StaffShell>
  );
}

function VitalsForm({ encounterId, onSaved }: { encounterId: string; onSaved: () => void }) {
  const [form, setForm] = useState({ temperature_c: '', systolic: '', diastolic: '', pulse: '', resp_rate: '', spo2: '', weight_kg: '', height_cm: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const num = (v: string) => (v === '' ? undefined : Number(v));
      await api('/vitals', {
        method: 'POST',
        body: {
          encounter_id: encounterId,
          temperature_c: num(form.temperature_c), systolic: num(form.systolic), diastolic: num(form.diastolic),
          pulse: num(form.pulse), resp_rate: num(form.resp_rate), spo2: num(form.spo2),
          weight_kg: num(form.weight_kg), height_cm: num(form.height_cm), notes: form.notes || undefined,
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vitals');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-3 font-semibold text-navy">Record vital signs</h3>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Temp (°C)"><Input inputMode="decimal" value={form.temperature_c} onChange={(e) => setForm({ ...form, temperature_c: e.target.value })} /></Field>
        <Field label="Systolic"><Input inputMode="numeric" value={form.systolic} onChange={(e) => setForm({ ...form, systolic: e.target.value })} /></Field>
        <Field label="Diastolic"><Input inputMode="numeric" value={form.diastolic} onChange={(e) => setForm({ ...form, diastolic: e.target.value })} /></Field>
        <Field label="Pulse"><Input inputMode="numeric" value={form.pulse} onChange={(e) => setForm({ ...form, pulse: e.target.value })} /></Field>
        <Field label="Resp rate"><Input inputMode="numeric" value={form.resp_rate} onChange={(e) => setForm({ ...form, resp_rate: e.target.value })} /></Field>
        <Field label="SpO₂ (%)"><Input inputMode="numeric" value={form.spo2} onChange={(e) => setForm({ ...form, spo2: e.target.value })} /></Field>
        <Field label="Weight (kg)"><Input inputMode="decimal" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} /></Field>
        <Field label="Height (cm)"><Input inputMode="decimal" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} /></Field>
        <div className="col-span-2 sm:col-span-3"><Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
        <div className="col-span-2 sm:col-span-3"><ErrorMsg>{error}</ErrorMsg></div>
        <Button type="submit" busy={busy}>Save vitals</Button>
      </form>
    </Card>
  );
}

function NursingForm({ encounterId, existing, onSaved }: { encounterId: string; existing: EncounterData['nursing']; onSaved: () => void }) {
  const [form, setForm] = useState({ assessment: '', intervention: '', escalated: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/nursing-assessments', {
        method: 'POST',
        body: { encounter_id: encounterId, assessment: form.assessment, intervention: form.intervention || undefined, escalated_to_doctor: form.escalated },
      });
      setForm({ assessment: '', intervention: '', escalated: false });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {existing.length > 0 && (
        <Card>
          <h3 className="mb-2 font-semibold text-navy">Previous nursing notes</h3>
          <ul className="space-y-2 text-sm">
            {existing.map((n, i) => (
              <li key={i} className="rounded-lg bg-bg p-3">
                <p className="text-slate-400 text-xs">{new Date(n.recorded_at).toLocaleString()}</p>
                <p className="text-slate-700">{n.assessment}</p>
                {n.intervention && <p className="text-slate-500">Intervention: {n.intervention}</p>}
                {n.escalated_to_doctor && <p className="font-medium text-red-700">Escalated to doctor</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <h3 className="mb-3 font-semibold text-navy">Nursing assessment</h3>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Assessment" required><Textarea value={form.assessment} onChange={(e) => setForm({ ...form, assessment: e.target.value })} required minLength={3} /></Field>
          <Field label="Intervention / treatment given"><Textarea value={form.intervention} onChange={(e) => setForm({ ...form, intervention: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.escalated} onChange={(e) => setForm({ ...form, escalated: e.target.checked })}
              className="h-4 w-4 rounded border-line accent-primary" />
            Escalate / refer to doctor
          </label>
          <ErrorMsg>{error}</ErrorMsg>
          <Button type="submit" busy={busy}>Save assessment</Button>
        </form>
      </Card>
    </div>
  );
}

function ConsultForm({ encounterId, initial, diagnoses, locked, onSaved }: {
  encounterId: string;
  initial: EncounterData['consultation'];
  diagnoses: EncounterData['diagnoses'];
  locked: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    presentation: initial?.presentation ?? '', examination: initial?.examination ?? '',
    treatment_plan: initial?.treatment_plan ?? '', follow_up_date: initial?.follow_up_date ?? '',
  });
  const [dxName, setDxName] = useState('');
  const [dxCode, setDxCode] = useState('');
  const [pendingDx, setPendingDx] = useState<{ name: string; code?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (locked) {
    return (
      <Card>
        <h3 className="mb-2 font-semibold text-navy">Doctor consultation</h3>
        {initial ? (
          <div className="space-y-2 text-sm text-slate-700">
            <p><strong>Presentation:</strong> {initial.presentation}</p>
            {initial.examination && <p><strong>Examination:</strong> {initial.examination}</p>}
            {initial.treatment_plan && <p><strong>Plan:</strong> {initial.treatment_plan}</p>}
            {initial.follow_up_date && <p><strong>Follow-up:</strong> {initial.follow_up_date}</p>}
          </div>
        ) : <p className="text-sm text-slate-500">The doctor has not documented the consultation yet.</p>}
      </Card>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/consultations', {
        method: 'POST',
        body: {
          encounter_id: encounterId, presentation: form.presentation,
          examination: form.examination || undefined, treatment_plan: form.treatment_plan || undefined,
          follow_up_date: form.follow_up_date || null, diagnoses: pendingDx,
        },
      });
      setPendingDx([]);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save consultation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-3 font-semibold text-navy">Doctor consultation</h3>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Clinical presentation / history" required>
          <Textarea value={form.presentation} onChange={(e) => setForm({ ...form, presentation: e.target.value })} required minLength={3} />
        </Field>
        <Field label="Examination findings"><Textarea value={form.examination} onChange={(e) => setForm({ ...form, examination: e.target.value })} /></Field>
        <Field label="Treatment plan"><Textarea value={form.treatment_plan} onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })} /></Field>
        <Field label="Follow-up date"><Input type="date" value={form.follow_up_date ?? ''} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} /></Field>

        <div className="rounded-lg bg-bg p-3">
          <p className="mb-2 text-sm font-semibold text-navy">Diagnoses this visit</p>
          <div className="flex flex-wrap gap-2">
            {diagnoses.map((d) => <span key={d.id} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-navy border border-line">{d.name}</span>)}
            {pendingDx.map((d, i) => <span key={`p${i}`} className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary-dark">{d.name} (new)</span>)}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1"><Field label="Diagnosis">
              <Input list="dx-list" value={dxName} onChange={(e) => setDxName(e.target.value)} />
              <datalist id="dx-list">{commonDiagnoses.map((d) => <option key={d} value={d} />)}</datalist>
            </Field></div>
            <div className="w-24"><Field label="Code"><Input value={dxCode} onChange={(e) => setDxCode(e.target.value)} /></Field></div>
            <Button type="button" variant="secondary" disabled={!dxName.trim()}
              onClick={() => { setPendingDx([...pendingDx, { name: dxName.trim(), code: dxCode || undefined }]); setDxName(''); setDxCode(''); }}>
              Add
            </Button>
          </div>
        </div>

        <ErrorMsg>{error}</ErrorMsg>
        <Button type="submit" busy={busy}>Save consultation</Button>
      </form>
    </Card>
  );
}

function PrescriptionForm({ encounterId, prescriptions, canPrescribe, onSaved }: {
  encounterId: string; prescriptions: EncounterData['prescriptions']; canPrescribe: boolean; onSaved: () => void;
}) {
  const [items, setItems] = useState<{ medicine_name: string; dosage: string; frequency: string; duration_days: string; quantity: string }[]>([
    { medicine_name: '', dosage: '', frequency: '', duration_days: '5', quantity: '' },
  ]);
  const [notes, setNotes] = useState('');
  const [meds, setMeds] = useState<{ name: string; stock_qty: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<{ name: string; stock_qty: number }[]>('/medicines').then(setMeds).catch(() => {}); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/prescriptions', {
        method: 'POST',
        body: {
          encounter_id: encounterId, notes: notes || undefined,
          items: items.filter((i) => i.medicine_name).map((i) => ({
            medicine_name: i.medicine_name, dosage: i.dosage, frequency: i.frequency,
            duration_days: Number(i.duration_days) || undefined, quantity: Number(i.quantity),
          })),
        },
      });
      setItems([{ medicine_name: '', dosage: '', frequency: '', duration_days: '5', quantity: '' }]);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create prescription');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {prescriptions.length > 0 && (
        <Card>
          <h3 className="mb-2 font-semibold text-navy">Prescriptions this visit</h3>
          <div className="space-y-3">
            {prescriptions.map((rx) => (
              <div key={rx.id} className="rounded-lg bg-bg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">{new Date(rx.created_at).toLocaleString()}</p>
                  <StatusPill status={rx.status} />
                </div>
                <ul className="mt-1 text-sm text-slate-700">
                  {rx.prescription_items.map((it) => (
                    <li key={it.id}>{it.medicine_name} — {it.dosage}, {it.frequency} ({it.dispensed_qty}/{it.quantity} dispensed)</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {canPrescribe ? (
        <Card>
          <h3 className="mb-3 font-semibold text-navy">New prescription</h3>
          <form onSubmit={submit} className="flex flex-col gap-3">
            {items.map((item, i) => {
              const stock = meds.find((m) => m.name.toLowerCase() === item.medicine_name.toLowerCase());
              return (
                <div key={i} className="rounded-lg bg-bg p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Medicine" required>
                      <Input list="med-list" value={item.medicine_name} required
                        onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, medicine_name: e.target.value } : it))} />
                    </Field>
                    <div className="self-end text-xs">
                      {stock && <span className={stock.stock_qty > 0 ? 'text-emerald-700' : 'text-red-700'}>Stock: {stock.stock_qty}</span>}
                    </div>
                    <Field label="Dosage" required><Input placeholder="e.g. 1 tablet" value={item.dosage} required
                      onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, dosage: e.target.value } : it))} /></Field>
                    <Field label="Frequency" required><Input placeholder="e.g. 3× daily" value={item.frequency} required
                      onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, frequency: e.target.value } : it))} /></Field>
                    <Field label="Duration (days)"><Input inputMode="numeric" value={item.duration_days}
                      onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, duration_days: e.target.value } : it))} /></Field>
                    <Field label="Total quantity" required><Input inputMode="numeric" value={item.quantity} required
                      onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, quantity: e.target.value } : it))} /></Field>
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))}
                      className="mt-2 text-sm text-red-700 hover:underline">Remove</button>
                  )}
                </div>
              );
            })}
            <datalist id="med-list">{meds.map((m) => <option key={m.name} value={m.name} />)}</datalist>
            <div className="flex gap-2">
              <Button type="button" variant="secondary"
                onClick={() => setItems([...items, { medicine_name: '', dosage: '', frequency: '', duration_days: '5', quantity: '' }])}>
                Add medicine
              </Button>
            </div>
            <Field label="Notes for pharmacist"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <ErrorMsg>{error}</ErrorMsg>
            <Button type="submit" busy={busy}>Send to pharmacy</Button>
          </form>
        </Card>
      ) : (
        <Card><p className="text-sm text-slate-500">Prescribing is restricted to doctors by clinic policy.</p></Card>
      )}
    </div>
  );
}

function LabOrderForm({ encounterId, orders, canOrder, onSaved }: {
  encounterId: string; orders: EncounterData['labOrders']; canOrder: boolean; onSaved: () => void;
}) {
  const [tests, setTests] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<{ id: string; name: string; code: string }[]>('/lab/tests').then(setTests).catch(() => {}); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (!ids.length) { setError('Select at least one test'); return; }
    setBusy(true); setError(null);
    try {
      await api('/lab/orders', { method: 'POST', body: { encounter_id: encounterId, test_ids: ids, clinical_note: note || undefined } });
      setSelected({}); setNote('');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to order tests');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.length > 0 && (
        <Card>
          <h3 className="mb-2 font-semibold text-navy">Lab orders this visit</h3>
          <ul className="space-y-1.5 text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between">
                <span className="text-slate-700">{oneName(o.lab_tests)}</span>
                <StatusPill status={o.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canOrder && (
        <Card>
          <h3 className="mb-3 font-semibold text-navy">Order laboratory tests</h3>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {tests.map((t) => (
                <label key={t.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <input type="checkbox" checked={!!selected[t.id]} onChange={(e) => setSelected({ ...selected, [t.id]: e.target.checked })}
                    className="h-4 w-4 accent-primary" />
                  {t.name} <span className="text-xs text-slate-400">({t.code})</span>
                </label>
              ))}
            </div>
            <Field label="Clinical note for the lab"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <ErrorMsg>{error}</ErrorMsg>
            <Button type="submit" busy={busy}>Send to laboratory</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
