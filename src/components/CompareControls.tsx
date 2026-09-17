/** Controles da comparação, numa única linha acima dos resultados. */
import type { CompareOptionsApi } from '../state/useShoppingList';

const STOP_CHOICES = [1, 2, 3, 4];

interface CompareControlsProps {
  api: CompareOptionsApi;
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange(value: boolean): void;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm whitespace-nowrap">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded-[4px]"
        style={{ accentColor: 'var(--accent)' }}
      />
      <span>{children}</span>
    </label>
  );
}

export function CompareControls({ api }: CompareControlsProps) {
  const { options } = api;
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[var(--radius)] border px-4 py-3"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      <Toggle checked={options.includeDelivery} onChange={api.setIncludeDelivery}>
        Incluir entrega
      </Toggle>
      <Toggle checked={options.onlyAvailable} onChange={api.setOnlyAvailable}>
        Só disponíveis
      </Toggle>

      <div className="flex items-center gap-2 text-sm">
        <span id="max-stops-label" className="whitespace-nowrap">
          Máximo de paradas
        </span>
        <div
          role="group"
          aria-labelledby="max-stops-label"
          className="inline-flex overflow-hidden rounded-[var(--radius-sm)] border"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          {STOP_CHOICES.map((value) => {
            const active = options.maxStops === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                aria-label={`Máximo de ${value} parada${value === 1 ? '' : 's'}`}
                onClick={() => api.setMaxStops(value)}
                className="tabular h-9 w-9 text-sm font-semibold"
                style={{
                  background: active ? 'var(--accent)' : 'var(--surface-1)',
                  color: active ? 'var(--accent-ink)' : 'var(--text-primary)',
                }}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
