/**
 * Carregar snapshot: arrastar-e-soltar um .json ou escolher arquivo. Um erro
 * de leitura/validação NUNCA derruba a tela — vira lista de problemas.
 */
import { useCallback, useRef, useState } from 'react';
import { IconUpload } from '../ui/icons';

interface SnapshotLoaderProps {
  loading: boolean;
  onSnapshot(snapshot: unknown): void;
  onFailure(message: string): void;
  onReset(): void;
}

export function SnapshotLoader({ loading, onSnapshot, onFailure, onReset }: SnapshotLoaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const readFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
        onFailure(`"${file.name}" não é um arquivo .json.`);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => onFailure(`Não foi possível ler "${file.name}".`);
      reader.onload = () => {
        try {
          onSnapshot(JSON.parse(String(reader.result)));
        } catch (cause) {
          onFailure(`JSON inválido em "${file.name}": ${cause instanceof Error ? cause.message : String(cause)}`);
        }
      };
      reader.readAsText(file);
    },
    [onFailure, onSnapshot],
  );

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        readFile(event.dataTransfer.files[0]);
      }}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-sm)] border border-dashed px-3 py-2"
      style={{
        borderColor: dragging ? 'var(--accent)' : 'var(--border-strong)',
        background: dragging ? 'var(--surface-2)' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold disabled:opacity-60"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        <IconUpload />
        {loading ? 'Carregando…' : 'Carregar snapshot'}
      </button>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        ou arraste um .json aqui
      </span>
      <button
        type="button"
        onClick={onReset}
        className="text-xs underline underline-offset-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        usar dados de exemplo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Escolher arquivo de snapshot .json"
        onChange={(event) => {
          readFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
}
