/**
 * Uma tela só, três zonas: cabeçalho, catálogo + lista e resultado da
 * comparação. Toda a camada de dados vem pronta dos hooks e do otimizador.
 */
import { useCallback, useMemo, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { CatalogPanel } from './components/CatalogPanel';
import { ComparisonPanel } from './components/ComparisonPanel';
import { useCatalog } from './state/useCatalog';
import { useCompareOptions, useShoppingList } from './state/useShoppingList';
import { createSeriesScale } from './ui/series';
import { useTheme } from './ui/useTheme';

export default function App() {
  const { catalog, loading, error, loadSnapshot, reset } = useCatalog();
  const list = useShoppingList();
  const optionsApi = useCompareOptions();
  const { theme, toggle } = useTheme();

  // Erro de leitura do arquivo (antes do validador) mora aqui; o erro do
  // catálogo vem do hook. Os dois viram a mesma lista de problemas.
  const [readError, setReadError] = useState<string | null>(null);

  const onSnapshot = useCallback(
    (snapshot: unknown) => {
      setReadError(null);
      loadSnapshot(snapshot);
    },
    [loadSnapshot],
  );

  const onReset = useCallback(() => {
    setReadError(null);
    reset();
  }, [reset]);

  const problems = useMemo(() => {
    const messages = [readError, error].filter((message): message is string => Boolean(message));
    return messages.flatMap((message) => message.split('\n').filter((line) => line.trim() !== ''));
  }, [readError, error]);

  // Cor por mercado: índice estável no catálogo, nunca o ranking.
  const scale = useMemo(() => createSeriesScale(catalog?.markets ?? []), [catalog]);

  return (
    <div className="min-h-screen">
      <AppHeader
        catalog={catalog}
        loading={loading}
        problems={problems}
        theme={theme}
        onToggleTheme={toggle}
        onSnapshot={onSnapshot}
        onFailure={setReadError}
        onReset={onReset}
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-5">
        {catalog ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
            {/* min-w-0 nos dois: sem isso o item do grid cresce até o conteúdo mais
                largo (a tabela) e vaza rolagem horizontal para a página inteira. */}
            <div className="min-w-0 lg:sticky lg:top-4">
              <CatalogPanel catalog={catalog} list={list} scale={scale} />
            </div>
            <div className="min-w-0">
              <ComparisonPanel catalog={catalog} list={list} optionsApi={optionsApi} scale={scale} />
            </div>
          </div>
        ) : (
          <p
            className="rounded-[var(--radius)] border p-6 text-center text-sm"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Carregue um snapshot .json para começar.
          </p>
        )}
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs" style={{ color: 'var(--text-muted)' }}>
        Preços do snapshot carregado — confira no mercado antes de fechar a compra.
      </footer>
    </div>
  );
}
