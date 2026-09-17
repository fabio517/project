/**
 * Gerador do dataset seed. Preços ancorados em valores reais de mercado
 * brasileiro: `base` é o preço da UNIDADE BASE em centavos (por kg, por L ou
 * por unidade), do qual o preço da embalagem é derivado.
 */
import { writeFileSync } from 'node:fs';

// hash determinístico -> [0,1)
const h = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return ((x >>> 0) % 100000) / 100000; };

const markets = [
  { id: 'assai',    name: 'Assaí Atacadista',   slug: 'assai-atacadista',   mult: 0.86, deliveryFee: 1290, minOrder: 12000, deliveryMinutes: [75, 100], distanceKm: 6.4, rating: 4.3 },
  { id: 'atacadao', name: 'Atacadão',           slug: 'atacadao',           mult: 0.85, deliveryFee: 1490, minOrder: 15000, deliveryMinutes: [80, 110], distanceKm: 8.9, rating: 4.2 },
  { id: 'sams',     name: "Sam's Club",         slug: 'sams-club',          mult: 0.90, deliveryFee:  990, minOrder: 10000, deliveryMinutes: [70,  95], distanceKm: 11.2, rating: 4.5 },
  { id: 'dia',      name: 'Dia Supermercado',   slug: 'dia-supermercado',   mult: 0.97, deliveryFee:  699, minOrder:  3000, deliveryMinutes: [35,  50], distanceKm: 1.2, rating: 4.1 },
  { id: 'carrefour',name: 'Carrefour',          slug: 'carrefour',          mult: 1.00, deliveryFee:  799, minOrder:  5000, deliveryMinutes: [45,  65], distanceKm: 3.1, rating: 4.6 },
  { id: 'extra',    name: 'Extra Mercado',      slug: 'extra-mercado',      mult: 1.06, deliveryFee:    0, minOrder:  8000, deliveryMinutes: [50,  70], distanceKm: 2.7, rating: 4.4 },
  { id: 'pao',      name: 'Pão de Açúcar',      slug: 'pao-de-acucar',      mult: 1.18, deliveryFee:  590, minOrder:  4000, deliveryMinutes: [30,  45], distanceKm: 0.9, rating: 4.8 },
  { id: 'marche',   name: 'St Marche',          slug: 'st-marche',          mult: 1.30, deliveryFee:  890, minOrder:  6000, deliveryMinutes: [30,  40], distanceKm: 1.8, rating: 4.9 },
];

