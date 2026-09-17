/**
 * Conversão iFood cru -> domínio. Regras:
 *  - dinheiro chega em reais decimais e sai em centavos (`parseBRL`, nunca parseInt);
 *  - nada aqui lança: item impossível de parsear vira `null` e é descartado;
 *  - a normalização de embalagem/produto é delegada a units.ts e normalize.ts.
 */
import type { Centavos, Market, Offer, Product, Snapshot, UnitKind } from '../../domain/types';
import { parseBRL } from '../../domain/money';
import { parsePackage, parseUnitToken } from '../../domain/units';
import { matchProduct } from '../normalize';
import type {
  IFoodCatalogCategory, IFoodCatalogItem, IFoodCatalogResponse, IFoodMerchant,
  IFoodMoney, IFoodPromotion, IFoodResource,
} from './types';

// Host de mídia do iFood: o catálogo devolve só o `fileName`.
const IMAGE_BASE = 'https://static.ifood-static.com.br/image/upload/t_medium/';

const isObj = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text === '' ? null : text;
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Reais decimais -> centavos, via a mesma regra de `money.ts`. */
function toCents(value: unknown): Centavos | null {
  const amount = moneyValue(value);
  if (amount === null) return null;
  try {
    return parseBRL(amount);
  } catch {
    return null;
  }
}

/** Aceita `7.99` e `{ value: 7.99 }`. */
function moneyValue(value: unknown): number | null {
  if (isObj(value)) {
    const wrapped = value as IFoodMoney;
    return num(wrapped.value ?? wrapped.originalValue);
  }
  return num(value);
}

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function imageFrom(direct: unknown, resources: IFoodResource[] | null | undefined, folder: string): string | null {
  const url = str(direct);
  if (url) return url.startsWith('http') ? url : `${IMAGE_BASE}${folder}/${url}`;
  for (const resource of resources ?? []) {
    const ready = str(resource?.url);
    if (ready) return ready;
    const fileName = str(resource?.fileName);
    if (fileName) return `${IMAGE_BASE}${folder}/${fileName}`;
  }
  return null;
}

// ------------------------------------------------------------------ mercados

function deliveryRange(raw: IFoodMerchant): [number, number] {
  const info = isObj(raw.deliveryInfo) ? raw.deliveryInfo : null;
  const min = num(raw.deliveryTimeMinMinutes ?? info?.timeMinMinutes);
  const max = num(raw.deliveryTimeMaxMinutes ?? info?.timeMaxMinutes);
  if (min !== null && max !== null) {
    const lo = Math.max(0, Math.round(min));
    const hi = Math.max(0, Math.round(max));
    return lo <= hi ? [lo, hi] : [hi, lo];
  }
  // Só o tempo alvo: não inventamos faixa, repetimos o valor nas duas pontas.
  const single = num(raw.deliveryTime ?? info?.deliveryTime ?? min ?? max ?? raw.preparationTime);
  if (single !== null) {
    const value = Math.max(0, Math.round(single));
    return [value, value];
  }
  return [0, 0];
}

export function parseMerchant(raw: IFoodMerchant | null | undefined): Market | null {
  if (!isObj(raw)) return null;
  const merchant = raw as IFoodMerchant;

  const name = str(merchant.name);
  const id = str(merchant.id) ?? str(merchant.uuid) ?? (name ? slugify(name) : null);
  if (!id || !name) return null;

  const info = isObj(merchant.deliveryInfo) ? merchant.deliveryInfo : null;
  const feeCents = toCents(merchant.deliveryFee ?? info?.fee);
  const minOrderCents = toCents(merchant.minimumOrderValue ?? merchant.minimumOrder);
  const distance = num(merchant.distance ?? info?.distance);
  const rating = num(merchant.userRating ?? merchant.rating);
  const logoUrl = imageFrom(merchant.logoUrl, merchant.resources, 'logosgde');

  const market: Market = {
    id,
    name,
    slug: str(merchant.slug) ?? slugify(name),
    deliveryFee: feeCents !== null && feeCents > 0 ? feeCents : 0,
    minOrder: minOrderCents !== null && minOrderCents > 0 ? minOrderCents : 0,
    deliveryMinutes: deliveryRange(merchant),
    distanceKm: distance !== null && distance > 0 ? round6(distance) : 0,
  };
  if (logoUrl) market.logoUrl = logoUrl;
  if (rating !== null) market.rating = Math.min(5, Math.max(0, rating));

  return market;
}

// -------------------------------------------------------------------- itens

function readAvailability(raw: IFoodCatalogItem): boolean {
  if (raw.unavailable === true || raw.soldOut === true) return false;
  if (typeof raw.available === 'boolean') return raw.available;
  if (typeof raw.inStock === 'boolean') return raw.inStock;
  const stock = num(raw.stockQuantity);
  if (stock !== null) return stock > 0;
  return true;
}

