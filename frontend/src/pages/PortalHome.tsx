import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PatientShell } from '../components/Shells';
import { Button, Card, Empty, ErrorMsg, Loading, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Appointment { id: string; reference: string; appointment_date: string; start_time: string; status: string }

export default function PortalHome() {
  const { patient } = useAuth();
  const [upcoming, setUpcoming] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      api<Appointment[]>(`/patients/${patient.id}/appointments?upcoming=true`)
        .then(setUpcoming)
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'Could not load your appointments.');
          setUpcoming([]);
        });
    }
  }, [patient]);

  if (!patient) return null;

  return (
    <PatientShell>
      <h1 className="font-display text-2xl font-semibold text-navy">Hello{patient.full_name ? `, ${patient.full_name.split(' ')[0]}` : ''}</h1>

      <Card className="mt-4 border-primary/30 bg-primary-light/30">
        <p className="text-sm text-slate-600">Your clinic file</p>
        <p className="font-display text-2xl font-bold tracking-wide text-primary-dark">{patient.unit_number}</p>
        <p className="mt-1 text-xs text-slate-500">Show this number at reception — it opens your clinic file.</p>
      </Card>

      <ErrorMsg>{error}</ErrorMsg>

      <div className="mt-6">
        <h2 className="mb-3 font-semibold text-navy">Next appointment</h2>
        {upcoming === null ? <Loading /> : upcoming.length === 0 ? (
          <Empty title="No appointment yet. Book your first visit."
            action={<Link to="/portal/book"><Button>Book appointment</Button></Link>} />
        ) : (
          <Card>
            {upcoming.slice(0, 1).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy">{a.appointment_date} at {a.start_time.slice(0, 5)}</p>
                  <p className="text-sm text-slate-500">Reference {a.reference}</p>
                </div>
                <StatusPill status={a.status} />
              </div>
            ))}
          </Card>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {[
          ['/portal/book', 'Book a visit'],
          ['/portal/visits', 'My visits & medicines'],
          ['/portal/results', 'Test results'],
          ['/portal/more', 'Profile & notifications'],
        ].map(([to, label]) => (
          <Link key={to} to={to} className="rounded-xl border border-line bg-white p-4 font-medium text-navy shadow-sm hover:border-primary">
            {label}
          </Link>
        ))}
      </div>

      <Card className="mt-6 border-red-200 bg-red-50">
        <p className="font-semibold text-red-900">Emergency</p>
        <p className="mt-1 text-sm text-red-800">Don't book online for emergencies — call or request immediate help.</p>
        <Link to="/emergency-request" className="mt-3 inline-block">
          <Button variant="danger" size="sm">Emergency request</Button>
        </Link>
      </Card>
    </PatientShell>
  );
}