// base = centavos por unidade base (kg, L ou un). pk = tamanhos de embalagem possíveis.
const products = [
  { id:'arroz-branco',    name:'Arroz branco tipo 1',        cat:'Mercearia',  u:'kg', base:540,  pk:[5,2,1],      kw:['arroz'],                 br:['Tio João','Camil','Prato Fino','Namorado'] },
  { id:'feijao-carioca',  name:'Feijão carioca',             cat:'Mercearia',  u:'kg', base:820,  pk:[1,2],        kw:['feijao','carioca'],      br:['Camil','Kicaldo','Broto Legal'] },
  { id:'macarrao-espag',  name:'Macarrão espaguete',         cat:'Mercearia',  u:'kg', base:900,  pk:[0.5,1],      kw:['macarrao','espaguete'],  br:['Barilla','Adria','Renata','Galo'] },
  { id:'acucar-refinado', name:'Açúcar refinado',            cat:'Mercearia',  u:'kg', base:510,  pk:[1,2,5],      kw:['acucar'],                br:['União','Caravelas','Guarani'] },
  { id:'cafe-moido',      name:'Café torrado e moído',       cat:'Mercearia',  u:'kg', base:4200, pk:[0.5,1],      kw:['cafe'],                  br:['Pilão','Melitta','3 Corações','Santa Clara'] },
  { id:'oleo-soja',       name:'Óleo de soja',               cat:'Mercearia',  u:'L',  base:840,  pk:[0.9],        kw:['oleo','soja'],           br:['Liza','Soya','Concórdia'] },
  { id:'farinha-trigo',   name:'Farinha de trigo',           cat:'Mercearia',  u:'kg', base:560,  pk:[1,5],        kw:['farinha','trigo'],       br:['Dona Benta','Renata','Anaconda'] },
  { id:'sal-refinado',    name:'Sal refinado iodado',        cat:'Mercearia',  u:'kg', base:260,  pk:[1],          kw:['sal'],                   br:['Cisne','Lebre','Diana'] },
  { id:'molho-tomate',    name:'Molho de tomate',            cat:'Mercearia',  u:'kg', base:880,  pk:[0.34,0.52],  kw:['molho','tomate'],        br:['Pomarola','Heinz','Quero','Elefante'] },
  { id:'biscoito-agua',   name:'Biscoito água e sal',        cat:'Mercearia',  u:'kg', base:1280, pk:[0.4],        kw:['biscoito','agua','sal'], br:['Piraquê','Vitarella','Marilan'] },

  { id:'leite-integral',  name:'Leite integral',             cat:'Laticínios', u:'L',  base:530,  pk:[1],          kw:['leite','integral'],      br:['Piracanjuba','Italac','Parmalat','Elegê'] },
  { id:'queijo-mussarela',name:'Queijo mussarela fatiado',   cat:'Laticínios', u:'kg', base:4600, pk:[0.15,0.4],   kw:['queijo','mussarela'],    br:['Tirolez','President','Polenghi'] },
  { id:'manteiga',        name:'Manteiga com sal',           cat:'Laticínios', u:'kg', base:6100, pk:[0.2],        kw:['manteiga'],              br:['Aviação','Itambé','Batavo'] },
  { id:'iogurte-natural', name:'Iogurte natural',            cat:'Laticínios', u:'kg', base:1350, pk:[0.17,0.5],   kw:['iogurte','natural'],     br:['Nestlé','Danone','Vigor'] },
  { id:'requeijao',       name:'Requeijão cremoso',          cat:'Laticínios', u:'kg', base:3600, pk:[0.2],        kw:['requeijao'],             br:['Catupiry','Danubio','Vigor'] },

  { id:'banana-prata',    name:'Banana prata',               cat:'Hortifruti', u:'kg', base:720,  pk:[1],          kw:['banana'],                br:[''] },
  { id:'tomate',          name:'Tomate',                     cat:'Hortifruti', u:'kg', base:940,  pk:[1],          kw:['tomate'],                br:[''] },
  { id:'batata',          name:'Batata lavada',              cat:'Hortifruti', u:'kg', base:620,  pk:[1,2],        kw:['batata'],                br:[''] },
  { id:'cebola',          name:'Cebola',                     cat:'Hortifruti', u:'kg', base:690,  pk:[1],          kw:['cebola'],                br:[''] },
  { id:'alface-crespa',   name:'Alface crespa',              cat:'Hortifruti', u:'un', base:420,  pk:[1],          kw:['alface'],                br:[''] },
  { id:'maca-fuji',       name:'Maçã Fuji',                  cat:'Hortifruti', u:'kg', base:1050, pk:[1],          kw:['maca','fuji'],           br:[''] },

  { id:'peito-frango',    name:'Peito de frango',            cat:'Carnes',     u:'kg', base:1690, pk:[1,2],        kw:['peito','frango'],        br:['Sadia','Perdigão','Seara'] },
  { id:'patinho',         name:'Patinho bovino',             cat:'Carnes',     u:'kg', base:4200, pk:[0.5,1],      kw:['patinho'],               br:['Friboi','Swift'] },
  { id:'linguica-cal',    name:'Linguiça calabresa',         cat:'Carnes',     u:'kg', base:2600, pk:[0.4],        kw:['linguica','calabresa'],  br:['Sadia','Perdigão','Seara'] },
  { id:'ovos',            name:'Ovos brancos',               cat:'Carnes',     u:'un', base:105,  pk:[12,30],      kw:['ovos'],                  br:['Mantiqueira','Naturovos'] },

  { id:'refri-cola',      name:'Refrigerante de cola',       cat:'Bebidas',    u:'L',  base:470,  pk:[2,1.5],      kw:['refrigerante','cola'],   br:['Coca-Cola','Pepsi'] },
  { id:'suco-uva',        name:'Suco de uva integral',       cat:'Bebidas',    u:'L',  base:1450, pk:[1,1.5],      kw:['suco','uva'],            br:['Aurora','Campo Largo'] },
  { id:'cerveja-lata',    name:'Cerveja lata 350ml',         cat:'Bebidas',    u:'un', base:365,  pk:[12,6],       kw:['cerveja'],               br:['Heineken','Original','Brahma'] },
  { id:'agua-mineral',    name:'Água mineral sem gás',       cat:'Bebidas',    u:'L',  base:210,  pk:[1.5,5],      kw:['agua','mineral'],        br:['Crystal','Bonafont','Minalba'] },
  { id:'cha-mate',        name:'Chá mate natural',           cat:'Bebidas',    u:'L',  base:490,  pk:[1.5],        kw:['cha','mate'],            br:['Leão','Matte Leão'] },

  { id:'detergente',      name:'Detergente neutro',          cat:'Limpeza',    u:'L',  base:580,  pk:[0.5],        kw:['detergente'],            br:['Ypê','Limpol','Minuano'] },
  { id:'sabao-po',        name:'Sabão em pó',                cat:'Limpeza',    u:'kg', base:1180, pk:[1.6,0.8],    kw:['sabao','po'],            br:['Omo','Tixan','Brilhante'] },
  { id:'amaciante',       name:'Amaciante de roupas',        cat:'Limpeza',    u:'L',  base:620,  pk:[2,1],        kw:['amaciante'],             br:['Downy','Comfort','Mon Bijou'] },
  { id:'desinfetante',    name:'Desinfetante',               cat:'Limpeza',    u:'L',  base:460,  pk:[2,1],        kw:['desinfetante'],          br:['Pinho Sol','Veja','Ypê'] },
  { id:'papel-higienico', name:'Papel higiênico folha dupla',cat:'Limpeza',    u:'un', base:190,  pk:[12,4],       kw:['papel','higienico'],     br:['Neve','Personal','Sublime'] },

  { id:'sabonete',        name:'Sabonete em barra',          cat:'Higiene',    u:'un', base:265,  pk:[1,5],        kw:['sabonete'],              br:['Dove','Lux','Protex'] },
  { id:'shampoo',         name:'Shampoo',                    cat:'Higiene',    u:'L',  base:4100, pk:[0.35,0.4],   kw:['shampoo'],               br:['Seda','Pantene','Elseve'] },
  { id:'creme-dental',    name:'Creme dental',               cat:'Higiene',    u:'un', base:520,  pk:[1,3],        kw:['creme','dental'],        br:['Colgate','Sorriso','Oral-B'] },
  { id:'papel-toalha',    name:'Papel toalha',               cat:'Higiene',    u:'un', base:460,  pk:[2],          kw:['papel','toalha'],        br:['Snob','Kitchen','Neve'] },
  { id:'absorvente',      name:'Absorvente com abas',        cat:'Higiene',    u:'un', base:112,  pk:[8,16],       kw:['absorvente'],            br:['Always','Intimus','Sempre Livre'] },
];

