/** Estado inicial: explica o app em vez de mostrar uma tela em branco. */
import { IconCart, IconCheck, IconPlus, IconSearch } from '../ui/icons';

const STEPS = [
  {
    icon: <IconSearch className="h-4 w-4" />,
    title: 'Busque no catálogo',
    text: 'Os produtos estão agrupados por categoria, com o melhor preço por quilo, litro ou unidade já calculado.',
  },
  {
    icon: <IconPlus className="h-4 w-4" />,
    title: 'Monte a lista no +',
    text: 'Cada item entra com a quantidade que você quiser; a lista fica salva neste navegador.',
  },
  {
    icon: <IconCheck className="h-4 w-4" />,
    title: 'Veja onde sai mais barato',
    text: 'Comparamos a lista inteira em todos os mercados, com taxa de entrega, pedido mínimo e o plano de dividir a compra.',
  },
];

export function EmptyList() {
  return (
    <div
      className="rounded-[var(--radius)] border p-6 text-center"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      <span
        className="inline-flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
      >
        <IconCart className="h-6 w-6" />
      </span>
      <h2 className="mt-3 text-lg font-bold">Sua lista está vazia</h2>
      <p className="mx-auto mt-1 max-w-prose text-sm" style={{ color: 'var(--text-secondary)' }}>
        A Feira Inteligente compara a sua lista de compras em todos os mercados do snapshot e mostra, em
        dinheiro, onde ela sai mais barata — inclusive se vale a pena dividir a compra em duas paradas.
      </p>

      <ol className="mt-5 grid gap-3 text-left sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-[var(--radius-sm)] border p-3"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                {index + 1}
              </span>
              <span style={{ color: 'var(--text-secondary)' }} className="inline-flex">
                {step.icon}
              </span>
              {step.title}
            </p>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
