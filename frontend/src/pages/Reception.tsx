import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { StaffShell } from '../components/Shells';
import { Button, Card, Empty, ErrorMsg, Field, Input, Modal, Select, SuccessMsg, Textarea } from '../components/ui';
import { api } from '../lib/api';

interface PatientRow { id: string; unit_number: string; full_name: string; category: string; university_id: string | null; phone: string | null }
interface Appointment { id: string; reference: string; patient_id: string; appointment_date: string; start_time: string; status: string; patients: { unit_number: string; full_name: string } | { unit_number: string; full_name: string }[] }

function pname(obj: unknown): string {
  return Array.isArray(obj) ? (obj[0] as { full_name?: string })?.full_name ?? '' : (obj as { full_name?: string })?.full_name ?? '';
}
function punit(obj: unknown): string {
  return Array.isArray(obj) ? (obj[0] as { unit_number?: string })?.unit_number ?? '' : (obj as { unit_number?: string })?.unit_number ?? '';
}

export default function Reception() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientRow[] | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [checkIn, setCheckIn] = useState<PatientRow | null>(null);
  const [complaint, setComplaint] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function loadAppointments() {
    api<Appointment[]>(`/appointments?date=${new Date().toISOString().slice(0, 10)}`)
      .then(setTodayAppointments).catch(() => setTodayAppointments([]));
  }
  useEffect(loadAppointments, []);

  function search(q: string) {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (q.trim().length < 2) { setResults(null); return; }
      api<PatientRow[]>(`/patients/search?q=${encodeURIComponent(q.trim())}`)
        .then(setResults).catch(() => setResults([]));
    }, 250);
  }

  async function doCheckIn(type: 'walk_in' | 'appointment', appointmentId?: string) {
    if (!checkIn) return;
    setBusy(true); setError(null);
    try {
      const res = await api<{ encounter_id: string; queue_number: number }>('/check-in', {
        method: 'POST',
        body: { patient_id: checkIn.id, encounter_type: type, chief_complaint: complaint || null, appointment_id: appointmentId ?? null },
      });
      setMessage(`${checkIn.full_name} checked in. Queue number: ${res.queue_number}`);
      setCheckIn(null); setComplaint(''); loadAppointments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check-in failed');
    } finally {
      setBusy(false);
    }
  }

  const bookedToday = todayAppointments.filter((a) => a.status === 'booked');

  return (
    <StaffShell title="Reception">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Card>
            <h2 className="mb-3 font-semibold text-navy">Find a patient</h2>
            <Input value={query} onChange={(e) => search(e.target.value)} autoFocus
              placeholder="Unit Number, Reg No/Staff ID, phone or name…" aria-label="Search patients" />
            <p className="mt-2 text-xs text-slate-500">At least 2 characters. Searches unit numbers, university IDs, phones and names.</p>

            <div className="mt-4 flex flex-col gap-2">
              {results === null ? null : results.length === 0 ? (
                <Empty title="No patient found."
                  action={<Button size="sm" onClick={() => setShowRegister(true)}>Register new patient</Button>} />
              ) : results.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy">{p.full_name}</p>
                    <p className="text-xs text-slate-500">{p.unit_number} · {p.category.replace('_', ' ')}{p.university_id ? ` · ${p.university_id}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link to={`/patients?file=${p.id}`}>
                      <Button size="sm" variant="secondary">File</Button>
                    </Link>
                    <Button size="sm" onClick={() => { setCheckIn(p); setError(null); }}>Check in</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-navy">New patient</h2>
              <Button size="sm" onClick={() => setShowRegister(true)}>Register</Button>
            </div>
            <p className="text-sm text-slate-600">
              Students, university staff and external/community patients. A Clinic Unit Number is generated automatically.
            </p>
          </Card>
        </div>

        <div>
          <Card>
            <h2 className="mb-3 font-semibold text-navy">Today's appointments</h2>
            {bookedToday.length === 0 ? <Empty title="No booked appointments left today." /> : (
              <div className="flex flex-col gap-2">
                {bookedToday.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5">
                    <div>
                      <p className="font-medium text-navy">{pname(a.patients)}</p>
                      <p className="text-xs text-slate-500">{a.start_time.slice(0, 5)} · {punit(a.patients)} · {a.reference}</p>
                    </div>
                    <Button size="sm" onClick={() => {
                      setCheckIn({ id: a.patient_id, unit_number: punit(a.patients), full_name: pname(a.patients), category: '', university_id: null, phone: null });
                      setError(null);
                      setTimeout(() => void doCheckIn('appointment', a.id), 0);
                    }}>Check in</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="mb-2 font-semibold text-navy">Run the clinic</h2>
            <div className="flex flex-wrap gap-2">
              <Link to="/queue"><Button variant="secondary" size="sm">Clinic queue →</Button></Link>
              <Link to="/emergency"><Button variant="danger" size="sm">Emergency board</Button></Link>
            </div>
          </Card>
        </div>
      </div>

      <SuccessMsg>{message}</SuccessMsg>
      <div className="mt-3"><ErrorMsg>{error}</ErrorMsg></div>

      {/* Check-in dialog */}
      <Modal open={!!checkIn} onClose={() => setCheckIn(null)} title={`Check in ${checkIn?.full_name ?? ''}`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">Unit Number <strong>{checkIn?.unit_number}</strong>. Create today's visit and add to the queue.</p>
          <Field label="Chief complaint (what the patient reports)">
            <Textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="e.g. Fever and headache for 2 days" />
          </Field>
          <ErrorMsg>{error}</ErrorMsg>
          <div className="flex gap-2">
            <Button busy={busy} onClick={() => void doCheckIn('walk_in')}>Check in (walk-in)</Button>
            <Button variant="secondary" onClick={() => setCheckIn(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <RegisterModal open={showRegister} onClose={() => setShowRegister(false)}
        onCreated={(p) => { setShowRegister(false); setMessage(`Registered ${p.full_name} — Unit Number ${p.unit_number}`); }} />
    </StaffShell>
  );
}

export function RegisterModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: PatientRow) => void }) {
  const [form, setForm] = useState({
    full_name: '', category: 'student', sex: 'male', date_of_birth: '', phone: '', address: '',
    university_id: '', department: '', next_of_kin_name: '', next_of_kin_phone: '', next_of_kin_relationship: '',
    blood_group: '', allergies: '', chronic_conditions: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const payload = {
        ...form,
        date_of_birth: form.date_of_birth || null,
        university_id: form.category === 'external' ? null : form.university_id || null,
      };
      const created = await api<PatientRow>('/patients', { method: 'POST', body: payload });
      onCreated(created);
      setForm({ ...form, full_name: '', university_id: '', phone: '', next_of_kin_name: '', next_of_kin_phone: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Register new patient">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Full name" required><Input value={form.full_name} onChange={set('full_name')} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Patient category" required>
            <Select value={form.category} onChange={set('category')}>
              <option value="student">Student</option>
              <option value="university_staff">University staff</option>
              <option value="external">External / community</option>
            </Select>
          </Field>
          <Field label="Sex"><Select value={form.sex} onChange={set('sex')}><option value="male">Male</option><option value="female">Female</option></Select></Field>
        </div>
        {form.category !== 'external' && (
          <Field label="University ID" required hint="Reg No for students, Staff ID for university staff">
            <Input value={form.university_id} onChange={set('university_id')} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input value={form.phone} onChange={set('phone')} inputMode="tel" /></Field>
          <Field label="Date of birth"><Input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} max={new Date().toISOString().slice(0, 10)} /></Field>
        </div>
        <Field label="Address"><Input value={form.address} onChange={set('address')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Blood group"><Input value={form.blood_group} onChange={set('blood_group')} placeholder="O+" /></Field>
          <Field label="Known allergies"><Input value={form.allergies} onChange={set('allergies')} placeholder="None" /></Field>
        </div>
        <Field label="Chronic conditions"><Input value={form.chronic_conditions} onChange={set('chronic_conditions')} placeholder="e.g. Asthma" /></Field>
        <div className="rounded-lg bg-bg p-3">
          <p className="mb-2 text-sm font-semibold text-navy">Next of kin</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><Input value={form.next_of_kin_name} onChange={set('next_of_kin_name')} /></Field>
            <Field label="Phone"><Input value={form.next_of_kin_phone} onChange={set('next_of_kin_phone')} /></Field>
          </div>
          <Field label="Relationship"><Input value={form.next_of_kin_relationship} onChange={set('next_of_kin_relationship')} placeholder="Parent, sibling…" /></Field>
        </div>
        <ErrorMsg>{error}</ErrorMsg>
        <Button type="submit" busy={busy}>Register patient</Button>
      </form>
    </Modal>
  );
}
