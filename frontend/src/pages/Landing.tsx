import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HeroSlideshow } from '../components/HeroSlideshow';
import { LogoLockup } from '../components/ClinicLogo';
import { Card } from '../components/ui';
import { api } from '../lib/api';
import { useAuth, homeForRole } from '../lib/auth';

interface ClinicInfo { clinic_name: string; emergency_phone: string; opening_time: string; closing_time: string }

const services = [
  { name: 'General consultation', desc: 'Everyday illness, check-ups and health advice from our doctors.' },
  { name: 'Laboratory tests', desc: 'Malaria, blood, urine and other tests with results released to your portal.' },
  { name: 'Pharmacy', desc: 'Prescribed medicines dispensed on campus, with live stock management.' },
  { name: 'Emergency care', desc: 'A dedicated emergency hotline and response team for urgent situations.' },
  { name: 'Antenatal & follow-up', desc: 'Follow-up visits and pregnancy care tracked in your clinic file.' },
  { name: 'Health records', desc: 'Your whole clinic history in one digital file, secured and private.' },
];

/** Reveals children with a slide-up once they scroll into view.
 *  Motion is CSS-driven; the global prefers-reduced-motion rule disables it. */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${shown ? 'revealed' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function Landing() {
  const { profile } = useAuth();
  const [info, setInfo] = useState<ClinicInfo | null>(null);

  useEffect(() => {
    api<ClinicInfo>('/public/clinic-info').then(setInfo).catch(() => setInfo(null));
  }, []);

  return (
    <div className="min-h-screen">
      {/* ---------- Nav ---------- */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-8">
        <LogoLockup light />
        <nav className="flex items-center gap-3">
          {profile ? (
            <Link to={homeForRole[profile.role]}
              className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5 hover:bg-primary-dark">
              Open my dashboard
            </Link>
          ) : (
            <>
              <Link to="/login"
                className="rounded-[10px] border border-white/40 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10">
                Login
              </Link>
              <Link to="/signup"
                className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5 hover:bg-primary-dark">
                Register
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* ---------- Hero with automated slideshow ---------- */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden">
        <HeroSlideshow />

        {/* Decorative gradient orbs — pure ambience, never intercept input */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-16 h-72 w-72 rounded-full bg-primary/25 blur-3xl float-slow" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 bottom-24 h-64 w-64 rounded-full bg-gold/15 blur-3xl" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-28 sm:px-8">
          <p className="hero-enter mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white backdrop-blur"
            style={{ animationDelay: '80ms' }}>
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary-light" aria-hidden="true" />
            Federal University Dutse
          </p>
          <h1 className="hero-enter max-w-2xl font-display text-4xl font-bold leading-tight text-white drop-shadow-sm sm:text-5xl"
            style={{ animationDelay: '180ms' }}>
            FUD <span className="text-gradient">Campus Care</span>
          </h1>
          <p className="hero-enter mt-4 max-w-xl text-lg text-navy-light" style={{ animationDelay: '280ms' }}>
            Digital healthcare for Federal University Dutse. Book appointments, avoid the long queue,
            and keep your whole clinic history in one secure file.
          </p>
          <div className="hero-enter mt-8 flex flex-wrap gap-3" style={{ animationDelay: '380ms' }}>
            {profile ? (
              <Link to={homeForRole[profile.role]}
                className="rounded-[10px] bg-primary px-6 py-3 font-semibold text-white shadow-xl shadow-primary/30 transition hover:-translate-y-0.5 hover:bg-primary-dark">
                Go to my dashboard
              </Link>
            ) : (
              <>
                <Link to="/login"
                  className="rounded-[10px] bg-primary px-6 py-3 font-semibold text-white shadow-xl shadow-primary/30 transition hover:-translate-y-0.5 hover:bg-primary-dark">
                  Login to the clinic
                </Link>
                <Link to="/signup"
                  className="rounded-[10px] border border-white/50 px-6 py-3 font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10">
                  Register as a student
                </Link>
              </>
            )}
            <a href={`tel:${info?.emergency_phone ?? ''}`}
              className="rounded-[10px] bg-red-700 px-6 py-3 font-semibold text-white shadow-lg shadow-red-900/30 transition hover:-translate-y-0.5 hover:bg-red-800">
              Emergency: {info?.emergency_phone || 'call the clinic'}
            </a>
          </div>
          <p className="hero-enter mt-6 inline-flex items-center gap-2 rounded-full bg-navy/40 px-3 py-1 text-sm text-navy-light backdrop-blur"
            style={{ animationDelay: '480ms' }}>
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            Clinic hours: {info ? `${info.opening_time.slice(0, 5)} – ${info.closing_time.slice(0, 5)}` : 'Mon – Fri, 8:00 – 17:00'}
          </p>
        </div>

        {/* Scroll cue */}
        <a href="#how-it-works" aria-label="Scroll to how Campus Care works"
          className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-1 text-navy-light transition hover:text-white sm:flex">
          <span className="text-[11px] font-medium uppercase tracking-widest">Discover</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-bounce">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-16 sm:px-8">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold text-navy">How Campus Care works</h2>
        </Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ['1. Register once', 'Every patient gets a Clinic Unit Number — your permanent digital clinic file.'],
            ['2. Book or walk in', 'Reserve a slot online, or simply walk in and reception checks you into the queue.'],
            ['3. Care, tracked', 'Nurse, doctor, lab and pharmacy actions all attach to your file automatically.'],
          ].map(([title, desc], i) => (
            <Reveal key={title} delay={i * 90}>
              <Card className="h-full transition duration-300 hover:-translate-y-1 hover:shadow-lg">
                <h3 className="font-semibold text-primary">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{desc}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Services ---------- */}
      <section className="bg-gradient-to-b from-white to-bg py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold text-navy">Clinic services</h2>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <Reveal key={s.name} delay={(i % 3) * 90}>
                <Card className="h-full transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                  <h3 className="font-semibold text-navy">{s.name}</h3>
                  <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Trust ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold text-navy">Private and secure</h2>
            <p className="mt-3 text-slate-600">
              Your records are protected by the same database-level security used in hospitals.
              Only clinic staff involved in your care can see your file, every access is logged,
              and test results reach you only after the lab releases them.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="h-full rounded-xl border border-red-200 bg-red-50 p-6 transition duration-300 hover:shadow-lg">
              <h3 className="font-display text-lg font-semibold text-red-900">Emergency?</h3>
              <p className="mt-2 text-sm text-red-800">
                Don't book an appointment. Call the clinic emergency line or send an emergency request now —
                available even without an account.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href={`tel:${info?.emergency_phone ?? ''}`} className="rounded-[10px] bg-red-700 px-4 py-2 font-semibold text-white shadow-md shadow-red-900/20 transition hover:-translate-y-0.5 hover:bg-red-800">
                  Call {info?.emergency_phone || 'emergency line'}
                </a>
                <Link to="/emergency-request" className="rounded-[10px] border border-red-300 px-4 py-2 font-semibold text-red-800 transition hover:-translate-y-0.5 hover:bg-red-100">
                  Send emergency request
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="bg-navy py-10 text-navy-light">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <LogoLockup light />
          <p className="text-sm">
            Federal University Dutse · Dutse, Jigawa State · {info?.clinic_name ?? 'FUD Campus Care Clinic'}
          </p>
        </div>
        <div className="mx-auto mt-6 max-w-6xl border-t border-white/10 px-4 pt-5 sm:px-8">
          <p className="text-center text-xs tracking-wide text-white/45 sm:text-left">
            © 2026 Innovatech Limited. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
