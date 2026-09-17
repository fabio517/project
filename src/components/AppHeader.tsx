/** Cabeçalho: identidade do snapshot, tema e carregamento de dados. */
import type { Catalog } from '../domain/types';
import { formatCapturedAt } from '../ui/format';
import { IconAlert, IconCart } from '../ui/icons';
import type { ThemeChoice } from '../ui/useTheme';
import { SnapshotLoader } from './SnapshotLoader';
import { ThemeToggle } from './ThemeToggle';

interface AppHeaderProps {
  catalog: Catalog | null;
  loading: boolean;
  problems: string[];
  theme: ThemeChoice;
  onToggleTheme(): void;
  onSnapshot(snapshot: unknown): void;
  onFailure(message: string): void;
  onReset(): void;
}

export function AppHeader({
  catalog,
  loading,
  problems,
  theme,
  onToggleTheme,
  onSnapshot,
  onFailure,
  onReset,
}: AppHeaderProps) {
  return (
    <header
      className="border-b"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
              <span style={{ color: 'var(--accent)' }} className="inline-flex">
                <IconCart className="h-5 w-5" />
              </span>
              Feira Inteligente
            </h1>
            {catalog ? (
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {catalog.location.label} · preços de {formatCapturedAt(catalog.capturedAt)}
                <span style={{ color: 'var(--text-muted)' }}>
                  {' '}
                  · {catalog.source === 'seed' ? 'dados de exemplo' : 'captura iFood'}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                Nenhum catálogo carregado.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>

        <div className="mt-3">
          <SnapshotLoader
            loading={loading}
            onSnapshot={onSnapshot}
            onFailure={onFailure}
            onReset={onReset}
          />
        </div>

        {problems.length > 0 ? (
          <div
            role="alert"
            className="mt-3 rounded-[var(--radius-sm)] border p-3"
            style={{ borderColor: 'var(--status-critical)', background: 'var(--surface-2)' }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span style={{ color: 'var(--status-critical)' }} className="inline-flex">
                <IconAlert />
              </span>
              Não deu para usar esse snapshot — os dados anteriores continuam valendo
            </p>
            <ul className="mt-2 space-y-1 pl-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {problems.slice(0, 12).map((problem, i) => (
                <li key={`${i}-${problem}`} className="list-disc break-words">
                  {problem}
                </li>
              ))}
              {problems.length > 12 ? (
                <li className="list-disc" style={{ color: 'var(--text-muted)' }}>
                  … e mais {problems.length - 12} problema(s).
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </header>
  );
}
