import { describe, expect, it } from 'vitest';
import { validateSnapshot } from '../normalize';
import { DEFAULT_PRODUCTS, parseCatalogItem, parseMerchant, parseSnapshot } from './parse';
import type { IFoodCatalogItem, IFoodMerchant } from './types';

const ctx = { marketId: 'm1', products: DEFAULT_PRODUCTS };

describe('parseMerchant', () => {
  const raw: IFoodMerchant = {
    id: 'merchant-1',
    name: 'Carrefour Vila Mariana',
    slug: 'carrefour-vila-mariana',
    deliveryFee: 7.99,
    minimumOrderValue: 30,
    deliveryTimeMinMinutes: 40,
    deliveryTimeMaxMinutes: 55,
    distance: 2.13,
    userRating: 4.6,
    resources: [{ fileName: 'logo.png', type: 'LOGO' }],
  };

  it('converte reais decimais em centavos sem truncar', () => {
    const market = parseMerchant(raw);
    expect(market?.deliveryFee).toBe(799);
    expect(market?.minOrder).toBe(3000);
    expect(parseMerchant({ ...raw, deliveryFee: 0.1 + 0.2 })?.deliveryFee).toBe(30);
  });

  it('mapeia faixa de entrega, distância e nota', () => {
    const market = parseMerchant(raw);
    expect(market?.deliveryMinutes).toEqual([40, 55]);
    expect(market?.distanceKm).toBe(2.13);
    expect(market?.rating).toBe(4.6);
    expect(market?.slug).toBe('carrefour-vila-mariana');
    expect(market?.logoUrl).toContain('logo.png');
  });

  it('aceita os formatos alternativos da API', () => {
    const wrapped = parseMerchant({
      uuid: 'u-9',
      name: 'Pão de Açúcar Paraíso',
      deliveryFee: { value: 12.5 },
      deliveryInfo: { timeMinMinutes: 35, timeMaxMinutes: 50, distance: 1.2 },
    });
    expect(wrapped?.id).toBe('u-9');
    expect(wrapped?.deliveryFee).toBe(1250);
    expect(wrapped?.deliveryMinutes).toEqual([35, 50]);
    expect(wrapped?.slug).toBe('pao-de-acucar-paraiso');

    // Só o tempo alvo: vira faixa degenerada, sem inventar minutos.
    expect(parseMerchant({ id: 'x', name: 'Y', deliveryTime: 45 })?.deliveryMinutes).toEqual([45, 45]);
  });

  it('é defensivo com campos ausentes ou lixo', () => {
    expect(parseMerchant(undefined)).toBeNull();
    expect(parseMerchant(null)).toBeNull();
    expect(parseMerchant({ id: 'sem-nome' })).toBeNull();
    expect(parseMerchant('lixo' as unknown as IFoodMerchant)).toBeNull();
    const bare = parseMerchant({ id: 'm', name: 'Mercadinho' });
    expect(bare).toEqual({
      id: 'm',
      name: 'Mercadinho',
      slug: 'mercadinho',
      deliveryFee: 0,
      minOrder: 0,
      deliveryMinutes: [0, 0],
      distanceKm: 0,
    });
  });
});

