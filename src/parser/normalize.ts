/**
 * Fronteira entre o JSON persistido e o índice em memória: valida o snapshot,
 * deriva o preço por unidade base e casa nomes crus de mercado com o produto
 * canônico. É a única fonte de verdade de normalização do app.
 */
import type {
  Catalog, EnrichedOffer, Market, Offer, Product, Snapshot, UnitKind,
} from '../domain/types';
import type { CatalogApi } from '../lib/contracts';
import { formatUnitPrice, normalizeText, unitPriceOf } from '../domain/units';

const UNITS: ReadonlySet<string> = new Set<UnitKind>(['kg', 'L', 'un']);

// ------------------------------------------------------------- enriquecimento

export function enrichOffer(
  offer: Offer,
  catalogRefs: { markets: Market[]; products: Product[] },
): EnrichedOffer | null {
  if (!offer || typeof offer !== 'object') return null;

  const market = catalogRefs.markets.find((m) => m.id === offer.marketId);
  const product = catalogRefs.products.find((p) => p.id === offer.productId);
  if (!market || !product) return null;

  // `packageSize` já vem com o pack multiplicado (6x350ml -> 2.1 L), então o
  // preço por unidade base é preço da embalagem dividido pelo tamanho total.
  const unitKind = offer.packageUnit;
  const unitPrice = unitPriceOf(offer.price, offer.packageSize, unitKind);

  const hasDiscount =
    typeof offer.originalPrice === 'number' && offer.originalPrice > offer.price && offer.originalPrice > 0;
  const discountPercent = hasDiscount
    ? Math.round((1 - offer.price / (offer.originalPrice as number)) * 100)
    : 0;

  return {
    ...offer,
    unitPrice,
    unitKind,
    unitLabel: formatUnitPrice(unitPrice, unitKind),
    discountPercent,
    market,
    product,
  };
}

export function buildCatalog(snapshot: Snapshot): Catalog {
  const markets = [...snapshot.markets];
  const products = [...snapshot.products];

  const offers: EnrichedOffer[] = [];
  for (const raw of snapshot.offers ?? []) {
    const enriched = enrichOffer(raw, { markets, products });
    if (enriched) offers.push(enriched); // órfãs (mercado/produto inexistente) somem aqui
  }

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

  // Mais barato por unidade primeiro: é a ordem que a UI de comparação espera.
  for (const list of offersByProduct.values()) {
    list.sort((a, b) => a.unitPrice - b.unitPrice || a.price - b.price || a.id.localeCompare(b.id));
  }

  return {
    capturedAt: snapshot.capturedAt,
    source: snapshot.source,
    location: snapshot.location,
    markets,
    products,
    offers,
    offersByProduct,
    offersByMarket,
    marketById: new Map(markets.map((m) => [m.id, m])),
    productById: new Map(products.map((p) => [p.id, p])),
  };
}

// ---------------------------------------------------------------- validação

