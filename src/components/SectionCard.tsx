/** Cartão padrão das seções: superfície, borda e sombra vindas dos tokens. */
import type { ReactNode } from 'react';

interface SectionCardProps {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SectionCard({
  title,
  action,
  children,
  className = '',
  bodyClassName = 'p-4',
}: SectionCardProps) {
  return (
    <section
      className={`rounded-[var(--radius)] border shadow-[var(--shadow-1)] ${className}`}
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      {title ? (
        <header
          className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: 'var(--text-secondary)' }}>
            {title}
          </h2>
          {action}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
