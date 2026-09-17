import { describe, expect, it } from 'vitest';
import type { Market, Offer, Product, Snapshot } from '../domain/types';
import { buildCatalog, enrichOffer, matchProduct, validateSnapshot } from './normalize';

const market = (id: string, over: Partial<Market> = {}): Market => ({
  id,
  name: `Mercado ${id}`,
  slug: `mercado-${id}`,
  deliveryFee: 799,
  minOrder: 3000,
  deliveryMinutes: [40, 55],
  distanceKm: 2.1,
  ...over,
});

const product = (id: string, over: Partial<Product> = {}): Product => ({
  id,
  name: `Produto ${id}`,
  category: 'Mercearia',
  defaultUnit: 'kg',
  keywords: [id],
  ...over,
});

const offer = (id: string, over: Partial<Offer> = {}): Offer => ({
  id,
  marketId: 'm1',
  productId: 'arroz',
  rawName: 'Arroz Tio João 5kg',
  price: 2790,
  packageSize: 5,
  packageUnit: 'kg',
  available: true,
  ...over,
});

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  capturedAt: '2026-09-17T12:00:00.000Z',
  source: 'seed',
  location: { label: 'São Paulo, SP' },
  markets: [market('m1'), market('m2')],
  products: [product('arroz')],
  offers: [offer('o1'), offer('o2', { marketId: 'm2', price: 2590 })],
  ...over,
});

describe('enrichOffer', () => {
  const refs = { markets: [market('m1')], products: [product('arroz')] };

  it('deriva unitPrice, unitKind e rótulo', () => {
    const enriched = enrichOffer(offer('o1'), refs);
    expect(enriched?.unitPrice).toBe(558);
    expect(enriched?.unitKind).toBe('kg');
    expect(enriched?.unitLabel).toBe('R$ 5,58/kg');
    expect(enriched?.market.id).toBe('m1');
    expect(enriched?.product.id).toBe('arroz');
  });

  it('calcula desconto só quando há preço de', () => {
    expect(enrichOffer(offer('o1'), refs)?.discountPercent).toBe(0);
    expect(enrichOffer(offer('o1', { price: 2590, originalPrice: 2990 }), refs)?.discountPercent).toBe(13);
    // originalPrice menor ou igual não é promoção
    expect(enrichOffer(offer('o1', { price: 2590, originalPrice: 2590 }), refs)?.discountPercent).toBe(0);
  });

  it('descarta órfãs', () => {
    expect(enrichOffer(offer('o1', { marketId: 'fantasma' }), refs)).toBeNull();
    expect(enrichOffer(offer('o1', { productId: 'fantasma' }), refs)).toBeNull();
  });

  it('não explode com embalagem zerada', () => {
    expect(enrichOffer(offer('o1', { packageSize: 0 }), refs)?.unitPrice).toBe(0);
  });
});

describe('buildCatalog', () => {
  it('ordena offersByProduct do menor unitPrice para o maior', () => {
    const catalog = buildCatalog(
      snapshot({
        offers: [
          offer('caro', { price: 3000, packageSize: 5 }), // R$ 6,00/kg
          offer('barato', { id: 'barato', marketId: 'm2', price: 2400, packageSize: 5 }), // R$ 4,80/kg
          offer('medio', { id: 'medio', marketId: 'm2', price: 1400, packageSize: 2 }), // R$ 7,00/kg
        ],
      }),
    );
    const ordered = catalog.offersByProduct.get('arroz') ?? [];
    expect(ordered.map((o) => o.id)).toEqual(['barato', 'caro', 'medio']);
    expect(ordered.map((o) => o.unitPrice)).toEqual([480, 600, 700]);
  });

  it('descarta ofertas órfãs e indexa o resto', () => {
    const catalog = buildCatalog(
      snapshot({ offers: [offer('o1'), offer('orfa', { id: 'orfa', marketId: 'nao-existe' })] }),
    );
    expect(catalog.offers.map((o) => o.id)).toEqual(['o1']);
    expect(catalog.offersByMarket.get('nao-existe')).toBeUndefined();
    expect(catalog.marketById.get('m1')?.name).toBe('Mercado m1');
    expect(catalog.productById.get('arroz')?.name).toBe('Produto arroz');
    expect(catalog.capturedAt).toBe('2026-09-17T12:00:00.000Z');
  });
});

