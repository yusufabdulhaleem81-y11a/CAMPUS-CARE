// 
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, ErrorMsg, Field, Input } from '../components/ui';
import { ClinicLogo } from '../components/ClinicLogo';
import { useAuth, homeForRole } from '../lib/auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setBusy(true);
    setError(null);

    try {
      const profile = await login(id.trim(), password);
      navigate(homeForRole[profile.role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <ClinicLogo size={44} />

          <div>
            <h1 className="font-display text-xl font-bold text-navy">
              Campus Care
            </h1>
            <p className="text-sm text-slate-500">
              FUD Clinic · Sign in
            </p>
          </div>
        </div>

        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field
              label="Registration No or Staff ID"
              required
              hint="Students: e.g. FCO/CSC/24/1001 · Staff: e.g. STF/MED/014"
            >
              <Input
                id="login-id"
                name="id"
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
                autoFocus
                placeholder="Your ID"
                autoComplete="username"
              />
            </Field>

            <Field label="Password" required>
              <Input
                id="login-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Field>

            <ErrorMsg>{error}</ErrorMsg>

            <Button type="submit" busy={busy}>
              Sign in
            </Button>
          </form>

          <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
            <span>
              New student?{' '}
              <Link
                to="/signup"
                className="font-medium text-primary hover:underline"
              >
                Create an account
              </Link>
            </span>

            <span>
              Forgot your password? Visit reception with your ID card —
              they will reset it for you.
            </span>
          </div>
        </Card>

        <p className="mt-4 text-center text-sm">
          <Link to="/" className="text-slate-500 hover:underline">
            ← Back to home
          </Link>
        </p>

        <p className="mt-8 text-center text-xs text-slate-400">
          © 2026 Innovatech Limited. All rights reserved.
        </p>
      </div>
    </div>
  );
}