describe('parseCatalogItem', () => {
  it('converte item cru em oferta do domínio', () => {
    const offer = parseCatalogItem(
      { id: 'i1', description: 'Arroz Tio João Tipo 1 5kg', brand: 'Tio João', unitPrice: 27.9, price: 29.9 },
      ctx,
    );
    expect(offer).toMatchObject({
      id: 'm1-i1',
      marketId: 'm1',
      productId: 'arroz-branco',
      rawName: 'Arroz Tio João Tipo 1 5kg',
      brand: 'Tio João',
      price: 2790,
      originalPrice: 2990,
      packageSize: 5,
      packageUnit: 'kg',
      available: true,
    });
  });

  it('só guarda originalPrice quando é MAIOR que o preço atual', () => {
    expect(parseCatalogItem({ id: 'a', description: 'Arroz Camil 5kg', unitPrice: 27.9, price: 27.9 }, ctx))
      .not.toHaveProperty('originalPrice');
    expect(parseCatalogItem({ id: 'b', description: 'Arroz Camil 5kg', unitPrice: 27.9, price: 20 }, ctx))
      .not.toHaveProperty('originalPrice');
    expect(
      parseCatalogItem({ id: 'c', description: 'Arroz Camil 5kg', price: 27.9, originalPrice: 31.5 }, ctx)
        ?.originalPrice,
    ).toBe(3150);
  });

  it('multiplica o pack no packageSize', () => {
    const offer = parseCatalogItem(
      { id: 'p', description: 'Refrigerante Coca-Cola Pack 6x350ml', unitPrice: 17.4 }, ctx,
    );
    expect(offer?.packageSize).toBe(2.1);
    expect(offer?.packageUnit).toBe('L');
  });

  it('cai nos campos estruturados quando o nome não tem embalagem', () => {
    const offer = parseCatalogItem(
      { id: 'w', description: 'Café Torrado e Moído Melitta', unitPrice: 18.9, weight: 500, unit: 'g' }, ctx,
    );
    expect(offer?.packageSize).toBe(0.5);
    expect(offer?.packageUnit).toBe('kg');
    expect(offer?.productId).toBe('cafe-torrado');
  });

  it('lê disponibilidade das flags de estoque', () => {
    const base: IFoodCatalogItem = { id: 's', description: 'Arroz Camil 5kg', unitPrice: 25 };
    expect(parseCatalogItem(base, ctx)?.available).toBe(true);
    expect(parseCatalogItem({ ...base, soldOut: true }, ctx)?.available).toBe(false);
    expect(parseCatalogItem({ ...base, available: false }, ctx)?.available).toBe(false);
    expect(parseCatalogItem({ ...base, inStock: false }, ctx)?.available).toBe(false);
    expect(parseCatalogItem({ ...base, stockQuantity: 0 }, ctx)?.available).toBe(false);
    expect(parseCatalogItem({ ...base, stockQuantity: 3 }, ctx)?.available).toBe(true);
  });

  it('guarda promo e imagem quando existem', () => {
    const offer = parseCatalogItem(
      {
        id: 'promo',
        description: 'Leite Italac 1,5 L',
        unitPrice: 5.49,
        promotion: { name: 'Leve 3 pague 2' },
        logoUrl: 'leite.png',
      },
      ctx,
    );
    expect(offer?.promo).toBe('Leve 3 pague 2');
    expect(offer?.imageUrl).toContain('leite.png');
  });

  it('devolve null (sem lançar) no que não dá para parsear', () => {
    expect(parseCatalogItem(null, ctx)).toBeNull();
    expect(parseCatalogItem(undefined, ctx)).toBeNull();
    expect(parseCatalogItem({}, ctx)).toBeNull();
    expect(parseCatalogItem({ description: 'Arroz Camil 5kg' }, ctx)).toBeNull(); // sem preço
    expect(parseCatalogItem({ description: 'Arroz Camil', unitPrice: 25 }, ctx)).toBeNull(); // sem embalagem
    expect(parseCatalogItem({ description: 'Sabonete Dove 90g', unitPrice: 3.5 }, ctx)).toBeNull(); // sem produto
    // Leite em pó é kg, mas o produto canônico compara em L: incomparável, descarta.
    expect(parseCatalogItem({ description: 'Leite em Pó Ninho 400g', unitPrice: 19.9 }, ctx)).toBeNull();
  });
});

describe('parseSnapshot', () => {
  const merchants: IFoodMerchant[] = [
    { id: 'm1', name: 'Mercado Um', deliveryFee: 7.99, minimumOrderValue: 30, deliveryTimeMinMinutes: 40, deliveryTimeMaxMinutes: 55, distance: 2.1, userRating: 4.6 },
    { id: 'm2', name: 'Mercado Dois', deliveryFee: 4.99, minimumOrderValue: 50, deliveryTime: 60, distance: 3.4 },
    { id: 'm3', name: 'Mercado Sem Catálogo' },
  ];
  const catalogs = {
    m1: {
      categories: [
        { name: 'Mercearia', items: [
          { id: 'a', description: 'Arroz Tio João Tipo 1 5kg', unitPrice: 27.9 },
          { id: 'l', description: 'Leite Italac 1,5 L', unitPrice: 8.49, price: 9.99 },
          { id: 'x', description: 'Escova de Dentes Oral-B', unitPrice: 12.9 },
        ] },
      ],
    },
    m2: [
      { id: 'a', description: 'Arroz Camil Tipo 1 5kg', unitPrice: 25.9 },
      { id: 'l', description: 'Leite Piracanjuba 1L', unitPrice: 5.19 },
    ],
  };

  const snap = parseSnapshot(merchants, catalogs, { label: 'São Paulo, SP', latitude: -23.55, longitude: -46.63 }, {
    capturedAt: '2026-09-17T12:00:00.000Z',
  });

  it('gera um snapshot que passa no árbitro de esquema', () => {
    expect(validateSnapshot(snap)).toEqual([]);
    expect(snap.source).toBe('ifood');
    expect(snap.capturedAt).toBe('2026-09-17T12:00:00.000Z');
    expect(snap.location.latitude).toBe(-23.55);
  });

  it('descarta mercado sem oferta reconhecida e produto sem oferta', () => {
    expect(snap.markets.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(snap.products.map((p) => p.id).sort()).toEqual(['arroz-branco', 'leite-integral']);
  });

  it('gera ids de oferta únicos por mercado', () => {
    expect(snap.offers.map((o) => o.id)).toEqual(['m1-a', 'm1-l', 'm2-a', 'm2-l']);
    expect(new Set(snap.offers.map((o) => o.id)).size).toBe(snap.offers.length);
  });

  it('não quebra com entradas vazias ou corrompidas', () => {
    const empty = parseSnapshot([], {}, { label: 'X' });
    expect(empty.markets).toEqual([]);
    expect(empty.offers).toEqual([]);
    const lixo = parseSnapshot([null, 42, 'texto'], { m1: 'nada' }, { label: 'X' });
    expect(lixo.offers).toEqual([]);
  });
});
