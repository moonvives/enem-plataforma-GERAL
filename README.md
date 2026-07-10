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

## Estrutura

```
data/
  source/           Material-fonte em Markdown (eBook e resumo da TRI)
  questions.json    Dataset canônico gerado (metadados + questões)
scripts/
  build_dataset.py  Extrai o dataset da fonte e gera os JSON e o data.js
docs/               Site estático (pronto para GitHub Pages)
  index.html        Busca e filtragem
  questao.html      Detalhe da questão
  painel.html       Painel analítico
  sobre.html        Metodologia (Matriz de Referência e TRI)
  assets/           styles.css, app.js e data.js (dataset embutido)
  api/              questions.json, stats.json, meta.json
```

## Como gerar os dados

O dataset e os arquivos servidos são derivados do material-fonte. Após alterar a
fonte ou o parser, regenere tudo com:

```bash
python3 scripts/build_dataset.py
```

O script (sem dependências externas) grava `data/questions.json`,
`docs/api/*.json` e `docs/assets/data.js`.

## Como executar

O site é estático e não requer servidor. Para desenvolvimento local:

```bash
python3 -m http.server -d docs 8000
# abra http://localhost:8000
```

Também funciona abrindo `docs/index.html` diretamente (`file://`), pois o dataset
fica embutido em `docs/assets/data.js` para evitar dependência de `fetch`/CORS.
Para publicação, aponte o GitHub Pages para a pasta `docs/`.
