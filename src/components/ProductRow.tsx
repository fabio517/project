/**
 * Linha do catálogo: produto, melhor preço por unidade e em qual mercado,
 * quantos mercados têm, e o stepper que alimenta a lista.
 */
import type { EnrichedOffer, Product } from '../domain/types';
import { formatBRL } from '../domain/money';
import { formatUnitPrice } from '../domain/units';
import { pluralize } from '../ui/format';
import { IconCheck } from '../ui/icons';
import type { SeriesScale } from '../ui/series';
import { MarketSwatch } from './MarketLabel';
import { QuantityStepper } from './QuantityStepper';

interface ProductRowProps {
  product: Product;
  offers: EnrichedOffer[];
  quantity: number;
  scale: SeriesScale;
  onChange(quantity: number): void;
}

/** Melhor = menor preço por unidade entre as ofertas disponíveis. */
function bestOfferOf(offers: EnrichedOffer[]): EnrichedOffer | null {
  const available = offers.filter((offer) => offer.available);
  const pool = available.length > 0 ? available : offers;
  let best: EnrichedOffer | null = null;
  for (const offer of pool) {
    if (!best || offer.unitPrice < best.unitPrice) best = offer;
  }
  return best;
}

export function ProductRow({ product, offers, quantity, scale, onChange }: ProductRowProps) {
  const best = bestOfferOf(offers);
  const marketCount = new Set(offers.filter((offer) => offer.available).map((o) => o.marketId)).size;
  const inList = quantity > 0;

  return (
    <li
      className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border p-3"
      style={{
        borderColor: inList ? 'var(--accent)' : 'var(--border)',
        background: inList ? 'var(--surface-2)' : 'var(--surface-1)',
      }}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
          <span className="min-w-0 break-words">{product.name}</span>
          {inList ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              <IconCheck className="h-3 w-3" />
              na lista
            </span>
          ) : null}
        </p>
        {best ? (
          <>
            <p
              className="tabular mt-1 flex flex-wrap items-center gap-x-2 text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatUnitPrice(best.unitPrice, best.unitKind)}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1">
                <MarketSwatch market={best.market} scale={scale} />
                <span className="truncate">{best.market.name}</span>
              </span>
            </p>
            <p className="tabular text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatBRL(best.price)} a embalagem · {pluralize(marketCount, 'mercado tem', 'mercados têm')}
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Sem oferta neste snapshot.
          </p>
        )}
      </div>
      <QuantityStepper label={product.name} quantity={quantity} onChange={onChange} />
    </li>
  );
}
