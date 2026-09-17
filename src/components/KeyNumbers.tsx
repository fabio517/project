/**
 * Linha de números-chave: melhor mercado, economia contra o mais caro e o que
 * dividir a compra faz. Quando dividir não compensa, a tela diz isso com
 * todas as letras — ícone + rótulo, nunca um número escondido.
 */
import type { ComparisonResult } from '../domain/types';
import { formatBRL } from '../domain/money';
import { pluralize } from '../ui/format';
import type { SeriesScale } from '../ui/series';
import { MarketLabel } from './MarketLabel';
import { StatusChip } from './StatusChip';

interface KeyNumbersProps {
  result: ComparisonResult;
  scale: SeriesScale;
  totalItems: number;
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[var(--radius)] border p-4"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function KeyNumbers({ result, scale, totalItems }: KeyNumbersProps) {
  const best = result.bestSingle;
  const worst = result.quotes.length > 0 ? result.quotes[result.quotes.length - 1] : null;
  const split = result.split;
  const splitWorth = result.savingsFromSplit > 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Tile label="Melhor mercado">
        {best ? (
          <>
            <div className="text-sm font-semibold">
              <MarketLabel market={best.market} scale={scale} />
            </div>
            <p className="tabular mt-1 text-2xl font-bold">{formatBRL(best.comparableTotal)}</p>
            <p className="tabular mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {best.imputedCost > 0
                ? `${formatBRL(best.total)} aqui + ${formatBRL(best.imputedCost)} em outro lugar`
                : `${best.foundCount} de ${totalItems} itens numa parada só`}
            </p>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Sem mercados para comparar.
          </p>
        )}
      </Tile>

      <Tile label="Economia contra o mais caro">
        <p className="tabular text-2xl font-bold">{formatBRL(result.spread)}</p>
        {worst && best ? (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {result.spread > 0
              ? `${best.market.name} contra ${worst.market.name}, na mesma cesta comparável`
              : 'Todos os mercados custam praticamente o mesmo nesta lista'}
          </p>
        ) : null}
      </Tile>

      <Tile label="Dividir a compra">
        {split && best ? (
          splitWorth ? (
            <>
              <p className="tabular text-2xl font-bold">{formatBRL(result.savingsFromSplit)}</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                de economia em {pluralize(split.stops.length, 'parada', 'paradas')}, já contando{' '}
                {pluralize(split.stops.length, 'entrega', 'entregas')} ({formatBRL(split.deliveryTotal)})
              </p>
            </>
          ) : (
            <>
              <StatusChip tone="warning">Não compensa dividir</StatusChip>
              <p className="tabular mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {result.savingsFromSplit === 0
                  ? `Dividir em ${pluralize(split.stops.length, 'parada', 'paradas')} dá exatamente no mesmo: ${formatBRL(split.total)}.`
                  : `Dividir em ${pluralize(split.stops.length, 'parada', 'paradas')} sairia ${formatBRL(Math.abs(result.savingsFromSplit))} MAIS CARO (${formatBRL(split.total)}) — as entregas comem a diferença.`}
              </p>
            </>
          )
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Sem plano dividido para esta lista.
          </p>
        )}
      </Tile>
    </div>
  );
}