function readPromo(raw: IFoodCatalogItem): string | null {
  const candidates: (IFoodPromotion | string | null | undefined)[] = [
    raw.promotion,
    ...(raw.promotionTags ?? []),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const text = str(candidate);
      if (text) return text;
    } else if (isObj(candidate)) {
      const text = str(candidate.name) ?? str(candidate.tag) ?? str(candidate.description);
      if (text) return text;
    }
  }
  return null;
}

interface PackageShape {
  size: number;
  unit: UnitKind;
  count: number;
}

/** Nome cru primeiro; os campos estruturados (`weight`/`unit`) são o plano B. */
function readPackage(raw: IFoodCatalogItem, rawName: string): PackageShape | null {
  const parsed = parsePackage(rawName);
  if (parsed) return parsed;

  const weight = num(raw.weight);
  const token = parseUnitToken(str(raw.unit) ?? str(raw.measurementUnit) ?? '');
  if (weight !== null && weight > 0 && token) {
    const quantity = num(raw.packageQuantity);
    return {
      size: round6(weight * token.scale),
      unit: token.unit,
      count: quantity !== null && quantity >= 1 ? Math.round(quantity) : 1,
    };
  }
  return null;
}

export interface CatalogItemContext {
  marketId: string;
  products: readonly Product[];
  /** Produto já resolvido; quando ausente, cai no matcher por keywords. */
  product?: Product | null;
}

export function parseCatalogItem(
  raw: IFoodCatalogItem | null | undefined,
  context: CatalogItemContext,
): Offer | null {
  if (!isObj(raw) || !context || !str(context.marketId)) return null;
  const item = raw as IFoodCatalogItem;

  const rawName = str(item.description) ?? str(item.name) ?? str(item.details);
  if (!rawName) return null;

  const product = context.product ?? matchProduct(rawName, context.products ?? []);
  if (!product) return null;

  const price = firstPositiveCents([item.unitPrice, item.price, item.promotionalPrice]);
  if (price === null) return null;

  const pack = readPackage(item, rawName);
  if (!pack) return null;

  // O esquema exige packageUnit === product.defaultUnit; sem isso a oferta não
  // é comparável e o snapshot seria rejeitado pelo árbitro.
  if (pack.unit !== product.defaultUnit) return null;

  const packageSize = round6(pack.size * (pack.count > 0 ? pack.count : 1));
  if (!(packageSize > 0)) return null;

  const itemId = str(item.id) ?? str(item.code) ?? str(item.sku) ?? str(item.ean) ?? slugify(rawName);
  const offer: Offer = {
    id: `${context.marketId}-${itemId}`,
    marketId: context.marketId,
    productId: product.id,
    rawName,
    price,
    packageSize,
    packageUnit: pack.unit,
    available: readAvailability(item),
  };

  const brand = str(item.brand);
  if (brand) offer.brand = brand;

  // `originalPrice` só existe quando é MAIOR que o preço de hoje; quando o
  // iFood manda `unitPrice` promocional, `price` costuma ser o preço "de".
  const originals = [item.originalPrice, item.unitOriginalPrice];
  if (item.unitPrice !== null && item.unitPrice !== undefined) originals.push(item.price);
  const original = maxCents(originals);
  if (original !== null && original > price) offer.originalPrice = original;

  const imageUrl = imageFrom(item.logoUrl ?? item.imageUrl, item.resources, 'pratos');
  if (imageUrl) offer.imageUrl = imageUrl;

  const promo = readPromo(item);
  if (promo) offer.promo = promo;

  return offer;
}

function firstPositiveCents(values: readonly unknown[]): Centavos | null {
  for (const value of values) {
    const cents = toCents(value);
    if (cents !== null && cents > 0) return cents;
  }
  return null;
}

function maxCents(values: readonly unknown[]): Centavos | null {
  let best: Centavos | null = null;
  for (const value of values) {
    const cents = toCents(value);
    if (cents !== null && (best === null || cents > best)) best = cents;
  }
  return best;
}

// ----------------------------------------------------------------- snapshot

/** Aceita `{categories:[{items}]}`, lista de categorias ou lista solta de itens. */
export function collectItems(rawCatalog: unknown): IFoodCatalogItem[] {
  const items: IFoodCatalogItem[] = [];

  const pushCategory = (category: unknown): void => {
    if (!isObj(category)) return;
    const cat = category as IFoodCatalogCategory;
    for (const list of [cat.items, cat.itens, cat.products]) {
      for (const item of list ?? []) if (isObj(item)) items.push(item as IFoodCatalogItem);
    }
  };

  if (Array.isArray(rawCatalog)) {
    for (const entry of rawCatalog) {
      if (!isObj(entry)) continue;
      const looksLikeCategory =
        'items' in entry || 'itens' in entry || 'products' in entry;
      if (looksLikeCategory) pushCategory(entry);
      else items.push(entry as IFoodCatalogItem);
    }
    return items;
  }

  if (isObj(rawCatalog)) {
    const response = rawCatalog as IFoodCatalogResponse;
    for (const category of response.categories ?? response.menu ?? response.data?.categories ?? []) {
      pushCategory(category);
    }
    for (const item of response.items ?? []) if (isObj(item)) items.push(item as IFoodCatalogItem);
  }

  return items;
}

