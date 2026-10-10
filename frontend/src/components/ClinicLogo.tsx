import { useState } from 'react';

const CREST_SRC = '/images/fud-crest.png';

/** Fallback mark used only if the official crest image fails to load. */
function CrossBookMark({ size, variant }: { size: number; variant: 'solid' | 'mono' }) {
  const r = size / 5;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="FUD Campus Care logo">
      {variant === 'solid' ? (
        <rect x="0" y="0" width="48" height="48" rx={r} fill="#0f766e" />
      ) : (
        <rect x="0" y="0" width="48" height="48" rx={r} fill="none" />
      )}
      <rect x="21" y="8" width="6" height="32" rx="2" fill={variant === 'solid' ? '#ffffff' : '#0f766e'} />
      <path
        d="M7 21 c4-2.6 8-2.6 12 0 v6 c-4-2.6-8-2.6-12 0 z M41 21 c-4-2.6-8-2.6-12 0 v6 c4-2.6 8-2.6 12 0 z"
        fill={variant === 'solid' ? '#ffffff' : '#0f766e'}
      />
      <line x1="24" y1="21" x2="24" y2="27" stroke={variant === 'solid' ? '#0f766e' : '#ffffff'} strokeWidth="1.6" />
    </svg>
  );
}

/** Official Federal University Dutse crest (from fud.edu.ng), with a fallback mark. */
export function ClinicLogo({ size = 32, variant = 'solid' }: { size?: number; variant?: 'solid' | 'mono' }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <CrossBookMark size={size} variant={variant} />;
  return (
    <img
      src={CREST_SRC}
      width={size}
      height={size}
      alt="Federal University Dutse crest"
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
    />
  );
}

export function LogoLockup({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <ClinicLogo size={34} />
      <span className="leading-tight">
        <span className={`block font-display text-[17px] font-bold ${light ? 'text-white' : 'text-navy'}`}>
          Campus Care
        </span>
        <span className={`block text-[11px] font-medium tracking-wide ${light ? 'text-navy-light' : 'text-slate-500'}`}>
          FUD CLINIC
        </span>
      </span>
    </span>
  );
}
