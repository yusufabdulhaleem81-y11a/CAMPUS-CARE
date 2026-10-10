import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';

/** onNavy: use on the dark navy header/sidebar; otherwise on light/dark surfaces. */
export function ThemeToggle({ onNavy = false }: { onNavy?: boolean }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const tone = onNavy
    ? 'border-white/25 text-white hover:bg-white/10'
    : 'border-line bg-surface text-navy hover:bg-bg';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${tone}`}
    >
      {isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
