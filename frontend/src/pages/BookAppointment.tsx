import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PatientShell } from '../components/Shells';
import { Button, Card, Empty, ErrorMsg, Loading } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Doctor { profile_id: string; specialty: string; profiles: { full_name: string } }
interface Slot { time: string; available: boolean }

function nextDays(count: number): { date: string; label: string; dow: string }[] {
  const days: { date: string; label: string; dow: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
    });
  }
  return days;
}

export default function BookAppointment() {
  const { patient } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [service, setService] = useState('General consultation');
  const [doctorId, setDoctorId] = useState<string>('');
  const [date, setDate] = useState<string>(nextDays(1)[0].date);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [chosen, setChosen] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<Doctor[]>('/doctors').then(setDoctors).catch(() => setDoctors([])); }, []);

  useEffect(() => {
    if (!doctorId || !date) return;
    setSlots(null); setChosen(''); setError(null);
    api<{ slots: Slot[] }>(`/appointments/availability?doctorId=${doctorId}&date=${date}`)
      .then((r) => setSlots(r.slots)).catch((e) => { setError(e.message); setSlots([]); });
  }, [doctorId, date]);

  async function confirm() {
    setBusy(true); setError(null);
    try {
      const res = await api<{ reference: string }>('/appointments', {
        method: 'POST',
        body: { patient_id: patient!.id, doctor_id: doctorId, date, time: chosen, service },
      });
      setReference(res.reference);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed');
      // refresh slots — the chosen one may have just been taken
      api<{ slots: Slot[] }>(`/appointments/availability?doctorId=${doctorId}&date=${date}`)
        .then((r) => setSlots(r.slots)).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  if (!patient) return null;

  if (reference) {
    return (
      <PatientShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-semibold text-navy">Done. Your appointment is booked.</h1>
          <p className="mt-2 text-slate-600">{date} at {chosen} · {service}</p>
          <div className="my-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary-light/40 p-6">
            <p className="text-sm text-slate-600">Booking reference</p>
            <p className="font-display text-2xl font-bold text-primary-dark">{reference}</p>
          </div>
          <p className="text-sm text-slate-500">Come with your Unit Number: <strong>{patient.unit_number}</strong>. Reception will check you in.</p>
          <Link to="/portal" className="mt-4 inline-block"><Button>Back to home</Button></Link>
        </Card>
      </PatientShell>
    );
  }

  return (
    <PatientShell>
      <h1 className="font-display text-2xl font-semibold text-navy">Book an appointment</h1>

      <div className="mt-4 flex flex-col gap-4">
        <Card>
          <h2 className="mb-2 font-semibold text-navy">1. Service</h2>
          <div className="flex flex-wrap gap-2">
            {['General consultation', 'Follow-up visit', 'Laboratory test request', 'Antenatal check'].map((s) => (
              <button key={s} onClick={() => setService(s)} type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium ${service === s ? 'bg-primary text-white' : 'border border-line bg-white text-slate-700 hover:border-primary'}`}>
                {s}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold text-navy">2. Doctor</h2>
          <div className="flex flex-col gap-2">
            {doctors.length === 0 && <p className="text-sm text-slate-500">No doctors accepting appointments right now.</p>}
            {doctors.map((d) => (
              <button key={d.profile_id} type="button" onClick={() => setDoctorId(d.profile_id)}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left ${doctorId === d.profile_id ? 'border-primary bg-primary-light/40' : 'border-line bg-white hover:border-primary'}`}>
                <span className="font-medium text-navy">{d.profiles?.full_name}</span>
                <span className="text-sm text-slate-500">{d.specialty}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold text-navy">3. Day</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {nextDays(10).map((d) => (
              <button key={d.date} type="button" onClick={() => setDate(d.date)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-center text-sm ${date === d.date ? 'border-primary bg-primary text-white' : 'border-line bg-white'}`}>
                <span className="block text-xs opacity-80">{d.dow}</span>
                <span className="font-semibold">{d.label}</span>
              </button>
            ))}
          </div>
        </Card>

        {doctorId && (
          <Card>
            <h2 className="mb-2 font-semibold text-navy">4. Time</h2>
            {slots === null ? <Loading /> : slots.length === 0 ? (
              <Empty title="No available times this day. Try another day." />
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {slots.map((s) => (
                  <button key={s.time} type="button" disabled={!s.available}
                    onClick={() => setChosen(s.time)}
                    className={`rounded-lg border px-2 py-2 text-sm font-medium ${!s.available ? 'cursor-not-allowed border-line bg-slate-100 text-slate-400 line-through'
                      : chosen === s.time ? 'border-primary bg-primary text-white' : 'border-line bg-white hover:border-primary'}`}>
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        <ErrorMsg>{error}</ErrorMsg>

        <Button onClick={confirm} disabled={!chosen || !doctorId} busy={busy}>
          Confirm booking
        </Button>
      </div>
    </PatientShell>
  );
}
