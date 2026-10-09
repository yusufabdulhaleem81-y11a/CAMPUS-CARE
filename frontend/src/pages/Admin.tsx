import { useEffect, useState } from 'react';
import { StaffShell } from '../components/Shells';
import { Button, Card, ErrorMsg, Field, Input, Loading, SuccessMsg } from '../components/ui';
import { api } from '../lib/api';

interface ClinicSettings {
  clinic_name: string;
  emergency_phone: string;
  opening_time: string;
  closing_time: string;
  allow_open_signup: boolean;
}

interface User {
  id: string;
  full_name: string;
  role: string;
  staff_id: string | null;
  reg_no: string | null;
  email: string | null;
  created_at: string;
}

interface AuditLog {
  id: number;
  actor_name: string | null;
  action: string;
  table_name: string | null;
  created_at: string;
}

export default function Admin() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api<ClinicSettings>('/admin/settings'),
      api<User[]>('/admin/users'),
      api<AuditLog[]>('/admin/audit-logs?limit=50'),
    ]).then(([clinic, staff, logs]) => {
      setSettings(clinic);
      setUsers(staff);
      setAuditLogs(logs);
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load administration data.'));
  }, []);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await api<ClinicSettings>('/admin/settings', { method: 'PATCH', body: settings });
      setSettings(saved);
      setMessage('Clinic settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save clinic settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StaffShell title="Administration">
      <ErrorMsg>{error}</ErrorMsg>
      <SuccessMsg>{message}</SuccessMsg>
      {!settings || !users || !auditLogs ? <Loading /> : (
        <div className="mt-4 flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 font-semibold text-navy">Clinic settings</h2>
            <form onSubmit={saveSettings} className="grid gap-4 sm:grid-cols-2">
              <Field label="Clinic name" required>
                <Input value={settings.clinic_name} onChange={(e) => setSettings({ ...settings, clinic_name: e.target.value })} required minLength={2} />
              </Field>
              <Field label="Emergency phone" required>
                <Input value={settings.emergency_phone} onChange={(e) => setSettings({ ...settings, emergency_phone: e.target.value })} required minLength={5} />
              </Field>
              <Field label="Opening time" required>
                <Input type="time" value={settings.opening_time.slice(0, 5)} onChange={(e) => setSettings({ ...settings, opening_time: e.target.value })} required />
              </Field>
              <Field label="Closing time" required>
                <Input type="time" value={settings.closing_time.slice(0, 5)} onChange={(e) => setSettings({ ...settings, closing_time: e.target.value })} required />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input type="checkbox" checked={settings.allow_open_signup} onChange={(e) => setSettings({ ...settings, allow_open_signup: e.target.checked })} />
                Allow students to register their own accounts
              </label>
              <Button type="submit" busy={busy} className="sm:col-span-2">Save settings</Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-navy">User accounts ({users.length})</h2>
            {users.length === 0 ? <p className="text-sm text-slate-500">No accounts found.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-line text-slate-500"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">ID</th><th className="py-2">Email</th></tr></thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-line last:border-0">
                        <td className="py-2 pr-3 font-medium text-navy">{user.full_name}</td>
                        <td className="py-2 pr-3 capitalize">{user.role.replace('_', ' ')}</td>
                        <td className="py-2 pr-3">{user.staff_id ?? user.reg_no ?? '—'}</td>
                        <td className="py-2">{user.email ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-navy">Recent audit activity</h2>
            {auditLogs.length === 0 ? <p className="text-sm text-slate-500">No audit entries found.</p> : (
              <ul className="divide-y divide-line">
                {auditLogs.map((log) => (
                  <li key={log.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                    <span><strong>{log.actor_name ?? 'System'}</strong> · {log.action}{log.table_name ? ` · ${log.table_name}` : ''}</span>
                    <time className="text-slate-500" dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </StaffShell>
  );
}
