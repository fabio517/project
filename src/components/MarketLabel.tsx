/**
 * Nome do mercado ao lado do seu quadradinho de cor. A REGRA DE RELEVO mora
 * aqui: a cor é só a marca; o nome é texto em tinta comum, nunca na cor da
 * série. Fora dos 8 slots, o rótulo de série vira "Outros".
 */
import type { Market } from '../domain/types';
import type { SeriesScale } from '../ui/series';
import { OVERFLOW_LABEL } from '../ui/series';

interface MarketLabelProps {
  market: Market;
  scale: SeriesScale;
  className?: string;
}

export function MarketSwatch({ market, scale }: { market: Market; scale: SeriesScale }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 shrink-0 rounded-[3px]"
      style={{ background: scale.colorOf(market.id) }}
    />
  );
}

export function MarketLabel({ market, scale, className = '' }: MarketLabelProps) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <MarketSwatch market={market} scale={scale} />
      <span className="truncate" style={{ color: 'var(--text-primary)' }}>
        {market.name}
      </span>
      {scale.isOverflow(market.id) ? (
        <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
          ({OVERFLOW_LABEL})
        </span>
      ) : null}
    </span>
  );
}
