import { useCallback, useEffect, useState } from 'react';
import { StaffShell } from '../components/Shells';
import { Button, Card, Empty, ErrorMsg, Field, Input, Loading, Modal, Select, StatusPill, SuccessMsg, Tabs, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Shift {
  id: string; staff_id: string; shift_date: string; shift_type: string;
  starts_at: string; ends_at: string; is_emergency_responsible: boolean; notes: string | null;
  profiles: { full_name: string; role: string; staff_id: string | null } | { full_name: string; role: string; staff_id: string | null }[];
}
interface OnDuty { onDuty: Shift[]; emergencyResponsible: Shift | null }
interface AttendanceRow { id: string; work_date: string; check_in_at: string | null; check_out_at: string | null; status: string; profiles: { full_name: string; role: string } | { full_name: string; role: string }[] }
interface Handover { id: string; summary: string; open_cases_note: string; created_at: string; profiles: { full_name: string } | { full_name: string }[] | null }

function one<T>(obj: T | T[] | null | undefined): T | null {
  if (obj == null) return null;
  return Array.isArray(obj) ? (obj[0] ?? null) : obj;
}

export default function StaffRoom() {
  const { profile } = useAuth();
  const isMgr = profile && ['hospital_head', 'admin', 'super_admin'].includes(profile.role);
  const [tab, setTab] = useState('today');
  const [onDuty, setOnDuty] = useState<OnDuty | null>(null);
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[] | null>(null);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showHandover, setShowHandover] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  const [myAttendance, setMyAttendance] = useState<AttendanceRow | null>(null);

  const load = useCallback(() => {
    api<OnDuty>('/on-duty').then(setOnDuty).catch((e) => setError(e.message));
    const today = new Date().toISOString().slice(0, 10);
    api<Shift[]>(`/shifts?from=${today}&to=${today}`).then(setShifts).catch(() => setShifts([]));
    if (isMgr) {
      api<AttendanceRow[]>(`/attendance?date=${today}`).then(setAttendance).catch(() => setAttendance([]));
    }
    api<Handover[]>('/handovers').then(setHandovers).catch(() => setHandovers([]));
    api<AttendanceRow[]>(`/attendance?date=${today}`).then((rows) => {
      setMyAttendance(rows.find((r) => one(r.profiles)?.full_name === profile?.full_name) ?? null);
    }).catch(() => {});
  }, [isMgr, profile?.full_name]);
  useEffect(() => { load(); }, [load]);

  async function attendanceAction(action: 'check-in' | 'check-out') {
    setError(null);
    try {
      await api(`/attendance/${action}`, { method: 'POST' });
      setMessage(action === 'check-in' ? 'Checked in. Have a good shift.' : 'Checked out.');
      load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  }

  if (!profile) return null;

  return (
    <StaffShell title="Shifts & Handover">
      <SuccessMsg>{message}</SuccessMsg>
      <ErrorMsg>{error}</ErrorMsg>

      {/* My attendance */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-navy">My attendance today</p>
            <p className="text-sm text-slate-500">
              {myAttendance
                ? `${myAttendance.status} · in ${myAttendance.check_in_at ? new Date(myAttendance.check_in_at).toLocaleTimeString() : '—'}${myAttendance.check_out_at ? ` · out ${new Date(myAttendance.check_out_at).toLocaleTimeString()}` : ''}`
                : 'Not checked in yet.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => attendanceAction('check-in')} disabled={!!myAttendance?.check_in_at && !myAttendance?.check_out_at}>
              Check in
            </Button>
            <Button size="sm" variant="secondary" onClick={() => attendanceAction('check-out')} disabled={!myAttendance?.check_in_at || !!myAttendance?.check_out_at}>
              Check out
            </Button>
          </div>
        </div>
      </Card>

      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'today', label: "Who's on now" },
        { id: 'roster', label: 'Today roster' },
        ...(isMgr ? [{ id: 'attendance', label: 'Attendance' }] : []),
        { id: 'handover', label: `Handovers (${handovers.length})` },
      ]} />

      {tab === 'today' && (onDuty === null ? <Loading /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <h3 className="mb-2 font-semibold text-navy">On duty right now</h3>
            {onDuty.onDuty.length === 0 ? <p className="text-sm text-slate-500">No shift is active right now.</p> : (
              <ul className="space-y-2">
                {onDuty.onDuty.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-sm">
                    <span className="font-medium text-navy">{one(s.profiles)?.full_name} <span className="text-slate-500">({one(s.profiles)?.role})</span></span>
                    <span className="text-slate-500 capitalize">{s.shift_type}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h3 className="mb-2 font-semibold text-navy">Emergency responsibility</h3>
            {onDuty.emergencyResponsible ? (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                <strong>{one(onDuty.emergencyResponsible.profiles)?.full_name}</strong> ({one(onDuty.emergencyResponsible.profiles)?.role})
                is responsible for emergency response until {new Date(onDuty.emergencyResponsible.ends_at).toLocaleTimeString()}.
              </p>
            ) : (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                No one is assigned emergency responsibility right now. Management should assign it in the roster.
              </p>
            )}
          </Card>
        </div>
      ))}

      {tab === 'roster' && (
        <div className="flex flex-col gap-3">
          {isMgr && <Button size="sm" className="self-start" onClick={() => setShowAddShift(true)}>Add shift</Button>}
          {shifts === null ? <Loading /> : shifts.length === 0 ? <Empty title="No shifts scheduled today." /> : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Staff</th><th className="px-4 py-3">Shift</th>
                    <th className="px-4 py-3">Time</th><th className="px-4 py-3">Emergency</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s) => (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-medium text-navy">{one(s.profiles)?.full_name}</td>
                      <td className="px-4 py-2.5 capitalize">{s.shift_type}</td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(s.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(s.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-2.5">{s.is_emergency_responsible ? <span className="font-medium text-primary-dark">Responsible</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {tab === 'attendance' && isMgr && (attendance === null ? <Loading /> : attendance.length === 0 ? (
        <Empty title="No attendance recorded today yet." />
      ) : (
        <div className="flex flex-col gap-2">
          {attendance.map((a) => (
            <Card key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium text-navy">{one(a.profiles)?.full_name} <span className="text-sm text-slate-500">({one(a.profiles)?.role})</span></p>
                <p className="text-xs text-slate-400">
                  {a.check_in_at ? `In ${new Date(a.check_in_at).toLocaleTimeString()}` : 'No check-in'}
                  {a.check_out_at ? ` · Out ${new Date(a.check_out_at).toLocaleTimeString()}` : ''}
                </p>
              </div>
              <StatusPill status={a.status} />
            </Card>
          ))}
        </div>
      ))}

      {tab === 'handover' && (
        <div className="flex flex-col gap-3">
          <Button size="sm" className="self-start" onClick={() => setShowHandover(true)}>Write handover</Button>
          {handovers.length === 0 ? <Empty title="No handover notes yet." /> : handovers.map((h) => (
            <Card key={h.id}>
              <p className="text-xs text-slate-400">{one(h.profiles)?.full_name ?? 'Staff'} · {new Date(h.created_at).toLocaleString()}</p>
              <p className="mt-1 text-sm text-slate-700">{h.summary}</p>
              <p className="mt-2 rounded-lg bg-bg p-2 text-sm text-slate-600"><strong>Open cases:</strong> {h.open_cases_note}</p>
            </Card>
          ))}
        </div>
      )}

      <HandoverModal open={showHandover} onClose={() => setShowHandover(false)}
        onSaved={() => { setShowHandover(false); setMessage('Handover recorded.'); load(); }} />

      {isMgr && <AddShiftModal open={showAddShift} onClose={() => setShowAddShift(false)}
        onSaved={() => { setShowAddShift(false); setMessage('Shift added.'); load(); }} />}
    </StaffShell>
  );
}

function HandoverModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [summary, setSummary] = useState('');
  const [cases, setCases] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/handovers', { method: 'POST', body: { summary, open_cases_note: cases } });
      setSummary(''); setCases('');
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Shift handover">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Shift summary" required><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} required minLength={5} /></Field>
        <Field label="Open cases for the next team" required><Textarea value={cases} onChange={(e) => setCases(e.target.value)} required minLength={3} /></Field>
        <ErrorMsg>{error}</ErrorMsg>
        <div className="flex gap-2">
          <Button type="submit" busy={busy}>Record handover</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function AddShiftModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [staff, setStaff] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [form, setForm] = useState({ staff_id: '', shift_date: new Date().toISOString().slice(0, 10), shift_type: 'morning', start: '08:00', end: '14:00', emergency: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      api<{ id: string; full_name: string; role: string; staff_id: string | null }[]>('/staff-directory').then(setStaff).catch(() => setStaff([]));
    }
  }, [open]);

  const times: Record<string, [string, string]> = { morning: ['07:00', '14:00'], afternoon: ['13:00', '20:00'], night: ['19:00', '07:00'] };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const [start, end] = times[form.shift_type];
    const startsAt = new Date(`${form.shift_date}T${start}:00`);
    const endsAt = form.shift_type === 'night'
      ? new Date(new Date(`${form.shift_date}T${end}:00`).getTime() + 86400000)
      : new Date(`${form.shift_date}T${end}:00`);
    try {
      await api('/shifts', {
        method: 'POST',
        body: {
          staff_id: form.staff_id, shift_date: form.shift_date, shift_type: form.shift_type,
          starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
          is_emergency_responsible: form.emergency,
        },
      });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add shift">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Staff member" required>
          <Select value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} required>
            <option value="">Select staff…</option>
            {staff.filter((s) => s.role !== 'student').map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date" required><Input type="date" value={form.shift_date} onChange={(e) => setForm({ ...form, shift_date: e.target.value })} required /></Field>
          <Field label="Shift" required>
            <Select value={form.shift_type} onChange={(e) => setForm({ ...form, shift_type: e.target.value })}>
              <option value="morning">Morning (07–14)</option>
              <option value="afternoon">Afternoon (13–20)</option>
              <option value="night">Night (19–07)</option>
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.emergency} onChange={(e) => setForm({ ...form, emergency: e.target.checked })} className="h-4 w-4 accent-primary" />
          Emergency response responsibility
        </label>
        <ErrorMsg>{error}</ErrorMsg>
        <div className="flex gap-2">
          <Button type="submit" busy={busy} disabled={!form.staff_id}>Add shift</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
