# Naturezas — 720 questões — pacote corrigido

Conteúdo:

- `material_ia.md`: 720 questões em Markdown, com metadados YAML e alternativas em checkboxes.
- `questoes.json`: banco estruturado completo.
- `manifesto_questoes.csv`: índice tabular de todos os itens.
- `imagens/`: um recorte integral de alta fidelidade por questão, preservando todo conteúdo visual.
- `manifesto_imagens.csv`: correspondência entre questão, página e imagem.
- `auditoria_transcricao.csv`: indicadores usados na revisão geométrica e nos casos encaminhados à preservação visual.
- `relatorio_validacao.json`: contagens, integridade de links, itens anulados e alertas.

A revisão final inclui 26 questões com alternativas transcritas manualmente e 43 questões cujas alternativas são essencialmente gráficas ou estruturais, preservadas por recorte integral em vez de descrições inventadas.

## Regras de fidelidade

1. O valor de dificuldade impresso no PDF é preservado em `dificuldade_escala_enem` e `dificuldade_publicada`.
2. O parâmetro padronizado é calculado em campo separado: `(dificuldade - 500) / 100`.
3. Nenhum gráfico, circuito, fórmula ou estrutura química é reescrito por conjectura: o recorte visual integral acompanha cada questão.
4. Em 2009, o próprio material declara que os microdados não apresentam as habilidades de Ciências da Natureza; por isso, Habilidade e Competência ficam nulas.
5. Em 2024, o material informa que os microdados ainda não estavam disponíveis; Habilidade, Competência, parâmetro b e dificuldade permanecem nulos.
