/**
 * Tabela por produto: linhas = produtos da lista, colunas = mercados, célula =
 * preço da linha naquele mercado. A célula mais barata da linha é destacada
 * com ✓ e negrito (nunca só com cor). Esta é também a visão de tabela exigida
 * pela acessibilidade — todo valor do gráfico está aqui em texto.
 */
import type { MarketQuote } from '../domain/types';
import { formatBRL } from '../domain/money';
import { formatUnitPrice } from '../domain/units';
import { IconCheck } from '../ui/icons';
import type { SeriesScale } from '../ui/series';
import { MarketSwatch } from './MarketLabel';
import { Tooltip } from './Tooltip';

interface ProductMatrixProps {
  quotes: MarketQuote[];
  scale: SeriesScale;
}

export function ProductMatrix({ quotes, scale }: ProductMatrixProps) {
  if (quotes.length === 0) return null;
  const rows = quotes[0].lines;
  if (rows.length === 0) return null;

  const stickyCell = 'sticky left-0 z-10';

  return (
    <div className="scroll-soft -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full border-collapse text-xs" style={{ minWidth: `${180 + quotes.length * 108}px` }}>
        <caption className="mb-2 text-left text-xs" style={{ color: 'var(--text-secondary)' }}>
          Preço de cada produto da lista em cada mercado (quantidade já multiplicada). A célula com ✓ é a mais
          barata da linha; “—” significa que o mercado não tem o item.
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className={`${stickyCell} border-b px-2 py-2 text-left font-semibold`}
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
            >
              Produto
            </th>
            {quotes.map((quote) => (
              <th
                key={quote.market.id}
                scope="col"
                className="border-b px-2 py-2 text-right font-semibold"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <MarketSwatch market={quote.market} scale={scale} />
                  <span className="whitespace-nowrap">{quote.market.name}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const cells = quotes.map((quote) => quote.lines[rowIndex]);
            const priced = cells.filter((cell) => cell.offer !== null);
            const cheapest = priced.length > 0 ? Math.min(...priced.map((cell) => cell.lineTotal)) : null;

            return (
              <tr key={row.productId}>
                <th
                  scope="row"
                  className={`${stickyCell} border-b px-2 py-2 text-left font-medium`}
                  style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
                >
                  <span className="block max-w-[150px] truncate" title={row.product.name}>
                    {row.product.name}
                  </span>
                  {row.quantity > 1 ? (
                    <span className="tabular text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {row.quantity} unidades
                    </span>
                  ) : null}
                </th>

                {cells.map((cell, cellIndex) => {
                  const quote = quotes[cellIndex];
                  const isCheapest = cell.offer !== null && cell.lineTotal === cheapest;
                  return (
                    <td
                      key={quote.market.id}
                      className="border-b p-0 text-right"
                      style={{
                        borderColor: 'var(--border)',
                        background: isCheapest ? 'var(--surface-2)' : 'transparent',
                      }}
                    >
                      {cell.offer ? (
                        <Tooltip
                          className="cursor-default px-2 py-2"
                          content={
                            <div className="space-y-0.5">
                              <p className="font-semibold">{row.product.name}</p>
                              <p style={{ color: 'var(--text-secondary)' }}>{quote.market.name}</p>
                              <p className="tabular">
                                {formatBRL(cell.offer.price)} × {cell.quantity} = {formatBRL(cell.lineTotal)}
                              </p>
                              <p className="tabular" style={{ color: 'var(--text-secondary)' }}>
                                {formatUnitPrice(cell.offer.unitPrice, cell.offer.unitKind)} ·{' '}
                                {cell.offer.packageSize} {cell.offer.packageUnit}
                              </p>
                              {isCheapest ? <p className="font-semibold">Menor preço da linha</p> : null}
                            </div>
                          }
                        >
                          <span
                            className={`tabular inline-flex items-center justify-end gap-1 whitespace-nowrap ${
                              isCheapest ? 'font-bold' : ''
                            }`}
                          >
                            {isCheapest ? (
                              <>
                                <IconCheck className="h-3 w-3" />
                                <span className="sr-only">Menor preço da linha:</span>
                              </>
                            ) : null}
                            {formatBRL(cell.lineTotal)}
                          </span>
                        </Tooltip>
                      ) : (
                        <span className="block px-2 py-2" style={{ color: 'var(--text-muted)' }}>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">não disponível</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
