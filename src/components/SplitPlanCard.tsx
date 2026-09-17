/** Plano dividido: as paradas, o que comprar em cada uma e o total com todas as entregas. */
import type { MarketQuote, SplitPlan } from '../domain/types';
import { formatBRL } from '../domain/money';
import { pluralize } from '../ui/format';
import type { SeriesScale } from '../ui/series';
import { MarketLabel } from './MarketLabel';
import { StatusChip } from './StatusChip';

interface SplitPlanCardProps {
  split: SplitPlan;
  bestSingle: MarketQuote | null;
  savingsFromSplit: number;
  scale: SeriesScale;
  productName(productId: string): string;
}

export function SplitPlanCard({
  split,
  bestSingle,
  savingsFromSplit,
  scale,
  productName,
}: SplitPlanCardProps) {
  const worth = savingsFromSplit > 0;

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        {split.stops.map((stop, index) => (
          <div
            key={stop.market.id}
            className="rounded-[var(--radius-sm)] border p-3"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Parada {index + 1}
                </span>
                <MarketLabel market={stop.market} scale={scale} />
              </h3>
              <span className="tabular text-sm font-bold">{formatBRL(stop.total)}</span>
            </div>

            <ul className="mt-2 space-y-1 text-xs">
              {stop.lines.map((line) => (
                <li key={line.productId} className="tabular flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words" style={{ color: 'var(--text-secondary)' }}>
                    {line.quantity > 1 ? `${line.quantity}× ` : ''}
                    {line.product.name}
                  </span>
                  <span className="shrink-0">{formatBRL(line.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <p className="tabular mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Subtotal {formatBRL(stop.subtotal)} · Entrega{' '}
              {stop.deliveryFee === 0 ? 'grátis' : formatBRL(stop.deliveryFee)} ·{' '}
              {pluralize(stop.lines.length, 'item', 'itens')}
            </p>

            {!stop.meetsMinOrder ? (
              <div className="mt-2">
                <StatusChip tone="warning">
                  Abaixo do pedido mínimo de {formatBRL(stop.market.minOrder)}
                </StatusChip>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div
        className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-[var(--radius-sm)] border px-3 py-2"
        style={{ borderColor: 'var(--border-strong)' }}
      >
        <p className="tabular text-sm">
          <span className="font-semibold">Total do plano: {formatBRL(split.total)}</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {' '}
            — {formatBRL(split.subtotal)} em produtos + {formatBRL(split.deliveryTotal)} de{' '}
            {pluralize(split.stops.length, 'entrega', 'entregas')}
          </span>
        </p>
        {bestSingle ? (
          <p className="tabular text-xs" style={{ color: 'var(--text-secondary)' }}>
            {worth
              ? `Economiza ${formatBRL(savingsFromSplit)} contra comprar tudo no ${bestSingle.market.name}.`
              : `Fica ${formatBRL(Math.abs(savingsFromSplit))} mais caro que comprar tudo no ${bestSingle.market.name}.`}
          </p>
        ) : null}
      </div>

      {split.unavailableProductIds.length > 0 ? (
        <div className="mt-3">
          <StatusChip tone="serious">
            Fora do plano (sem oferta): {split.unavailableProductIds.map(productName).join(', ')}
          </StatusChip>
        </div>
      ) : null}
    </div>
  );
}