const unitTxt = (size, u) => u === 'kg' ? (size < 1 ? `${Math.round(size*1000)}g` : `${String(size).replace('.',',')}kg`)
                          : u === 'L'  ? (size < 1 ? `${Math.round(size*1000)}ml` : `${String(size).replace('.',',')}L`)
                          : `${size} un`;

const offers = [];
for (const p of products) {
  for (const m of markets) {
    const seed = h(m.id + '|' + p.id);
    if (seed > 0.86) continue;                       // produto não existe neste mercado (cobertura 5–8 mercados)
    const jitter = 0.88 + h(p.id + '~' + m.id) * 0.24;  // ±12% em cima do multiplicador do mercado
    const size = p.pk[Math.floor(h(m.id + '#' + p.id) * p.pk.length)];
    const brand = p.br[Math.floor(h('b' + m.id + p.id) * p.br.length)];
    const promoRoll = h('promo' + m.id + p.id);
    // Promoção de verdade derruba o preço: é o que faz um mercado caro ganhar
    // em UM item e tornar a divisão da compra vantajosa.
    const deal = promoRoll > 0.88 ? 0.78 + h('d' + m.id + p.id) * 0.12 : 1;
    const price = Math.round(p.base * size * m.mult * jitter * deal);
    const offer = {
      id: `${m.id}-${p.id}`,
      marketId: m.id,
      productId: p.id,
      rawName: [p.name, brand, unitTxt(size, p.u)].filter(Boolean).join(' '),
      ...(brand ? { brand } : {}),
      price,
      ...(deal < 1 ? { originalPrice: Math.round(price / deal) } : promoRoll > 0.78 ? { originalPrice: Math.round(price * (1.12 + h('op' + m.id + p.id) * 0.18)) } : {}),
      packageSize: size,
      packageUnit: p.u,
      available: h('av' + m.id + p.id) > 0.05,
      ...(deal < 1 ? { promo: `${Math.round((1 - deal) * 100)}% OFF` } : {}),
    };
    offers.push(offer);
  }
}

const snapshot = {
  capturedAt: '2026-09-17T12:00:00.000Z',
  source: 'seed',
  location: { label: 'São Paulo, SP — Vila Mariana', latitude: -23.5893, longitude: -46.6349 },
  markets: markets.map(({ mult, ...m }) => m),
  products: products.map((p) => ({ id: p.id, name: p.name, category: p.cat, defaultUnit: p.u, keywords: p.kw })),
  offers,
};

writeFileSync('/home/user/project/src/data/seed.json', JSON.stringify(snapshot, null, 2) + '\n');
console.log(`gerado: ${markets.length} mercados, ${products.length} produtos, ${offers.length} ofertas`);
