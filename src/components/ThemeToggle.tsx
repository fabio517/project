/** Alternador claro/escuro — botão de verdade, com ícone e rótulo. */
import { IconMoon, IconSun } from '../ui/icons';
import type { ThemeChoice } from '../ui/useTheme';

interface ThemeToggleProps {
  theme: ThemeChoice;
  onToggle(): void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const goingDark = theme === 'light';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={theme === 'dark'}
      className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium transition-colors"
      style={{
        borderColor: 'var(--border-strong)',
        background: 'var(--surface-1)',
        color: 'var(--text-primary)',
      }}
      title={goingDark ? 'Mudar para o tema escuro' : 'Mudar para o tema claro'}
    >
      {goingDark ? <IconMoon /> : <IconSun />}
      <span>{goingDark ? 'Escuro' : 'Claro'}</span>
    </button>
  );
}