/**
 * Catálogo canônico mínimo usado pelo scraper. O app de verdade recebe os
 * produtos do snapshot; esta lista existe só para o scraper conseguir agrupar
 * ofertas de mercados diferentes sem depender de src/data/seed.json.
 */
export const DEFAULT_PRODUCTS: Product[] = [
  { id: 'arroz-branco', name: 'Arroz branco tipo 1', category: 'Mercearia', defaultUnit: 'kg', keywords: ['arroz'] },
  { id: 'feijao-carioca', name: 'Feijão carioca', category: 'Mercearia', defaultUnit: 'kg', keywords: ['feijao'] },
  { id: 'acucar-refinado', name: 'Açúcar refinado', category: 'Mercearia', defaultUnit: 'kg', keywords: ['acucar'] },
  { id: 'cafe-torrado', name: 'Café torrado e moído', category: 'Mercearia', defaultUnit: 'kg', keywords: ['cafe'] },
  { id: 'macarrao-espaguete', name: 'Macarrão espaguete', category: 'Mercearia', defaultUnit: 'kg', keywords: ['macarrao'] },
  { id: 'farinha-trigo', name: 'Farinha de trigo', category: 'Mercearia', defaultUnit: 'kg', keywords: ['farinha', 'trigo'] },
  { id: 'oleo-soja', name: 'Óleo de soja', category: 'Mercearia', defaultUnit: 'L', keywords: ['oleo', 'soja'] },
  { id: 'leite-integral', name: 'Leite integral', category: 'Laticínios', defaultUnit: 'L', keywords: ['leite'] },
  { id: 'ovos-brancos', name: 'Ovos brancos', category: 'Ovos', defaultUnit: 'un', keywords: ['ovos'] },
  { id: 'refrigerante-cola', name: 'Refrigerante de cola', category: 'Bebidas', defaultUnit: 'L', keywords: ['refrigerante'] },
  { id: 'agua-mineral', name: 'Água mineral', category: 'Bebidas', defaultUnit: 'L', keywords: ['agua', 'mineral'] },
  { id: 'sabao-po', name: 'Sabão em pó', category: 'Limpeza', defaultUnit: 'kg', keywords: ['sabao', 'po'] },
  { id: 'detergente', name: 'Detergente líquido', category: 'Limpeza', defaultUnit: 'L', keywords: ['detergente'] },
  { id: 'papel-higienico', name: 'Papel higiênico', category: 'Limpeza', defaultUnit: 'un', keywords: ['papel', 'higienico'] },
];

export interface ParseSnapshotOptions {
  /** Catálogo canônico usado pelo matcher. Default: `DEFAULT_PRODUCTS`. */
  products?: readonly Product[];
  capturedAt?: string;
  source?: Snapshot['source'];
}

export function parseSnapshot(
  rawMerchants: readonly unknown[],
  rawCatalogs: Readonly<Record<string, unknown>>,
  location: Snapshot['location'],
  options: ParseSnapshotOptions = {},
): Snapshot {
  const products = [...(options.products ?? DEFAULT_PRODUCTS)];
  const markets: Market[] = [];
  const offers: Offer[] = [];
  const seenMarkets = new Set<string>();
  const seenOffers = new Set<string>();

  for (const rawMerchant of rawMerchants ?? []) {
    const market = parseMerchant(rawMerchant as IFoodMerchant);
    if (!market || seenMarkets.has(market.id)) continue;

    const rawId = isObj(rawMerchant) ? (str(rawMerchant.id) ?? str(rawMerchant.uuid)) : null;
    const rawCatalog = rawCatalogs?.[market.id] ?? (rawId ? rawCatalogs?.[rawId] : undefined);

    const marketOffers: Offer[] = [];
    for (const item of collectItems(rawCatalog)) {
      const offer = parseCatalogItem(item, { marketId: market.id, products });
      if (!offer || seenOffers.has(offer.id)) continue;
      seenOffers.add(offer.id);
      marketOffers.push(offer);
    }

    // Mercado sem nenhuma oferta reconhecida é erro de esquema: não entra.
    if (marketOffers.length === 0) continue;
    seenMarkets.add(market.id);
    markets.push(market);
    offers.push(...marketOffers);
  }

  const usedProducts = new Set(offers.map((o) => o.productId));

  return {
    capturedAt: options.capturedAt ?? new Date().toISOString(),
    source: options.source ?? 'ifood',
    location,
    markets,
    products: products.filter((p) => usedProducts.has(p.id)),
    offers,
  };
}
