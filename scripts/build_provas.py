#!/usr/bin/env python3
"""Extrai as questões de Ciências da Natureza (enunciado + alternativas) dos
PDFs oficiais das provas do ENEM (texto já extraído em ``data/provas/raw``) e
as cruza com os microdados do INEP (gabarito, habilidade e parâmetros TRI).

Cada prova é descrita em ``PROVAS`` com: ano, cor do caderno, ``co_prova`` do
booklet correspondente nos microdados e o arquivo de texto bruto.

Saídas:
  - ``data/provas/enem_<ano>_cn.json`` (por prova)
  - ``docs/api/provas_cn.json`` (todas as questões com texto, consolidado)
  - ``docs/assets/provas.js`` (embutido: ``window.ENEM_PROVAS``)

Limitações: alternativas e/ou enunciados baseados em imagens (gráficos,
estruturas químicas, figuras) não são capturados pelo texto; nesses casos a
questão é marcada com ``alternativas_tipo = "imagem"`` mas mantém enunciado,
gabarito e parâmetros TRI oficiais.
"""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "provas" / "raw"
MICRO = ROOT / "data" / "microdados"
OUT_DIR = ROOT / "data" / "provas"
OUT_API = ROOT / "docs" / "api"
OUT_ASSETS = ROOT / "docs" / "assets"

# Provas disponíveis (texto bruto já salvo). co_prova = booklet regular da cor.
PROVAS = [
    {"ano": 2025, "cor": "AZUL", "co_prova": "1483", "raw": "enem_2025_dia2_azul.txt"},
]

TIER = [
    (float("-inf"), 560.0, 1, "Muito fácil"),
    (560.0, 620.0, 2, "Fácil"),
    (620.0, 680.0, 3, "Mediana"),
    (680.0, 740.0, 4, "Difícil"),
    (740.0, float("inf"), 5, "Muito difícil"),
]


def tier_de(b_enem):
    if b_enem is None:
        return None
    for lo, hi, nivel, rotulo in TIER:
        if lo <= b_enem < hi:
            return {"nivel": nivel, "rotulo": rotulo}
    return None


