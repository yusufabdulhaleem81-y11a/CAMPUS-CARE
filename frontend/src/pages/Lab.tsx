import { useCallback, useEffect, useState } from 'react';
import { StaffShell } from '../components/Shells';
import { Button, Card, Empty, ErrorMsg, Field, Input, Loading, Modal, StatusPill, Tabs, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface LabOrder {
  id: string;
  status: string;
  ordered_at: string;
  clinical_note: string | null;
  sample_collected_at: string | null;
  lab_tests: { name: string; code: string; specimen_type: string } | { name: string; code: string; specimen_type: string }[];
  lab_results: { result_text: string; remarks: string | null } | { result_text: string; remarks: string | null }[] | null;
  patients: { unit_number: string; full_name: string } | { unit_number: string; full_name: string }[];
}

function one<T>(obj: T | T[] | null | undefined): T | null {
  if (obj == null) return null;
  return Array.isArray(obj) ? (obj[0] ?? null) : obj;
}

export default function Lab() {
  const { profile } = useAuth();
  const isLabStaff = profile?.role === 'laboratory' || profile?.role === 'admin' || profile?.role === 'super_admin';
  const [tab, setTab] = useState('inbox');
  const [orders, setOrders] = useState<LabOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entryFor, setEntryFor] = useState<LabOrder | null>(null);

  const load = useCallback(() => {
    api<LabOrder[]>('/lab/orders').then(setOrders).catch((e) => { setError(e.message); setOrders([]); });
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  async function act(path: string) {
    setError(null);
    try { await api(`/lab/orders/${path}`, { method: 'POST' }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); }
  }

  const inbox = (orders ?? []).filter((o) => ['ordered', 'sample_collected'].includes(o.status));
  const toVerify = (orders ?? []).filter((o) => o.status === 'result_entered');
  const released = (orders ?? []).filter((o) => ['verified', 'released'].includes(o.status));

  const tabs = [
    { id: 'inbox', label: `Inbox (${inbox.length})` },
    { id: 'verify', label: `To verify & release (${toVerify.length})` },
    { id: 'released', label: `Released (${released.length})` },
  ];

  const renderOrder = (o: LabOrder, phase: 'inbox' | 'verify' | 'released') => {
    const test = one(o.lab_tests);
    const patient = one(o.patients);
    const result = one(o.lab_results);
    return (
      <Card key={o.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-navy">{test?.name} <span className="text-sm font-normal text-slate-400">({test?.code} · {test?.specimen_type})</span></p>
            <p className="text-sm text-slate-600">{patient?.full_name} · {patient?.unit_number}</p>
            <p className="text-xs text-slate-400">Ordered {new Date(o.ordered_at).toLocaleString()}{o.clinical_note ? ` · Note: ${o.clinical_note}` : ''}</p>
            {result && (
              <div className="mt-2 rounded-lg bg-bg p-3 text-sm">
                <p className="text-slate-700">{result.result_text}</p>
                {result.remarks && <p className="text-xs text-slate-500">Remarks: {result.remarks}</p>}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill status={o.status} />
            {phase === 'inbox' && isLabStaff && (
              <div className="flex gap-2">
                {o.status === 'ordered' && <Button size="sm" onClick={() => act(`${o.id}/sample`)}>Sample collected</Button>}
                <Button size="sm" onClick={() => setEntryFor(o)}>Enter result</Button>
              </div>
            )}
            {phase === 'verify' && isLabStaff && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEntryFor(o)}>Edit result</Button>
                <Button size="sm" onClick={() => act(`${o.id}/verify`)}>Verify</Button>
                <Button size="sm" onClick={() => act(`${o.id}/release`)}>Release</Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <StaffShell title="Laboratory">
      <ErrorMsg>{error}</ErrorMsg>
      {orders === null ? <Loading /> : (
        <>
          <Tabs active={tab} onChange={setTab} tabs={tabs} />
          <div className="flex flex-col gap-3">
            {tab === 'inbox' && (inbox.length === 0 ? <Empty title="No pending tests. New orders arrive here." /> : inbox.map((o) => renderOrder(o, 'inbox')))}
            {tab === 'verify' && (toVerify.length === 0 ? <Empty title="Nothing waiting for verification." /> : toVerify.map((o) => renderOrder(o, 'verify')))}
            {tab === 'released' && (released.length === 0 ? <Empty title="No released results yet." /> : released.map((o) => renderOrder(o, 'released')))}
          </div>
        </>
      )}

      <ResultEntryModal order={entryFor} onClose={() => setEntryFor(null)}
        onSaved={() => { setEntryFor(null); load(); }} />
    </StaffShell>
  );
}

function ResultEntryModal({ order, onClose, onSaved }: { order: LabOrder | null; onClose: () => void; onSaved: () => void }) {
  const [resultText, setResultText] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const existing = one(order?.lab_results ?? null);
    setResultText(existing?.result_text ?? '');
    setRemarks(existing?.remarks ?? '');
    setError(null);
  }, [order]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (order?.status === 'ordered') await api(`/lab/orders/${order.id}/sample`, { method: 'POST' });
      await api(`/lab/orders/${order!.id}/result`, { method: 'POST', body: { result_text: resultText, remarks: remarks || undefined } });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save result');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!order} onClose={onClose} title={`Result — ${one(order?.lab_tests ?? null)?.name ?? ''}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Result" required><Textarea value={resultText} onChange={(e) => setResultText(e.target.value)} required minLength={2} /></Field>
        <Field label="Remarks (optional)"><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
        <ErrorMsg>{error}</ErrorMsg>
        <Button type="submit" busy={busy}>Save result</Button>
      </form>
    </Modal>
  );
}
