# Microdados de participantes do ENEM — 2020 a 2025

Importação integral dos pacotes anuais publicados pelo INEP/MEC.

## Fonte oficial

| Ano | Arquivo oficial |
|---:|---|
| 2020 | `https://download.inep.gov.br/microdados/microdados_enem_2020.zip` |
| 2021 | `https://download.inep.gov.br/microdados/microdados_enem_2021.zip` |
| 2022 | `https://download.inep.gov.br/microdados/microdados_enem_2022.zip` |
| 2023 | `https://download.inep.gov.br/microdados/microdados_enem_2023.zip` |
| 2024 | `https://download.inep.gov.br/microdados/microdados_enem_2024.zip` |
| 2025 | `https://download.inep.gov.br/microdados/microdados_enem_2025.zip` |

Documentação complementar: <https://brazilvisible.org/docs/apis/educacao/enem/>.

## Onde os arquivos ficam

Os CSVs principais têm milhões de linhas e ultrapassam o limite de 100 MB por arquivo do GitHub. Por isso, a importação não coloca os CSVs gigantes no histórico Git do repositório.

O workflow `Importar microdados oficiais do ENEM`:

1. baixa cada ZIP diretamente do domínio oficial do INEP;
2. registra o SHA-256 do pacote original;
3. valida a integridade do ZIP;
4. extrai integralmente todos os diretórios e arquivos;
5. produz um manifesto JSON com caminho, tamanho e SHA-256 de cada arquivo extraído;
6. cria um arquivo `tar.zst` reproduzível com todo o conteúdo extraído;
7. divide arquivos maiores em partes de até 1.900 MiB;
8. publica as partes e os manifestos na Release `inep-enem-microdados-2020-2025`.

## Reconstrução de um ano

Baixe todas as partes do mesmo ano e execute:

```bash
cat enem-2023-extraido.tar.zst.*.part > enem-2023-extraido.tar.zst
tar --use-compress-program=unzstd -xf enem-2023-extraido.tar.zst
```

Depois da extração, compare os arquivos com `manifest-2023.json`.

## Conteúdo esperado

Cada pacote pode incluir:

- CSV principal de participantes;
- dicionário de variáveis;
- programas de leitura para SAS e SPSS;
- documentação e notas metodológicas;
- outros arquivos auxiliares publicados pelo INEP naquele ano.

Os pacotes são preservados como publicados. Nomes, codificações e diferenças de esquema entre anos não são normalizados nesta camada bruta.

## Privacidade e uso

Os dados são abertos e anonimizados pelo INEP. Mesmo assim, análises derivadas devem evitar tentativas de reidentificação e apresentar agregações responsáveis. Notas ausentes, mudanças de questionário e diferenças entre edições precisam ser tratadas antes de comparações longitudinais.
