/**
 * Normalização de embalagem: transforma "Pack 6x350ml" em uma medida
 * comparável (0,35 L × 6) e deriva preço por kg / L / un — a métrica de
 * custo-benefício do app.
 */
import type { Centavos, UnitKind } from './types';
import type { ParsedPackage, UnitsApi } from '../lib/contracts';
import { formatBRL } from './money';

/** minúsculas, sem acento, "×" -> "x", espaços colapsados. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[×✕]/g, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

interface UnitToken {
  unit: UnitKind;
  /** Multiplicador até a unidade base: g -> 0.001 kg, dz -> 12 un. */
  scale: number;
}

const TOKENS: Record<string, UnitToken> = {
  kg: { unit: 'kg', scale: 1 },
  kgs: { unit: 'kg', scale: 1 },
  quilo: { unit: 'kg', scale: 1 },
  quilos: { unit: 'kg', scale: 1 },
  g: { unit: 'kg', scale: 0.001 },
  gr: { unit: 'kg', scale: 0.001 },
  grs: { unit: 'kg', scale: 0.001 },
  grama: { unit: 'kg', scale: 0.001 },
  gramas: { unit: 'kg', scale: 0.001 },
  mg: { unit: 'kg', scale: 0.000001 },
  l: { unit: 'L', scale: 1 },
  lt: { unit: 'L', scale: 1 },
  lts: { unit: 'L', scale: 1 },
  litro: { unit: 'L', scale: 1 },
  litros: { unit: 'L', scale: 1 },
  ml: { unit: 'L', scale: 0.001 },
  mls: { unit: 'L', scale: 0.001 },
  mililitro: { unit: 'L', scale: 0.001 },
  mililitros: { unit: 'L', scale: 0.001 },
  un: { unit: 'un', scale: 1 },
  uns: { unit: 'un', scale: 1 },
  und: { unit: 'un', scale: 1 },
  unds: { unit: 'un', scale: 1 },
  unid: { unit: 'un', scale: 1 },
  unidade: { unit: 'un', scale: 1 },
  unidades: { unit: 'un', scale: 1 },
  pc: { unit: 'un', scale: 1 },
  pcs: { unit: 'un', scale: 1 },
  rolo: { unit: 'un', scale: 1 },
  rolos: { unit: 'un', scale: 1 },
  folha: { unit: 'un', scale: 1 },
  folhas: { unit: 'un', scale: 1 },
  dz: { unit: 'un', scale: 12 },
  duzia: { unit: 'un', scale: 12 },
  duzias: { unit: 'un', scale: 12 },
};

// Alternativas longas primeiro para "unidades" não casar como "un" e "ml" não
// casar como "l"; `(?![a-z])` evita casar o "l" de "light" ou o "g" de "gold".
const UNIT_ALT = Object.keys(TOKENS)
  .sort((a, b) => b.length - a.length)
  .join('|');
const NUM = String.raw`\d+(?:[.,]\d+)?`;
const UNIT_END = String.raw`(?![a-z])`;

const PACK_RE = new RegExp(String.raw`(\d+)\s*x\s*(${NUM})\s*(${UNIT_ALT})${UNIT_END}`);
const PACK_REVERSED_RE = new RegExp(String.raw`(${NUM})\s*(${UNIT_ALT})${UNIT_END}\s*x\s*(\d+)(?![\d.,])`);
const SIZE_RE = new RegExp(String.raw`(${NUM})\s*(${UNIT_ALT})${UNIT_END}`, 'g');
// "caixa com 12", "fardo 6", "leve 3" — só vira `count` quando já existe um
// tamanho em peso/volume, senão "bandeja com 20 un" viraria 20 pacotes de 20.
const COUNT_HINT_RE = /(?:pack|fardo|caixa|cx|embalagem|leve|c\/|com)\s*(\d{1,3})(?![\d.,])/;

/** "1,5" -> 1.5 e "1.000" -> 1000 (milhar); ponto solto é decimal. */
function toNumber(raw: string): number {
  const text = /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw.replace(',', '.');
  return Number(text);
}

/** Corta o ruído de float de 350 * 0.001. */
const tidy = (value: number): number => Math.round(value * 1e6) / 1e6;

/** "Kg", "ml", "unidade" -> unidade base + escala. Usado no fallback estruturado. */
export function parseUnitToken(raw: string): UnitToken | null {
  const key = normalizeText(raw).replace(/[^a-z]/g, '');
  return TOKENS[key] ?? null;
}

interface Measure {
  size: number;
  unit: UnitKind;
}

function measureOf(value: string, token: string): Measure | null {
  const spec = TOKENS[token];
  const amount = toNumber(value);
  if (!spec || !Number.isFinite(amount) || amount <= 0) return null;
  return { size: tidy(amount * spec.scale), unit: spec.unit };
}

export function parsePackage(rawName: string): ParsedPackage | null {
  if (typeof rawName !== 'string' || rawName.trim() === '') return null;
  const name = normalizeText(rawName);

  const pack = PACK_RE.exec(name);
  if (pack) {
    const measure = measureOf(pack[2], pack[3]);
    const count = Number(pack[1]);
    if (measure && Number.isFinite(count) && count >= 1) {
      return { size: measure.size, unit: measure.unit, count: Math.round(count) };
    }
  }

  const reversed = PACK_REVERSED_RE.exec(name);
  if (reversed) {
    const measure = measureOf(reversed[1], reversed[2]);
    const count = Number(reversed[3]);
    if (measure && Number.isFinite(count) && count >= 1) {
      return { size: measure.size, unit: measure.unit, count: Math.round(count) };
    }
  }

  const measures: Measure[] = [];
  for (const match of name.matchAll(SIZE_RE)) {
    const measure = measureOf(match[1], match[2]);
    if (measure) measures.push(measure);
  }

  const sized = measures.filter((m) => m.unit !== 'un');
  const counted = measures.filter((m) => m.unit === 'un');

  if (sized.length > 0) {
    // O tamanho costuma ser a última medida do nome ("Arroz Tipo 1 5kg").
    const size = sized[sized.length - 1];
    let count = 1;
    if (counted.length > 0) count = Math.round(counted[counted.length - 1].size);
    else {
      const hint = COUNT_HINT_RE.exec(name);
      if (hint) count = Number(hint[1]);
    }
    return { size: size.size, unit: size.unit, count: Number.isFinite(count) && count >= 1 ? count : 1 };
  }

  if (counted.length > 0) {
    const last = counted[counted.length - 1];
    return { size: last.size, unit: 'un', count: 1 };
  }

  return null;
}

export function unitPriceOf(price: Centavos, size: number, _unit: UnitKind, count = 1): Centavos {
  const packs = Number.isFinite(count) && count > 0 ? count : 1;
  const total = size * packs;
  if (!Number.isFinite(price) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round(price / total);
}

export function formatUnitPrice(unitPrice: Centavos, unit: UnitKind): string {
  return `${formatBRL(unitPrice)}/${unit}`;
}

export const units: UnitsApi = { parsePackage, unitPriceOf, formatUnitPrice };
