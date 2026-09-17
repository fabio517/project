/**
 * Otimizador da Feira Inteligente.
 *
 * Depende APENAS de `src/domain/types.ts`: aritmética de inteiros (centavos),
 * zero formatação, zero React, zero I/O. Tudo aqui é determinístico — dois
 * catálogos iguais produzem exatamente o mesmo `ComparisonResult`.
 */
import type {
  Catalog,
  Centavos,
  CompareOptions,
  ComparisonResult,
  EnrichedOffer,
  ListItem,
  Market,
  MarketQuote,
  Product,
  QuoteLine,
  SplitPlan,
  SplitStop,
} from '../domain/types';

/** Item da lista já saneado: produto existe no catálogo, quantidade inteira >= 1. */
interface ListEntry {
  productId: string;
  product: Product;
  quantity: number;
}

/** productId -> (marketId -> melhor oferta daquele mercado para a quantidade pedida). */
type BestOfferIndex = Map<string, Map<string, EnrichedOffer>>;

/** Atribuição produto -> mercado usada para montar o plano dividido. */
interface Assignment {
  entry: ListEntry;
  marketId: string;
  offer: EnrichedOffer;
  lineTotal: Centavos;
}

// --------------------------------------------------------------- utilitários

/**
 * "Melhor" = menor preço de embalagem × quantidade. O usuário compra
 * embalagens, não granel, então `unitPrice` só entra como desempate; `id`
 * fecha o desempate para a ordenação ser estável entre execuções.
 */
