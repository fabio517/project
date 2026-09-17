/**
 * Testes do otimizador. Catálogos montados à mão (nunca o seed): cada número
 * aqui existe para provar uma regra, então o seed mudar não pode quebrá-los.
 */
import { describe, expect, it } from 'vitest';
import type {
  Catalog,
  CompareOptions,
  EnrichedOffer,
  Market,
  Product,
  UnitKind,
} from '../domain/types';
import type { OptimizerApi } from './contracts';
import { compare } from './optimizer';

// ------------------------------------------------------------------ fixtures

interface OfferSpec {
  id: string;
  marketId: string;
  productId: string;
  price: number;
  packageSize?: number;
  available?: boolean;
}

function mkMarket(id: string, over: Partial<Market> = {}): Market {
  return {
    id,
    name: `Mercado ${id.toUpperCase()}`,
    slug: id,
    deliveryFee: 0,
    minOrder: 0,
    deliveryMinutes: [30, 45],
    distanceKm: 1,
    ...over,
  };
}

function mkProduct(id: string, unit: UnitKind = 'un'): Product {
  return { id, name: id, category: 'Teste', defaultUnit: unit, keywords: [id] };
}

function mkCatalog(markets: Market[], products: Product[], specs: OfferSpec[]): Catalog {
  const marketById = new Map(markets.map((m) => [m.id, m]));
  const productById = new Map(products.map((p) => [p.id, p]));

  const offers: EnrichedOffer[] = specs.map((spec) => {
    const market = marketById.get(spec.marketId);
    const product = productById.get(spec.productId);
    if (!market || !product) throw new Error(`fixture inválida: ${spec.id}`);
    const packageSize = spec.packageSize ?? 1;
    return {
      id: spec.id,
      marketId: spec.marketId,
      productId: spec.productId,
      rawName: `${product.name} (${market.name})`,
      price: spec.price,
      packageSize,
      packageUnit: product.defaultUnit,
      available: spec.available ?? true,
      unitPrice: Math.round(spec.price / packageSize),
      unitKind: product.defaultUnit,
      unitLabel: '',
      discountPercent: 0,
      market,
      product,
    };
  });

  const offersByProduct = new Map<string, EnrichedOffer[]>();
  const offersByMarket = new Map<string, EnrichedOffer[]>();
  for (const offer of offers) {
    const byProduct = offersByProduct.get(offer.productId);
    if (byProduct) byProduct.push(offer);
    else offersByProduct.set(offer.productId, [offer]);
    const byMarket = offersByMarket.get(offer.marketId);
    if (byMarket) byMarket.push(offer);
    else offersByMarket.set(offer.marketId, [offer]);
  }

  return {
    capturedAt: '2026-01-01T00:00:00.000Z',
    source: 'seed',
    location: { label: 'Teste' },
    markets,
    products,
    offers,
    offersByProduct,
    offersByMarket,
    marketById,
    productById,
  };
}

function opts(over: Partial<CompareOptions> = {}): CompareOptions {
  return { includeDelivery: false, onlyAvailable: true, maxStops: 2, ...over };
}

function stopIds(result: ReturnType<typeof compare>): string[] {
  return (result.split?.stops ?? []).map((stop) => stop.market.id).sort();
}

// --------------------------------------------------------------------- casos

describe('compare — contrato', () => {
  it('implementa OptimizerApi', () => {
    const api: OptimizerApi = { compare };
    expect(typeof api.compare).toBe('function');
  });

  it('lista vazia devolve resultado bem-formado, sem exceção', () => {
    const catalog = mkCatalog(
      [mkMarket('a')],
      [mkProduct('p1')],
      [{ id: 'a-p1', marketId: 'a', productId: 'p1', price: 1000 }],
    );

    const result = compare(catalog, [], opts());

    expect(result.quotes).toEqual([]);
    expect(result.bestSingle).toBeNull();
    expect(result.split).toBeNull();
    expect(result.savingsFromSplit).toBe(0);
    expect(result.spread).toBe(0);
    expect(result.cheapestByProduct).toEqual({});
  });
});

