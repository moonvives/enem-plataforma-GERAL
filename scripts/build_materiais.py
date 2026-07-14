#!/usr/bin/env python3
"""Gera o catálogo somente a partir dos PDFs versionados no repositório.

Não acessa serviços externos, não contém IDs de provedores e não produz links
remotos. O catálogo público aponta apenas para arquivos sob ``data/naturezas``.
"""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "naturezas"
API = ROOT / "docs" / "api" / "materiais.json"
ASSET = ROOT / "docs" / "assets" / "materiais.js"
MANIFEST = BASE / "MANIFEST.md"
LOCAL_MANIFEST = BASE / "manifest.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def item(path: Path) -> dict:
    relative = path.relative_to(BASE)
    parts = relative.parts
    size = path.stat().st_size
    return {
        "disciplina": parts[0] if len(parts) > 1 else "Geral",
        "subpasta": parts[1] if len(parts) > 2 else None,
        "tipo": "pdf",
        "titulo": path.name,
        "tamanho_bytes": size,
        "tamanho_mb": round(size / 1024 / 1024, 1),
        "sha256": sha256(path),
        "no_repositorio": True,
        "caminho": path.relative_to(ROOT).as_posix(),
    }


def main() -> None:
    itens = [item(path) for path in sorted(BASE.rglob("*.pdf"))]
    counts = Counter(entry["disciplina"] for entry in itens)
    resumo = {
        "total": len(itens),
        "versionados": len(itens),
        "pdfs": len(itens),
        "por_disciplina": dict(sorted(counts.items())),
        "origem": "Arquivos versionados no repositório",
    }
    payload = {"resumo": resumo, "itens": itens}

    API.parent.mkdir(parents=True, exist_ok=True)
    ASSET.parent.mkdir(parents=True, exist_ok=True)
    API.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    LOCAL_MANIFEST.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    ASSET.write_text(
        "// Gerado por scripts/build_materiais.py — catálogo local, sem integrações externas.\n"
        "window.ENEM_MATERIAIS="
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";",
        encoding="utf-8",
    )

    lines = [
        "# Biblioteca de Ciências da Natureza",
        "",
        "Catálogo dos PDFs versionados neste repositório. Não há links, IDs ou dependências de armazenamento externo.",
        "",
        f"- PDFs: **{len(itens)}**",
        f"- Tamanho total: **{sum(x['tamanho_bytes'] for x in itens) / 1024 / 1024:.1f} MB**",
        "",
        "| Disciplina | Subpasta | Arquivo | Tamanho | SHA-256 |",
        "|---|---|---|--:|---|",
    ]
    for entry in itens:
        lines.append(
            f"| {entry['disciplina']} | {entry['subpasta'] or '—'} | "
            f"`{entry['titulo']}` | {entry['tamanho_mb']} MB | `{entry['sha256']}` |"
        )
    MANIFEST.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"OK materiais: {len(itens)} PDFs locais; integrações externas: 0")


if __name__ == "__main__":
    main()
