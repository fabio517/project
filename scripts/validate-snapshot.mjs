#!/usr/bin/env node
/**
 * Árbitro de esquema: valida qualquer snapshot (seed ou raspado) contra o
 * contrato em src/domain/types.ts.  Uso: node scripts/validate-snapshot.mjs <arquivo.json>
 */
import { readFileSync } from 'node:fs';

const UNITS = new Set(['kg', 'L', 'un']);
const errors = [];
const warn = [];
const err = (m) => errors.push(m);

const file = process.argv[2];
if (!file) { console.error('uso: node scripts/validate-snapshot.mjs <arquivo.json>'); process.exit(2); }

let snap;
try { snap = JSON.parse(readFileSync(file, 'utf8')); }
catch (e) { console.error(`JSON inválido: ${e.message}`); process.exit(1); }

const isInt = (n) => Number.isInteger(n);
const isStr = (s) => typeof s === 'string' && s.length > 0;

if (!isStr(snap.capturedAt) || Number.isNaN(Date.parse(snap.capturedAt))) err('capturedAt deve ser ISO 8601');
if (!['ifood', 'seed'].includes(snap.source)) err("source deve ser 'ifood' ou 'seed'");
if (!snap.location || !isStr(snap.location.label)) err('location.label obrigatório');

for (const key of ['markets', 'products', 'offers']) {
  if (!Array.isArray(snap[key]) || snap[key].length === 0) err(`${key} deve ser array não-vazio`);
}
if (errors.length) { console.error(errors.map((e) => ' ✗ ' + e).join('\n')); process.exit(1); }

const marketIds = new Set(), productIds = new Set(), offerIds = new Set();

snap.markets.forEach((m, i) => {
  const at = `markets[${i}]`;
  if (!isStr(m.id)) err(`${at}.id obrigatório`); else if (marketIds.has(m.id)) err(`${at}.id duplicado: ${m.id}`); else marketIds.add(m.id);
  if (!isStr(m.name)) err(`${at}.name obrigatório`);
  if (!isStr(m.slug)) err(`${at}.slug obrigatório`);
  if (!isInt(m.deliveryFee) || m.deliveryFee < 0) err(`${at}.deliveryFee deve ser inteiro >= 0 (centavos)`);
  if (!isInt(m.minOrder) || m.minOrder < 0) err(`${at}.minOrder deve ser inteiro >= 0 (centavos)`);
  if (!Array.isArray(m.deliveryMinutes) || m.deliveryMinutes.length !== 2 || !m.deliveryMinutes.every(isInt)) err(`${at}.deliveryMinutes deve ser [int, int]`);
  else if (m.deliveryMinutes[0] > m.deliveryMinutes[1]) err(`${at}.deliveryMinutes fora de ordem`);
  if (typeof m.distanceKm !== 'number' || m.distanceKm < 0) err(`${at}.distanceKm deve ser número >= 0`);
  if (m.rating !== undefined && (typeof m.rating !== 'number' || m.rating < 0 || m.rating > 5)) err(`${at}.rating deve estar entre 0 e 5`);
});

snap.products.forEach((p, i) => {
  const at = `products[${i}]`;
  if (!isStr(p.id)) err(`${at}.id obrigatório`); else if (productIds.has(p.id)) err(`${at}.id duplicado: ${p.id}`); else productIds.add(p.id);
  if (!isStr(p.name)) err(`${at}.name obrigatório`);
  if (!isStr(p.category)) err(`${at}.category obrigatório`);
  if (!UNITS.has(p.defaultUnit)) err(`${at}.defaultUnit deve ser kg|L|un, veio "${p.defaultUnit}"`);
  if (!Array.isArray(p.keywords) || p.keywords.length === 0) err(`${at}.keywords deve ser array não-vazio`);
});

const offersPerProduct = new Map();
snap.offers.forEach((o, i) => {
  const at = `offers[${i}] (${o.rawName ?? '?'})`;
  if (!isStr(o.id)) err(`${at}.id obrigatório`); else if (offerIds.has(o.id)) err(`${at}.id duplicado: ${o.id}`); else offerIds.add(o.id);
  if (!marketIds.has(o.marketId)) err(`${at}.marketId "${o.marketId}" não existe em markets`);
  if (!productIds.has(o.productId)) err(`${at}.productId "${o.productId}" não existe em products`);
  if (!isStr(o.rawName)) err(`${at}.rawName obrigatório`);
  if (!isInt(o.price) || o.price <= 0) err(`${at}.price deve ser inteiro > 0 (centavos) — veio ${o.price}`);
  if (o.originalPrice !== undefined) {
    if (!isInt(o.originalPrice)) err(`${at}.originalPrice deve ser inteiro (centavos)`);
    else if (o.originalPrice <= o.price) err(`${at}.originalPrice (${o.originalPrice}) deve ser MAIOR que price (${o.price})`);
  }
  if (typeof o.packageSize !== 'number' || o.packageSize <= 0) err(`${at}.packageSize deve ser número > 0`);
  if (!UNITS.has(o.packageUnit)) err(`${at}.packageUnit deve ser kg|L|un`);
  if (typeof o.available !== 'boolean') err(`${at}.available deve ser boolean`);
  if ('unitPrice' in o) err(`${at} não deve conter unitPrice — é derivado em tempo de carga`);
  const key = `${o.marketId}|${o.productId}`;
  offersPerProduct.set(key, (offersPerProduct.get(key) ?? 0) + 1);
  const prod = snap.products.find((p) => p.id === o.productId);
  if (prod && prod.defaultUnit !== o.packageUnit) {
    err(`${at}.packageUnit "${o.packageUnit}" difere de products.defaultUnit "${prod.defaultUnit}" de ${o.productId} — impede comparação`);
  }
});

// cobertura: cada produto precisa aparecer em >= 2 mercados, senão não há o que comparar
for (const pid of productIds) {
  const mkts = new Set(snap.offers.filter((o) => o.productId === pid).map((o) => o.marketId));
  if (mkts.size === 0) err(`produto "${pid}" não tem nenhuma oferta`);
  else if (mkts.size < 2) warn.push(`produto "${pid}" só existe em 1 mercado — nada a comparar`);
}
for (const mid of marketIds) {
  const n = snap.offers.filter((o) => o.marketId === mid).length;
  if (n === 0) err(`mercado "${mid}" não tem nenhuma oferta`);
  else if (n < 10) warn.push(`mercado "${mid}" só tem ${n} ofertas`);
}

if (warn.length) console.warn(warn.map((w) => ' ! ' + w).join('\n'));
if (errors.length) {
  console.error(`\n✗ ${errors.length} erro(s):\n` + errors.map((e) => ' ✗ ' + e).join('\n'));
  process.exit(1);
}
console.log(`✓ snapshot válido — ${snap.markets.length} mercados, ${snap.products.length} produtos, ${snap.offers.length} ofertas, ${warn.length} aviso(s)`);
