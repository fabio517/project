import { describe, it, expect } from 'vitest';
import { loadSeedCatalog } from './data/loader';
import { compare } from './lib/optimizer';
import { formatBRL } from './domain/money';

describe('ponta a ponta com o seed real', () => {
  const catalog = loadSeedCatalog();

  it('constroi o catalogo inteiro', () => {
    expect(catalog.markets).toHaveLength(8);
    expect(catalog.products).toHaveLength(40);
    expect(catalog.offers.length).toBeGreaterThan(250);
  });

  it('normaliza precos por unidade em faixas plausiveis', () => {
    const arroz = catalog.offersByProduct.get('arroz-branco')!;
    for (const o of arroz) {
      expect(o.unitPrice).toBeGreaterThan(300);   // > R$ 3,00/kg
      expect(o.unitPrice).toBeLessThan(1000);     // < R$ 10,00/kg
    }
    const cafe = catalog.offersByProduct.get('cafe-moido')!;
    for (const o of cafe) {
      expect(o.unitPrice).toBeGreaterThan(3000);
      expect(o.unitPrice).toBeLessThan(6000);
    }
  });

  it('ordena ofertas por preco unitario crescente', () => {
    for (const offs of catalog.offersByProduct.values()) {
      const ups = offs.map((o) => o.unitPrice);
      expect([...ups].sort((a, b) => a - b)).toEqual(ups);
    }
  });

  it('compara uma lista de casa de verdade', () => {
    const list = ['arroz-branco','feijao-carioca','leite-integral','cafe-moido','oleo-soja',
      'ovos','banana-prata','tomate','peito-frango','detergente','papel-higienico','sabao-po']
      .map((productId) => ({ productId, quantity: 2 }));

    const r = compare(catalog, list, { includeDelivery: true, onlyAvailable: true, maxStops: 2 });

    expect(r.bestSingle).not.toBeNull();
    expect(r.quotes.length).toBeGreaterThan(0);
    // o melhor mercado nao pode ter cobertura pior que qualquer outro
    const maxCov = Math.max(...r.quotes.map((q) => q.foundCount));
    expect(r.bestSingle!.foundCount).toBe(maxCov);
    // totais coerentes
    for (const q of r.quotes) {
      const soma = q.lines.reduce((a, l) => a + l.lineTotal, 0);
      expect(q.subtotal).toBe(soma);
      expect(q.total).toBe(q.subtotal + q.deliveryFee);
      expect(Number.isInteger(q.total)).toBe(true);
    }
    expect(r.split).not.toBeNull();
    expect(r.savingsFromSplit).toBe(r.bestSingle!.total - r.split!.total);

    console.log('\n  melhor mercado:', r.bestSingle!.market.name, formatBRL(r.bestSingle!.total),
      `(${r.bestSingle!.foundCount}/${list.length} itens)`);
    console.log('  spread entre mercados:', formatBRL(r.spread));
    console.log('  plano dividido:', r.split!.stops.map((s) => s.market.name).join(' + '),
      formatBRL(r.split!.total), '| economia:', formatBRL(r.savingsFromSplit));
    r.quotes.slice(0, 8).forEach((q) =>
      console.log(`   ${q.market.name.padEnd(20)} ${formatBRL(q.total).padStart(11)}  ${q.foundCount}/${list.length}${q.meetsMinOrder ? '' : '  [abaixo do minimo]'}`));
  });
});
