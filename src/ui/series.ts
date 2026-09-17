/**
 * Atribuição de cor por mercado.
 *
 * A paleta categórica tem 8 slots em ORDEM FIXA (--series-1..8). O slot vem do
 * índice estável do mercado no catálogo — nunca do ranking, nunca do filtro:
 * mudar a lista não pode repintar os mercados. Do 9º mercado em diante não
 * existe tom novo: a cor vira --text-muted e o rótulo de série vira "Outros".
 */
import type { Market } from '../domain/types';

export const SERIES_SLOTS = 8;
export const OVERFLOW_LABEL = 'Outros';
const OVERFLOW_COLOR = 'var(--text-muted)';

export interface SeriesScale {
  /** Cor do mercado, já como `var(--...)` pronto para `style`. */
  colorOf(marketId: string): string;
  /** true quando o mercado passou dos 8 slots e caiu em "Outros". */
  isOverflow(marketId: string): boolean;
  /** Rótulo da SÉRIE (não do mercado): o nome, ou "Outros" no estouro. */
  seriesLabelOf(market: Market): string;
}

export function createSeriesScale(markets: Market[]): SeriesScale {
  const slotById = new Map<string, number>();
  markets.forEach((market, index) => slotById.set(market.id, index));

  const slotOf = (marketId: string): number => slotById.get(marketId) ?? SERIES_SLOTS;

  return {
    colorOf(marketId) {
      const slot = slotOf(marketId);
      return slot < SERIES_SLOTS ? `var(--series-${slot + 1})` : OVERFLOW_COLOR;
    },
    isOverflow(marketId) {
      return slotOf(marketId) >= SERIES_SLOTS;
    },
    seriesLabelOf(market) {
      return slotOf(market.id) >= SERIES_SLOTS ? OVERFLOW_LABEL : market.name;
    },
  };
}
