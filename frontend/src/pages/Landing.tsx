import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HeroSlideshow } from '../components/HeroSlideshow';
import { LogoLockup } from '../components/ClinicLogo';
import { ThemeToggle } from '../components/ThemeToggle';
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

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${shown ? 'revealed' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Contact', href: '#contact' },
];

export default function Landing() {
  const { profile } = useAuth();
  const [info, setInfo] = useState<ClinicInfo | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    api<ClinicInfo>('/public/clinic-info').then(setInfo).catch(() => setInfo(null));
  }, []);

  const bookHref = profile ? homeForRole[profile.role] : '/login';

  return (
    <div className="min-h-screen">
      {/* ---------- Header ---------- */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0">
            <LogoLockup light />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-medium text-white/90 transition hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle onNavy />
            {profile ? (
              <Link
                to={homeForRole[profile.role]}
                className="hidden rounded-full bg-[#0e9b8a] px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-[#0a8a7a] sm:inline-flex"
              >
                Open my dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-full border border-white/35 bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Login
              </Link>
            )}
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 text-white lg:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {mobileOpen ? (
                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="mx-4 rounded-2xl border border-white/15 bg-navy/85 px-4 py-4 backdrop-blur lg:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {navLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
                >
                  {l.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* ---------- Hero ---------- */}
      <section id="home" className="relative flex h-screen items-center overflow-hidden">
        <HeroSlideshow />

        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pb-28 lg:pt-32">
          <div className="max-w-[640px]">
            <p
              className="hero-enter text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70"
              style={{ animationDelay: '80ms' }}
            >
              Quality healthcare, closer to you
            </p>
            <h1
              className="hero-enter mt-3 font-display text-4xl font-extrabold leading-[0.95] tracking-tight sm:text-5xl lg:text-[58px]"
              style={{ animationDelay: '160ms' }}
            >
              <span className="text-white">FUD</span>{' '}
              <span className="text-[#7af0d6]">Campus Care</span>
            </h1>
            <p
              className="hero-enter mt-5 max-w-[520px] text-base leading-relaxed text-white/85 sm:text-[17px]"
              style={{ animationDelay: '260ms' }}
            >
              Fast, secure and convenient clinic services for Federal University Dutse students and staff.
            </p>
            <div className="hero-enter mt-8 flex flex-wrap gap-3" style={{ animationDelay: '360ms' }}>
              <Link
                to={bookHref}
                className="inline-flex items-center justify-center rounded-full bg-[#10b981] px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 transition hover:-translate-y-0.5 hover:bg-[#0ea371]"
              >
                Book Appointment
              </Link>
              <a
                href="#about"
                className="inline-flex items-center justify-center rounded-full border border-white/70 bg-white/5 px-7 py-3 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- About ---------- */}
      <section id="about" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-14 sm:px-8">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">About Campus Care</p>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-navy">
            Healthcare built for the FUD community
          </h2>
          <p className="mt-3 max-w-3xl text-slate-600">
            FUD Campus Care brings the university clinic online — appointments, queue management, lab results,
            pharmacy and emergency response — so students and staff spend less time waiting and more time cared for.
            Your clinic file stays secure, private and always at hand.
          </p>
        </Reveal>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-10 sm:px-8">
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
      <section id="services" className="bg-gradient-to-b from-surface to-bg py-16">
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

      {/* ---------- Trust / Emergency ---------- */}
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
                Don&apos;t book an appointment. Call the clinic emergency line or send an emergency request now —
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
      <footer id="contact" className="bg-sidebar py-10 text-navy-light">
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
