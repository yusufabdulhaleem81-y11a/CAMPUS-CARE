import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, ErrorMsg, Field, Input, SuccessMsg } from '../components/ui';
import { ClinicLogo } from '../components/ClinicLogo';
import { api } from '../lib/api';
import { getToken, setSession } from '../lib/api';

interface SignupResponse {
  session: { access_token: string; refresh_token: string } | null;
  patient: { unit_number: string } | null;
}

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', reg_no: '', email: '', phone: '', department: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [unitNumber, setUnitNumber] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await api<SignupResponse>('/auth/signup', { method: 'POST', body: form });
      if (res.session) setSession(res.session.access_token, res.session.refresh_token);
      setUnitNumber(res.patient?.unit_number ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  if (unitNumber) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <Card className="max-w-md text-center">
          <h1 className="font-display text-xl font-semibold text-navy">Registration complete</h1>
          <p className="mt-3 text-slate-600">Your clinic file has been created.</p>
          <div className="my-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary-light/40 p-6">
            <p className="text-sm text-slate-600">Your Clinic Unit Number</p>
            <p className="font-display text-3xl font-bold tracking-wide text-primary-dark">{unitNumber}</p>
            <p className="mt-2 text-xs text-slate-500">Keep this number — it opens your file at reception.</p>
          </div>
          <Button onClick={() => { if (getToken()) navigate('/portal'); else navigate('/login'); }}>
            Continue to my portal
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <ClinicLogo size={44} />
          <div>
            <h1 className="font-display text-xl font-bold text-navy">Student registration</h1>
            <p className="text-sm text-slate-500">FUD Clinic · Create your account</p>
          </div>
        </div>
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Full name" required>
              <Input value={form.full_name} onChange={set('full_name')} required autoFocus />
            </Field>
            <Field label="Registration number" required hint="As printed on your ID card, e.g. FCO/CSC/24/1001">
              <Input value={form.reg_no} onChange={set('reg_no')} required />
            </Field>
            <Field label="Email" required hint="Used only if you ever need a password reset">
              <Input type="email" value={form.email} onChange={set('email')} required />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={set('phone')} placeholder="+234…" />
            </Field>
            <Field label="Department">
              <Input value={form.department} onChange={set('department')} />
            </Field>
            <Field label="Password" required hint="At least 6 characters">
              <Input type="password" value={form.password} onChange={set('password')} required minLength={6} />
            </Field>
            <ErrorMsg>{error}</ErrorMsg>
            <SuccessMsg>This creates your login and your clinic file with a unique Unit Number.</SuccessMsg>
            <Button type="submit" busy={busy}>Create account</Button>
          </form>
          <p className="mt-4 text-sm text-slate-600">
            Already registered? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </Card>
        <p className="mt-4 text-center text-sm">
          <Link to="/" className="text-slate-500 hover:underline">← Back to home</Link>
        </p>
        <p className="mt-8 text-center text-xs text-slate-400">© 2026 Innovatech Limited. All rights reserved.</p>
      </div>
    </div>
  );
}
