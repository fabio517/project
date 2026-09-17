/**
 * Zona 3: o resultado. `compare` roda memoizado — só recalcula quando o
 * catálogo, a lista ou as opções mudam.
 */
import { useCallback, useMemo } from 'react';
import type { Catalog } from '../domain/types';
import { compare } from '../lib/optimizer';
import type { ShoppingListApi } from '../lib/contracts';
import type { CompareOptionsApi } from '../state/useShoppingList';
import type { SeriesScale } from '../ui/series';
import { pluralize } from '../ui/format';
import { CompareControls } from './CompareControls';
import { EmptyList } from './EmptyList';
import { KeyNumbers } from './KeyNumbers';
import { MarketRanking } from './MarketRanking';
import { ProductMatrix } from './ProductMatrix';
import { SectionCard } from './SectionCard';
import { SplitPlanCard } from './SplitPlanCard';

interface ComparisonPanelProps {
  catalog: Catalog;
  list: ShoppingListApi;
  optionsApi: CompareOptionsApi;
  scale: SeriesScale;
}

export function ComparisonPanel({ catalog, list, optionsApi, scale }: ComparisonPanelProps) {
  const result = useMemo(
    () => compare(catalog, list.items, optionsApi.options),
    [catalog, list.items, optionsApi.options],
  );

  const productName = useCallback(
    (productId: string) => catalog.productById.get(productId)?.name ?? productId,
    [catalog.productById],
  );

  const totalItems = result.quotes[0]?.lines.length ?? 0;
  const hasList = list.items.length > 0;

  return (
    <div className="space-y-4">
      <CompareControls api={optionsApi} />

      {!hasList || result.quotes.length === 0 ? (
        <EmptyList />
      ) : (
        <>
          <KeyNumbers result={result} scale={scale} totalItems={totalItems} />

          <SectionCard
            title="Ranking dos mercados"
            action={
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {pluralize(totalItems, 'produto', 'produtos')} · {pluralize(list.totalUnits, 'unidade', 'unidades')}
              </span>
            }
          >
            <MarketRanking
              quotes={result.quotes}
              scale={scale}
              totalItems={totalItems}
              productName={productName}
            />
          </SectionCard>

          {result.split ? (
            <SectionCard
              title="Plano dividido"
              action={
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  até {pluralize(optionsApi.options.maxStops, 'parada', 'paradas')}
                </span>
              }
            >
              <SplitPlanCard
                split={result.split}
                bestSingle={result.bestSingle}
                savingsFromSplit={result.savingsFromSplit}
                scale={scale}
                productName={productName}
              />
            </SectionCard>
          ) : null}

          <SectionCard title="Preço por produto em cada mercado">
            <ProductMatrix quotes={result.quotes} scale={scale} />
          </SectionCard>
        </>
      )}
    </div>
  );
}
