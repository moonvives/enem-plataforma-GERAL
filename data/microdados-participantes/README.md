# Microdados de participantes do ENEM — 2018 a 2025

Importação integral dos pacotes anuais publicados pelo INEP/MEC.

## Estado da importação

**Concluída em 10 de julho de 2026.** Os oito pacotes passaram por validação do ZIP, extração integral, manifesto por arquivo, recompressão e publicação.

[Abrir a Release 2018–2019](https://github.com/moonvives/enem-plataforma-GERAL/releases/tag/inep-enem-microdados-2018-2019) · [Abrir a Release 2020–2025](https://github.com/moonvives/enem-plataforma-GERAL/releases/tag/inep-enem-microdados-2020-2025)

| Ano | Arquivos extraídos | Tamanho extraído | Pacote publicado |
|---:|---:|---:|---:|
| 2018 | 62 | 2.659.233.264 bytes | 563,4 MB |
| 2019 | 76 | 2.534.745.337 bytes | 565,0 MB |
| 2020 | 99 | 2.218.965.196 bytes | 516,9 MB |
| 2021 | 109 | 1.673.795.307 bytes | 434,2 MB |
| 2022 | 113 | 2.139.001.910 bytes | 553,0 MB |
| 2023 | 83 | 1.923.184.307 bytes | 461,7 MB |
| 2024 | 20 | 2.169.497.664 bytes | 426,8 MB |
| 2025 | 21 | 2.659.002.728 bytes | 504,4 MB |
| **Total** | **583** | **17.977.425.713 bytes** | **4,025 GB** |

Cada ano possui exatamente estes quatro ativos na Release:

- `enem-AAAA-extraido.tar.zst.000.part`;
- `enem-AAAA-extraido.tar.zst.sha256`;
- `manifest-AAAA.json`;
- `original-AAAA.zip.sha256`.

## Fonte oficial

| Ano | Arquivo oficial |
|---:|---|
| 2018 | `https://download.inep.gov.br/microdados/microdados_enem_2018.zip` |
| 2019 | `https://download.inep.gov.br/microdados/microdados_enem_2019.zip` |
| 2020 | `https://download.inep.gov.br/microdados/microdados_enem_2020.zip` |
| 2021 | `https://download.inep.gov.br/microdados/microdados_enem_2021.zip` |
| 2022 | `https://download.inep.gov.br/microdados/microdados_enem_2022.zip` |
| 2023 | `https://download.inep.gov.br/microdados/microdados_enem_2023.zip` |
| 2024 | `https://download.inep.gov.br/microdados/microdados_enem_2024.zip` |
| 2025 | `https://download.inep.gov.br/microdados/microdados_enem_2025.zip` |

Documentação complementar: <https://brazilvisible.org/docs/apis/educacao/enem/>.

## Onde os arquivos ficam

Os CSVs principais têm milhões de linhas e ultrapassam o limite de 100 MB por arquivo do GitHub. Por isso, a importação não coloca os CSVs gigantes no histórico Git do repositório.

Os workflows `Importar microdados oficiais do ENEM`:

1. baixa cada ZIP diretamente do domínio oficial do INEP;
2. registra o SHA-256 do pacote original;
3. valida a integridade do ZIP;
4. extrai integralmente todos os diretórios e arquivos;
5. produz um manifesto JSON com caminho, tamanho e SHA-256 de cada arquivo extraído;
6. cria um arquivo `tar.zst` reproduzível com todo o conteúdo extraído;
7. divide arquivos maiores em partes de até 1.900 MiB;
8. publica as partes e os manifestos nas Releases correspondentes.

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
