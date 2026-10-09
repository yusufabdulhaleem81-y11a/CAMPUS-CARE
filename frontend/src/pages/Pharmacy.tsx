import { useCallback, useEffect, useState } from 'react';
import { StaffShell } from '../components/Shells';
import { Button, Card, Empty, ErrorMsg, Field, Input, Loading, Modal, StatusPill, SuccessMsg, Tabs, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Medicine { id: string; name: string; unit: string; stock_qty: number; reorder_level: number; critical_level: number }
interface RxItem { id: string; medicine_name: string; dosage: string; frequency: string; quantity: number; dispensed_qty: number }
interface PendingRx {
  id: string; status: string; created_at: string; notes: string | null;
  prescription_items: RxItem[];
  patients: { unit_number: string; full_name: string } | { unit_number: string; full_name: string }[];
  profiles: { full_name: string } | { full_name: string }[] | null;
}
interface Alert {
  id: string; alert_level: string; stock_qty: number; usage_per_day: string | null;
  days_remaining: string | null; status: string;
  medicines: { name: string; unit: string } | { name: string; unit: string }[];
}
interface PurchaseRequest {
  id: string; request_number: string; status: string; created_at: string; notes: string | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
  purchase_request_items: { id: string; quantity_requested: number; quantity_approved: number | null; medicines: { name: string } | { name: string }[] }[];
}
interface Movement { id: number; movement_type: string; quantity_change: number; reason: string | null; created_at: string; medicines: { name: string } | { name: string }[]; profiles: { full_name: string } | { full_name: string }[] | null }

function one<T>(obj: T | T[] | null | undefined): T | null {
  if (obj == null) return null;
  return Array.isArray(obj) ? (obj[0] ?? null) : obj;
}

export default function Pharmacy() {
  const { profile } = useAuth();
  const isPharm = profile?.role === 'pharmacist' || profile?.role === 'admin' || profile?.role === 'super_admin';
  const isMgr = profile?.role === 'hospital_head' || profile?.role === 'admin' || profile?.role === 'super_admin';
  const [tab, setTab] = useState('dispense');
  const [pendingRx, setPendingRx] = useState<PendingRx[] | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiveFor, setReceiveFor] = useState<Medicine | null>(null);
  const [correctFor, setCorrectFor] = useState<Medicine | null>(null);
  const [showPurchase, setShowPurchase] = useState(false);

  const load = useCallback(() => {
    api<PendingRx[]>('/prescriptions/pending').then(setPendingRx).catch((e) => setError(e.message));
    api<Medicine[]>('/medicines').then(setMedicines).catch(() => {});
    api<Alert[]>('/alerts').then(setAlerts).catch(() => {});
    api<PurchaseRequest[]>('/purchase-requests').then(setRequests).catch(() => {});
    api<Movement[]>('/movements').then(setMovements).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function dispense(prescriptionId: string, item: RxItem) {
    const remaining = item.quantity - item.dispensed_qty;
    setBusy(true); setError(null);
    try {
      await api('/dispense', { method: 'POST', body: { prescription_id: prescriptionId, item_id: item.id, quantity: remaining } });
      setMessage(`Dispensed ${item.medicine_name} × ${remaining}.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispensing failed');
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge(alertId: string) {
    try { await api(`/alerts/${alertId}/acknowledge`, { method: 'POST' }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  }

  async function decidePurchase(id: string, approve: boolean) {
    setError(null);
    try {
      await api(`/purchase-requests/${id}/decide`, { method: 'POST', body: { approve } });
      setMessage(`Purchase request ${approve ? 'approved' : 'rejected'}.`);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  }

  async function receivePurchase(id: string) {
    setError(null);
    try {
      await api(`/purchase-requests/${id}/receive`, { method: 'POST' });
      setMessage('Stock received and inventory updated.');
      load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  }

  const openAlerts = alerts.filter((a) => a.status === 'open');

  return (
    <StaffShell title="Pharmacy">
      <SuccessMsg>{message}</SuccessMsg>
      <ErrorMsg>{error}</ErrorMsg>

      {openAlerts.length > 0 && (
        <div className="mb-4 rounded-xl border border-orange-300 bg-orange-50 p-4">
          <p className="font-semibold text-orange-900">⚠ {openAlerts.length} active stock alert{openAlerts.length > 1 ? 's' : ''}</p>
          <ul className="mt-1 text-sm text-orange-800">
            {openAlerts.slice(0, 4).map((a) => (
              <li key={a.id}>
                {one(a.medicines)?.name}: {a.alert_level.replace('_', ' ')} ({a.stock_qty} left{a.days_remaining ? `, ~${a.days_remaining} days` : ''})
              </li>
            ))}
          </ul>
        </div>
      )}

      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'dispense', label: `To dispense (${pendingRx?.length ?? '…'})` },
        { id: 'inventory', label: `Inventory (${medicines.length})` },
        { id: 'alerts', label: `Alerts (${openAlerts.length})` },
        { id: 'purchases', label: `Purchase requests (${requests.filter((r) => r.status === 'submitted').length})` },
        { id: 'history', label: 'Movements' },
      ]} />

      {tab === 'dispense' && (pendingRx === null ? <Loading /> : pendingRx.length === 0 ? <Empty title="No prescriptions waiting." /> : (
        <div className="flex flex-col gap-3">
          {pendingRx.map((rx) => (
            <Card key={rx.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy">{one(rx.patients)?.full_name} <span className="text-sm font-normal text-slate-500">{one(rx.patients)?.unit_number}</span></p>
                  <p className="text-xs text-slate-400">Prescribed by {one(rx.profiles)?.full_name ?? 'doctor'} · {new Date(rx.created_at).toLocaleString()}</p>
                  {rx.notes && <p className="mt-1 text-sm text-slate-600">Note: {rx.notes}</p>}
                </div>
                <StatusPill status={rx.status} />
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {rx.prescription_items.map((item) => {
                  const med = medicines.find((m) => m.name.toLowerCase() === item.medicine_name.toLowerCase());
                  const remaining = item.quantity - item.dispensed_qty;
                  const short = med ? med.stock_qty < remaining : false;
                  return (
                    <div key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${short ? 'border-red-300 bg-red-50' : 'border-line bg-white'}`}>
                      <div>
                        <p className="font-medium text-navy">{item.medicine_name}</p>
                        <p className="text-sm text-slate-500">{item.dosage}, {item.frequency} · remaining {remaining} of {item.quantity}</p>
                        <p className={`text-xs ${short ? 'text-red-700 font-medium' : 'text-slate-400'}`}>
                          {med ? `Stock on hand: ${med.stock_qty}` : 'Not in catalogue — add it first'}
                        </p>
                      </div>
                      {isPharm && med && !short && remaining > 0 && (
                        <Button size="sm" busy={busy} onClick={() => dispense(rx.id, item)}>Dispense {remaining}</Button>
                      )}
                      {short && <span className="text-sm font-medium text-red-700">Insufficient stock</span>}
                      {remaining === 0 && <StatusPill status="dispensed" />}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      ))}

      {tab === 'inventory' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {isPharm && <>
              <Button size="sm" onClick={() => setReceiveFor(medicines[0] ?? null)}>Receive stock</Button>
              <Button size="sm" variant="secondary" onClick={() => setCorrectFor(medicines[0] ?? null)}>Correct count</Button>
              <Button size="sm" variant="secondary" onClick={() => setShowPurchase(true)}>New purchase request</Button>
            </>}
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Medicine</th><th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Reorder / Critical</th><th className="px-4 py-3">Level</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((m) => {
                  const level = m.stock_qty === 0 ? 'out_of_stock' : m.stock_qty <= m.critical_level ? 'critical' : m.stock_qty <= m.reorder_level ? 'low' : null;
                  return (
                    <tr key={m.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-medium text-navy">{m.name}</td>
                      <td className="px-4 py-3">{m.stock_qty} {m.unit}s</td>
                      <td className="px-4 py-3 text-slate-500">{m.reorder_level} / {m.critical_level}</td>
                      <td className="px-4 py-3">{level ? <StatusPill status={level} /> : <span className="text-emerald-700">Normal</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'alerts' && (alerts.length === 0 ? <Empty title="No stock alerts. Levels are recalculated after every dispense and receipt." /> : (
        <div className="flex flex-col gap-2">
          {alerts.map((a) => (
            <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-navy">{one(a.medicines)?.name}</p>
                <p className="text-sm text-slate-500">
                  {a.stock_qty} left · usage {a.usage_per_day ?? 0}/day{a.days_remaining ? ` · ~${a.days_remaining} days remaining` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={a.alert_level} />
                <StatusPill status={a.status} />
                {isPharm && a.status === 'open' && (
                  <Button size="sm" variant="secondary" onClick={() => acknowledge(a.id)}>Acknowledge</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ))}

      {tab === 'purchases' && (requests.length === 0 ? <Empty title="No purchase requests yet."
        action={isPharm ? <Button size="sm" onClick={() => setShowPurchase(true)}>Create request</Button> : undefined} /> : (
        <div className="flex flex-col gap-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy">{r.request_number}</p>
                  <p className="text-xs text-slate-400">By {one(r.profiles)?.full_name ?? 'pharmacy'} · {new Date(r.created_at).toLocaleString()}</p>
                  <ul className="mt-2 text-sm text-slate-600">
                    {r.purchase_request_items.map((it) => (
                      <li key={it.id}>{one(it.medicines)?.name} × {it.quantity_requested}
                        {it.quantity_approved != null && ` (approved: ${it.quantity_approved})`}</li>
                    ))}
                  </ul>
                  {r.notes && <p className="mt-1 text-sm text-slate-500">Note: {r.notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusPill status={r.status} />
                  {isMgr && r.status === 'submitted' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decidePurchase(r.id, true)}>Approve</Button>
                      <Button size="sm" variant="danger" onClick={() => decidePurchase(r.id, false)}>Reject</Button>
                    </div>
                  )}
                  {isPharm && r.status === 'approved' && (
                    <Button size="sm" onClick={() => receivePurchase(r.id)}>Mark received</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ))}

      {tab === 'history' && (movements.length === 0 ? <Empty title="No stock movements yet." /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">When</th><th className="px-4 py-3">Medicine</th>
                <th className="px-4 py-3">Type</th><th className="px-4 py-3">Change</th>
                <th className="px-4 py-3">By</th><th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 text-slate-500">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-medium text-navy">{one(m.medicines)?.name}</td>
                  <td className="px-4 py-2.5 capitalize">{m.movement_type}</td>
                  <td className={`px-4 py-2.5 font-medium ${m.quantity_change < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{one(m.profiles)?.full_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{m.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      {/* Receive stock modal */}
      <Modal open={!!receiveFor} onClose={() => setReceiveFor(null)} title="Receive stock">
        <ReceiveForm medicines={medicines} onClose={() => setReceiveFor(null)}
          onSaved={() => { setReceiveFor(null); setMessage('Stock received.'); load(); }} />
      </Modal>

      {/* Correct modal */}
      <Modal open={!!correctFor} onClose={() => setCorrectFor(null)} title="Correct stock count">
        <CorrectForm medicines={medicines} onClose={() => setCorrectFor(null)}
          onSaved={() => { setCorrectFor(null); setMessage('Stock corrected.'); load(); }} />
      </Modal>

      {/* Purchase request modal */}
      <Modal open={showPurchase} onClose={() => setShowPurchase(false)} title="New purchase request">
        <PurchaseForm medicines={medicines} alerts={alerts} onClose={() => setShowPurchase(false)}
          onSaved={() => { setShowPurchase(false); setMessage('Purchase request submitted for approval.'); load(); }} />
      </Modal>
    </StaffShell>
  );
}

function ReceiveForm({ medicines, onClose, onSaved }: { medicines: Medicine[]; onClose: () => void; onSaved: () => void }) {
  const [medicineId, setMedicineId] = useState(medicines[0]?.id ?? '');
  const [qty, setQty] = useState('');
  const [batch, setBatch] = useState('');
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/stock/receive', { method: 'POST', body: { medicine_id: medicineId, quantity: Number(qty), batch_no: batch || undefined, expiry_date: expiry || undefined } });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Medicine" required>
        <select value={medicineId} onChange={(e) => setMedicineId(e.target.value)} className="w-full rounded-[6px] border border-line px-3 py-2">
          {medicines.map((m) => <option key={m.id} value={m.id}>{m.name} (stock {m.stock_qty})</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Quantity" required><Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} required /></Field>
        <Field label="Batch no"><Input value={batch} onChange={(e) => setBatch(e.target.value)} /></Field>
        <Field label="Expiry"><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
      </div>
      <ErrorMsg>{error}</ErrorMsg>
      <div className="flex gap-2">
        <Button type="submit" busy={busy}>Receive</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

function CorrectForm({ medicines, onClose, onSaved }: { medicines: Medicine[]; onClose: () => void; onSaved: () => void }) {
  const [medicineId, setMedicineId] = useState(medicines[0]?.id ?? '');
  const [newQty, setNewQty] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = medicines.find((m) => m.id === medicineId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/stock/correct', { method: 'POST', body: { medicine_id: medicineId, new_qty: Number(newQty), reason } });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Medicine" required>
        <select value={medicineId} onChange={(e) => { setMedicineId(e.target.value); }}
          className="w-full rounded-[6px] border border-line px-3 py-2">
          {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Field>
      {current && <p className="text-sm text-slate-500">System count: <strong>{current.stock_qty}</strong></p>}
      <Field label="Actual counted quantity" required><Input inputMode="numeric" value={newQty} onChange={(e) => setNewQty(e.target.value)} required /></Field>
      <Field label="Reason for correction" required hint="Recorded in the audit trail">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} />
      </Field>
      <ErrorMsg>{error}</ErrorMsg>
      <div className="flex gap-2">
        <Button type="submit" busy={busy}>Save correction</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

function PurchaseForm({ medicines, alerts, onClose, onSaved }: { medicines: Medicine[]; alerts: Alert[]; onClose: () => void; onSaved: () => void }) {
  const [items, setItems] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const suggested = new Set(
    alerts.filter((a) => a.status !== 'resolved').map((a) => one(a.medicines)?.name).filter(Boolean) as string[],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const chosen = Object.entries(items).filter(([, qty]) => Number(qty) > 0);
    if (!chosen.length) { setError('Add at least one medicine with a quantity'); return; }
    setBusy(true); setError(null);
    try {
      await api('/purchase-requests', {
        method: 'POST',
        body: {
          notes: notes || undefined,
          items: chosen.map(([medicine_id, qty]) => ({ medicine_id, quantity: Number(qty) })),
        },
      });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-slate-600">Medicines with active alerts are pre-filled where possible.</p>
      <div className="max-h-72 overflow-y-auto">
        {medicines.map((m) => (
          <div key={m.id} className={`flex items-center justify-between gap-2 border-b border-line py-2 ${suggested.has(m.name) ? 'bg-orange-50/60 px-2 rounded' : ''}`}>
            <div>
              <p className="text-sm font-medium text-navy">{m.name} {suggested.has(m.name) && <span className="text-xs text-orange-700">· alert</span>}</p>
              <p className="text-xs text-slate-400">stock {m.stock_qty} · reorder at {m.reorder_level}</p>
            </div>
            <Input inputMode="numeric" placeholder="Qty" value={items[m.id] ?? ''} aria-label={`Quantity for ${m.name}`}
              onChange={(e) => setItems({ ...items, [m.id]: e.target.value })} className="w-24" />
          </div>
        ))}
      </div>
      <Field label="Notes for management"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <ErrorMsg>{error}</ErrorMsg>
      <div className="flex gap-2">
        <Button type="submit" busy={busy}>Submit for approval</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
