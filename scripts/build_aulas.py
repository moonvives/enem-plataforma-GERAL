#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_aulas.py — Compila as aulas (conteúdo extraído das videoaulas) de
data/aulas/*.json para os artefatos consumidos pelo site.

Cada aula é conteúdo de estudo estruturado a partir da transcrição da videoaula:
os "modelos" de questão que a aula ensina, com a ideia central, como o padrão é
cobrado no ENEM e um atalho de resolução.

Saídas:
  docs/api/aulas.json     -> {meta, aulas:[...]}
  docs/assets/aulas.js    -> window.ENEM_AULAS
"""
import json, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "aulas")
API = os.path.join(ROOT, "docs", "api")
ASSETS = os.path.join(ROOT, "docs", "assets")


def main():
    os.makedirs(API, exist_ok=True)
    os.makedirs(ASSETS, exist_ok=True)
    aulas = []
    for path in sorted(glob.glob(os.path.join(SRC, "*.json"))):
        aulas.append(json.load(open(path, encoding="utf-8")))
    meta = {
        "n_aulas": len(aulas),
        "n_modelos": sum(len(a.get("modelos", [])) for a in aulas),
        "temas": sorted({a.get("tema_banco") for a in aulas if a.get("tema_banco")}),
        "fonte": "Conteúdo de estudo sintetizado a partir das transcrições das videoaulas "
                 "(uso pessoal do assinante).",
    }
    payload = {"meta": meta, "aulas": aulas}
    with open(os.path.join(API, "aulas.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(ASSETS, "aulas.js"), "w", encoding="utf-8") as f:
        f.write("// Gerado por scripts/build_aulas.py — não editar à mão.\nwindow.ENEM_AULAS=")
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")
    print(f"OK aulas: {meta['n_aulas']} aulas | {meta['n_modelos']} modelos | temas {meta['temas']}")


if __name__ == "__main__":
    main()
