#!/usr/bin/env python3
"""Baixa os materiais de Ciências da Natureza da biblioteca do Drive e gera o
manifesto (catálogo) de tudo — inclusive itens que não cabem no repositório.

Os arquivos do Drive estão compartilhados por link; o download direto é feito
via ``drive.usercontent.google.com``. PDFs até 100 MB são gravados em
``data/naturezas/<disciplina>/``. Vídeos e arquivos acima do limite do GitHub
(100 MB por arquivo) NÃO são versionados: entram apenas no manifesto, com o
link direto de download, para não ficarem ocultos.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "data" / "naturezas"
GITHUB_LIMIT = 100 * 1024 * 1024  # 100 MB por arquivo

# Inventário completo da pasta "Áreas do Conhecimento / Naturezas" do Drive.
# (disciplina, subpasta, tipo, título, id, tamanho_bytes)
INVENTARIO = [
    ("Geral", "", "pdf", "Naturezas.pdf", "1TckPUn9GTMGn2ykBSuQtI5eDibiNeShN", 56553694),
    ("Geral", "", "pdf", "eBook - Naturezas PPL.pdf", "1Hkbb5vWjZl6oTXkr4f7jaHfc6cWXa3MA", 53303714),
    ("Geral", "", "pdf", "Enem 360 de Cn do Fredao.pdf", "1h8wwHmEoTlelSfW-lA6pSlKcB8hQOFi4", 15189792),
    ("Geral", "", "pdf", "Manual do ENEM - Natureza.pdf", "16ViS5aWA-WMABWITQmIaiCmgioICcjrR", 5161775),
    ("Fisica", "Teoria", "pdf", "Manual para gabaritar FISICA - ENEM.pdf", "1f6INYoxtNGAWrLT-m9Ae6yZ2jcdaw9vc", 120869259),
    ("Fisica", "Teoria", "pdf", "Fisica I.pdf", "1C7kAVAE8vqF1N89lEXtM01J20uj6pnOf", 23410132),
    ("Biologia", "Teoria", "pdf", "Manual para gabaritar BIOLOGIA - ENEM.pdf", "1wtg_jmv9DqWc6VGPsSiiCad8UGXKpNJx", 14208850),
    ("Quimica", "Teoria", "pdf", "Principios de Quimica - Questionando a Vida Moderna e o Meio Ambiente.pdf", "1rkHwhSGmaxHrPkQ9VKzCKe4E70cX4bR-", 91932278),
    ("Quimica", "Teoria", "pdf", "Apostila 01 Vestcursos Quimica Organica.pdf", "1ISCpobcTYD0iO9Vg96VchGFcIz8QN56P", 23937061),
    ("Quimica", "Teoria", "pdf", "Apostila 01 Vestcursos Quimica Geral.pdf", "12YyZJFugKpuGcaDMadDTIZhASJKIwxIo", 22993752),
    ("Quimica", "Teoria", "pdf", "Apostila 01 Vestcursos Fisico-Quimica.pdf", "10AE1aIOEIwF0sTrMARjeCnDdfKnNv_UJ", 16944546),
    ("Quimica", "Teoria", "pdf", "Apostila 02 Vestcursos Quimica Organica.pdf", "10S2MHqiIV_TSZQQmY9Pziuh2lhvZcLV3", 15373729),
    ("Quimica", "Teoria", "pdf", "Apostila 02 Vestcursos Quimica Geral.pdf", "1IIsGbJ6SHFCcXgd1uyXBCTIMCEQYbK-r", 11467298),
    ("Quimica", "Teoria", "pdf", "Apostila 02 Vestcursos Fisico-Quimica.pdf", "1YZnXTLfBC-Qzm5IK6RduUS0u3kmQpyq2", 11264351),
    ("Quimica", "Teoria", "pdf", "Apostila 01 Modulo 01 Episteme - Quimica Geral.pdf", "1mQoLidxT7a2ErPhDeIOeUHcI7AgwJWqo", 5036638),
    ("Quimica", "Teoria", "pdf", "Numero de oxidacao - Curso de Quimica Pro.pdf", "1MnXdX1OJqWX0gPBcJQlkhxry7jl5i_tJ", 276563),
    ("Quimica", "Teoria", "pdf", "Manual para gabaritar QUIMICA - ENEM.pdf", "1j3yx4uqySRlCptIyRJzyR8cOgwVpQSui", 40261252),
    ("Quimica", "Teoria", "pdf", "Quimica I.pdf", "1LyAHiLllHoZKZ_B2-KDXzijvVDG6cjm_", 29008880),
    ("Quimica", "Simulados", "pdf", "Simulado ENEM Quimica - Questoes (Episteme).pdf", "1JlezODJZ9rV8zv8AtCGRuaapHyf8ZDJV", 508610),
    ("Quimica", "Simulados", "pdf", "Simulado 2 ENEM Quimica - Questoes (Episteme).pdf", "1sDgt0YB_4tOMyfBEISI-eXBSKcBtMquj", 546977),
    ("Quimica", "Simulados", "pdf", "Simulado 2 ENEM Quimica - Questoes e Comentarios (Episteme).pdf", "12BR5aOCxwl3AGRZ2sqFc2q8nuICmEcaa", 664716),
    ("Quimica", "Simulados", "pdf", "Simulado ENEM Quimica - Questoes e Comentarios (Episteme).pdf", "1jtpRqJE5QhO6LwBwkJ2JE0fJGlvyQX2W", 656365),
    # Vídeos (Aulas) — acima do limite do GitHub, catalogados com link.
    ("Geral", "", "video", "Minhas apostas para o Enem 2025 (Natureza e Matematica).mp4", "1dj0-7nFXU_83A7N1yMtkdFIXl0xEqnpH", 566911878),
    ("Geral", "", "video", "PARTE 2 - Minhas apostas para o Enem 2025 (Natureza e Matematica).mp4", "1eaJaeJutfOJZmrrbFSVmeJA1nGpH8uzH", 217056142),
    ("Biologia", "Aulas", "video", "Evolucao e Taxonomia.mp4", "1izFsyKWhf9NCG3xO_u800lTMQ5YAJhB6", 557320983),
    ("Biologia", "Aulas", "video", "Metabolismo Energetico.mp4", "1yNDP2GHO4zQaAqOshkLnWG8MdruPmsl3", 498197360),
    ("Biologia", "Aulas", "video", "Destrinchando o Enem 5.mp4", "1XaOher1y41Ykvp2jjsnWUNzhong-MKhp", 939580259),
    ("Biologia", "Aulas", "video", "Sistemas Ecologicos DOE 2.mp4", "1NKhrtB-tmWGE6g533FGfIR7EEBln8ep5", 514202810),
    ("Biologia", "Aulas", "video", "Fisiologia Humana I.mp4", "1GrbjI3wxcHX53M0_-V317bh18Pk73epJ", 651668284),
    ("Biologia", "Aulas", "video", "Fisiologia Humana II.mp4", "1mUtejf8PR9YVX6LnjgynkIoomXpaN9P3", 567496893),
    ("Biologia", "Aulas", "video", "DNA.mp4", "1CyDp_D2X5NvsOWu8vhdmhzR6Ji6TqKT_", 144975064),
    ("Biologia", "Aulas", "video", "Sistemas Ecologicos.mp4", "1DR5duwPCtpddKQ0PbI1AlkuxKakpGeZ1", 161249790),
    ("Biologia", "Aulas", "video", "Bases da Ecologia.mp4", "131M7_y8R4Dn4_knyIb6k6aeAm-KIMuth", 526177924),
    ("Biologia", "Aulas", "video", "Complicacoes Ecologicas.mp4", "1SUU8ZQiSSrbitA1KlMcDWz0eds0RaO0N", 119990015),
    ("Biologia", "Aulas", "video", "Bases Moleculares.mp4", "1nnp64nZRdTFPeq_LoF3_ylfXET6OfXjN", 112607383),
    ("Biologia", "Aulas", "video", "Bases Ecologicas.mp4", "1muFBQaZ3xyP2i0XmXqqhuXPil3aF_7r3", 125816908),
    ("Fisica", "Aulas", "video", "Cinematica.mp4", "1r9gj9FMl9cARvhyTnTqupZTlSRNBBJ5w", 730876236),
    ("Fisica", "Aulas", "video", "Destrinchando o Enem 6 - Termologia e Termodinamica.mp4", "1Bk9s7ujPWHRPYo6-Vn0hJCI3CjNZ6DiX", 485500825),
    ("Fisica", "Aulas", "video", "Dinamica.mp4", "1MVdrpVHBLChQd0EaYbOSWWm0cPs6jDp0", 610291709),
    ("Fisica", "Aulas", "video", "Aula 03 - Eletricidade.mp4", "106-KMVCplIUc05-VITkpNfRA-JGxB_n5", 255810364),
    ("Fisica", "Aulas", "video", "Aula 01 - Ondas.mp4", "1E_Zku3ntsS_J2UYmYmGUEAZxgV_knLl7", 217390968),
    ("Fisica", "Aulas", "video", "Aula 04 - Termologia.mp4", "1lSJYt-k_Qt0yZTSBltx8RlAHmha63HWm", 198465720),
    ("Fisica", "Aulas", "video", "Aula 02 - Movimento.mp4", "1ewFCQc3iIwnM-TEpSKQF7LC20s-x3t4w", 169644196),
    ("Quimica", "Aulas", "video", "Quimica Organica.mp4", "1WpcZvKjKkjRjHe7eSpqUXp3iDMk8UlTc", 663230585),
    ("Quimica", "Aulas", "video", "Reacoes Inorganicas.mp4", "1b-qEJK7AS2Wl0gCF7W0VFoYwiD44XJ49", 615499271),
    ("Quimica", "Aulas", "video", "Destrinchando o Enem - Equilibrio.mp4", "1vHJFWiUbOduBmlsLLZKpajVDSJrOmLzz", 755077761),
    ("Quimica", "Aulas", "video", "Solubilidade.mp4", "1iXRNXO6KL15VUsUUTnZ74GUcvyyQDlx7", 524326947),
    ("Quimica", "Aulas", "video", "Inorganica.mp4", "1cgpnnLPAQu5rlxGDjOQOpFqPy0zTqD5H", 328588381),
    ("Quimica", "Aulas", "video", "Radioatividade.mp4", "1rok3_SiBcbVl-83pxaeDP7flqxkgPQio", 334828591),
    ("Quimica", "Aulas", "video", "Estequiometria.mp4", "1HBqbARcTSdePF9kJbvSCwx89eJYRjift", 621347157),
    ("Quimica", "Aulas", "video", "Aula 14 - Radioatividade.mp4", "1frWhoU30J0MfufEG-emc35k7rmu4Cf49", 124023311),
    ("Quimica", "Aulas", "video", "Aula 13 - Termoquimica.mp4", "1yjZtqE9nxzmRmufH9M1BZZviPy90RqaA", 219138694),
    ("Quimica", "Aulas", "video", "Aula 12 - Eletroquimica.mp4", "11L2drAsKCR9zawOJ9dB9O2XMVVlHeLO0", 219059394),
    ("Quimica", "Aulas", "video", "Aula 11 - Analitica.mp4", "1JxEipmBhLMpLcUVNpsZEagiiR1w4sf2Z", 191810207),
]


def url(file_id):
    return f"https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t"


def download(file_id, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        ["curl", "-sSL", url(file_id), "-o", str(dest)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        return False, r.stderr[:200]
    head = dest.read_bytes()[:5] if dest.exists() else b""
    if head[:4] == b"%PDF":
        return True, "ok"
    dest.unlink(missing_ok=True)
    return False, f"conteudo inesperado (head={head!r})"


def main():
    manifesto = []
    for disciplina, sub, tipo, titulo, fid, size in INVENTARIO:
        rel = "/".join(x for x in ["data/naturezas", disciplina, sub, titulo] if x)
        entry = {
            "disciplina": disciplina, "subpasta": sub or None, "tipo": tipo,
            "titulo": titulo, "drive_id": fid, "tamanho_bytes": size,
            "tamanho_mb": round(size / 1024 / 1024, 1),
            "download_url": url(fid),
            "no_repositorio": False, "caminho": None,
        }
        if tipo == "pdf" and size <= GITHUB_LIMIT:
            dest = ROOT / "data" / "naturezas" / disciplina / sub / titulo if sub \
                else ROOT / "data" / "naturezas" / disciplina / titulo
            ok, msg = download(fid, dest)
            if ok:
                entry["no_repositorio"] = True
                entry["caminho"] = str(dest.relative_to(ROOT))
                print(f"  baixado: {rel} ({entry['tamanho_mb']} MB)")
            else:
                print(f"  FALHA:   {rel} — {msg}")
        else:
            motivo = "vídeo" if tipo == "video" else f">100 MB ({entry['tamanho_mb']} MB)"
            print(f"  catalogado (não versionado, {motivo}): {titulo}")
        manifesto.append(entry)

    BASE.mkdir(parents=True, exist_ok=True)
    (BASE / "manifest.json").write_text(
        json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # MANIFEST.md legível
    pdfs = [m for m in manifesto if m["tipo"] == "pdf"]
    vids = [m for m in manifesto if m["tipo"] == "video"]
    no_repo = [m for m in manifesto if not m["no_repositorio"]]
    linhas = [
        "# Biblioteca de Ciências da Natureza — Manifesto",
        "",
        "Catálogo completo dos materiais de CN da biblioteca do Drive.",
        "PDFs até 100 MB estão versionados no repositório; vídeos e arquivos "
        "acima do limite do GitHub ficam apenas neste catálogo, com link de download.",
        "",
        f"- Total de arquivos: **{len(manifesto)}** ({len(pdfs)} PDFs, {len(vids)} vídeos)",
        f"- Versionados no repositório: **{sum(1 for m in manifesto if m['no_repositorio'])}**",
        f"- Somente catalogados (link): **{len(no_repo)}**",
        "",
        "## Arquivos versionados (no repositório)",
        "",
        "| Disciplina | Arquivo | Tamanho | Caminho |",
        "|---|---|--:|---|",
    ]
    for m in manifesto:
        if m["no_repositorio"]:
            linhas.append(f"| {m['disciplina']} | {m['titulo']} | {m['tamanho_mb']} MB | `{m['caminho']}` |")
    linhas += [
        "",
        "## Somente catalogados (fora do repositório — link de download)",
        "",
        "| Disciplina | Arquivo | Tipo | Tamanho | Download |",
        "|---|---|---|--:|---|",
    ]
    for m in sorted(no_repo, key=lambda x: (x["disciplina"], x["titulo"])):
        linhas.append(
            f"| {m['disciplina']} | {m['titulo']} | {m['tipo']} | {m['tamanho_mb']} MB "
            f"| [baixar]({m['download_url']}) |"
        )
    (BASE / "MANIFEST.md").write_text("\n".join(linhas) + "\n", encoding="utf-8")

    total_repo = sum(m["tamanho_bytes"] for m in manifesto if m["no_repositorio"])
    print(f"\nManifesto: {len(manifesto)} arquivos")
    print(f"  versionados: {sum(1 for m in manifesto if m['no_repositorio'])} "
          f"({round(total_repo/1024/1024,1)} MB)")
    print(f"  catalogados (link): {len(no_repo)}")


if __name__ == "__main__":
    main()
