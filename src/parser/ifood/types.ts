/**
 * Formas cruas da API pública do iFood (marketplace.ifood.com.br).
 *
 * A API não é versionada para terceiros: campos somem, mudam de nome e trocam
 * de formato entre respostas. Por isso todo campo aqui é opcional e vários
 * aceitam união de formatos — a disciplina fica em `parse.ts`, que reduz esse
 * caos ao domínio. Valores monetários chegam em REAIS decimais (7.99), nunca
 * em centavos.
 */

/** Dinheiro embrulhado em objeto, como em `deliveryFee: { value: 7.99 }`. */
export interface IFoodMoney {
  value?: number | null;
  originalValue?: number | null;
  currency?: string | null;
}

export interface IFoodResource {
  fileName?: string | null;
  type?: string | null;
  /** Alguns endpoints devolvem a URL pronta. */
  url?: string | null;
}

export interface IFoodDeliveryInfo {
  fee?: number | IFoodMoney | null;
  timeMinMinutes?: number | null;
  timeMaxMinutes?: number | null;
  deliveryTime?: number | null;
  distance?: number | null;
  type?: string | null;
}

export interface IFoodMerchant {
  id?: string | null;
  uuid?: string | null;
  name?: string | null;
  slug?: string | null;
  mainCategory?: string | null;
  logoUrl?: string | null;
  resources?: IFoodResource[] | null;

  deliveryFee?: number | IFoodMoney | null;
  deliveryInfo?: IFoodDeliveryInfo | null;
  deliveryTime?: number | null;
  deliveryTimeMinMinutes?: number | null;
  deliveryTimeMaxMinutes?: number | null;
  preparationTime?: number | null;

  minimumOrderValue?: number | IFoodMoney | null;
  minimumOrder?: number | null;

  distance?: number | null;
  userRating?: number | null;
  rating?: number | null;
  available?: boolean | null;
  /** Nem sempre presente; quando vem, `false` significa fechado agora. */
  open?: boolean | null;
}

export interface IFoodPromotion {
  name?: string | null;
  tag?: string | null;
  description?: string | null;
}

export interface IFoodCatalogItem {
  id?: string | null;
  code?: string | null;
  sku?: string | null;
  ean?: string | null;

  /** No catálogo de mercado o nome do item vem em `description`. */
  description?: string | null;
  name?: string | null;
  details?: string | null;

  /**
   * `unitPrice` no iFood é o preço da unidade de venda (a embalagem), NÃO o
   * preço por kg/L — o preço por unidade base é derivado em `normalize.ts`.
   */
  unitPrice?: number | null;
  price?: number | null;
  unitOriginalPrice?: number | null;
  originalPrice?: number | null;
  promotionalPrice?: number | null;

  /** Campos estruturados de embalagem, quando o mercado preenche. */
  weight?: number | null;
  unit?: string | null;
  measurementUnit?: string | null;
  packageQuantity?: number | null;

  brand?: string | null;
  logoUrl?: string | null;
  imageUrl?: string | null;
  resources?: IFoodResource[] | null;

  available?: boolean | null;
  inStock?: boolean | null;
  soldOut?: boolean | null;
  unavailable?: boolean | null;
  stockQuantity?: number | null;

  promotion?: IFoodPromotion | string | null;
  promotionTags?: (IFoodPromotion | string)[] | null;
  tags?: string[] | null;
}

export interface IFoodCatalogCategory {
  id?: string | null;
  name?: string | null;
  items?: IFoodCatalogItem[] | null;
  itens?: IFoodCatalogItem[] | null;
  products?: IFoodCatalogItem[] | null;
}

export interface IFoodCatalogResponse {
  merchantId?: string | null;
  categories?: IFoodCatalogCategory[] | null;
  menu?: IFoodCatalogCategory[] | null;
  data?: { categories?: IFoodCatalogCategory[] | null } | null;
  items?: IFoodCatalogItem[] | null;
}

/** Tudo que já apareceu como corpo de catálogo: objeto, lista ou lista de itens. */
export type IFoodCatalogSource =
  | IFoodCatalogResponse
  | IFoodCatalogCategory[]
  | IFoodCatalogItem[]
  | null
  | undefined;

export interface IFoodMerchantListResponse {
  merchants?: IFoodMerchant[] | null;
  items?: IFoodMerchant[] | null;
  data?: { merchants?: IFoodMerchant[] | null } | null;
}
