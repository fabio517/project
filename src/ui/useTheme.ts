/**
 * Tema claro/escuro: a escolha do usuário vai para o localStorage e é aplicada
 * como `data-theme` no <html> — os tokens já definem os dois escopos. Sem
 * escolha salva, o sistema manda (o media query dos tokens assume).
 */
import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark';

const STORAGE_KEY = 'feira:v1:theme';

function prefersDark(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch {
    return false;
  }
}

function readStored(): ThemeChoice | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    // Aba privada / storage bloqueado: o tema só não persiste.
    return null;
  }
}

export interface ThemeApi {
  theme: ThemeChoice;
  toggle(): void;
}

export function useTheme(): ThemeApi {
  const [theme, setTheme] = useState<ThemeChoice>(() => readStored() ?? (prefersDark() ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, theme);
    } catch {
      /* silencioso: o tema vale para a sessão */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')), []);

  return { theme, toggle };
}
