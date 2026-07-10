#!/usr/bin/env python3
"""Constrói o dataset de itens oficiais do ENEM a partir dos microdados do INEP.

Fonte: ``data/microdados/ITENS_PROVA_AAAA.csv`` (arquivos ITENS_PROVA dos
microdados oficiais, 2009–2025). Cada arquivo traz um item por linha e por cor
de caderno; os parâmetros da TRI (``NU_PARAM_A/B/C``) estão na métrica
padronizada (θ ~ N(0,1)). A escala de proficiência do ENEM (0–1000) é obtida por
``proficiência = 500 + 100 · θ``, logo ``b_enem = 500 + 100 · NU_PARAM_B``.

Colunas relevantes: ``SG_AREA`` (CN/CH/LC/MT), ``CO_ITEM``, ``TX_GABARITO``,
``CO_HABILIDADE``, ``IN_ITEM_ABAN`` (item abandonado/anulado), ``NU_PARAM_A/B/C``.

Saídas:
  - ``data/microdados.json``: todos os itens (todas as áreas e anos), deduplicados.
  - ``docs/api/microdados_cn.json``: itens de Ciências da Natureza (foco da plataforma).
  - ``docs/api/microdados_stats.json``: indicadores de CN por recorte de anos.
  - ``docs/assets/microdados.js``: itens de CN embutidos (window.ENEM_MICRO) para
    o painel funcionar offline.
"""
from __future__ import annotations

import csv
import glob
import io
import json
import os
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "data" / "microdados"
OUT_DATA = ROOT / "data" / "microdados.json"
OUT_API = ROOT / "docs" / "api"
OUT_ASSETS = ROOT / "docs" / "assets"

AREAS = {
    "CN": "Ciências da Natureza",
    "CH": "Ciências Humanas",
    "LC": "Linguagens e Códigos",
    "MT": "Matemática",
}

# Régua de dificuldade na escala ENEM (idêntica à do restante da plataforma).
REGUA = [
    (float("-inf"), 560.0, 1, "Muito fácil", "❶"),
    (560.0, 620.0, 2, "Fácil", "❷"),
    (620.0, 680.0, 3, "Mediana", "❸"),
    (680.0, 740.0, 4, "Difícil", "❹"),
    (740.0, float("inf"), 5, "Muito difícil", "❺"),
]


def tier_de(b_enem):
    if b_enem is None:
        return None
    for lo, hi, nivel, rotulo, icone in REGUA:
        if lo <= b_enem < hi:
            return {"nivel": nivel, "rotulo": rotulo, "icone": icone}
    return None


def to_float(x):
    x = (x or "").strip().replace(",", ".")
    if not x:
        return None
    try:
        return float(x)
    except ValueError:
        return None


def to_int(x):
    x = (x or "").strip()
    try:
        return int(float(x))
    except ValueError:
        return None


def read_rows(fp):
    txt = Path(fp).read_bytes().decode("latin-1")
    return csv.DictReader(io.StringIO(txt), delimiter=";")


