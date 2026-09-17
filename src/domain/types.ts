/**
 * Contrato de dominio da Feira Inteligente.
 *
 * Regras invioláveis:
 *  - Todo dinheiro é `Centavos` (inteiro). Nunca float para moeda.
 *  - O snapshot persistido (JSON) NUNCA guarda preço por unidade: ele é
 *    derivado em tempo de carga por `enrichOffer`, para existir uma única
 *    fonte de verdade de normalização.
 */

/** Valor monetário em centavos de real. Sempre inteiro. */
export type Centavos = number;

/** Unidade base na qual o preço é normalizado para comparação. */
export type UnitKind = 'kg' | 'L' | 'un';

// ---------------------------------------------------------------- mercados

export interface Market {
  id: string;
  name: string;
  /** Identificador legível/urlzável, ex: "carrefour-vila-mariana". */
  slug: string;
  logoUrl?: string;
  /** Taxa de entrega em centavos. 0 = entrega grátis. */
  deliveryFee: Centavos;
  /** Pedido mínimo em centavos. 0 = sem mínimo. */
  minOrder: Centavos;
  /** Faixa estimada de entrega em minutos: [min, max]. */
  deliveryMinutes: [number, number];
  distanceKm: number;
  /** Nota de 0 a 5 exibida no iFood. */
  rating?: number;
}

// ---------------------------------------------------------------- produtos

/**
 * Produto canônico: a entidade que o usuário coloca na lista.
 * Várias `Offer` de mercados diferentes apontam para o mesmo `Product`.
 */
export interface Product {
  id: string;
  name: string;
  category: string;
  /** Unidade em que faz sentido comparar este produto. */
  defaultUnit: UnitKind;
  /** Termos usados pelo matcher para agrupar ofertas de mercados distintos. */
  keywords: string[];
}

/** Uma oferta concreta: um produto, em um mercado, a um preço. */
export interface Offer {
  id: string;
  marketId: string;
  productId: string;
  /** Nome exatamente como veio do mercado, preservado para auditoria. */
  rawName: string;
  brand?: string;
  /** Preço cobrado hoje. */
  price: Centavos;
  /** Preço "de" quando há promoção. Ausente se não há desconto. */
  originalPrice?: Centavos;
  /** Tamanho da embalagem na unidade `packageUnit`, ex: 1.5 */
  packageSize: number;
  packageUnit: UnitKind;
  available: boolean;
  imageUrl?: string;
  /** Texto da promoção, ex: "Leve 3 pague 2". */
  promo?: string;
}

// --------------------------------------------------------------- snapshot

/** Documento persistido em JSON — a saída do parser, a entrada do app. */
export interface Snapshot {
  /** ISO 8601 do momento da captura. */
  capturedAt: string;
  source: 'ifood' | 'seed';
  location: { label: string; latitude?: number; longitude?: number };
  markets: Market[];
  products: Product[];
  offers: Offer[];
}

// --------------------------------------------------------- dados derivados

/** Oferta com normalização calculada e referências resolvidas. */
export interface EnrichedOffer extends Offer {
  /** Preço por `unitKind` — a métrica de custo-benefício. */
  unitPrice: Centavos;
  /** Unidade do `unitPrice`, ex: 'kg'. */
  unitKind: UnitKind;
  /** Rótulo pronto para exibição, ex: "R$ 7,93/kg". */
  unitLabel: string;
  /** Desconto percentual 0..100, ou 0 quando não há promoção. */
  discountPercent: number;
  market: Market;
  product: Product;
}

/** Índice em memória construído a partir de um `Snapshot`. */
export interface Catalog {
  capturedAt: string;
  source: Snapshot['source'];
  location: Snapshot['location'];
  markets: Market[];
  products: Product[];
  offers: EnrichedOffer[];
  offersByProduct: Map<string, EnrichedOffer[]>;
  offersByMarket: Map<string, EnrichedOffer[]>;
  marketById: Map<string, Market>;
  productById: Map<string, Product>;
}

// ------------------------------------------------------------ lista/compra

export interface ListItem {
  productId: string;
  /** Quantidade de embalagens a comprar. Inteiro >= 1. */
  quantity: number;
}

export interface CompareOptions {
  /** Somar taxa de entrega ao total de cada mercado. */
  includeDelivery: boolean;
  /** Ignorar ofertas com `available: false`. */
  onlyAvailable: boolean;
  /** Número máximo de mercados no plano dividido. >= 1. */
  maxStops: number;
}

// -------------------------------------------------------------- comparação

export interface QuoteLine {
  productId: string;
  product: Product;
  quantity: number;
  /** Melhor oferta deste produto neste mercado, ou null se indisponível. */
  offer: EnrichedOffer | null;
  /** price * quantity, ou 0 quando `offer` é null. */
  lineTotal: Centavos;
}

/** O custo da lista inteira em UM mercado. */
export interface MarketQuote {
  market: Market;
  lines: QuoteLine[];
  foundCount: number;
  missingCount: number;
  missingProductIds: string[];
  subtotal: Centavos;
  deliveryFee: Centavos;
  /** subtotal + deliveryFee (se `includeDelivery`). */
  total: Centavos;
  meetsMinOrder: boolean;
  /** Quanto falta para bater o pedido mínimo. 0 se já bate. */
  shortfallToMinOrder: Centavos;
  /** foundCount / total de itens da lista, 0..1. */
  coverage: number;
}

/** Uma parada do plano dividido. */
export interface SplitStop {
  market: Market;
  lines: QuoteLine[];
  subtotal: Centavos;
  deliveryFee: Centavos;
  total: Centavos;
  meetsMinOrder: boolean;
}

/** Plano que divide a lista entre vários mercados. */
export interface SplitPlan {
  stops: SplitStop[];
  subtotal: Centavos;
  deliveryTotal: Centavos;
  total: Centavos;
  unavailableProductIds: string[];
}

export interface ComparisonResult {
  /** Todos os mercados, do melhor total para o pior. */
  quotes: MarketQuote[];
  /** Melhor mercado único que cobre o máximo da lista. */
  bestSingle: MarketQuote | null;
  /** Melhor divisão entre mercados, ou null se não compensa. */
  split: SplitPlan | null;
  /** bestSingle.total - split.total. Positivo = dividir economiza. */
  savingsFromSplit: Centavos;
  /** Pior mercado - melhor mercado: o range da decisão. */
  spread: Centavos;
  /** Oferta mais barata (por preço da embalagem) de cada produto da lista. */
  cheapestByProduct: Record<string, EnrichedOffer | null>;
}
