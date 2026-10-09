import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, ErrorMsg, Field, Input, Select, SuccessMsg, Textarea } from '../components/ui';
import { ClinicLogo } from '../components/ClinicLogo';
import { api } from '../lib/api';

interface Created { case_number: string; priority: string }

/** Public emergency request — works without an account (also reachable by phone). */
export default function EmergencyRequest() {
  const [form, setForm] = useState({ caller_name: '', caller_phone: '', location: '', description: '', priority: 'serious' });
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await api<Created>('/emergency', { method: 'POST', body: form });
      setCreated(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request. Call the clinic now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-red-50/60 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center gap-3">
          <ClinicLogo size={40} />
          <div>
            <h1 className="font-display text-xl font-bold text-red-900">Emergency request</h1>
            <p className="text-sm text-red-700">FUD Campus Care · available without login</p>
          </div>
        </div>

        {created ? (
          <Card>
            <SuccessMsg>
              <>Emergency request received. Reference <strong>{created.case_number}</strong> ({created.priority} priority).</>
              The response team has been alerted.
            </SuccessMsg>
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-900">
              If this is life-threatening, also call the clinic emergency line directly.
              Stay with the patient and keep the phone nearby.
            </div>
            <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">← Back to home</Link>
          </Card>
        ) : (
          <Card>
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              For immediate danger, <strong>call the clinic first</strong>. Use this form when calling is not possible.
            </div>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field label="Your name" required>
                <Input value={form.caller_name} onChange={(e) => setForm({ ...form, caller_name: e.target.value })} required autoFocus />
              </Field>
              <Field label="Phone number we can reach you on" required>
                <Input value={form.caller_phone} onChange={(e) => setForm({ ...form, caller_phone: e.target.value })} required inputMode="tel" />
              </Field>
              <Field label="Location" required hint="Hostel, block, or landmark on campus">
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
              </Field>
              <Field label="What is happening?" required>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required minLength={5} />
              </Field>
              <Field label="How urgent is it?" required>
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="critical">Critical — life threatening</option>
                  <option value="serious">Serious — needs urgent attention</option>
                  <option value="minor">Minor — needs help soon</option>
                </Select>
              </Field>
              <ErrorMsg>{error}</ErrorMsg>
              <Button type="submit" busy={busy} className="bg-red-700 hover:bg-red-800">Send emergency request</Button>
            </form>
          </Card>
        )}
        <p className="mt-8 text-center text-xs text-slate-400">© 2026 Innovatech Limited. All rights reserved.</p>
      </div>
    </div>
  );
}
