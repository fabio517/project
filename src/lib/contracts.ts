/**
 * Contratos de API entre os módulos. Só tipos e assinaturas — zero implementação.
 * Cada módulo implementa a sua parte; a UI programa contra este arquivo.
 */
import type {
  Catalog, ComparisonResult, CompareOptions, EnrichedOffer,
  ListItem, Offer, Snapshot, UnitKind, Centavos, Product,
} from '../domain/types';

// ---- src/domain/money.ts -------------------------------------------------
export interface MoneyApi {
  /** 793 -> "R$ 7,93" */
  formatBRL(cents: Centavos): string;
  /** 793 -> "7,93" (sem símbolo) */
  formatAmount(cents: Centavos): string;
  /** "R$ 7,93" | "7,93" | 7.93 -> 793. Lança em entrada inválida. */
  parseBRL(input: string | number): Centavos;
}

// ---- src/domain/units.ts -------------------------------------------------
export interface ParsedPackage {
  size: number;
  unit: UnitKind;
  /** Quantas embalagens vêm no pacote (ex: "Pack 6x350ml" -> 6). Default 1. */
  count: number;
}
export interface UnitsApi {
  /** "Arroz Tio João 5kg" | "Leite 1,5 L" | "Pack 6x350ml" -> ParsedPackage | null */
  parsePackage(rawName: string): ParsedPackage | null;
  /** Preço por unidade base. price=1290, size=5, unit='kg' -> 258 (R$/kg). */
  unitPriceOf(price: Centavos, size: number, unit: UnitKind, count?: number): Centavos;
  /** 258, 'kg' -> "R$ 2,58/kg" */
  formatUnitPrice(unitPrice: Centavos, unit: UnitKind): string;
}

// ---- src/parser/normalize.ts --------------------------------------------
export interface CatalogApi {
  /** Deriva unitPrice/discount e resolve referências. */
  enrichOffer(offer: Offer, catalogRefs: { markets: Market[]; products: Product[] }): EnrichedOffer | null;
  /** Snapshot cru -> índice em memória. Descarta ofertas órfãs. */
  buildCatalog(snapshot: Snapshot): Catalog;
  /** Valida a forma do JSON antes de construir. Retorna lista de erros (vazia = ok). */
  validateSnapshot(input: unknown): string[];
}

// ---- src/lib/optimizer.ts ------------------------------------------------
export interface OptimizerApi {
  compare(catalog: Catalog, list: ListItem[], options: CompareOptions): ComparisonResult;
}

// ---- src/state/useShoppingList.ts (hook React) ---------------------------
export interface ShoppingListApi {
  items: ListItem[];
  add(productId: string, quantity?: number): void;
  remove(productId: string): void;
  setQuantity(productId: string, quantity: number): void;
  clear(): void;
  has(productId: string): boolean;
  quantityOf(productId: string): number;
  /** Soma das quantidades. */
  totalUnits: number;
}

// ---- src/state/useCatalog.ts (hook React) --------------------------------
export interface CatalogState {
  catalog: Catalog | null;
  loading: boolean;
  error: string | null;
  /** Carrega um snapshot enviado pelo usuário (upload do JSON do scraper). */
  loadSnapshot(snapshot: unknown): void;
  /** Volta para o dataset seed embutido. */
  reset(): void;
}

import type { Market } from '../domain/types';
export type { Market };
