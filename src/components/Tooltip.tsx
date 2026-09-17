/**
 * Tooltip de hover/foco para barras e células. Renderiza em portal com
 * `position: fixed` para não ser cortado pelo contêiner que rola, e o alvo
 * (o wrapper) é sempre maior que a marca colorida.
 */
import { useCallback, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Anchor {
  x: number;
  y: number;
  below: boolean;
}

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}

const HALF_WIDTH = 130;

export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const id = useId();

  const place = useCallback((x: number, y: number) => {
    const width = globalThis.innerWidth || 360;
    const clampedX = Math.min(Math.max(x, HALF_WIDTH + 8), Math.max(width - HALF_WIDTH - 8, HALF_WIDTH + 8));
    setAnchor({ x: clampedX, y, below: y < 96 });
  }, []);

  const hide = useCallback(() => setAnchor(null), []);

  const onPointer = useCallback(
    (event: React.PointerEvent) => place(event.clientX, event.clientY),
    [place],
  );

  const onFocus = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      place(rect.left + rect.width / 2, rect.top);
    },
    [place],
  );

  return (
    <div
      className={className}
      aria-describedby={anchor ? id : undefined}
      onPointerEnter={onPointer}
      onPointerMove={onPointer}
      onPointerLeave={hide}
      onPointerCancel={hide}
      onFocusCapture={onFocus}
      onBlurCapture={hide}
    >
      {children}
      {anchor
        ? createPortal(
            <div
              id={id}
              role="tooltip"
              className="pointer-events-none fixed z-50 max-w-[260px] rounded-[8px] px-3 py-2 text-xs leading-snug shadow-[var(--shadow-2)]"
              style={{
                left: anchor.x,
                top: anchor.below ? anchor.y + 22 : anchor.y - 12,
                transform: anchor.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
              }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
