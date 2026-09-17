/**
 * Wrapper de `localStorage` à prova de ambiente hostil: modo privado, storage
 * bloqueado por política, cota estourada, SSR e JSON corrompido. NADA aqui
 * pode lançar — a lista de compras nunca derruba a UI.
 *
 * Quando o storage real não está disponível, um Map em memória assume: a
 * sessão continua funcionando, só não sobrevive a um reload.
 */

/** Chaves versionadas: mudou o formato, sobe o `v` e o dado velho é ignorado. */
export const STORAGE_KEYS = {
  list: 'feira:v1:list',
  options: 'feira:v1:options',
} as const;

const memory = new Map<string, string>();

let resolved = false;
let backend: Storage | null = null;

function getBackend(): Storage | null {
  if (resolved) return backend;
  resolved = true;
  try {
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    if (!candidate) return (backend = null);
    // Safari em aba privada deixa LER e estoura no `setItem`; só um teste de
    // escrita real revela isso antes de a UI depender do storage.
    const probe = 'feira:v1:__probe__';
    candidate.setItem(probe, '1');
    candidate.removeItem(probe);
    backend = candidate;
  } catch {
    backend = null;
  }
  return backend;
}

export function readRaw(key: string): string | null {
  const store = getBackend();
  if (store) {
    try {
      const value = store.getItem(key);
      if (value !== null) return value;
    } catch {
      /* cai para a memória */
    }
  }
  return memory.get(key) ?? null;
}

export function writeRaw(key: string, value: string): void {
  // A memória é sempre espelhada: se o `setItem` falhar (cota), a sessão atual
  // ainda enxerga o valor novo.
  memory.set(key, value);
  const store = getBackend();
  if (!store) return;
  try {
    store.setItem(key, value);
  } catch {
    /* silencioso de propósito */
  }
}

export function removeKey(key: string): void {
  memory.delete(key);
  const store = getBackend();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    /* silencioso de propósito */
  }
}

/**
 * Lê e valida. `validate` devolve o valor saneado ou `null`; qualquer coisa
 * fora do formato (JSON quebrado, tipo errado, dado de uma versão antiga) é
 * descartada e a chave some, para não voltar a estourar no próximo boot.
 */
export function readJson<T>(key: string, validate: (input: unknown) => T | null): T | null {
  const raw = readRaw(key);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeKey(key);
    return null;
  }
  try {
    const value = validate(parsed);
    if (value === null) removeKey(key);
    return value;
  } catch {
    removeKey(key);
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    /* valor com referência cíclica: melhor não persistir do que quebrar */
  }
}

export const storage = { readRaw, writeRaw, removeKey, readJson, writeJson, STORAGE_KEYS };
