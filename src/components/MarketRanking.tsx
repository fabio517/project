/**
 * Ranking dos mercados — barras horizontais no MESMO eixo (um eixo só, o do
 * dinheiro). A barra mede `comparableTotal`, que é o único número que pode
 * ser comparado entre mercados: o que você gasta ali MAIS o que os itens
 * faltantes vão custar em outro lugar.
 *
 * Cada barra tem três preenchimentos, com 2px de respiro entre eles:
 *   sólido    = subtotal neste mercado
 *   claro     = taxa de entrega
 *   hachurado = custo imputado (itens que faltam, comprados fora)
 * Cor nunca sozinha: nome e valores são sempre texto.
 */
import type { MarketQuote } from '../domain/types';
import { formatBRL } from '../domain/money';
import { pluralize } from '../ui/format';
import type { SeriesScale } from '../ui/series';
import { MarketLabel } from './MarketLabel';
import { StatusChip } from './StatusChip';
import { Tooltip } from './Tooltip';

interface MarketRankingProps {
  quotes: MarketQuote[];
  scale: SeriesScale;
  totalItems: number;
  productName(productId: string): string;
}

interface Segment {
  key: string;
  value: number;
  background: string;
  title: string;
}

const MIN_VISIBLE_PERCENT = 0.9;

function segmentsOf(quote: MarketQuote, color: string): Segment[] {
  const hatch = `repeating-linear-gradient(135deg, var(--border-strong) 0 3px, var(--surface-2) 3px 7px)`;
  return [
    { key: 'subtotal', value: quote.subtotal, background: color, title: 'Subtotal aqui' },
    {
      key: 'delivery',
      value: quote.deliveryFee,
      background: `color-mix(in srgb, ${color} 45%, var(--surface-1))`,
      title: 'Taxa de entrega',
    },
    { key: 'imputed', value: quote.imputedCost, background: hatch, title: 'Itens que faltam, comprados fora' },
  ].filter((segment) => segment.value > 0);
}

function widthPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max((value / max) * 100, MIN_VISIBLE_PERCENT);
}

function nameList(ids: string[], productName: (id: string) => string, limit = 3): string {
  const names = ids.map(productName);
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} e mais ${names.length - limit}`;
}

export function MarketRanking({ quotes, scale, totalItems, productName }: MarketRankingProps) {
  if (quotes.length === 0) return null;
  const max = Math.max(...quotes.map((quote) => quote.comparableTotal), 1);

  return (
    <div>
      <ol className="space-y-4">
        {quotes.map((quote, rank) => {
          const color = scale.colorOf(quote.market.id);
          const segments = segmentsOf(quote, color);
          return (
            <li key={quote.market.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <MarketLabel market={quote.market} scale={scale} />
                  {rank === 0 ? (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                    >
                      melhor escolha
                    </span>
                  ) : null}
                </div>
                <div className="ml-auto text-right">
                  <span className="tabular text-sm font-bold">{formatBRL(quote.comparableTotal)}</span>
                  <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    comparável
                  </span>
                </div>
              </div>

              <Tooltip
                className="mt-1.5 cursor-default py-1.5"
                content={
                  <div className="space-y-0.5">
                    <p className="font-semibold">{quote.market.name}</p>
                    <p className="tabular">Você gasta aqui: {formatBRL(quote.total)}</p>
                    <p className="tabular" style={{ color: 'var(--text-secondary)' }}>
                      Subtotal {formatBRL(quote.subtotal)} · Entrega{' '}
                      {quote.deliveryFee === 0 ? 'grátis' : formatBRL(quote.deliveryFee)}
                    </p>
                    {quote.imputedCost > 0 ? (
                      <p className="tabular" style={{ color: 'var(--text-secondary)' }}>
                        Faltando aqui, comprado fora: {formatBRL(quote.imputedCost)}
                      </p>
                    ) : null}
                    <p className="tabular font-semibold">Comparável: {formatBRL(quote.comparableTotal)}</p>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Cobertura: {quote.foundCount} de {totalItems} itens
                    </p>
                  </div>
                }
              >
                <div
                  className="flex h-3 w-full items-stretch overflow-hidden rounded-r-[4px]"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {segments.map((segment, sIndex) => (
                    <div
                      key={segment.key}
                      title={`${segment.title}: ${formatBRL(segment.value)}`}
                      style={{
                        width: `${widthPercent(segment.value, max)}%`,
                        background: segment.background,
                        marginLeft: sIndex === 0 ? 0 : 2,
                        borderTopRightRadius: sIndex === segments.length - 1 ? 4 : 0,
                        borderBottomRightRadius: sIndex === segments.length - 1 ? 4 : 0,
                      }}
                    />
                  ))}
                </div>
              </Tooltip>

              {quote.imputedCost > 0 ? (
                <p className="tabular mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{formatBRL(quote.total)} aqui</span> +{' '}
                  {formatBRL(quote.imputedCost)} em outro lugar ={' '}
                  <span style={{ color: 'var(--text-primary)' }}>{formatBRL(quote.comparableTotal)}</span>
                </p>
              ) : (
                <p className="tabular mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{formatBRL(quote.total)} aqui</span> — a lista
                  inteira numa parada só
                </p>
              )}

              <p className="tabular mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>Subtotal {formatBRL(quote.subtotal)}</span>
                <span>Entrega {quote.deliveryFee === 0 ? 'grátis' : formatBRL(quote.deliveryFee)}</span>
                <span>
                  Cobertura {quote.foundCount} de {totalItems} itens
                </span>
                {quote.missingCount > 0 ? (
                  <span className="min-w-0 break-words">
                    Falta aqui: {nameList(quote.missingProductIds, productName)}
                  </span>
                ) : null}
              </p>

              {!quote.meetsMinOrder || quote.unpricedProductIds.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {!quote.meetsMinOrder ? (
                    <StatusChip tone="warning">
                      Abaixo do pedido mínimo de {formatBRL(quote.market.minOrder)} — faltam{' '}
                      {formatBRL(quote.shortfallToMinOrder)}
                    </StatusChip>
                  ) : null}
                  {quote.unpricedProductIds.length > 0 ? (
                    <StatusChip tone="serious">
                      {pluralize(quote.unpricedProductIds.length, 'item', 'itens')} sem preço em nenhum mercado:{' '}
                      {nameList(quote.unpricedProductIds, productName)}
                    </StatusChip>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-4 rounded-[3px]"
            style={{ background: 'var(--text-secondary)' }}
          />
          subtotal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-4 rounded-[3px]"
            style={{ background: 'color-mix(in srgb, var(--text-secondary) 45%, var(--surface-1))' }}
          />
          entrega
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-4 rounded-[3px]"
            style={{
              background:
                'repeating-linear-gradient(135deg, var(--border-strong) 0 3px, var(--surface-2) 3px 7px)',
            }}
          />
          itens que faltam, comprados fora
        </span>
      </p>
    </div>
  );
}
