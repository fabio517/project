/**
 * Lista de compras e opções de comparação — estado local persistido em
 * `localStorage`. React puro (useState/useCallback/useMemo), sem biblioteca.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompareOptions, ListItem } from '../domain/types';
import type { ShoppingListApi } from '../lib/contracts';
import { STORAGE_KEYS, readJson, writeJson } from './storage';

export const DEFAULT_COMPARE_OPTIONS: CompareOptions = {
  includeDelivery: true,
  onlyAvailable: true,
  maxStops: 2,
};

/** Quantidade é sempre inteiro >= 1. */
function normalizeQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.trunc(quantity));
}

/** O storage pode estar corrompido ou vir de uma versão antiga: valida item a item. */
function parseList(input: unknown): ListItem[] | null {
  if (!Array.isArray(input)) return null;
  const items: ListItem[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const { productId, quantity } = raw as { productId?: unknown; quantity?: unknown };
    if (typeof productId !== 'string' || productId === '' || seen.has(productId)) continue;
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 1) continue;
    seen.add(productId);
    items.push({ productId, quantity: Math.trunc(quantity) });
  }
  return items;
}

function parseOptions(input: unknown): CompareOptions | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<Record<keyof CompareOptions, unknown>>;
  return {
    includeDelivery:
      typeof raw.includeDelivery === 'boolean'
        ? raw.includeDelivery
        : DEFAULT_COMPARE_OPTIONS.includeDelivery,
    onlyAvailable:
      typeof raw.onlyAvailable === 'boolean'
        ? raw.onlyAvailable
        : DEFAULT_COMPARE_OPTIONS.onlyAvailable,
    maxStops:
      typeof raw.maxStops === 'number' && Number.isFinite(raw.maxStops)
        ? Math.max(1, Math.trunc(raw.maxStops))
        : DEFAULT_COMPARE_OPTIONS.maxStops,
  };
}

// ------------------------------------------------------------------- lista

export function useShoppingList(): ShoppingListApi {
  // Reidratação preguiçosa: o storage é lido uma vez, não a cada render.
  const [items, setItems] = useState<ListItem[]>(() => readJson(STORAGE_KEYS.list, parseList) ?? []);

  useEffect(() => {
    writeJson(STORAGE_KEYS.list, items);
  }, [items]);

  /** `add` é cumulativo: clicar duas vezes em "+" soma, não sobrescreve. */
  const add = useCallback((productId: string, quantity = 1) => {
    if (!productId) return;
    const delta = normalizeQuantity(quantity);
    setItems((prev) => {
      const index = prev.findIndex((item) => item.productId === productId);
      if (index === -1) return [...prev, { productId, quantity: delta }];
      const next = prev.slice();
      next[index] = { productId, quantity: next[index].quantity + delta };
      return next;
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (!productId) return;
    setItems((prev) => {
      // Zero ou menos significa "tirei da lista" — é o mesmo gesto de remover.
      if (!Number.isFinite(quantity) || Math.trunc(quantity) < 1) {
        return prev.filter((item) => item.productId !== productId);
      }
      const value = normalizeQuantity(quantity);
      const index = prev.findIndex((item) => item.productId === productId);
      if (index === -1) return [...prev, { productId, quantity: value }];
      if (prev[index].quantity === value) return prev;
      const next = prev.slice();
      next[index] = { productId, quantity: value };
      return next;
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const has = useCallback(
    (productId: string) => items.some((item) => item.productId === productId),
    [items],
  );

  const quantityOf = useCallback(
    (productId: string) => items.find((item) => item.productId === productId)?.quantity ?? 0,
    [items],
  );

  const totalUnits = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  return useMemo<ShoppingListApi>(
    () => ({ items, add, remove, setQuantity, clear, has, quantityOf, totalUnits }),
    [items, add, remove, setQuantity, clear, has, quantityOf, totalUnits],
  );
}

// ---------------------------------------------------------------- opções

export interface CompareOptionsApi {
  options: CompareOptions;
  setIncludeDelivery(value: boolean): void;
  setOnlyAvailable(value: boolean): void;
  /** Clampeado em >= 1 e inteiro. */
  setMaxStops(value: number): void;
  update(patch: Partial<CompareOptions>): void;
  reset(): void;
}

export function useCompareOptions(): CompareOptionsApi {
  const [options, setOptions] = useState<CompareOptions>(
    () => readJson(STORAGE_KEYS.options, parseOptions) ?? { ...DEFAULT_COMPARE_OPTIONS },
  );

  useEffect(() => {
    writeJson(STORAGE_KEYS.options, options);
  }, [options]);

  const update = useCallback((patch: Partial<CompareOptions>) => {
    setOptions((prev) => parseOptions({ ...prev, ...patch }) ?? prev);
  }, []);

  const setIncludeDelivery = useCallback(
    (value: boolean) => update({ includeDelivery: value }),
    [update],
  );
  const setOnlyAvailable = useCallback(
    (value: boolean) => update({ onlyAvailable: value }),
    [update],
  );
  const setMaxStops = useCallback((value: number) => update({ maxStops: value }), [update]);
  const reset = useCallback(() => setOptions({ ...DEFAULT_COMPARE_OPTIONS }), []);

  return useMemo<CompareOptionsApi>(
    () => ({ options, setIncludeDelivery, setOnlyAvailable, setMaxStops, update, reset }),
    [options, setIncludeDelivery, setOnlyAvailable, setMaxStops, update, reset],
  );
}