describe('validateSnapshot', () => {
  it('aceita snapshot bem formado', () => {
    expect(validateSnapshot(snapshot())).toEqual([]);
  });

  it('rejeita cabeçalho inválido', () => {
    expect(validateSnapshot(null).length).toBe(1);
    expect(validateSnapshot(snapshot({ source: 'outro' as Snapshot['source'] }))).toContain(
      "source deve ser 'ifood' ou 'seed'",
    );
    expect(validateSnapshot({ ...snapshot(), markets: [] }).join()).toMatch(/markets deve ser array não-vazio/);
  });

  it('rejeita unitPrice no JSON — é derivado em tempo de carga', () => {
    const contaminada = { ...offer('o1'), unitPrice: 558 };
    const errors = validateSnapshot(snapshot({ offers: [contaminada, offer('o2', { marketId: 'm2' })] }));
    expect(errors.join()).toMatch(/não deve conter unitPrice/);
  });

  it('rejeita packageUnit divergente do defaultUnit', () => {
    const errors = validateSnapshot(
      snapshot({ offers: [offer('o1', { packageUnit: 'L', packageSize: 5 }), offer('o2', { marketId: 'm2' })] }),
    );
    expect(errors.join()).toMatch(/difere de products.defaultUnit/);
  });

  it('rejeita referências quebradas, ids duplicados e centavos não-inteiros', () => {
    const errors = validateSnapshot(
      snapshot({
        offers: [
          offer('dup', { marketId: 'fantasma' }),
          offer('dup', { marketId: 'm2', price: 27.9 }),
        ],
      }),
    );
    expect(errors.join()).toMatch(/marketId "fantasma" não existe/);
    expect(errors.join()).toMatch(/id duplicado: dup/);
    expect(errors.join()).toMatch(/price deve ser inteiro/);
  });

  it('rejeita originalPrice menor ou igual ao preço', () => {
    const errors = validateSnapshot(snapshot({ offers: [offer('o1', { originalPrice: 2000 })] }));
    expect(errors.join()).toMatch(/deve ser MAIOR que price/);
  });

  it('cobra que todo mercado e todo produto tenham oferta', () => {
    const errors = validateSnapshot(snapshot({ offers: [offer('o1')] }));
    expect(errors.join()).toMatch(/mercado "m2" não tem nenhuma oferta/);
  });
});

describe('matchProduct', () => {
  const products = [
    product('arroz', { keywords: ['arroz'] }),
    product('arroz-integral', { keywords: ['arroz', 'integral'] }),
    product('leite', { keywords: ['leite'], defaultUnit: 'L' }),
    product('ovos', { keywords: ['ovo'], defaultUnit: 'un' }),
  ];

  it('casa marcas diferentes no mesmo produto canônico', () => {
    expect(matchProduct('Arroz Camil Tipo 1 5kg', products)?.id).toBe('arroz');
    expect(matchProduct('Arroz Tio João Tipo 1 5kg', products)?.id).toBe('arroz');
    expect(matchProduct('ARROZ BRANCO PRATO FINO 5KG', products)?.id).toBe('arroz');
  });

  it('prefere a entrada mais específica', () => {
    expect(matchProduct('Arroz Integral Camil 1kg', products)?.id).toBe('arroz-integral');
    expect(matchProduct('Arroz Branco Camil 1kg', products)?.id).toBe('arroz');
  });

  it('ignora acento e caixa e aceita plural', () => {
    expect(matchProduct('LEITE INTEGRAL ITALAC 1L', products)?.id).toBe('leite');
    expect(matchProduct('Ovos Brancos 12 unidades', products)?.id).toBe('ovos');
  });

  it('exige que todas as keywords casem e casa só em início de palavra', () => {
    expect(matchProduct('Detergente Ypê Novo 500ml', products)).toBeNull();
    expect(matchProduct('Sabonete Dove', products)).toBeNull();
    expect(matchProduct('', products)).toBeNull();
  });
});
