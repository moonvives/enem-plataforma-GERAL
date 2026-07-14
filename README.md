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
- **Modelos de Biologia** (`docs/modelos.html`): 13 modelos específicos —
  filogenia, seleção natural, evolução, taxonomia, digestão, excreção,
  circulação, endocrinologia, imunidade, doenças infecciosas, fermentação,
  respiração celular e fotossíntese — identificados em 123 questões oficiais.

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
   em PDF, todos versionados no próprio repositório. Não há integração com
   Google Drive nem links de armazenamento externo.

## Estrutura

```
data/
  source/           Material-fonte em Markdown (eBook e resumo da TRI)
  questions.json    Dataset canônico das 540 questões (metadados + questões)
  microdados/       ITENS_PROVA_2009..2025.csv (microdados oficiais do INEP)
  microdados.json   Todos os itens oficiais deduplicados (todas as áreas/anos)
  naturezas/        Biblioteca local de CN: PDFs por disciplina + manifesto
scripts/
  build_dataset.py     Gera o dataset das 540 questões (JSON + data.js)
  build_microdados.py  Gera os itens oficiais da TRI (microdados_*.json + microdados.js)
  build_materiais.py   Cataloga somente os PDFs já versionados no repositório
docs/               Site estático (pronto para GitHub Pages)
  index.html        Busca e filtragem (540 questões)
  questao.html      Detalhe da questão
  painel.html       Painel analítico (eBook)
  painel-oficial.html  Painel dos microdados oficiais (CN)
  materiais.html    Biblioteca de materiais por disciplina
  sobre.html        Metodologia (Matriz de Referência e TRI)
  assets/           styles.css, app.js e datasets estáticos da interface
  api/              questions.json, stats.json, meta.json, microdados_*.json, materiais.json
```

### Materiais

A página **Materiais** publica apenas os PDFs presentes em `data/naturezas`.
O catálogo não contém vídeos, IDs de provedores ou URLs externas. Depois de
adicionar ou remover um PDF versionado, regenere o catálogo com:

```bash
python3 scripts/build_materiais.py
```

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
projeto para rodar no desktop. É servida como site estático a partir da pasta
`docs/`, com domínio próprio, e exige conexão para abrir páginas, dados e painel.

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

Não há service worker, manifesto PWA ou modo offline. O bootstrap remove
registros e caches de versões antigas, e a configuração da Vercel envia
`Cache-Control: no-store` para evitar que o painel seja servido de cache.
