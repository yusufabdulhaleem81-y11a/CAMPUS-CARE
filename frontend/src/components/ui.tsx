import type { ReactNode } from 'react';
import { useEffect } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface p-5 shadow-sm ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-navy font-display">{children}</h2>
      {action}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  type?: 'button' | 'submit';
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  className?: string;
};

export function Button({ children, variant = 'primary', size = 'md', type = 'button', disabled, busy, onClick, className = '' }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-base';
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'border border-line bg-surface text-navy hover:bg-bg',
    danger: 'bg-red-700 text-white hover:bg-red-800',
    ghost: 'text-primary hover:bg-primary-light',
  }[variant];
  return (
    <button type={type} disabled={disabled || busy} onClick={onClick}
      className={`${base} ${sizes} ${variants} ${className}`}>
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status" aria-label="Loading" />
  );
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-700"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-[6px] border border-line bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-primary';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} min-h-20 ${props.className ?? ''}`} />;
}

const pillStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900',
  waiting: 'bg-amber-100 text-amber-900',
  booked: 'bg-sky-100 text-sky-900',
  called: 'bg-sky-100 text-sky-900',
  ordered: 'bg-sky-100 text-sky-900',
  submitted: 'bg-sky-100 text-sky-900',
  sample_collected: 'bg-sky-100 text-sky-900',
  in_consult: 'bg-teal-100 text-teal-900',
  verified: 'bg-teal-100 text-teal-900',
  responding: 'bg-teal-100 text-teal-900',
  open: 'bg-amber-100 text-amber-900',
  completed: 'bg-emerald-100 text-emerald-900',
  dispensed: 'bg-emerald-100 text-emerald-900',
  released: 'bg-emerald-100 text-emerald-900',
  approved: 'bg-emerald-100 text-emerald-900',
  received: 'bg-emerald-100 text-emerald-900',
  checked_in: 'bg-teal-100 text-teal-900',
  present: 'bg-emerald-100 text-emerald-900',
  late: 'bg-amber-100 text-amber-900',
  absent: 'bg-red-100 text-red-900',
  cancelled: 'bg-red-100 text-red-900',
  skipped: 'bg-red-100 text-red-900',
  no_show: 'bg-red-100 text-red-900',
  rejected: 'bg-red-100 text-red-900',
  closed: 'bg-slate-200 text-slate-700',
  resolved: 'bg-slate-200 text-slate-700',
  handed_over: 'bg-slate-200 text-slate-700',
  low: 'bg-amber-100 text-amber-900',
  critical: 'bg-orange-100 text-orange-900',
  out_of_stock: 'bg-red-100 text-red-900',
  result_entered: 'bg-sky-100 text-sky-900',
  partially_dispensed: 'bg-amber-100 text-amber-900',
  acknowledged: 'bg-sky-100 text-sky-900',
};

export function StatusPill({ status }: { status: string }) {
  const style = pillStyles[status] ?? 'bg-slate-200 text-slate-700';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function Empty({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-bg/60 px-6 py-10 text-center">
      <p className="text-slate-500">{title}</p>
      {action}
    </div>
  );
}

export function ErrorMsg({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
      {children}
    </div>
  );
}

export function SuccessMsg({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
      {children}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-navy">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="font-display text-2xl font-semibold text-navy">{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </Card>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
            active === t.id ? 'border-b-2 border-primary bg-primary-light/50 text-primary-dark' : 'text-slate-600 hover:bg-slate-100'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner /> Loading…
    </div>
  );
}
