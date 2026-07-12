# enem-plataforma-GERAL

Aplicação web para consulta, filtragem e análise de questões do ENEM. O projeto
organiza itens por ano, disciplina, competência, habilidade, dificuldade estimada
e parâmetros TRI, oferecendo páginas de busca, detalhe da questão, painel analítico
e endpoints JSON.

## Escopo atual

Esta versão cobre **Ciências da Natureza — edições não regulares** do ENEM:
**540 questões** de 12 aplicações (nove edições PPL, a 2ª Aplicação de 2016, a
edição em Libras de 2017 e a edição Digital de 2020), de 2012 a 2024. Cada item é
classificado por uma das 30 habilidades da Matriz de Referência e ordenável pelo
parâmetro `b` da Teoria de Resposta ao Item (TRI).

A fonte é a *Coleção ENEM PPL por Habilidades e Dificuldades — Ciências da Natureza*
(Prof. Fredão); os valores de dificuldade e gabarito provêm dos microdados do INEP.

## O que a plataforma oferece

- **Busca e filtragem** (`docs/index.html`): busca livre por texto e filtros por
  área, competência, habilidade, edição, ano e nível de dificuldade (TRI), com
  ordenação por qualquer coluna.
- **Detalhe da questão** (`docs/questao.html?q=NNN`): ficha completa do item —
  habilidade, competência, área, edição, dificuldade `b`, nível e gabarito, com
  navegação entre questões.
- **Painel analítico** (`docs/painel.html`): indicadores (média e desvio-padrão de
  `b`, faixa) e distribuições por dificuldade, competência, área, habilidade,
  edição e ano.
- **Endpoints JSON** (`docs/api/`): `questions.json`, `stats.json` e `meta.json`,
  servidos como arquivos estáticos.

A régua de dificuldade segue o material-fonte: ❶ muito fácil (`b < 560`),
❷ fácil (`560 ≤ b < 620`), ❸ mediana (`620 ≤ b < 680`), ❹ difícil (`680 ≤ b < 740`)
e ❺ muito difícil (`b ≥ 740`). As estatísticas do painel são calculadas diretamente
dos valores de `b` publicados por item.

## Fontes de dados

A plataforma combina três fontes:

1. **eBook PPL (540 questões)** — edições não regulares, com enunciado, gabarito e
   dificuldade TRI. Base das páginas de busca e do painel.
2. **Microdados oficiais do INEP (2009–2025)** — arquivos `ITENS_PROVA` com os
   parâmetros reais da TRI (`a`, `b`, `c`) de todos os itens das provas regulares.
   Base do painel "Microdados" (foco em Ciências da Natureza, 672 itens 2020–2025).
3. **Biblioteca de estudos (Naturezas)** — teoria, apostilas, manuais e simulados
   por disciplina. PDFs versionados no repositório; videoaulas catalogadas com link.

## Estrutura

```
data/
  source/           Material-fonte em Markdown (eBook e resumo da TRI)
  questions.json    Dataset canônico das 540 questões (metadados + questões)
  microdados/       ITENS_PROVA_2009..2025.csv (microdados oficiais do INEP)
  microdados.json   Todos os itens oficiais deduplicados (todas as áreas/anos)
  naturezas/        Biblioteca de CN: PDFs por disciplina + MANIFEST.md/manifest.json
scripts/
  build_dataset.py     Gera o dataset das 540 questões (JSON + data.js)
  build_microdados.py  Gera os itens oficiais da TRI (microdados_*.json + microdados.js)
  fetch_naturezas.py   Baixa os PDFs da biblioteca e gera o manifesto/catálogo
docs/               Site estático (pronto para GitHub Pages)
  index.html        Busca e filtragem (540 questões)
  questao.html      Detalhe da questão
  painel.html       Painel analítico (eBook)
  painel-oficial.html  Painel dos microdados oficiais (CN)
  materiais.html    Biblioteca de materiais por disciplina
  sobre.html        Metodologia (Matriz de Referência e TRI)
  assets/           styles.css, app.js e *.js (datasets embutidos p/ offline)
  api/              questions.json, stats.json, meta.json, microdados_*.json, materiais.json
```

### Vídeos e arquivos grandes

As videoaulas da biblioteca (~13 GB, arquivos de até ~940 MB) **não são
versionadas**: o GitHub rejeita arquivos acima de 100 MB. Elas ficam catalogadas
em `data/naturezas/MANIFEST.md` e em `docs/api/materiais.json`, com link direto de
download do Drive, e aparecem na página **Materiais**. O mesmo vale para o único
PDF acima de 100 MB (o manual de Física de 120 MB).

## Como gerar os dados

O dataset e os arquivos servidos são derivados do material-fonte. Após alterar a
fonte ou o parser, regenere tudo com:

```bash
python3 scripts/build_dataset.py
```

O script (sem dependências externas) grava `data/questions.json`,
`docs/api/*.json` e `docs/assets/data.js`.

## Publicação

A plataforma é um site real, hospedado e acessível pela internet — não um
projeto para rodar no desktop. É servida como site estático pelo **GitHub
Pages** a partir da pasta `docs/`, e instalável como aplicativo (PWA), com
domínio próprio.

- **GitHub Pages:** em _Settings → Pages_, defina _Source_ como a branch de
  publicação e a pasta `/docs`.
- **Domínio próprio:** adicione o domínio em _Settings → Pages → Custom domain_
  (grava um arquivo `CNAME` em `docs/`) e aponte o DNS do domínio para o GitHub
  Pages. O PIN pessoal é **somente uma trava de privacidade local, executada no
  navegador (client-side)**: esconde a interface naquele aparelho e mantém o
  progresso de estudo salvo localmente. O PIN **não é autenticação, não cifra os
  dados e não protege os arquivos hospedados**. Em um site publicado, todo o
  conteúdo estático — inclusive `docs/assets/*.js`, `docs/api/*.json` e imagens
  — continua publicamente acessível por URL direta. Conteúdo que exija controle
  de acesso real deve ser servido por um backend autenticado e autorizado.

Todos os dados ficam embutidos em `docs/assets/*.js` (e espelhados em
`docs/api/*.json`), de modo que o site funciona mesmo instalado e offline.