function isCheaperOffer(a: EnrichedOffer, b: EnrichedOffer, quantity: number): boolean {
  const aTotal = a.price * quantity;
  const bTotal = b.price * quantity;
  if (aTotal !== bTotal) return aTotal < bTotal;
  if (a.unitPrice !== b.unitPrice) return a.unitPrice < b.unitPrice;
  return a.id < b.id;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Descarta itens inválidos e soma duplicatas do mesmo produto. */
function sanitizeList(catalog: Catalog, list: ListItem[]): ListEntry[] {
  const byProduct = new Map<string, ListEntry>();
  for (const item of list) {
    const product = catalog.productById.get(item.productId);
    // Produto fora do catálogo não tem como ser cotado: some da conta em vez
    // de virar uma linha sem `product` (o contrato exige `Product`).
    if (!product) continue;
    const quantity = Math.trunc(item.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) continue;
    const previous = byProduct.get(product.id);
    if (previous) previous.quantity += quantity;
    else byProduct.set(product.id, { productId: product.id, product, quantity });
  }
  return [...byProduct.values()];
}

/** Para cada item, a melhor oferta de cada mercado (respeitando `onlyAvailable`). */
function buildBestOfferIndex(
  catalog: Catalog,
  entries: ListEntry[],
  options: CompareOptions,
): BestOfferIndex {
  const index: BestOfferIndex = new Map();
  for (const entry of entries) {
    const byMarket = new Map<string, EnrichedOffer>();
    const offers = catalog.offersByProduct.get(entry.productId) ?? [];
    for (const offer of offers) {
      if (options.onlyAvailable && !offer.available) continue;
      if (!catalog.marketById.has(offer.marketId)) continue;
      const current = byMarket.get(offer.marketId);
      if (!current || isCheaperOffer(offer, current, entry.quantity)) {
        byMarket.set(offer.marketId, offer);
      }
    }
    index.set(entry.productId, byMarket);
  }
  return index;
}

function makeLine(entry: ListEntry, offer: EnrichedOffer | null): QuoteLine {
  return {
    productId: entry.productId,
    product: entry.product,
    quantity: entry.quantity,
    offer,
    lineTotal: offer ? offer.price * entry.quantity : 0,
  };
}

// ------------------------------------------------------------ cotação única

function buildQuote(
  market: Market,
  entries: ListEntry[],
  index: BestOfferIndex,
  options: CompareOptions,
): MarketQuote {
  const lines: QuoteLine[] = [];
  const missingProductIds: string[] = [];
  let subtotal = 0;

  for (const entry of entries) {
    const offer = index.get(entry.productId)?.get(market.id) ?? null;
    const line = makeLine(entry, offer);
    if (!offer) missingProductIds.push(entry.productId);
    subtotal += line.lineTotal;
    lines.push(line);
  }

  const foundCount = lines.length - missingProductIds.length;
  const deliveryFee = options.includeDelivery ? market.deliveryFee : 0;
  const shortfallToMinOrder = Math.max(0, market.minOrder - subtotal);

  return {
    market,
    lines,
    foundCount,
    missingCount: missingProductIds.length,
    missingProductIds,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    meetsMinOrder: subtotal >= market.minOrder,
    shortfallToMinOrder,
    coverage: entries.length === 0 ? 0 : foundCount / entries.length,
  };
}

/**
 * Cobertura ANTES de preço: um mercado que não tem metade da lista fica
 * artificialmente barato, e deixá-lo no topo seria mentir para o usuário.
 * Comparamos `foundCount` (inteiro) em vez de `coverage` (float) porque o
 * denominador é o mesmo para todos os mercados — mesma ordem, sem risco de
 * empate por arredondamento.
 */
function byCoverageThenTotal(a: MarketQuote, b: MarketQuote): number {
  if (a.foundCount !== b.foundCount) return b.foundCount - a.foundCount;
  if (a.total !== b.total) return a.total - b.total;
  return compareIds(a.market.id, b.market.id);
}

/** Só faz sentido comparar totais entre mercados que cobrem a mesma coisa. */
function spreadAmongBestCoverage(quotes: MarketQuote[]): Centavos {
  if (quotes.length === 0) return 0;
  const maxFound = Math.max(...quotes.map((quote) => quote.foundCount));
  const totals = quotes.filter((q) => q.foundCount === maxFound).map((q) => q.total);
  return Math.max(...totals) - Math.min(...totals);
}

// ------------------------------------------------------------ plano dividido

/** Mercado mais barato para o item entre `candidates` (ids de mercado vivos). */
function bestMarketFor(
  entry: ListEntry,
  index: BestOfferIndex,
  candidates: Iterable<string> | null,
): { marketId: string; offer: EnrichedOffer; lineTotal: Centavos } | null {
  const byMarket = index.get(entry.productId);
  if (!byMarket) return null;
  const allowed = candidates === null ? null : new Set(candidates);

  let bestMarketId: string | null = null;
  let bestOffer: EnrichedOffer | null = null;
  for (const [marketId, offer] of byMarket) {
    if (allowed && !allowed.has(marketId)) continue;
    if (!bestOffer || isCheaperOffer(offer, bestOffer, entry.quantity)) {
      bestOffer = offer;
      bestMarketId = marketId;
    }
  }
  if (!bestOffer || bestMarketId === null) return null;
  return { marketId: bestMarketId, offer: bestOffer, lineTotal: bestOffer.price * entry.quantity };
}

function planCost(
  assignments: Assignment[],
  stopIds: Set<string>,
  catalog: Catalog,
  options: CompareOptions,
): Centavos {
  let total = 0;
  for (const assignment of assignments) total += assignment.lineTotal;
  if (options.includeDelivery) {
    // Cada parada cobra a SUA entrega — é justamente isso que costuma matar a
    // vantagem de dividir a compra em muitos mercados.
    for (const id of stopIds) total += catalog.marketById.get(id)?.deliveryFee ?? 0;
  }
  return total;
}

/**
 * Reduz o número de paradas de forma gulosa: a cada rodada simula a remoção de
 * cada parada, realocando os produtos dela para o mercado sobrevivente mais
 * barato, e elimina a que sai mais barato.
 *
 * O critério de escolha é (produtos órfãos, custo total) nessa ordem: sem isso
 * a heurística preferiria justamente remover o mercado que é o único a ter um
 * produto caro — o item sumiria da conta e a remoção pareceria "de graça".
 * Cobertura antes de preço, igual ao ranking de mercado único.
 */
function reduceStops(
  assignments: Map<string, Assignment>,
  stopIds: Set<string>,
  index: BestOfferIndex,
  catalog: Catalog,
  options: CompareOptions,
  maxStops: number,
  unavailableProductIds: string[],
): void {
  while (stopIds.size > maxStops) {
    let bestRemoval: {
      marketId: string;
      orphans: string[];
      moves: Assignment[];
      cost: Centavos;
    } | null = null;

    for (const candidate of stopIds) {
      const survivors = new Set([...stopIds].filter((id) => id !== candidate));
      const orphans: string[] = [];
      const moves: Assignment[] = [];
      const simulated: Assignment[] = [];

      for (const assignment of assignments.values()) {
        if (assignment.marketId !== candidate) {
          simulated.push(assignment);
          continue;
        }
        const entry = assignment.entry;
        const relocated = bestMarketFor(entry, index, survivors);
        if (!relocated) {
          orphans.push(assignment.entry.productId);
          continue;
        }
        const move: Assignment = {
          entry,
          marketId: relocated.marketId,
          offer: relocated.offer,
          lineTotal: relocated.lineTotal,
        };
        moves.push(move);
        simulated.push(move);
      }

      const cost = planCost(simulated, survivors, catalog, options);
      const better =
        !bestRemoval ||
        orphans.length < bestRemoval.orphans.length ||
        (orphans.length === bestRemoval.orphans.length &&
          (cost < bestRemoval.cost ||
            (cost === bestRemoval.cost && compareIds(candidate, bestRemoval.marketId) < 0)));
      if (better) bestRemoval = { marketId: candidate, orphans, moves, cost };
    }

    if (!bestRemoval) break;
    for (const orphanId of bestRemoval.orphans) {
      assignments.delete(orphanId);
      unavailableProductIds.push(orphanId);
    }
    for (const move of bestRemoval.moves) assignments.set(move.entry.productId, move);
    stopIds.delete(bestRemoval.marketId);
  }
}

function buildSplit(
  catalog: Catalog,
  entries: ListEntry[],
  index: BestOfferIndex,
  options: CompareOptions,
): SplitPlan {
  const maxStops = Math.max(1, Math.trunc(options.maxStops) || 1);
  const assignments = new Map<string, Assignment>();
  const unavailableProductIds: string[] = [];
  const stopIds = new Set<string>();

  // Ponto de partida: cada produto no mercado onde a sua melhor linha é a mais
  // barata. Isso define o conjunto candidato de paradas.
  for (const entry of entries) {
    const best = bestMarketFor(entry, index, null);
    if (!best) {
      unavailableProductIds.push(entry.productId);
      continue;
    }
    assignments.set(entry.productId, {
      entry,
      marketId: best.marketId,
      offer: best.offer,
      lineTotal: best.lineTotal,
    });
    stopIds.add(best.marketId);
  }

  reduceStops(assignments, stopIds, index, catalog, options, maxStops, unavailableProductIds);

  const linesByMarket = new Map<string, QuoteLine[]>();
  for (const entry of entries) {
    const assignment = assignments.get(entry.productId);
    if (!assignment) continue;
    const bucket = linesByMarket.get(assignment.marketId);
    const line = makeLine(entry, assignment.offer);
    if (bucket) bucket.push(line);
    else linesByMarket.set(assignment.marketId, [line]);
  }

  const stops: SplitStop[] = [];
  let subtotal = 0;
  let deliveryTotal = 0;
  for (const [marketId, lines] of linesByMarket) {
    const market = catalog.marketById.get(marketId);
    if (!market) continue;
    const stopSubtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const deliveryFee = options.includeDelivery ? market.deliveryFee : 0;
    subtotal += stopSubtotal;
    deliveryTotal += deliveryFee;
    stops.push({
      market,
      lines,
      subtotal: stopSubtotal,
      deliveryFee,
      total: stopSubtotal + deliveryFee,
      // Uma parada que não bate o mínimo torna o plano inviável na prática;
      // o dado fica visível para a UI avisar em vez de esconder.
      meetsMinOrder: stopSubtotal >= market.minOrder,
    });
  }

  stops.sort((a, b) => b.subtotal - a.subtotal || compareIds(a.market.id, b.market.id));
  unavailableProductIds.sort(compareIds);

  return { stops, subtotal, deliveryTotal, total: subtotal + deliveryTotal, unavailableProductIds };
}

// ------------------------------------------------------------------- público

function emptyResult(): ComparisonResult {
  return {
    quotes: [],
    bestSingle: null,
    split: null,
    savingsFromSplit: 0,
    spread: 0,
    cheapestByProduct: {},
  };
}

export function compare(
  catalog: Catalog,
  list: ListItem[],
  options: CompareOptions,
): ComparisonResult {
  const entries = sanitizeList(catalog, list);
  if (entries.length === 0) return emptyResult();

  const index = buildBestOfferIndex(catalog, entries, options);

  const quotes = catalog.markets
    .map((market) => buildQuote(market, entries, index, options))
    .sort(byCoverageThenTotal);
  const bestSingle = quotes[0] ?? null;

  const split = buildSplit(catalog, entries, index, options);

  const cheapestByProduct: Record<string, EnrichedOffer | null> = {};
  for (const entry of entries) {
    const best = bestMarketFor(entry, index, null);
    cheapestByProduct[entry.productId] = best ? best.offer : null;
  }

  return {
    quotes,
    bestSingle,
    split,
    // Pode ser negativo (dividir custa mais caro): a UI precisa poder dizer
    // "não compensa", então não forçamos o piso em zero.
    savingsFromSplit: bestSingle ? bestSingle.total - split.total : 0,
    spread: spreadAmongBestCoverage(quotes),
    cheapestByProduct,
  };
}

export const optimizer = { compare };