describe('cobertura vs. preço', () => {
  const catalog = mkCatalog(
    [mkMarket('barato'), mkMarket('completo')],
    [mkProduct('p1'), mkProduct('p2')],
    [
      { id: 'barato-p1', marketId: 'barato', productId: 'p1', price: 1000 },
      { id: 'completo-p1', marketId: 'completo', productId: 'p1', price: 1200 },
      { id: 'completo-p2', marketId: 'completo', productId: 'p2', price: 1500 },
    ],
  );
  const list = [
    { productId: 'p1', quantity: 1 },
    { productId: 'p2', quantity: 1 },
  ];

  it('mercado com cobertura parcial não vira bestSingle mesmo sendo mais barato', () => {
    const result = compare(catalog, list, opts());

    const parcial = result.quotes.find((q) => q.market.id === 'barato');
    expect(parcial?.total).toBe(1000);
    expect(parcial?.coverage).toBe(0.5);
    expect(parcial?.missingProductIds).toEqual(['p2']);
    expect(parcial?.lines.find((l) => l.productId === 'p2')?.offer).toBeNull();
    expect(parcial?.lines.find((l) => l.productId === 'p2')?.lineTotal).toBe(0);

    expect(result.quotes[0].market.id).toBe('completo');
    expect(result.bestSingle?.market.id).toBe('completo');
    expect(result.bestSingle?.total).toBe(2700);
  });

  it('spread ignora mercados de cobertura menor', () => {
    const comSegundoCompleto = mkCatalog(
      [mkMarket('barato'), mkMarket('completo'), mkMarket('completo2')],
      [mkProduct('p1'), mkProduct('p2')],
      [
        { id: 'barato-p1', marketId: 'barato', productId: 'p1', price: 1000 },
        { id: 'completo-p1', marketId: 'completo', productId: 'p1', price: 1200 },
        { id: 'completo-p2', marketId: 'completo', productId: 'p2', price: 1500 },
        { id: 'completo2-p1', marketId: 'completo2', productId: 'p1', price: 1400 },
        { id: 'completo2-p2', marketId: 'completo2', productId: 'p2', price: 1600 },
      ],
    );

    // 3000 (completo2) - 2700 (completo); o mercado parcial de 1000 não conta.
    expect(compare(comSegundoCompleto, list, opts()).spread).toBe(300);
  });
});

describe('preço de embalagem manda, unitPrice só desempata', () => {
  it('escolhe a embalagem mais barata mesmo com pior preço por unidade', () => {
    const catalog = mkCatalog(
      [mkMarket('a')],
      [mkProduct('arroz', 'kg')],
      [
        { id: 'a-grande', marketId: 'a', productId: 'arroz', price: 1000, packageSize: 5 },
        { id: 'a-pequeno', marketId: 'a', productId: 'arroz', price: 900, packageSize: 2 },
      ],
    );

    const result = compare(catalog, [{ productId: 'arroz', quantity: 2 }], opts());

    expect(result.quotes[0].lines[0].offer?.id).toBe('a-pequeno');
    expect(result.quotes[0].lines[0].lineTotal).toBe(1800);
    expect(result.cheapestByProduct.arroz?.id).toBe('a-pequeno');
  });
});

describe('taxa de entrega', () => {
  const catalog = mkCatalog(
    [mkMarket('a', { deliveryFee: 1200 }), mkMarket('b', { deliveryFee: 100 })],
    [mkProduct('p1'), mkProduct('p2')],
    [
      { id: 'a-p1', marketId: 'a', productId: 'p1', price: 2500 },
      { id: 'a-p2', marketId: 'a', productId: 'p2', price: 2500 },
      { id: 'b-p1', marketId: 'b', productId: 'p1', price: 2700 },
      { id: 'b-p2', marketId: 'b', productId: 'p2', price: 2800 },
    ],
  );
  const list = [
    { productId: 'p1', quantity: 1 },
    { productId: 'p2', quantity: 1 },
  ];

  it('sem entrega o mercado de produtos mais baratos vence', () => {
    const result = compare(catalog, list, opts({ includeDelivery: false }));
    expect(result.bestSingle?.market.id).toBe('a');
    expect(result.bestSingle?.total).toBe(5000);
    expect(result.bestSingle?.deliveryFee).toBe(0);
  });

  it('com entrega o vencedor muda', () => {
    const result = compare(catalog, list, opts({ includeDelivery: true }));
    expect(result.bestSingle?.market.id).toBe('b');
    expect(result.bestSingle?.total).toBe(5600);
    expect(result.quotes[1].total).toBe(6200);
  });
});

