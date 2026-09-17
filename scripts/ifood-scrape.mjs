#!/usr/bin/env node
/**
 * Coletor do iFood -> snapshot.json da Feira Inteligente.
 *
 * DECISÃO DE ARQUITETURA — UMA FONTE DE VERDADE
 * ----------------------------------------------
 * Este script NÃO reimplementa parse/normalização. Ele faz só o que o app não
 * pode fazer (rede + persistência do JSON cru) e delega o resto:
 *
 *   1. baixa os JSONs crus e os grava em `--raw-dir` (auditoria e reprocesso);
 *   2. converte chamando `parseSnapshot` de src/parser/ifood/parse.ts, o MESMO
 *      código que o app usa, carregado em tempo de execução pelo Vite
 *      (`ssrLoadModule`) — o Vite já é devDependency e é o que roda `npm test`;
 *   3. valida a própria saída executando scripts/validate-snapshot.mjs, o
 *      árbitro do esquema, como processo filho.
 *
 * Copiar a normalização para cá criaria uma segunda fonte de verdade que
 * divergiria em silêncio do app. Por isso, se o Vite não estiver disponível
 * (clone sem `npm install`), o script preserva os JSONs crus e imprime o
 * comando exato para terminar a conversão — nunca "adivinha" o snapshot.
 *
 * USO
 *   node scripts/ifood-scrape.mjs --lat -23.55 --lng -46.63 --out public/data/snapshot.json
 *   node scripts/ifood-scrape.mjs --lat -23.55 --lng -46.63 --out out.json --limit 8 --delay 2000
 *   node scripts/ifood-scrape.mjs --from-raw .cache/ifood --out out.json   # reprocessa sem rede
 *
 * Rode na SUA máquina: o iFood bloqueia IP de datacenter/CI.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const VALIDATOR = join(HERE, 'validate-snapshot.mjs');
const PARSER_MODULE = '/src/parser/ifood/parse.ts';

// Endpoints públicos do app do iFood. Não são versionados para terceiros:
// se mudarem, troque aqui ou passe --base.
const DEFAULT_BASE = 'https://marketplace.ifood.com.br';
const MERCHANTS_PATH = '/v1/merchants';
const CATALOG_PATH = (merchantId) => `/v1/merchants/${encodeURIComponent(merchantId)}/catalog`;

// User-Agent honesto: diz o que é e quem chama, sem se passar por navegador.
const USER_AGENT = 'FeiraInteligente/0.1 (comparador pessoal de precos; +node-fetch) Node/' + process.versions.node;

const MIN_DELAY_MS = 250;
const DEFAULT_DELAY_MS = 1500;

const HELP = `
feira-inteligente — coletor iFood

  --lat <número>        latitude da entrega (obrigatório, salvo com --from-raw)
  --lng <número>        longitude da entrega (obrigatório, salvo com --from-raw)
  --out <arquivo>       snapshot de saída (obrigatório), ex: public/data/snapshot.json
  --limit <n>           máximo de mercados (default 8)
  --delay <ms>          pausa entre requisições (default ${DEFAULT_DELAY_MS}, mínimo ${MIN_DELAY_MS})
  --raw-dir <dir>       onde gravar os JSONs crus (default .cache/ifood)
  --from-raw <dir>      reprocessa JSONs já baixados, sem tocar na rede
  --label <texto>       rótulo da localização no snapshot (default "lat,lng")
  --header "K: V"       header extra; repetível (use para headers de sessão)
  --base <url>          base da API (default ${DEFAULT_BASE})
  --skip-validate       não roda o validador ao final (não recomendado)
  --help
`;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

// `parseArgs` recusa "--lat -23.55" ("argument is ambiguous"), e latitude no
// Brasil é sempre negativa: colamos o valor na opção antes de parsear.
const NUMERIC_OPTIONS = new Set(['--lat', '--lng', '--limit', '--delay']);
function foldNegativeNumbers(argv) {
  const folded = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (NUMERIC_OPTIONS.has(arg) && next !== undefined && /^-\d/.test(next)) {
      folded.push(`${arg}=${next}`);
      i += 1;
    } else {
      folded.push(arg);
    }
  }
  return folded;
}

function parseCli(rawArgv) {
  const argv = foldNegativeNumbers(rawArgv);
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        lat: { type: 'string' },
        lng: { type: 'string' },
        out: { type: 'string' },
        limit: { type: 'string', default: '8' },
        delay: { type: 'string', default: String(DEFAULT_DELAY_MS) },
        'raw-dir': { type: 'string', default: '.cache/ifood' },
        'from-raw': { type: 'string' },
        label: { type: 'string' },
        header: { type: 'string', multiple: true, default: [] },
        base: { type: 'string', default: DEFAULT_BASE },
        'skip-validate': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
      allowPositionals: false,
    });
  } catch (cause) {
    fail(`${cause.message}\n${HELP}`);
  }

  const { values } = parsed;
  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (!values.out) fail(`--out é obrigatório.\n${HELP}`);

  const fromRaw = values['from-raw'] ? resolve(values['from-raw']) : null;
  const lat = values.lat === undefined ? null : Number(values.lat);
  const lng = values.lng === undefined ? null : Number(values.lng);
  if (!fromRaw && (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng))) {
    fail(`--lat e --lng são obrigatórios (ou use --from-raw).\n${HELP}`);
  }

  const limit = Number(values.limit);
  if (!Number.isFinite(limit) || limit < 1) fail('--limit deve ser um inteiro >= 1');

  const delayRaw = Number(values.delay);
  if (!Number.isFinite(delayRaw) || delayRaw < 0) fail('--delay deve ser um número de milissegundos >= 0');
  const delay = Math.max(MIN_DELAY_MS, Math.round(delayRaw));
  if (delay !== Math.round(delayRaw)) {
    console.warn(`! --delay elevado para ${delay}ms: rate limiting é obrigatório neste script.`);
  }

  return {
    lat,
    lng,
    out: resolve(values.out),
    limit: Math.floor(limit),
    delay,
    rawDir: resolve(values['raw-dir']),
    fromRaw,
    label: values.label ?? (lat !== null ? `${lat}, ${lng}` : 'snapshot local'),
    headers: parseHeaders(values.header),
    base: values.base.replace(/\/+$/, ''),
    skipValidate: values['skip-validate'],
  };
}

function parseHeaders(entries) {
  const headers = {};
  for (const entry of entries ?? []) {
    const at = entry.indexOf(':');
    if (at <= 0) fail(`--header inválido: "${entry}". Formato esperado: --header "Chave: valor"`);
    headers[entry.slice(0, at).trim()] = entry.slice(at + 1).trim();
  }
  return headers;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function blockedMessage(status, url) {
  return [
    `o iFood respondeu ${status} em ${url}.`,
    '',
    'Esse endpoint costuma exigir headers de sessão de um navegador logado.',
    'Como obter (Chrome/Firefox, 1 minuto):',
    '  1. abra https://www.ifood.com.br e informe seu endereço;',
    '  2. DevTools (F12) > aba Network > filtre por "merchants";',
    '  3. clique na requisição > Copy > Copy as cURL;',
    '  4. repasse os headers relevantes para este script:',
    '',
    '     node scripts/ifood-scrape.mjs --lat -23.55 --lng -46.63 --out public/data/snapshot.json \\',
    '       --header "Authorization: Bearer <token>" \\',
    '       --header "Cookie: <cookie completo>" \\',
    '       --header "access_key: <valor>" --header "secret_key: <valor>"',
    '',
    'Outras causas comuns: IP de datacenter/VPN (rode na sua máquina) e',
    'requisições rápidas demais (suba o --delay, ex: --delay 3000).',
  ].join('\n');
}

async function getJson(url, options) {
  let response;
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json', 'accept-language': 'pt-BR,pt;q=0.9', 'user-agent': USER_AGENT, ...options.headers },
      redirect: 'follow',
    });
  } catch (cause) {
    fail(`falha de rede em ${url}: ${cause.message}`);
  }

  if (response.status === 401 || response.status === 403) fail(blockedMessage(response.status, url));
  if (response.status === 429) {
    fail(`o iFood respondeu 429 (rate limit) em ${url}. Aumente o --delay (ex: --delay 4000) e tente de novo.`);
  }
  if (!response.ok) fail(`HTTP ${response.status} em ${url}: ${(await response.text()).slice(0, 300)}`);

  try {
    return await response.json();
  } catch (cause) {
    fail(`resposta não é JSON em ${url}: ${cause.message}`);
  }
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const merchantsOf = (payload) =>
  Array.isArray(payload) ? payload : (payload?.merchants ?? payload?.items ?? payload?.data?.merchants ?? []);

const catalogFile = (id) => `catalog-${String(id).replace(/[^a-zA-Z0-9_-]+/g, '_')}.json`;

// -------------------------------------------------------------- coleta (rede)

async function download(options) {
  mkdirSync(options.rawDir, { recursive: true });

  const merchantsUrl = new URL(options.base + MERCHANTS_PATH);
  merchantsUrl.searchParams.set('latitude', String(options.lat));
  merchantsUrl.searchParams.set('longitude', String(options.lng));
  merchantsUrl.searchParams.set('channel', 'IFOOD');
  merchantsUrl.searchParams.set('categories', 'MERCADO');
  merchantsUrl.searchParams.set('size', String(options.limit));
  merchantsUrl.searchParams.set('page', '0');

  console.log(`→ mercados: ${merchantsUrl}`);
  const merchantsPayload = await getJson(merchantsUrl, options);
  writeJson(join(options.rawDir, 'merchants.json'), merchantsPayload);

  const merchants = merchantsOf(merchantsPayload).slice(0, options.limit);
  if (merchants.length === 0) fail('nenhum mercado retornado para essa coordenada. Confira --lat/--lng.');
  console.log(`  ${merchants.length} mercado(s). Pausa de ${options.delay}ms entre as próximas requisições.`);

  const catalogs = {};
  for (const [index, merchant] of merchants.entries()) {
    const id = merchant?.id ?? merchant?.uuid;
    if (!id) continue;

    await sleep(options.delay); // rate limiting educado: sempre, inclusive antes do 1º catálogo

    const catalogUrl = new URL(options.base + CATALOG_PATH(id));
    catalogUrl.searchParams.set('latitude', String(options.lat));
    catalogUrl.searchParams.set('longitude', String(options.lng));
    console.log(`→ catálogo ${index + 1}/${merchants.length}: ${merchant?.name ?? id}`);

    const catalog = await getJson(catalogUrl, options);
    catalogs[id] = catalog;
    writeJson(join(options.rawDir, catalogFile(id)), catalog);
  }

  return { merchants, catalogs, rawDir: options.rawDir };
}

// --------------------------------------------------- releitura dos JSONs crus

function readRaw(dir) {
  const merchantsPath = join(dir, 'merchants.json');
  if (!existsSync(merchantsPath)) fail(`não encontrei ${merchantsPath}. Rode a coleta antes ou aponte --from-raw para a pasta certa.`);

  const merchants = merchantsOf(JSON.parse(readFileSync(merchantsPath, 'utf8')));
  const catalogs = {};
  for (const merchant of merchants) {
    const id = merchant?.id ?? merchant?.uuid;
    if (!id) continue;
    const path = join(dir, catalogFile(id));
    if (existsSync(path)) catalogs[id] = JSON.parse(readFileSync(path, 'utf8'));
  }
  return { merchants, catalogs, rawDir: dir };
}

// ------------------------------- conversão (delegada ao parser TS do projeto)

async function loadParseSnapshot() {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true, watch: null },
  });
  const module = await server.ssrLoadModule(PARSER_MODULE);
  return { parseSnapshot: module.parseSnapshot, close: () => server.close() };
}

function rawOnlyInstructions(raw, options, cause) {
  console.error(`\n! não consegui carregar ${PARSER_MODULE} via Vite: ${cause.message}`);
  console.error('! os JSONs crus estão salvos e nada foi perdido — o script não duplica a normalização.');
  console.error(`\nJSONs crus: ${raw.rawDir}`);
  console.error('\nPara terminar a conversão com a MESMA lógica do app:');
  console.error('  npm install   # o Vite é devDependency e é quem carrega o parser TS');
  console.error(`  node scripts/ifood-scrape.mjs --from-raw ${raw.rawDir} --out ${options.out}`);
  console.error('\nOu, em código do app: parseSnapshot(merchants, catalogs, location) de src/parser/ifood/parse.ts\n');
  process.exit(2);
}

function validate(outPath) {
  console.log('\n→ validando com scripts/validate-snapshot.mjs');
  try {
    execFileSync(process.execPath, [VALIDATOR, outPath], { stdio: 'inherit' });
  } catch {
    fail('o snapshot gerado não passou no validador (veja os erros acima).');
  }
}

// ------------------------------------------------------------------------ main

async function main() {
  const options = parseCli(process.argv.slice(2));
  const raw = options.fromRaw ? readRaw(options.fromRaw) : await download(options);

  let parser;
  try {
    parser = await loadParseSnapshot();
  } catch (cause) {
    rawOnlyInstructions(raw, options, cause);
    return;
  }

  try {
    const location = { label: options.label };
    if (options.lat !== null) {
      location.latitude = options.lat;
      location.longitude = options.lng;
    }
    const snapshot = parser.parseSnapshot(raw.merchants, raw.catalogs, location, { source: 'ifood' });
    writeJson(options.out, snapshot);
    console.log(
      `\n✓ ${options.out} — ${snapshot.markets.length} mercados, ${snapshot.products.length} produtos, ${snapshot.offers.length} ofertas`,
    );
    console.log(`  JSONs crus em ${raw.rawDir}`);
  } finally {
    await parser.close();
  }

  if (!options.skipValidate) validate(options.out);
}

main().catch((cause) => fail(cause?.stack ?? String(cause)));
