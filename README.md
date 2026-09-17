# 🛒 Feira Inteligente

Prova de conceito para planejar as compras da casa comparando preços entre
mercados do iFood. Roda 100% local: sem servidor, sem banco, sem serviço pago.

![stack](https://img.shields.io/badge/React-19-2a78d6) ![stack](https://img.shields.io/badge/TypeScript-5.9-1c5cab) ![stack](https://img.shields.io/badge/Vite-7-4a3aa7)

## O que ele responde

1. **Qual mercado sai mais barato para a MINHA lista?** — não o mercado "mais barato"
   em geral, mas o mais barato para os 23 itens que você realmente vai comprar,
   já somando taxa de entrega e checando pedido mínimo.
2. **Compensa dividir a compra?** — quanto você economiza comprando em 2 mercados
   em vez de 1, já descontando a segunda taxa de entrega. Muitas vezes **não**
   compensa, e o app mostra isso em vez de esconder.
3. **Qual embalagem é o melhor negócio?** — tudo é normalizado para preço por
   kg / L / unidade, então "5kg por R$ 27,90" e "2kg por R$ 12,50" viram números
   comparáveis.

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes do parser e do otimizador
npm run build    # build de produção em dist/
```

O app já abre com um **dataset seed** de 8 mercados e 40 produtos, então dá para
usar na hora, sem configurar nada.

## Os dados reais do iFood

O parser de verdade vive em `scripts/ifood-scrape.mjs` e roda **na sua máquina**
(o ambiente onde este projeto foi construído tem o domínio do iFood bloqueado por
proxy, então a captura não pôde ser executada aqui — só o parsing foi testado,
contra fixtures).

```bash
node scripts/ifood-scrape.mjs \
  --lat -23.5893 --lng -46.6349 \
  --out public/data/snapshot.json \
  --limit 8 --delay 1500
```

Depois é só **arrastar o `snapshot.json` para dentro do app** (botão "Carregar
snapshot"). O JSON é validado contra o esquema antes de entrar; se estiver
quebrado, o app diz exatamente o quê, e continua funcionando com o seed.

Para checar um snapshot pela linha de comando:

```bash
node scripts/validate-snapshot.mjs public/data/snapshot.json
```

> O scraper é deliberadamente lento (1,5s entre requisições por padrão) e
> identifica-se com um `User-Agent` honesto. Ele lê o mesmo catálogo público que
> o site mostra, para uso pessoal. Se o iFood responder 401/403, o script explica
> como passar headers de sessão do seu próprio navegador via `--header`.

## Arquitetura

```
src/
  domain/          modelo e regras puras (dinheiro em centavos, unidades)
    types.ts       ← o contrato: todo o resto programa contra ele
    money.ts       centavos ⇄ "R$ 7,93"  (nunca float para moeda)
    units.ts       "Pack 6x350ml" → 2,1 L → preço por litro
  parser/
    ifood/         formas cruas da API do iFood → domínio
    normalize.ts   enriquecimento, índice do catálogo, matcher de produtos
  lib/
    optimizer.ts   a lista × todos os mercados → melhor único e melhor divisão
  state/           hooks React + localStorage (sem lib de estado)
  components/      UI
  data/seed.json   dataset embutido
scripts/
  ifood-scrape.mjs captura (roda na sua máquina)
  validate-snapshot.mjs  árbitro do esquema
```

### Três decisões que sustentam o resto

**Dinheiro é sempre inteiro em centavos.** Nenhum float toca preço em nenhum
ponto do fluxo. Formatação para real só acontece na borda de exibição.

**O snapshot persistido nunca guarda preço por unidade.** `unitPrice` é derivado
em tempo de carga, por uma única função. Assim um snapshot antigo nunca carrega
uma normalização desatualizada, e existe uma só fonte de verdade para o cálculo
que decide o que é "melhor custo-benefício". O validador rejeita um JSON que
traga `unitPrice`.

**O item que falta é precificado, não ignorado.** Um mercado que só tem metade
da sua lista soma um total baixinho e pareceria o vencedor. Mas ordenar por
cobertura para corrigir isso erra para o outro lado: manda você pagar R$ 136 a
mais para levar *um* item a mais. A saída é imputar — o item ausente entra na
conta pelo menor preço onde ele existe, porque você vai comprá-lo em algum
lugar de qualquer forma. Aí toda cesta cobre a mesma lista e os totais voltam a
significar a mesma coisa. Cada mercado mostra os dois números: o que você gasta
lá (`total`) e o custo comparável da lista inteira (`comparableTotal`).

## Limites conhecidos

- A captura ao vivo não foi exercitada ponta a ponta (rede bloqueada no ambiente
  de build). O parsing tem testes contra fixtures; a etapa de rede é o pedaço a
  validar na sua máquina.
- O plano dividido usa uma heurística gulosa de eliminação de paradas, não uma
  otimização exata. Para uma lista de casa (dezenas de itens, poucos mercados)
  a diferença é irrelevante, mas não é um solver.
- O matcher de produtos casa por palavras-chave curadas. Dois mercados que
  batizem o mesmo item de formas muito diferentes podem não ser agrupados.
