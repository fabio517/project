/**
 * Ícones inline (SVG, currentColor). Existem para que status e destaques nunca
 * dependam só de cor: todo aviso é ícone + rótulo.
 */
interface IconProps {
  className?: string;
}

const base = 'inline-block shrink-0';

export function IconPlus({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={`${base} ${className}`}>
      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconMinus({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={`${base} ${className}`}>
      <path d="M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={`${base} ${className}`}>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconAlert({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={`${base} ${className}`}>
      <path
        d="M8 1.8 15 14.2H1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 6v3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11.9" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function IconBlocked({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={`${base} ${className}`}>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 12 12 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconUpload({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={`${base} ${className}`}>
      <path
        d="M8 11V2.5M4.8 5.6 8 2.4l3.2 3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 10.5v2.2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSun({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={`${base} ${className}`}>
      <circle cx="8" cy="8" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 1.4v1.6M8 13v1.6M1.4 8H3M13 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMoon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={`${base} ${className}`}>
      <path
        d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a5.8 5.8 0 1 0 7 7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSearch({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={`${base} ${className}`}>
      <circle cx="7.2" cy="7.2" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.6 10.6 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconCart({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={`${base} ${className}`}>
      <path
        d="M1.6 2.2h1.9l1.6 7.3h6.6l1.5-5.2H4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.1" cy="12.6" r="1.2" fill="currentColor" />
      <circle cx="11.2" cy="12.6" r="1.2" fill="currentColor" />
    </svg>
  );
}