const isInt = (value: unknown): value is number => Number.isInteger(value);
const isStr = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isObj = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Espelha scripts/validate-snapshot.mjs (o árbitro do esquema). Vazio = ok. */
export function validateSnapshot(input: unknown): string[] {
  const errors: string[] = [];
  const err = (message: string): void => void errors.push(message);

  if (!isObj(input)) return ['snapshot deve ser um objeto JSON'];
  const snap = input;

  if (!isStr(snap.capturedAt) || Number.isNaN(Date.parse(snap.capturedAt))) {
    err('capturedAt deve ser ISO 8601');
  }
  if (snap.source !== 'ifood' && snap.source !== 'seed') err("source deve ser 'ifood' ou 'seed'");
  if (!isObj(snap.location) || !isStr(snap.location.label)) err('location.label obrigatório');

  for (const key of ['markets', 'products', 'offers'] as const) {
    if (!Array.isArray(snap[key]) || (snap[key] as unknown[]).length === 0) {
      err(`${key} deve ser array não-vazio`);
    }
  }
  if (errors.length > 0) return errors;

  const markets = snap.markets as unknown[];
  const products = snap.products as unknown[];
  const offers = snap.offers as unknown[];

  const marketIds = new Set<string>();
  const productIds = new Set<string>();
  const offerIds = new Set<string>();

  markets.forEach((value, i) => {
    const at = `markets[${i}]`;
    if (!isObj(value)) return err(`${at} deve ser objeto`);
    const m = value;
    if (!isStr(m.id)) err(`${at}.id obrigatório`);
    else if (marketIds.has(m.id)) err(`${at}.id duplicado: ${m.id}`);
    else marketIds.add(m.id);
    if (!isStr(m.name)) err(`${at}.name obrigatório`);
    if (!isStr(m.slug)) err(`${at}.slug obrigatório`);
    if (!isInt(m.deliveryFee) || m.deliveryFee < 0) err(`${at}.deliveryFee deve ser inteiro >= 0 (centavos)`);
    if (!isInt(m.minOrder) || m.minOrder < 0) err(`${at}.minOrder deve ser inteiro >= 0 (centavos)`);
    if (!Array.isArray(m.deliveryMinutes) || m.deliveryMinutes.length !== 2 || !m.deliveryMinutes.every(isInt)) {
      err(`${at}.deliveryMinutes deve ser [int, int]`);
    } else if ((m.deliveryMinutes[0] as number) > (m.deliveryMinutes[1] as number)) {
      err(`${at}.deliveryMinutes fora de ordem`);
    }
    if (typeof m.distanceKm !== 'number' || m.distanceKm < 0) err(`${at}.distanceKm deve ser número >= 0`);
    if (m.rating !== undefined && (typeof m.rating !== 'number' || m.rating < 0 || m.rating > 5)) {
      err(`${at}.rating deve estar entre 0 e 5`);
    }
  });

  products.forEach((value, i) => {
    const at = `products[${i}]`;
    if (!isObj(value)) return err(`${at} deve ser objeto`);
    const p = value;
    if (!isStr(p.id)) err(`${at}.id obrigatório`);
    else if (productIds.has(p.id)) err(`${at}.id duplicado: ${p.id}`);
    else productIds.add(p.id);
    if (!isStr(p.name)) err(`${at}.name obrigatório`);
    if (!isStr(p.category)) err(`${at}.category obrigatório`);
    if (!UNITS.has(p.defaultUnit as string)) {
      err(`${at}.defaultUnit deve ser kg|L|un, veio "${String(p.defaultUnit)}"`);
    }
    if (!Array.isArray(p.keywords) || p.keywords.length === 0) err(`${at}.keywords deve ser array não-vazio`);
  });

  offers.forEach((value, i) => {
    const at = `offers[${i}] (${isObj(value) && isStr(value.rawName) ? value.rawName : '?'})`;
    if (!isObj(value)) return err(`${at} deve ser objeto`);
    const o = value;
    if (!isStr(o.id)) err(`${at}.id obrigatório`);
    else if (offerIds.has(o.id)) err(`${at}.id duplicado: ${o.id}`);
    else offerIds.add(o.id);
    if (!isStr(o.marketId) || !marketIds.has(o.marketId)) {
      err(`${at}.marketId "${String(o.marketId)}" não existe em markets`);
    }
    if (!isStr(o.productId) || !productIds.has(o.productId)) {
      err(`${at}.productId "${String(o.productId)}" não existe em products`);
    }
    if (!isStr(o.rawName)) err(`${at}.rawName obrigatório`);
    if (!isInt(o.price) || o.price <= 0) err(`${at}.price deve ser inteiro > 0 (centavos) — veio ${String(o.price)}`);
    if (o.originalPrice !== undefined) {
      if (!isInt(o.originalPrice)) err(`${at}.originalPrice deve ser inteiro (centavos)`);
      else if (isInt(o.price) && o.originalPrice <= o.price) {
        err(`${at}.originalPrice (${o.originalPrice}) deve ser MAIOR que price (${o.price})`);
      }
    }
    if (typeof o.packageSize !== 'number' || o.packageSize <= 0) err(`${at}.packageSize deve ser número > 0`);
    if (!UNITS.has(o.packageUnit as string)) err(`${at}.packageUnit deve ser kg|L|un`);
    if (typeof o.available !== 'boolean') err(`${at}.available deve ser boolean`);
    if ('unitPrice' in o) err(`${at} não deve conter unitPrice — é derivado em tempo de carga`);

    const product = products.find((p) => isObj(p) && p.id === o.productId);
    if (isObj(product) && product.defaultUnit !== o.packageUnit) {
      err(
        `${at}.packageUnit "${String(o.packageUnit)}" difere de products.defaultUnit ` +
          `"${String(product.defaultUnit)}" de ${String(o.productId)} — impede comparação`,
      );
    }
  });

  for (const pid of productIds) {
    const hasOffer = offers.some((o) => isObj(o) && o.productId === pid);
    if (!hasOffer) err(`produto "${pid}" não tem nenhuma oferta`);
  }
  for (const mid of marketIds) {
    const hasOffer = offers.some((o) => isObj(o) && o.marketId === mid);
    if (!hasOffer) err(`mercado "${mid}" não tem nenhuma oferta`);
  }

  return errors;
}

// ------------------------------------------------------------------ matcher

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Keyword casa em início de palavra, para "ovo" pegar "ovos" mas não "novo". */
function hasKeyword(haystack: string, keyword: string): boolean {
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(keyword)}`).test(haystack);
}

/**
 * Casa "Arroz Camil 5kg" e "Arroz Tio João 5kg" no mesmo produto canônico.
 * Exige TODAS as keywords da entrada; entre várias entradas que casam, vence a
 * mais específica (mais keywords).
 */
export function matchProduct(rawName: string, products: readonly Product[]): Product | null {
  if (typeof rawName !== 'string') return null;
  const name = normalizeText(rawName);
  if (name === '') return null;

  let best: Product | null = null;
  let bestScore = -1;

  for (const product of products ?? []) {
    const keywords = (product?.keywords ?? []).map(normalizeText).filter((k) => k !== '');
    if (keywords.length === 0) continue;
    if (!keywords.every((keyword) => hasKeyword(name, keyword))) continue;

    const score = keywords.length * 1000 + keywords.reduce((sum, k) => sum + k.length, 0);
    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }

  return best;
}

export const catalogApi: CatalogApi = { enrichOffer, buildCatalog, validateSnapshot };
