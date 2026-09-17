/**
 * Catálogo em memória: começa no seed embutido e aceita um snapshot enviado
 * pelo usuário (upload do JSON do scraper). Erro de validação NUNCA derruba a
 * tela — o catálogo anterior continua valendo e a mensagem vai para `error`.
 */
import { useCallback, useMemo, useState } from 'react';
import type { Catalog } from '../domain/types';
import type { CatalogState } from '../lib/contracts';
import { catalogFromUnknown, loadSeedCatalog } from '../data/loader';

interface SeedResult {
  catalog: Catalog | null;
  error: string | null;
}

function readSeed(): SeedResult {
  try {
    return { catalog: loadSeedCatalog(), error: null };
  } catch (cause) {
    return { catalog: null, error: `Falha ao carregar o catálogo seed: ${describe(cause)}` };
  }
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function useCatalog(): CatalogState {
  // Reidratação preguiçosa: o seed é construído uma vez, não a cada render.
  const [seed] = useState<SeedResult>(readSeed);
  const [catalog, setCatalog] = useState<Catalog | null>(seed.catalog);
  const [error, setError] = useState<string | null>(seed.error);
  const [loading, setLoading] = useState(false);

  const loadSnapshot = useCallback((snapshot: unknown) => {
    setLoading(true);
    try {
      const { catalog: parsed, errors } = catalogFromUnknown(snapshot);
      if (!parsed || errors.length > 0) {
        // Mantém o catálogo atual: o usuário perde o upload, não a sessão.
        setError(errors.length > 0 ? errors.join('\n') : 'Snapshot inválido.');
        return;
      }
      setCatalog(parsed);
      setError(null);
    } catch (cause) {
      setError(`Snapshot inválido: ${describe(cause)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    const fresh = readSeed();
    setCatalog(fresh.catalog);
    setError(fresh.error);
  }, []);

  return useMemo<CatalogState>(
    () => ({ catalog, loading, error, loadSnapshot, reset }),
    [catalog, loading, error, loadSnapshot, reset],
  );
}
