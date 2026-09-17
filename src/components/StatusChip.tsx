/**
 * Selo de status: SEMPRE ícone + rótulo. A cor de status é reservada (nunca
 * vira cor de série) e nunca carrega o significado sozinha — o texto fica em
 * tinta normal, legível nos dois temas.
 */
import type { ReactNode } from 'react';
import { IconAlert, IconBlocked, IconCheck } from '../ui/icons';

export type StatusTone = 'good' | 'warning' | 'serious' | 'critical';

const TONE_COLOR: Record<StatusTone, string> = {
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  serious: 'var(--status-serious)',
  critical: 'var(--status-critical)',
};

function ToneIcon({ tone }: { tone: StatusTone }) {
  if (tone === 'good') return <IconCheck className="h-3.5 w-3.5" />;
  if (tone === 'critical') return <IconBlocked className="h-3.5 w-3.5" />;
  return <IconAlert className="h-3.5 w-3.5" />;
}

interface StatusChipProps {
  tone: StatusTone;
  children: ReactNode;
}

export function StatusChip({ tone, children }: StatusChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: TONE_COLOR[tone], color: 'var(--text-primary)' }}
    >
      <span style={{ color: TONE_COLOR[tone] }} className="inline-flex">
        <ToneIcon tone={tone} />
      </span>
      {children}
    </span>
  );
}
