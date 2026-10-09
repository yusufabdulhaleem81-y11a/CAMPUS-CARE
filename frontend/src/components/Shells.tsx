import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth, homeForRole } from '../lib/auth';
import type { Role } from '../lib/auth';
import { LogoLockup, ClinicLogo } from './ClinicLogo';

interface NavItem { to: string; label: string; roles: Role[] }

const staffNav: NavItem[] = [
  { to: '/reception', label: 'Reception', roles: ['receptionist', 'admin', 'super_admin'] },
  { to: '/queue', label: 'Clinic Queue', roles: ['receptionist', 'nurse', 'doctor', 'admin', 'super_admin'] },
  { to: '/patients', label: 'Patient Files', roles: ['receptionist', 'nurse', 'doctor', 'laboratory', 'pharmacist', 'admin', 'super_admin', 'hospital_head'] },
  { to: '/lab', label: 'Laboratory', roles: ['laboratory', 'doctor', 'admin', 'super_admin'] },
  { to: '/pharmacy', label: 'Pharmacy', roles: ['pharmacist', 'admin', 'super_admin'] },
  { to: '/emergency', label: 'Emergency', roles: ['receptionist', 'nurse', 'doctor', 'admin', 'super_admin', 'hospital_head'] },
  { to: '/staff-room', label: 'Shifts & Handover', roles: ['receptionist', 'nurse', 'doctor', 'laboratory', 'pharmacist', 'admin', 'super_admin', 'hospital_head'] },
  { to: '/management', label: 'Management', roles: ['hospital_head', 'admin', 'super_admin'] },
  { to: '/surveillance', label: 'Surveillance', roles: ['hospital_head', 'admin', 'super_admin'] },
  { to: '/admin', label: 'Administration', roles: ['admin', 'super_admin'] },
];

export function StaffShell({ title, children }: { title: string; children: ReactNode }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!profile) return null;
  const items = staffNav.filter((n) => n.roles.includes(profile.role));

  const nav = (
    <nav aria-label="Clinic navigation" className="flex flex-col gap-1">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-primary text-white' : 'text-navy-light hover:bg-white/10'}`}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col bg-navy p-4 no-print lg:flex">
        <Link to={homeForRole[profile.role]} className="mb-6"><LogoLockup light /></Link>
        {nav}
        <div className="mt-auto border-t border-white/15 pt-4">
          <p className="text-sm font-medium text-white">{profile.full_name}</p>
          <p className="text-xs text-navy-light">{profile.role.replace('_', ' ')}{profile.staff_id ? ` · ${profile.staff_id}` : ''}</p>
          <button onClick={() => { logout(); navigate('/'); }}
            className="mt-3 w-full rounded-lg border border-white/25 px-3 py-2 text-sm text-white hover:bg-white/10">
            Sign out
          </button>
          <p className="mt-4 text-[10px] leading-relaxed text-white/35">© 2026 Innovatech Limited. All rights reserved.</p>
        </div>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-navy px-4 py-3 no-print lg:hidden">
        <LogoLockup light />
        <button aria-expanded={open} aria-label="Toggle menu" onClick={() => setOpen(!open)}
          className="rounded-lg border border-white/25 px-3 py-1.5 text-sm text-white">Menu</button>
      </div>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-64 bg-navy p-4 pt-16" onClick={(e) => e.stopPropagation()}>
            {nav}
            <button onClick={logout} className="mt-4 w-full rounded-lg border border-white/25 px-3 py-2 text-sm text-white">Sign out</button>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-16 pt-20 lg:px-8 lg:pt-8">
        <header className="mb-6 flex items-center justify-between no-print">
          <h1 className="font-display text-2xl font-semibold text-navy">{title}</h1>
          <span className="hidden items-center gap-2 text-sm text-slate-500 lg:flex">
            <ClinicLogo size={22} /> FUD Campus Care
          </span>
        </header>
        {children}
      </main>
    </div>
  );
}

const portalNav = [
  { to: '/portal', label: 'Home' },
  { to: '/portal/book', label: 'Book' },
  { to: '/portal/visits', label: 'Visits' },
  { to: '/portal/results', label: 'Tests' },
  { to: '/portal/more', label: 'More' },
];

export function PatientShell({ children }: { children: ReactNode }) {
  const { profile, logout } = useAuth();
  if (!profile) return null;
  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-navy px-4 py-3 no-print">
        <LogoLockup light />
        <button onClick={logout} className="rounded-lg border border-white/25 px-3 py-1.5 text-sm text-white">Sign out</button>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      <footer className="pb-20 text-center">
        <p className="text-xs text-slate-400">© 2026 Innovatech Limited. All rights reserved.</p>
      </footer>
      <nav aria-label="Portal navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white no-print">
        {portalNav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/portal'}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-xs font-medium ${isActive ? 'text-primary' : 'text-slate-600'}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
