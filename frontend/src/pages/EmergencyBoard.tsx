import { useCallback, useEffect, useState } from 'react';
import { StaffShell } from '../components/Shells';
import { Button, Card, Empty, ErrorMsg, Field, Loading, Modal, StatusPill, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface EmergencyCase {
  id: string; case_number: string; status: string; priority: string;
  caller_name: string | null; caller_phone: string | null; location: string;
  description: string; triage_notes: string | null; created_at: string;
  patients: { unit_number: string; full_name: string } | { unit_number: string; full_name: string }[] | null;
  profiles: unknown;
}

function one<T>(obj: T | T[] | null | undefined): T | null {
  if (obj == null) return null;
  return Array.isArray(obj) ? (obj[0] ?? null) : obj;
}

const priorityStyle: Record<string, string> = {
  critical: 'bg-red-700 text-white', serious: 'bg-orange-500 text-white', minor: 'bg-amber-400 text-white',
};

export default function EmergencyBoard() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<EmergencyCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handoverFor, setHandoverFor] = useState<EmergencyCase | null>(null);
  const [showFilter, setShowFilter] = useState('active');

  const load = useCallback(() => {
    const q = showFilter === 'active' ? '?status=active' : showFilter === 'closed' ? '?status=closed' : '';
    api<EmergencyCase[]>(`/emergency${q}`).then(setCases).catch((e) => { setError(e.message); setCases([]); });
  }, [showFilter]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function act(id: string, action: string, body?: Record<string, unknown>) {
    setError(null);
    try { await api(`/emergency/${id}/${action}`, { method: 'POST', body: body ?? {} }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); }
  }

  if (!profile) return null;

  const active = (cases ?? []).filter((c) => c.status !== 'closed');

  return (
    <StaffShell title="Emergency Board">
      {active.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
          <p className="font-semibold">{active.length} active emergency case{active.length > 1 ? 's' : ''} — highest priority first.</p>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {['active', 'closed', 'all'].map((f) => (
          <button key={f} onClick={() => setShowFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${showFilter === f ? 'bg-primary text-white' : 'border border-line bg-white text-slate-600'}`}>
            {f}
          </button>
        ))}
      </div>

      <ErrorMsg>{error}</ErrorMsg>
      {cases === null ? <Loading /> : cases.length === 0 ? (
        <Empty title="No emergency cases. New requests appear here instantly." />
      ) : (
        <div className="flex flex-col gap-3">
          {cases.map((c) => (
            <Card key={c.id} className={c.status !== 'closed' && c.priority === 'critical' ? 'border-red-400' : ''}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${priorityStyle[c.priority] ?? 'bg-slate-400 text-white'}`}>{c.priority}</span>
                    <p className="font-semibold text-navy">{c.case_number}</p>
                    <StatusPill status={c.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{c.description}</p>
                  <p className="mt-1 text-sm text-slate-500">📍 {c.location}</p>
                  <p className="text-xs text-slate-400">
                    {c.caller_name && `Caller: ${c.caller_name} · `}
                    {c.caller_phone && <a className="underline" href={`tel:${c.caller_phone}`}>{c.caller_phone}</a> && `${c.caller_phone} · `}
                    {new Date(c.created_at).toLocaleString()}
                  </p>
                  {c.triage_notes && <p className="mt-2 rounded-lg bg-bg p-2 text-sm text-slate-600">Triage: {c.triage_notes}</p>}
                  {one(c.patients) && <p className="mt-1 text-xs text-slate-500">Patient: {one(c.patients)?.full_name} ({one(c.patients)?.unit_number})</p>}
                </div>
                {c.status !== 'closed' && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {c.status === 'open' && (
                      <>
                        <Button size="sm" onClick={() => act(c.id, 'respond')}>Respond</Button>
                        <Button size="sm" variant="secondary" onClick={() => setHandoverFor(c)}>Handover</Button>
                      </>
                    )}
                    {c.status !== 'open' && <Button size="sm" variant="secondary" onClick={() => setHandoverFor(c)}>Handover</Button>}
                    <Button size="sm" variant="danger" onClick={() => act(c.id, 'close')}>Close case</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <HandoverModal caseRow={handoverFor} onClose={() => setHandoverFor(null)}
        onSaved={() => { setHandoverFor(null); load(); }} />
    </StaffShell>
  );
}

function HandoverModal({ caseRow, onClose, onSaved }: { caseRow: EmergencyCase | null; onClose: () => void; onSaved: () => void }) {
  const [notes, setNotes] = useState('');
  const [staff, setStaff] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [staffId, setStaffId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (caseRow) { setNotes(''); setError(null); }
  }, [caseRow]);

  useEffect(() => {
    // fetch on-duty staff for handover targets
    api<{ onDuty: { staff_id: string; profiles: { full_name: string; role: string } }[] }>('/on-duty')
      .then((r) => setStaff(r.onDuty.map((s) => ({ id: s.staff_id, full_name: s.profiles.full_name, role: s.profiles.role }))))
      .catch(() => setStaff([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api(`/emergency/${caseRow!.id}/handover`, {
        method: 'POST',
        body: { staff_id: staffId || undefined, triage_notes: notes || undefined },
      });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={!!caseRow} onClose={onClose} title={`Handover — ${caseRow?.case_number ?? ''}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          The case stays open and moves to the incoming team. Add what they need to know.
        </p>
        <Field label="Handover notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Current condition, actions taken, pending steps…" />
        </Field>
        <Field label="Hand to (on duty now)">
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full rounded-[6px] border border-line px-3 py-2">
            <option value="">Next shift / team on duty</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
          </select>
        </Field>
        <ErrorMsg>{error}</ErrorMsg>
        <div className="flex gap-2">
          <Button type="submit" busy={busy}>Confirm handover</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
