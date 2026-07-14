#!/usr/bin/env python3
"""Extrai as 540 questões de Ciências da Natureza (edições não regulares do
ENEM) a partir do material-fonte em Markdown e gera o dataset estruturado
consumido pela plataforma web.

Fontes (em ``data/source``):
  - ``ciencias_natureza_ppl_compressed.md``: texto integral do eBook, com os
    cabeçalhos das questões (habilidade e enunciado) e as tabelas de gabarito
    (resposta, dificuldade TRI e edição — a referência canônica).
  - ``enem_cn_edicoes_nao_regulares_TRI.md``: régua de dificuldade e metadados.

Saídas:
  - ``data/questions.json``: dataset canônico (lista de questões).
  - ``docs/api/questions.json``: mesmo dataset, servido como endpoint estático.
  - ``docs/api/stats.json``: agregações para o painel analítico.
  - ``docs/api/meta.json``: metadados (habilidades, competências, régua, filtros).
  - ``docs/assets/data.js``: dataset estático consumido pela interface web
    (``file://``), evitando dependência de ``fetch``/CORS.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "source" / "ciencias_natureza_ppl_compressed.md"
OUT_DATA = ROOT / "data" / "questions.json"
OUT_API = ROOT / "docs" / "api"
OUT_ASSETS = ROOT / "docs" / "assets"

# --- Matriz de Referência: habilidade -> competência e descrições -----------

HABILIDADES = {
    1: "Reconhecer características de fenômenos ondulatórios ou oscilatórios, relacionando-os a seus usos.",
    2: "Associar a solução de problemas de comunicação, transporte ou saúde ao desenvolvimento científico e tecnológico.",
    3: "Confrontar interpretações científicas com interpretações do senso comum ao longo do tempo ou entre culturas.",
    4: "Avaliar propostas de intervenção no ambiente, considerando a qualidade de vida e a conservação da biodiversidade.",
    5: "Dimensionar circuitos ou dispositivos elétricos de uso cotidiano.",
    6: "Relacionar informações para compreender manuais de instalação ou utilização de aparelhos.",
    7: "Selecionar testes de controle, parâmetros ou critérios para a comparação de materiais e produtos.",
    8: "Identificar etapas em processos de obtenção, transformação, utilização ou reciclagem de recursos.",
    9: "Compreender a importância dos ciclos biogeoquímicos ou do fluxo de energia para a vida.",
    10: "Analisar perturbações ambientais, identificando fontes, transporte e destino dos poluentes.",
    11: "Reconhecer benefícios, limitações e aspectos éticos da biotecnologia.",
    12: "Avaliar impactos em ambientes naturais decorrentes de atividades sociais ou econômicas.",
    13: "Reconhecer mecanismos de transmissão da vida, prevendo ou explicando características dos seres vivos.",
    14: "Identificar padrões em fenômenos e processos vitais dos organismos.",
    15: "Interpretar modelos e experimentos para explicar fenômenos ou processos biológicos.",
    16: "Compreender o papel da evolução na produção de padrões e na organização taxonômica dos seres vivos.",
    17: "Relacionar informações apresentadas em diferentes formas de linguagem e representação.",
    18: "Relacionar propriedades físicas, químicas ou biológicas de produtos, sistemas ou procedimentos tecnológicos.",
    19: "Avaliar métodos, processos ou procedimentos das ciências naturais para diagnosticar ou solucionar problemas.",
    20: "Caracterizar causas ou efeitos dos movimentos de partículas, substâncias, objetos ou corpos celestes.",
    21: "Utilizar leis físicas ou químicas para interpretar processos naturais ou tecnológicos.",
    22: "Compreender fenômenos decorrentes da interação entre a radiação e a matéria.",
    23: "Avaliar possibilidades de geração, uso ou transformação de energia em ambientes específicos.",
    24: "Utilizar códigos e nomenclatura da química para caracterizar materiais, substâncias ou transformações.",
    25: "Caracterizar materiais ou substâncias, identificando etapas, rendimentos ou implicações de sua obtenção.",
    26: "Avaliar implicações sociais, ambientais e/ou econômicas na produção ou no consumo de recursos.",
    27: "Avaliar propostas de intervenção no ambiente aplicando conhecimentos químicos.",
    28: "Associar características adaptativas dos organismos ao seu modo de vida ou aos seus limites de distribuição.",
    29: "Interpretar experimentos ou técnicas que utilizam seres vivos.",
    30: "Avaliar propostas de alcance individual ou coletivo para a manutenção da saúde.",
}

COMPETENCIAS = {
    1: "Compreender as ciências naturais e as tecnologias associadas como construções humanas.",
    2: "Identificar a presença e aplicar as tecnologias associadas às ciências naturais em diferentes contextos.",
    3: "Associar intervenções de degradação ou conservação ambiental a processos produtivos e científico-tecnológicos.",
    4: "Compreender interações entre organismos e ambiente, em particular as relacionadas à saúde humana.",
    5: "Entender métodos e procedimentos próprios das ciências naturais.",
    6: "Apropriar-se de conhecimentos da física para compreender o mundo natural e tecnológico.",
    7: "Apropriar-se de conhecimentos da química para compreender o mundo natural e tecnológico.",
    8: "Apropriar-se de conhecimentos da biologia para compreender o mundo natural e tecnológico.",
}

# Área do conhecimento predominante por habilidade (Física / Química / Biologia).
AREA_POR_HAB = {
    1: "Física", 2: "Física", 3: "Interdisciplinar", 4: "Biologia",
    5: "Física", 6: "Física", 7: "Química",
    8: "Química", 9: "Biologia", 10: "Química", 11: "Biologia", 12: "Biologia",
    13: "Biologia", 14: "Biologia", 15: "Biologia", 16: "Biologia",
    17: "Interdisciplinar", 18: "Interdisciplinar", 19: "Interdisciplinar",
    20: "Física", 21: "Física", 22: "Física", 23: "Física",
    24: "Química", 25: "Química", 26: "Química", 27: "Química",
    28: "Biologia", 29: "Biologia", 30: "Biologia",
}


def competencia_de(hab: int) -> int:
    ranges = [(1, 4, 1), (5, 7, 2), (8, 12, 3), (13, 16, 4),
              (17, 19, 5), (20, 23, 6), (24, 27, 7), (28, 30, 8)]
    for lo, hi, comp in ranges:
        if lo <= hab <= hi:
            return comp
    raise ValueError(f"habilidade fora da matriz: {hab}")


# --- Régua de dificuldade (parâmetro b da TRI) ------------------------------

def tier_de(b: float | None) -> dict | None:
    if b is None:
        return None
    faixas = [
        (float("-inf"), 560.0, 1, "Muito fácil", "1"),
        (560.0, 620.0, 2, "Fácil", "2"),
        (620.0, 680.0, 3, "Mediana", "3"),
        (680.0, 740.0, 4, "Difícil", "4"),
        (740.0, float("inf"), 5, "Muito difícil", "5"),
    ]
    for lo, hi, nivel, rotulo, icone in faixas:
        if lo <= b < hi:
            return {"nivel": nivel, "rotulo": rotulo, "icone": icone}
    return None


# --- Normalização de edições ------------------------------------------------

def normaliza_edicao(nome: str) -> str:
    n = nome.strip()
    if n.startswith("2ª Aplic"):
        return "2ª Aplicação"
    return {"Digital": "Digital", "Libras": "Libras", "PPL": "PPL"}.get(n, n)


# --- Regexes ----------------------------------------------------------------

RE_GAB = re.compile(
    r"Questão (\d{3})\s+([A-EX])\s+(Convergência|Anulada|[\d.,]+)\s+"
    r"(PPL|Digital|Libras|2ª Aplic\.)\s+(\d{4})"
)
RE_HDR = re.compile(
    r"Questão (\d{3}) \(H(\d+)\s*\|\s*([^|]+?)\s*\|\s*([\d.,]+|Anulada|Convergência)\)"
)
# Cabeçalho/rodapé de página repetido ao longo do eBook.
RE_RUNNING = re.compile(
    r"[^\n]*?Natureza PPL por Habilidades e Dificuldades dos ItensP[áa]gina\d+"
)
RE_PAGE = re.compile(r"###\s*Page\s*\d+")
RE_TIER_ICONS = re.compile(r"[❶❷❸❹❺①②③④⑤]+")


def to_float(raw: str) -> float | None:
    if raw in ("Convergência", "Anulada"):
        return None
    return round(float(raw.replace(".", "").replace(",", ".")), 1)


def limpa_enunciado(texto: str) -> str:
    texto = RE_PAGE.sub(" ", texto)
    texto = RE_RUNNING.sub(" ", texto)
    texto = RE_TIER_ICONS.sub(" ", texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    return texto


def main() -> None:
    src = SRC.read_text(encoding="utf-8")

    # 1) Gabaritos (fonte canônica: resposta, dificuldade e edição).
    gab: dict[int, dict] = {}
    for num, resp, dif, ed, ano in RE_GAB.findall(src):
        gab[int(num)] = {
            "gabarito": None if resp == "X" else resp,
            "b_raw": dif,
            "b": to_float(dif),
            "edicao": normaliza_edicao(ed),
            "ano": int(ano),
        }
    assert len(gab) == 540, f"esperado 540 gabaritos, obtido {len(gab)}"

    # 2) Cabeçalhos do corpo: habilidade + posições para extrair enunciados.
    hab_por_num: dict[int, int] = {}
    matches = list(RE_HDR.finditer(src))
    enunciados: dict[int, str] = {}
    for i, m in enumerate(matches):
        num = int(m.group(1))
        hab_por_num[num] = int(m.group(2))
        ini = m.end()
        fim = matches[i + 1].start() if i + 1 < len(matches) else len(src)
        enunciados[num] = limpa_enunciado(src[ini:fim])[:1200]

    # Q436 e Q437 (dificuldade "Convergência") não casam o cabeçalho no OCR;
    # pertencem à Habilidade 24 (Competência 7, faixa Q417–Q437).
    for n in (436, 437):
        hab_por_num.setdefault(n, 24)

    # 3) Montagem do dataset.
    questoes = []
    for num in range(1, 541):
        g = gab[num]
        hab = hab_por_num[num]
        comp = competencia_de(hab)
        b = g["b"]
        registro = {
            "numero": num,
            "codigo": f"Q{num:03d}",
            "habilidade": hab,
            "habilidade_descricao": HABILIDADES[hab],
            "competencia": comp,
            "competencia_descricao": COMPETENCIAS[comp],
            "area": AREA_POR_HAB[hab],
            "edicao": g["edicao"],
            "ano": g["ano"],
            "aplicacao": f"{g['edicao']} {g['ano']}",
            "gabarito": g["gabarito"],
            "b": b,
            "b_texto": g["b_raw"] if b is None else f"{b:.1f}".replace(".", ","),
            "anulada": g["gabarito"] is None or g["b_raw"] == "Anulada",
            "tier": tier_de(b),
            "enunciado": enunciados.get(num, ""),
        }
        questoes.append(registro)

    # 4) Estatísticas para o painel analítico.
    validas = [q for q in questoes if q["b"] is not None]
    bs = [q["b"] for q in validas]
    media = round(sum(bs) / len(bs), 1)
    variancia = sum((x - media) ** 2 for x in bs) / len(bs)
    desvio = round(variancia ** 0.5, 1)

    por_tier = Counter(q["tier"]["rotulo"] for q in validas)
    por_hab = Counter(q["habilidade"] for q in questoes)
    por_comp = Counter(q["competencia"] for q in questoes)
    por_area = Counter(q["area"] for q in questoes)
    por_edicao = Counter(q["aplicacao"] for q in questoes)
    por_ano = Counter(q["ano"] for q in questoes)

    dificuldade_media_hab = {}
    b_por_hab = defaultdict(list)
    for q in validas:
        b_por_hab[q["habilidade"]].append(q["b"])
    for h, vals in b_por_hab.items():
        dificuldade_media_hab[h] = round(sum(vals) / len(vals), 1)

    ordem_tier = ["Muito fácil", "Fácil", "Mediana", "Difícil", "Muito difícil"]
    stats = {
        "total": len(questoes),
        "validas_tri": len(validas),
        "anuladas": sum(1 for q in questoes if q["anulada"]),
        "dificuldade_media": media,
        "desvio_padrao": desvio,
        "b_min": min(bs),
        "b_max": max(bs),
        "por_tier": [{"rotulo": t, "total": por_tier.get(t, 0)} for t in ordem_tier],
        "por_habilidade": [
            {
                "habilidade": h,
                "total": por_hab[h],
                "competencia": competencia_de(h),
                "area": AREA_POR_HAB[h],
                "dificuldade_media": dificuldade_media_hab.get(h),
            }
            for h in range(1, 31)
        ],
        "por_competencia": [
            {"competencia": c, "total": por_comp[c]} for c in range(1, 9)
        ],
        "por_area": [
            {"area": a, "total": por_area[a]}
            for a in sorted(por_area, key=lambda x: -por_area[x])
        ],
        "por_edicao": [
            {"aplicacao": e, "total": por_edicao[e]}
            for e in sorted(por_edicao, key=lambda x: (-por_edicao[x], x))
        ],
        "por_ano": [
            {"ano": a, "total": por_ano[a]} for a in sorted(por_ano)
        ],
    }

    meta = {
        "titulo": "ENEM Ciências da Natureza — Edições Não Regulares",
        "subtitulo": "PPL, 2ª Aplicação, Libras e Digital (2012–2024)",
        "habilidades": [
            {
                "id": h,
                "descricao": HABILIDADES[h],
                "competencia": competencia_de(h),
                "area": AREA_POR_HAB[h],
            }
            for h in range(1, 31)
        ],
        "competencias": [
            {"id": c, "descricao": COMPETENCIAS[c]} for c in range(1, 9)
        ],
        "areas": sorted({AREA_POR_HAB[h] for h in range(1, 31)}),
        "edicoes": sorted({q["edicao"] for q in questoes}),
        "anos": sorted({q["ano"] for q in questoes}),
        "regua": [
            {"nivel": 1, "rotulo": "Muito fácil", "icone": "1", "intervalo": "b < 560,0"},
            {"nivel": 2, "rotulo": "Fácil", "icone": "2", "intervalo": "560,0 ≤ b < 620,0"},
            {"nivel": 3, "rotulo": "Mediana", "icone": "3", "intervalo": "620,0 ≤ b < 680,0"},
            {"nivel": 4, "rotulo": "Difícil", "icone": "4", "intervalo": "680,0 ≤ b < 740,0"},
            {"nivel": 5, "rotulo": "Muito difícil", "icone": "5", "intervalo": "b ≥ 740,0"},
        ],
    }

    # 5) Gravação.
    OUT_API.mkdir(parents=True, exist_ok=True)
    OUT_ASSETS.mkdir(parents=True, exist_ok=True)
    OUT_DATA.parent.mkdir(parents=True, exist_ok=True)

    payload = {"meta": meta, "questoes": questoes}
    OUT_DATA.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_API / "questions.json").write_text(
        json.dumps(questoes, ensure_ascii=False), encoding="utf-8"
    )
    (OUT_API / "stats.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_API / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    embed = (
        "// Gerado por scripts/build_dataset.py — não editar à mão.\n"
        "window.ENEM_DATA = "
        + json.dumps({"meta": meta, "questoes": questoes, "stats": stats}, ensure_ascii=False)
        + ";\n"
    )
    (OUT_ASSETS / "data.js").write_text(embed, encoding="utf-8")

    print(f"OK: {len(questoes)} questões")
    print(f"  válidas TRI: {len(validas)} | anuladas: {stats['anuladas']}")
    print(f"  dificuldade média: {media} | desvio: {desvio} | faixa: {min(bs)}–{max(bs)}")
    print(f"  enunciados extraídos: {sum(1 for q in questoes if q['enunciado'])}")


if __name__ == "__main__":
    main()
