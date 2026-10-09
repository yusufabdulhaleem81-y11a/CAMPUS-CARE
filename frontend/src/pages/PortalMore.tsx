import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PatientShell } from '../components/Shells';
import { Card, Empty, Loading } from '../components/ui';
import { useAuth } from '../lib/auth';

interface Notification { id: number; title: string; body: string | null; type: string; read_at: string | null; created_at: string }

// Notifications are fetched through the Supabase client directly (RLS: own rows only)
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const supabaseAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export default function PortalMore() {
  const { patient, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  useEffect(() => {
    (async () => {
      if (!supabaseUrl || !supabaseAnon) { setNotifications([]); return; }
      const token = localStorage.getItem('cc_access_token');
      if (!token) { setNotifications([]); return; }
      const sb = createClient(supabaseUrl, supabaseAnon, {
        global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false },
      });
      const { data } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(30);
      setNotifications((data as Notification[]) ?? []);
    })();
  }, []);

  if (!patient) return null;

  return (
    <PatientShell>
      <h1 className="font-display text-2xl font-semibold text-navy">My profile</h1>

      <Card className="mt-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-500">Unit Number</dt><dd className="font-semibold text-primary-dark">{patient.unit_number}</dd></div>
          <div><dt className="text-slate-500">Category</dt><dd className="font-semibold text-navy capitalize">{patient.category.replace('_', ' ')}</dd></div>
          <div><dt className="text-slate-500">Name</dt><dd className="font-semibold text-navy">{patient.full_name}</dd></div>
          <div><dt className="text-slate-500">University ID</dt><dd className="font-semibold text-navy">{patient.university_id ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Blood group</dt><dd className="font-semibold text-navy">{(patient.blood_group as string) ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Allergies</dt><dd className="font-semibold text-navy">{(patient.allergies as string) ?? 'None recorded'}</dd></div>
        </dl>
      </Card>

      <h2 className="mt-6 mb-2 font-semibold text-navy">Notifications</h2>
      {notifications === null ? <Loading /> : notifications.length === 0 ? (
        <Empty title="No notifications yet." />
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <Card key={n.id} className={`py-3 ${n.read_at ? '' : 'border-primary/40 bg-primary-light/20'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-navy">{n.title}</p>
                <span className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              {n.body && <p className="mt-1 text-sm text-slate-600">{n.body}</p>}
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <p className="text-sm text-slate-600">
          Need to correct your details or forgot your password? Visit reception with your ID card.
        </p>
        <button onClick={logout} className="mt-3 rounded-[10px] border border-line px-4 py-2 text-sm font-medium text-navy hover:bg-bg">
          Sign out
        </button>
      </Card>

      <p className="mt-6 text-center">
        <Link to="/emergency-request" className="text-sm font-semibold text-red-700 hover:underline">Emergency request →</Link>
      </p>
    </PatientShell>
  );
}