def norm(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


# Linhas de mobília de página / ruído a descartar do enunciado.
LIXO = re.compile(
    r"(CI[ÊE]NCIAS DA NATUREZA|2[ºo]\s*DIA|CADERNO|LEIA ATENTAMENTE|"
    r"Page\s*\d+|ENEM\s*20\d\d|^\s*\*?0\d{5,}|FOLHA DE RASCUNHO|"
    r"^\s*\|\s*:?-+:?\s*\|\s*$|^\s*\|\s*\|\s*$|^\s*-{3,}\s*$|MINIST[ÉE]RIO)",
    re.IGNORECASE,
)
RE_MARK = re.compile(r"QUEST\S{0,3}O\s+(\d{2,3})")
RE_ALT = re.compile(r"^([A-E])\s+(.+\S)\s*$")


def limpa_linhas(bloco: str) -> list[str]:
    out = []
    for ln in bloco.split("\n"):
        ln = ln.replace("**", "").strip()
        if not ln:
            continue
        if LIXO.search(ln):
            continue
        # remove watermark colado tipo "ENEM2025ENEM2025..."
        if norm(ln).replace(" ", "").lower().count("enem20") >= 3:
            continue
        out.append(ln)
    return out


def extrai_alternativas(linhas: list[str]):
    """Procura a última sequência A,B,C,D,E (cada uma com texto)."""
    # índices de linhas que começam com letra A-E + texto
    cand = [(i, m.group(1), m.group(2)) for i, ln in enumerate(linhas)
            for m in [RE_ALT.match(ln)] if m]
    # tenta achar sequência A,B,C,D,E em ordem
    letras = "ABCDE"
    for start in range(len(cand) - 4):
        janela = cand[start:start + 5]
        if [c[1] for c in janela] == list(letras):
            alt_idx0 = janela[0][0]
            alts = {c[1]: c[2] for c in janela}
            return alt_idx0, alts
    return None, None


def parse_prova(cfg: dict) -> list[dict]:
    txt = (RAW / cfg["raw"]).read_text(encoding="utf-8")
    marks = [(m.start(), int(m.group(1))) for m in RE_MARK.finditer(txt)]
    # mantém apenas primeira ocorrência de cada número (evita duplicações)
    seen, ordered = set(), []
    for pos, n in marks:
        if n not in seen:
            seen.add(n)
            ordered.append((pos, n))
    blocos = {}
    for i, (pos, n) in enumerate(ordered):
        end = ordered[i + 1][0] if i + 1 < len(ordered) else len(txt)
        blocos[n] = txt[pos:end]

    # microdados desta prova
    micro = {}
    csv_path = MICRO / f"ITENS_PROVA_{cfg['ano']}.csv"
    if not csv_path.exists():
        csv_path = next(MICRO.glob(f"{cfg['ano']} ITENS*.csv"), csv_path)
    for r in csv.DictReader(open(csv_path, encoding="latin-1"), delimiter=";"):
        if r["SG_AREA"] == "CN" and r["CO_PROVA"] == cfg["co_prova"]:
            micro[int(r["CO_POSICAO"])] = r

    questoes = []
    for pos in range(91, 136):
        m = micro.get(pos)
        if not m:
            continue
        b = None
        try:
            b = float(m["NU_PARAM_B"])
        except (ValueError, KeyError):
            b = None
        b_enem = round(500 + 100 * b, 1) if b is not None else None
        try:
            a = round(float(m["NU_PARAM_A"]), 2)
        except (ValueError, KeyError):
            a = None
        try:
            c = round(float(m["NU_PARAM_C"]), 2)
        except (ValueError, KeyError):
            c = None
        enunciado, alts, tipo = "", None, "imagem"
        if pos in blocos:
            linhas = limpa_linhas(blocos[pos])
            # remove a linha do marcador "QUESTãO N"
            linhas = [l for l in linhas if not RE_MARK.search(l)]
            idx0, alt_map = extrai_alternativas(linhas)
            if alt_map:
                enunciado = " ".join(linhas[:idx0]).strip()
                alts = [{"letra": k, "texto": alt_map[k]} for k in "ABCDE"]
                tipo = "texto"
            else:
                enunciado = " ".join(linhas).strip()
        questoes.append({
            "ano": cfg["ano"],
            "co_item": int(m["CO_ITEM"]),
            "numero": pos,
            "codigo": f"E{cfg['ano']}-{pos}",
            "cor": cfg["cor"],
            "area": "CN",
            "habilidade": int(m["CO_HABILIDADE"]) if m.get("CO_HABILIDADE") else None,
            "gabarito": m["TX_GABARITO"] or None,
            "a": a, "b": b, "c": c, "b_enem": b_enem,
            "tier": tier_de(b_enem),
            "enunciado": enunciado,
            "alternativas": alts,
            "alternativas_tipo": tipo,
        })
    return questoes


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    todas = []
    for cfg in PROVAS:
        qs = parse_prova(cfg)
        (OUT_DIR / f"enem_{cfg['ano']}_cn.json").write_text(
            json.dumps(qs, ensure_ascii=False, indent=2), encoding="utf-8")
        com_texto = sum(1 for q in qs if q["alternativas_tipo"] == "texto")
        com_enun = sum(1 for q in qs if q["enunciado"])
        print(f"ENEM {cfg['ano']} {cfg['cor']}: {len(qs)} questões | "
              f"enunciado: {com_enun} | alternativas em texto: {com_texto}")
        todas.extend(qs)

    OUT_API.mkdir(parents=True, exist_ok=True)
    OUT_ASSETS.mkdir(parents=True, exist_ok=True)
    meta = {
        "fonte": "Provas oficiais do ENEM (INEP) + microdados ITENS_PROVA",
        "total": len(todas),
        "anos": sorted({q["ano"] for q in todas}),
    }
    payload = {"meta": meta, "questoes": todas}
    (OUT_API / "provas_cn.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    (OUT_ASSETS / "provas.js").write_text(
        "// Gerado por scripts/build_provas.py — não editar à mão.\n"
        "window.ENEM_PROVAS = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8")
    print(f"Total consolidado: {len(todas)} questões de {meta['anos']}")


if __name__ == "__main__":
    main()
