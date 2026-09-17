/** Busca tolerante a acento e caixa, reusando a normalização do domínio. */
import { normalizeText } from '../domain/units';
import type { Product } from '../domain/types';

export function matchesQuery(product: Product, query: string): boolean {
  const needle = normalizeText(query);
  if (needle === '') return true;
  const terms = needle.split(' ').filter(Boolean);
  const haystack = normalizeText(`${product.name} ${product.category} ${product.keywords.join(' ')}`);
  return terms.every((term) => haystack.includes(term));
}
