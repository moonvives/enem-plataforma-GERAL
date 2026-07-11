# Pacote estruturado - ENEM 360 Ciências da Natureza

Versão 2.2, refeita a partir do PDF original após reprovação da conversão anterior em auditoria semântica e estrutural.

Arquivos principais:

- `material_ia.md`: texto estruturado para leitura, vetorização e parsing.
- `questoes.jsonl`: um objeto JSON por questão, com metadados, alternativas, gabarito e imagens.
- `manifesto_questoes.csv`: índice tabular das 360 questões.
- `auditoria_transcricao.csv`: conferência cruzada entre o ENEM 360 e o volume ampliado Naturezas.
- `AUDITORIA_VERSAO_ANTERIOR.md` e `auditoria_versao_anterior.json`: diagnóstico do pacote reprovado.
- `imagens/extraidas/`: todas as imagens incorporadas no PDF, nomeadas por xref.
- `imagens/figuras/`: figuras associadas ao enunciado.
- `imagens/alternativas/`: alternativas gráficas rasterizadas individualmente A-E, inclusive elementos originalmente vetoriais.
- `imagens/contexto/`: recortes-fonte integrais de todas as questões, em alta resolução.
- `imagens/paginas/`: páginas editoriais e de análise renderizadas.
- `imagens/manifesto_imagens.csv`: ocorrência, função, página, coordenadas e caminho de cada imagem.
- `relatorio_validacao.json`: validação estrutural, visual, científico-tipográfica e de referências.
- `SHA256SUMS.txt`: hashes dos arquivos internos estáveis e do PDF de origem. O hash do ZIP final é fornecido externamente, pois um arquivo não pode conter de modo autorreferente o próprio hash final.

Os caminhos de imagem são relativos à raiz do pacote. O gabarito aparece no YAML, no JSONL, no manifesto e nas tabelas finais do Markdown.
