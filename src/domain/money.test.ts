import { describe, expect, it } from 'vitest';
import { formatAmount, formatBRL, money, parseBRL } from './money';

describe('formatBRL', () => {
  it('formata centavos em reais pt-BR', () => {
    expect(formatBRL(793)).toBe('R$ 7,93');
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(-793)).toBe('-R$ 7,93');
  });

  it('não vaza espaço não-quebrável do ICU', () => {
    expect(formatBRL(793)).not.toContain(' ');
    expect(formatBRL(793).split(' ')).toEqual(['R$', '7,93']);
  });

  it('formatAmount omite o símbolo', () => {
    expect(formatAmount(793)).toBe('7,93');
    expect(formatAmount(123456)).toBe('1.234,56');
  });
});

describe('parseBRL', () => {
  it('aceita os formatos usuais', () => {
    expect(parseBRL('R$ 1.234,56')).toBe(123456);
    expect(parseBRL('1234,56')).toBe(123456);
    expect(parseBRL('R$ 7,93')).toBe(793);
    expect(parseBRL('7,93')).toBe(793);
    expect(parseBRL('1,5')).toBe(150);
    expect(parseBRL('10')).toBe(1000);
    expect(parseBRL('R$1.234.567,89')).toBe(123456789);
  });

  it('resolve a ambiguidade ponto-vs-vírgula', () => {
    expect(parseBRL('12.90')).toBe(1290); // ponto decimal
    expect(parseBRL('1.234')).toBe(123400); // ponto de milhar
    expect(parseBRL('1.234,56')).toBe(123456);
    expect(parseBRL('1.234.567')).toBe(123456700);
    expect(parseBRL('12.9')).toBe(1290);
  });

  it('aceita número em reais', () => {
    expect(parseBRL(12.9)).toBe(1290);
    expect(parseBRL(7.99)).toBe(799);
    expect(parseBRL(0.1 + 0.2)).toBe(30);
    expect(parseBRL(0)).toBe(0);
  });

  it('arredonda frações com mais de dois dígitos', () => {
    expect(parseBRL('0,999')).toBe(100);
    expect(parseBRL('2,564')).toBe(256);
  });

  it('lança em lixo', () => {
    for (const bad of ['', '   ', 'abc', 'R$', 'R$ abc', '12,,5', '1.2.3', '12reais', ',50', '7,']) {
      expect(() => parseBRL(bad)).toThrow(Error);
    }
    expect(() => parseBRL(Number.NaN)).toThrow(Error);
    expect(() => parseBRL(Number.POSITIVE_INFINITY)).toThrow(Error);
  });

  it('faz round-trip com formatBRL', () => {
    expect(formatBRL(parseBRL('R$ 1.234,56'))).toBe('R$ 1.234,56');
    expect(parseBRL(formatBRL(4599))).toBe(4599);
  });

  it('expõe o objeto MoneyApi', () => {
    expect(money.formatBRL(793)).toBe('R$ 7,93');
    expect(money.parseBRL('R$ 7,93')).toBe(793);
    expect(money.formatAmount(793)).toBe('7,93');
  });
});