def build():
    files = sorted(glob.glob(str(SRC_DIR / "ITENS_PROVA_*.csv")))
    if not files:
        raise SystemExit("Nenhum ITENS_PROVA_*.csv em data/microdados/")

    # Dedup por (ano, CO_ITEM): o mesmo item aparece em várias cores de caderno.
    itens = {}
    for fp in files:
        ano = int(os.path.basename(fp)[12:16])
        for r in read_rows(fp):
            area = (r.get("SG_AREA") or "").strip()
            co = (r.get("CO_ITEM") or "").strip()
            if not co or area not in AREAS:
                continue
            key = (ano, co)
            b = to_float(r.get("NU_PARAM_B"))
            registro = {
                "ano": ano,
                "co_item": int(co),
                "area": area,
                "habilidade": to_int(r.get("CO_HABILIDADE")),
                "gabarito": (r.get("TX_GABARITO") or "").strip() or None,
                "a": to_float(r.get("NU_PARAM_A")),
                "b": b,
                "c": to_float(r.get("NU_PARAM_C")),
                "b_enem": round(500 + 100 * b, 1) if b is not None else None,
                "abandonado": (r.get("IN_ITEM_ABAN") or "").strip() == "1",
                "cor": (r.get("TX_COR") or "").strip() or None,
            }
            registro["tier"] = tier_de(registro["b_enem"])
            # Preferir a versão com parâmetros preenchidos.
            if key not in itens or (itens[key]["b"] is None and b is not None):
                itens[key] = registro

    todos = sorted(itens.values(), key=lambda x: (x["ano"], x["co_item"]))
    cn = [x for x in todos if x["area"] == "CN"]

    # Estatísticas de CN por recorte de anos (o painel usa 2020–2025 por padrão).
    def stats_cn(anos):
        sel = [x for x in cn if x["ano"] in anos]
        com_b = [x for x in sel if x["b_enem"] is not None]
        bs = [x["b_enem"] for x in com_b]
        a_s = [x["a"] for x in sel if x["a"] is not None]
        c_s = [x["c"] for x in sel if x["c"] is not None]
        if not bs:
            return None
        media = sum(bs) / len(bs)
        desvio = (sum((v - media) ** 2 for v in bs) / len(bs)) ** 0.5
        por_ano = Counter(x["ano"] for x in sel)
        por_tier = Counter(x["tier"]["rotulo"] for x in com_b)
        por_hab = Counter(x["habilidade"] for x in sel if x["habilidade"])
        por_gab = Counter(x["gabarito"] for x in sel if x["gabarito"] in list("ABCDE"))
        b_por_hab = defaultdict(list)
        for x in com_b:
            if x["habilidade"]:
                b_por_hab[x["habilidade"]].append(x["b_enem"])
        ordem = ["Muito fácil", "Fácil", "Mediana", "Difícil", "Muito difícil"]
        return {
            "anos": sorted(anos),
            "total": len(sel),
            "com_parametro": len(com_b),
            "dificuldade_media": round(media, 1),
            "desvio_padrao": round(desvio, 1),
            "discriminacao_media": round(sum(a_s) / len(a_s), 2) if a_s else None,
            "acaso_medio": round(sum(c_s) / len(c_s), 2) if c_s else None,
            "b_min": round(min(bs), 1),
            "b_max": round(max(bs), 1),
            "por_ano": [{"ano": a, "total": por_ano[a]} for a in sorted(por_ano)],
            "por_tier": [{"rotulo": t, "total": por_tier.get(t, 0)} for t in ordem],
            "por_habilidade": [
                {
                    "habilidade": h,
                    "total": por_hab.get(h, 0),
                    "dificuldade_media": round(sum(b_por_hab[h]) / len(b_por_hab[h]), 1)
                    if b_por_hab.get(h) else None,
                }
                for h in range(1, 31)
            ],
            "por_gabarito": [
                {"letra": g, "total": por_gab.get(g, 0)} for g in list("ABCDE")
            ],
        }

    anos_cn = sorted({x["ano"] for x in cn})
    stats = {
        "padrao": stats_cn(set(range(2020, 2026))),
        "todos_anos": stats_cn(set(anos_cn)),
        "anos_disponiveis": anos_cn,
    }

    meta = {
        "fonte": "Microdados do ENEM (INEP) — arquivos ITENS_PROVA",
        "conversao_escala": "b_enem = 500 + 100 × NU_PARAM_B",
        "areas": [{"sigla": k, "nome": v} for k, v in AREAS.items()],
        "anos": anos_cn,
        "regua": [
            {"nivel": n, "rotulo": r, "icone": i,
             "intervalo": (f"< {int(hi)}" if lo == float("-inf")
                           else f"≥ {int(lo)}" if hi == float("inf")
                           else f"{int(lo)}–{int(hi)-1}")}
            for lo, hi, n, r, i in REGUA
        ],
        "total_itens": len(todos),
        "total_cn": len(cn),
    }

    OUT_API.mkdir(parents=True, exist_ok=True)
    OUT_ASSETS.mkdir(parents=True, exist_ok=True)
    OUT_DATA.write_text(
        json.dumps({"meta": meta, "itens": todos}, ensure_ascii=False),
        encoding="utf-8",
    )
    (OUT_API / "microdados_cn.json").write_text(
        json.dumps(cn, ensure_ascii=False), encoding="utf-8"
    )
    (OUT_API / "microdados_stats.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_ASSETS / "microdados.js").write_text(
        "// Gerado por scripts/build_microdados.py — não editar à mão.\n"
        "window.ENEM_MICRO = "
        + json.dumps({"meta": meta, "itens": cn, "stats": stats}, ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )

    p = stats["padrao"]
    print(f"OK: {len(todos)} itens oficiais ({len(cn)} de CN)")
    print(f"  CN 2020–2025: {p['total']} itens | b médio {p['dificuldade_media']} "
          f"| a médio {p['discriminacao_media']} | c médio {p['acaso_medio']}")
    print(f"  faixa b: {p['b_min']}–{p['b_max']}")


if __name__ == "__main__":
    build()
