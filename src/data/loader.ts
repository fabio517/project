/**
 * Entrada de dados do app: o snapshot embutido (seed) e qualquer JSON que o
 * usuário suba. Nada vira `Catalog` sem passar pelo validador antes.
 */
import type { Catalog, Snapshot } from '../domain/types';
import { buildCatalog, validateSnapshot } from '../parser/normalize';
import seed from './seed.json';

/**
 * Sucesso -> `{ catalog, errors: [] }`; falha -> `{ catalog: null, errors }`.
 * Os dois campos existem sempre para o consumidor poder desestruturar sem
 * estreitar a união antes.
 */
export type CatalogResult =
  | { catalog: Catalog; errors: [] }
  | { catalog: null; errors: string[] };

/** Valida e constrói. Nunca lança: o erro volta como dado para a UI. */
export function catalogFromUnknown(input: unknown): CatalogResult {
  const errors = validateSnapshot(input);
  if (errors.length > 0) return { catalog: null, errors };
  return { catalog: buildCatalog(input as unknown as Snapshot), errors: [] };
}

/**
 * Dataset embutido. Um seed inválido é bug de build, não erro de usuário —
 * por isso aqui lança em vez de devolver erros.
 */
export function loadSeedCatalog(): Catalog {
  const { catalog, errors } = catalogFromUnknown(seed as unknown as Snapshot);
  if (!catalog) {
    throw new Error(`src/data/seed.json inválido:\n${errors.map((e) => ` - ${e}`).join('\n')}`);
  }
  return catalog;
}