describe('plano dividido', () => {
  it('maxStops: 1 degenera para o melhor mercado único', () => {
    const catalog = mkCatalog(
      [mkMarket('a'), mkMarket('b')],
      [mkProduct('p1'), mkProduct('p2')],
      [
        { id: 'a-p1', marketId: 'a', productId: 'p1', price: 1000 },
        { id: 'a-p2', marketId: 'a', productId: 'p2', price: 1300 },
        { id: 'b-p1', marketId: 'b', productId: 'p1', price: 1100 },
        { id: 'b-p2', marketId: 'b', productId: 'p2', price: 1250 },
      ],
    );
    const list = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 1 },
    ];

    const result = compare(catalog, list, opts({ maxStops: 1 }));

    expect(result.split?.stops).toHaveLength(1);
    expect(result.split?.stops[0].market.id).toBe(result.bestSingle?.market.id);
    expect(result.split?.total).toBe(result.bestSingle?.total);
    expect(result.split?.total).toBe(2300);
    expect(result.savingsFromSplit).toBe(0);
  });

  it('reduz 3 paradas para 2 eliminando a de realocação mais barata', () => {
    const catalog = mkCatalog(
      [mkMarket('a'), mkMarket('b'), mkMarket('c')],
      [mkProduct('p1'), mkProduct('p2'), mkProduct('p3')],
      [
        { id: 'a-p1', marketId: 'a', productId: 'p1', price: 1000 },
        { id: 'a-p2', marketId: 'a', productId: 'p2', price: 1100 },
        { id: 'a-p3', marketId: 'a', productId: 'p3', price: 5000 },
        { id: 'b-p1', marketId: 'b', productId: 'p1', price: 1050 },
        { id: 'b-p2', marketId: 'b', productId: 'p2', price: 900 },
        { id: 'b-p3', marketId: 'b', productId: 'p3', price: 5000 },
        { id: 'c-p1', marketId: 'c', productId: 'p1', price: 2000 },
        { id: 'c-p2', marketId: 'c', productId: 'p2', price: 2000 },
        { id: 'c-p3', marketId: 'c', productId: 'p3', price: 700 },
      ],
    );
    const list = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 1 },
      { productId: 'p3', quantity: 1 },
    ];

    // Sem limite: a (p1), b (p2), c (p3) = 1000 + 900 + 700 = 2600.
    const livre = compare(catalog, list, opts({ maxStops: 3 }));
    expect(stopIds(livre)).toEqual(['a', 'b', 'c']);
    expect(livre.split?.total).toBe(2600);

    // Com 2 paradas: sair de "a" custa +50 (p1 vai para b), de "b" custa +200,
    // de "c" custa +4300. A eliminação correta é "a".
    const result = compare(catalog, list, opts({ maxStops: 2 }));
    expect(stopIds(result)).toEqual(['b', 'c']);
    expect(result.split?.total).toBe(2650);
    const paradaB = result.split?.stops.find((stop) => stop.market.id === 'b');
    expect(paradaB?.lines.map((l) => l.productId).sort()).toEqual(['p1', 'p2']);
    expect(paradaB?.subtotal).toBe(1950);
  });

  it('savingsFromSplit fica negativo quando as entregas comem a economia', () => {
    const catalog = mkCatalog(
      [mkMarket('a', { deliveryFee: 500 }), mkMarket('b', { deliveryFee: 1500 })],
      [mkProduct('p1'), mkProduct('p2')],
      [
        { id: 'a-p1', marketId: 'a', productId: 'p1', price: 1000 },
        { id: 'a-p2', marketId: 'a', productId: 'p2', price: 1000 },
        { id: 'b-p1', marketId: 'b', productId: 'p1', price: 900 },
      ],
    );
    const list = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 1 },
    ];

    const result = compare(catalog, list, opts({ includeDelivery: true, maxStops: 2 }));

    expect(result.split).not.toBeNull();
    expect(stopIds(result)).toEqual(['a', 'b']);
    expect(result.split?.subtotal).toBe(1900);
    expect(result.split?.deliveryTotal).toBe(2000);
    expect(result.split?.total).toBe(3900);
    expect(result.bestSingle?.market.id).toBe('a');
    expect(result.bestSingle?.total).toBe(2500);
    expect(result.savingsFromSplit).toBe(-1400);
  });

  it('marca meetsMinOrder e shortfallToMinOrder por mercado e por parada', () => {
    const catalog = mkCatalog(
      [mkMarket('a', { minOrder: 5000 }), mkMarket('b', { minOrder: 1000 })],
      [mkProduct('p1')],
      [
        { id: 'a-p1', marketId: 'a', productId: 'p1', price: 3000 },
        { id: 'b-p1', marketId: 'b', productId: 'p1', price: 3200 },
      ],
    );

    const result = compare(catalog, [{ productId: 'p1', quantity: 1 }], opts());

    const a = result.quotes.find((q) => q.market.id === 'a');
    const b = result.quotes.find((q) => q.market.id === 'b');
    expect(a?.meetsMinOrder).toBe(false);
    expect(a?.shortfallToMinOrder).toBe(2000);
    expect(b?.meetsMinOrder).toBe(true);
    expect(b?.shortfallToMinOrder).toBe(0);

    // A parada mais barata é justamente a que não bate o mínimo: o plano é
    // inviável na prática e o dado precisa continuar visível.
    expect(result.split?.stops[0].market.id).toBe('a');
    expect(result.split?.stops[0].meetsMinOrder).toBe(false);
  });

  it('produto indisponível em todo lugar cai em unavailableProductIds', () => {
    const catalog = mkCatalog(
      [mkMarket('a'), mkMarket('b')],
      [mkProduct('p1'), mkProduct('p2'), mkProduct('p3')],
      [
        { id: 'a-p1', marketId: 'a', productId: 'p1', price: 1000 },
        { id: 'b-p1', marketId: 'b', productId: 'p1', price: 1100 },
        { id: 'a-p2', marketId: 'a', productId: 'p2', price: 800, available: false },
        { id: 'b-p2', marketId: 'b', productId: 'p2', price: 850, available: false },
        // p3 não tem oferta nenhuma no catálogo.
      ],
    );
    const list = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 1 },
      { productId: 'p3', quantity: 1 },
    ];

    const result = compare(catalog, list, opts({ onlyAvailable: true }));

    expect(result.split?.unavailableProductIds).toEqual(['p2', 'p3']);
    expect(result.cheapestByProduct.p2).toBeNull();
    expect(result.cheapestByProduct.p3).toBeNull();
    expect(result.quotes[0].missingProductIds.sort()).toEqual(['p2', 'p3']);
    expect(result.quotes[0].coverage).toBeCloseTo(1 / 3);
    expect(result.split?.stops).toHaveLength(1);
    expect(result.split?.total).toBe(1000);

    // Com onlyAvailable: false o esgotado volta a contar.
    const comEsgotados = compare(catalog, list, opts({ onlyAvailable: false }));
    expect(comEsgotados.split?.unavailableProductIds).toEqual(['p3']);
    expect(comEsgotados.cheapestByProduct.p2?.id).toBe('a-p2');
  });

  it('um produto sem oferta em nenhum mercado sobrevivente vira indisponível na redução', () => {
    const catalog = mkCatalog(
      [mkMarket('a'), mkMarket('b'), mkMarket('c')],
      [mkProduct('p1'), mkProduct('p2'), mkProduct('p3')],
      [
        { id: 'a-p1', marketId: 'a', productId: 'p1', price: 1000 },
        { id: 'b-p2', marketId: 'b', productId: 'p2', price: 1000 },
        { id: 'c-p3', marketId: 'c', productId: 'p3', price: 1000 },
      ],
    );
    const list = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 1 },
      { productId: 'p3', quantity: 1 },
    ];

    const result = compare(catalog, list, opts({ maxStops: 2 }));

    expect(result.split?.stops).toHaveLength(2);
    expect(result.split?.unavailableProductIds).toHaveLength(1);
    expect(result.split?.total).toBe(2000);
  });
});
