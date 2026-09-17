/** Formatações de tela que não são dinheiro nem unidade (essas vêm do domínio). */

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "17 de setembro de 2026, 09:00" — ou o texto cru se a data não for válida. */
export function formatCapturedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_TIME.format(date).replace(/[  ]/g, ' ');
}

/** 0.95 -> "95%" */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${Math.round(ratio * 100)}%`;
}

/** "3 mercados" / "1 mercado" */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const SIZE = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

/** 0.9 -> "0,9" — o resto da tela está em pt-BR; o número cru do JS não pode vazar. */
export function formatPackageSize(size: number): string {
  if (!Number.isFinite(size)) return '—';
  return SIZE.format(size);
}
