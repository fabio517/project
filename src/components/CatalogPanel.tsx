/** Catálogo: busca por nome/categoria e produtos agrupados por categoria. */
import { useMemo, useState } from 'react';
import type { Catalog, Product } from '../domain/types';
import type { ShoppingListApi } from '../lib/contracts';
import { pluralize } from '../ui/format';
import { IconSearch } from '../ui/icons';
import { matchesQuery } from '../ui/search';
import type { SeriesScale } from '../ui/series';
import { ProductRow } from './ProductRow';
import { SectionCard } from './SectionCard';

interface CatalogPanelProps {
  catalog: Catalog;
  list: ShoppingListApi;
  scale: SeriesScale;
}

interface CategoryGroup {
  category: string;
  products: Product[];
}

function groupByCategory(products: Product[]): CategoryGroup[] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const bucket = groups.get(product.category);
    if (bucket) bucket.push(product);
    else groups.set(product.category, [product]);
  }
  return [...groups.entries()].map(([category, items]) => ({ category, products: items }));
}

export function CatalogPanel({ catalog, list, scale }: CatalogPanelProps) {
  const [query, setQuery] = useState('');

  const groups = useMemo(
    () => groupByCategory(catalog.products.filter((product) => matchesQuery(product, query))),
    [catalog.products, query],
  );

  const found = groups.reduce((sum, group) => sum + group.products.length, 0);

  return (
    <SectionCard
      title="Catálogo"
      action={
        list.items.length > 0 ? (
          <button
            type="button"
            onClick={list.clear}
            className="text-xs underline underline-offset-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            limpar lista ({pluralize(list.items.length, 'item', 'itens')})
          </button>
        ) : null
      }
      bodyClassName="p-4"
    >
      <label className="relative block">
        <span className="sr-only">Buscar produto por nome ou categoria</span>
        <span
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          style={{ color: 'var(--text-muted)' }}
        >
          <IconSearch />
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar: arroz, laticínios, café…"
          className="w-full rounded-[var(--radius-sm)] border py-2 pr-3 pl-9 text-sm"
          style={{
            borderColor: 'var(--border-strong)',
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
          }}
        />
      </label>

      <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        {pluralize(found, 'produto', 'produtos')} · {pluralize(catalog.markets.length, 'mercado', 'mercados')} no
        snapshot
      </p>

      {/* Altura limitada nos dois tamanhos: no celular, 40 produtos empurrariam o
          resultado da comparação para bem longe do polegar. */}
      <div className="scroll-soft mt-3 max-h-[32rem] space-y-5 overflow-y-auto pr-1 lg:max-h-[calc(100vh-17rem)]">
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Nada encontrado para “{query}”.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.category}>
              <h3
                className="sticky top-0 z-10 py-1 text-xs font-semibold tracking-wide uppercase"
                style={{ background: 'var(--surface-1)', color: 'var(--text-secondary)' }}
              >
                {group.category}
                <span style={{ color: 'var(--text-muted)' }}> · {group.products.length}</span>
              </h3>
              <ul className="mt-2 space-y-2">
                {group.products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    offers={catalog.offersByProduct.get(product.id) ?? []}
                    quantity={list.quantityOf(product.id)}
                    scale={scale}
                    onChange={(quantity) => list.setQuantity(product.id, quantity)}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}
