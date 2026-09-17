import { describe, expect, it } from 'vitest';
import { formatUnitPrice, parsePackage, parseUnitToken, unitPriceOf, units } from './units';

describe('parsePackage', () => {
  const cases: Array<[string, { size: number; unit: string; count: number }]> = [
    ['Arroz Tio João Tipo 1 5kg', { size: 5, unit: 'kg', count: 1 }],
    ['Leite Italac 1,5 L', { size: 1.5, unit: 'L', count: 1 }],
    ['Refrigerante 350ml', { size: 0.35, unit: 'L', count: 1 }],
    ['Pack 6x350ml', { size: 0.35, unit: 'L', count: 6 }],
    ['Café 500 g', { size: 0.5, unit: 'kg', count: 1 }],
    ['Ovos Brancos 12 unidades', { size: 12, unit: 'un', count: 1 }],
    ['Sabão em pó 1,6Kg', { size: 1.6, unit: 'kg', count: 1 }],
    ['Detergente 500 mL', { size: 0.5, unit: 'L', count: 1 }],
    ['Açúcar 2 kg', { size: 2, unit: 'kg', count: 1 }],
    ['Fardo 12 x 1L', { size: 1, unit: 'L', count: 12 }],
    ['Bandeja com 20 un', { size: 20, unit: 'un', count: 1 }],
  ];

  for (const [raw, expected] of cases) {
    it(`entende "${raw}"`, () => {
      expect(parsePackage(raw)).toEqual(expected);
    });
  }

  it('cobre variações de escrita', () => {
    expect(parsePackage('Ovos Caipira 1 dz')).toEqual({ size: 12, unit: 'un', count: 1 });
    expect(parsePackage('Cerveja 269ml Caixa com 12')).toEqual({ size: 0.269, unit: 'L', count: 12 });
    expect(parsePackage('Água Mineral 500ml 12 un')).toEqual({ size: 0.5, unit: 'L', count: 12 });
    expect(parsePackage('Leite Integral 1 litro')).toEqual({ size: 1, unit: 'L', count: 1 });
    expect(parsePackage('Refrigerante 2 LITROS')).toEqual({ size: 2, unit: 'L', count: 1 });
    expect(parsePackage('Papel Higiênico Neve 12 rolos')).toEqual({ size: 12, unit: 'un', count: 1 });
  });

  it('não confunde número solto nem palavra que começa com unidade', () => {
    expect(parsePackage('Arroz Tipo 1 5kg')).toEqual({ size: 5, unit: 'kg', count: 1 });
    expect(parsePackage('Cerveja 350ml Light')).toEqual({ size: 0.35, unit: 'L', count: 1 });
    expect(parsePackage('Chocolate 90g Gold')).toEqual({ size: 0.09, unit: 'kg', count: 1 });
  });

  it('devolve null quando não há embalagem no nome', () => {
    expect(parsePackage('Sabonete Dove')).toBeNull();
    expect(parsePackage('')).toBeNull();
    expect(parsePackage('   ')).toBeNull();
  });

  it('parseUnitToken normaliza os campos estruturados', () => {
    expect(parseUnitToken('Kg')).toEqual({ unit: 'kg', scale: 1 });
    expect(parseUnitToken('mL')).toEqual({ unit: 'L', scale: 0.001 });
    expect(parseUnitToken('unidade')).toEqual({ unit: 'un', scale: 1 });
    expect(parseUnitToken('caixa')).toBeNull();
  });
});

describe('unitPriceOf', () => {
  it('normaliza para a unidade base', () => {
    expect(unitPriceOf(1290, 5, 'kg')).toBe(258);
    expect(unitPriceOf(549, 1, 'L')).toBe(549);
    expect(unitPriceOf(1899, 12, 'un')).toBe(158);
  });

  it('multiplica o tamanho pelo count do pack', () => {
    expect(unitPriceOf(1290, 0.35, 'L', 6)).toBe(614); // 1290 / 2,1 L
    expect(unitPriceOf(4800, 1, 'L', 12)).toBe(400);
    expect(unitPriceOf(4800, 1, 'L', 1)).toBe(4800);
  });

  it('arredonda para centavo inteiro', () => {
    expect(unitPriceOf(1000, 3, 'kg')).toBe(333);
    expect(unitPriceOf(1000, 0.7, 'kg')).toBe(1429);
  });

  it('protege contra divisão por zero e lixo', () => {
    expect(unitPriceOf(1290, 0, 'kg')).toBe(0);
    expect(unitPriceOf(1290, -5, 'kg')).toBe(0);
    expect(unitPriceOf(1290, 5, 'kg', 0)).toBe(258);
    expect(unitPriceOf(1290, Number.NaN, 'kg')).toBe(0);
  });
});

describe('formatUnitPrice', () => {
  it('cola preço e unidade', () => {
    expect(formatUnitPrice(258, 'kg')).toBe('R$ 2,58/kg');
    expect(formatUnitPrice(549, 'L')).toBe('R$ 5,49/L');
    expect(formatUnitPrice(158, 'un')).toBe('R$ 1,58/un');
  });

  it('expõe o objeto UnitsApi', () => {
    expect(units.parsePackage('Arroz 5kg')).toEqual({ size: 5, unit: 'kg', count: 1 });
    expect(units.unitPriceOf(1290, 5, 'kg')).toBe(258);
    expect(units.formatUnitPrice(258, 'kg')).toBe('R$ 2,58/kg');
  });
});
