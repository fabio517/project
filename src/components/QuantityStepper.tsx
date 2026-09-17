/** Stepper +/− da lista. Botões de verdade, com aria-label descritivo. */
import { IconMinus, IconPlus } from '../ui/icons';

interface QuantityStepperProps {
  /** Nome do produto — entra no aria-label de cada botão. */
  label: string;
  quantity: number;
  onChange(quantity: number): void;
}

const buttonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border transition-colors disabled:opacity-40';

export function QuantityStepper({ label, quantity, onChange }: QuantityStepperProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] p-1"
      style={{ background: 'var(--surface-2)' }}
    >
      <button
        type="button"
        className={buttonClass}
        style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', background: 'var(--surface-1)' }}
        aria-label={`Remover uma unidade de ${label}`}
        disabled={quantity <= 0}
        onClick={() => onChange(quantity - 1)}
      >
        <IconMinus />
      </button>
      <span className="tabular w-7 text-center text-sm font-semibold" aria-hidden="true">
        {quantity}
      </span>
      <span className="sr-only">{`${quantity} na lista`}</span>
      <button
        type="button"
        className={buttonClass}
        style={{ borderColor: 'transparent', color: 'var(--accent-ink)', background: 'var(--accent)' }}
        aria-label={`Adicionar uma unidade de ${label}`}
        onClick={() => onChange(quantity + 1)}
      >
        <IconPlus />
      </button>
    </div>
  );
}
