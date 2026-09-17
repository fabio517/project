/**
 * Dinheiro sempre em centavos inteiros (`Centavos`). Nenhum float de moeda
 * atravessa a fronteira deste módulo: entra texto/reais, sai inteiro.
 */
import type { Centavos } from './types';
import type { MoneyApi } from '../lib/contracts';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const AMOUNT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// O ICU separa "R$" do número com espaço não-quebrável (U+00A0) ou estreito
// (U+202F); trocamos por espaço comum para o texto ser estável em teste e em DOM.
const withPlainSpaces = (text: string): string => text.replace(/[  ]/g, ' ');

const toReais = (cents: Centavos): number => (Number.isFinite(cents) ? Math.round(cents) : 0) / 100;

export function formatBRL(cents: Centavos): string {
  return withPlainSpaces(BRL.format(toReais(cents)));
}

export function formatAmount(cents: Centavos): string {
  return withPlainSpaces(AMOUNT.format(toReais(cents)));
}

const invalid = (input: unknown): Error =>
  new Error(`valor monetário inválido: ${JSON.stringify(input)}`);

/**
 * Aceita "R$ 1.234,56", "1234,56", "12.90" e números em reais (12.9 -> 1290).
 *
 * O caso ambíguo é o ponto sozinho: em "1.234" ele é separador de milhar
 * (1234 reais) e em "12.90" é decimal (12 reais e 90 centavos). Desempate:
 * um único ponto seguido de exatamente 3 dígitos é milhar; caso contrário é
 * decimal. Com os dois separadores presentes, vence o último ("1.234,56").
 */
export function parseBRL(input: string | number): Centavos {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw invalid(input);
    return Math.round(input * 100);
  }
  if (typeof input !== 'string') throw invalid(input);

  const cleaned = input
    .trim()
    .replace(/^R\$/i, '')
    .replace(/[\s  ]/g, '');

  if (!/^-?\d[\d.,]*$/.test(cleaned) || /[.,]{2,}/.test(cleaned) || /[.,]$/.test(cleaned)) {
    throw invalid(input);
  }

  const negative = cleaned.startsWith('-');
  const digits = negative ? cleaned.slice(1) : cleaned;

  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');
  const commas = (digits.match(/,/g) ?? []).length;
  const dots = (digits.match(/\./g) ?? []).length;

  let decimalAt = -1;
  if (lastComma >= 0 && lastDot >= 0) decimalAt = Math.max(lastComma, lastDot);
  else if (lastComma >= 0) decimalAt = commas === 1 ? lastComma : -1;
  else if (lastDot >= 0) {
    const afterDot = digits.length - lastDot - 1;
    decimalAt = dots === 1 && afterDot !== 3 ? lastDot : -1;
  }

  const intPart = decimalAt >= 0 ? digits.slice(0, decimalAt) : digits;
  const fracPart = decimalAt >= 0 ? digits.slice(decimalAt + 1) : '';

  // O que sobrou de separador na parte inteira só pode ser milhar bem formado.
  const groups = intPart.split(/[.,]/);
  if (groups.length > 1) {
    const wellFormed =
      /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every((g) => /^\d{3}$/.test(g));
    if (!wellFormed) throw invalid(input);
  }

  const wholeDigits = groups.join('');
  if (!/^\d+$/.test(wholeDigits) || (fracPart !== '' && !/^\d+$/.test(fracPart))) {
    throw invalid(input);
  }

  const wholeCents = Number(wholeDigits) * 100;
  // Arredonda a fração inteira sem passar o valor cheio por float (0,999 -> 100).
  const fracCents = fracPart === '' ? 0 : Math.round(Number(`0.${fracPart}`) * 100);
  const cents = wholeCents + fracCents;
  if (!Number.isFinite(cents)) throw invalid(input);

  return negative ? -cents : cents;
}

export const money: MoneyApi = { formatBRL, formatAmount, parseBRL };
