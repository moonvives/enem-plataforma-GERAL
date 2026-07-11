#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_modelos.py — Catálogo de MODELOS DE QUESTÕES do ENEM (Ciências da Natureza).

Consome os pacotes estruturados e auditados (corrigidos por IA a partir dos PDFs
originais), não mais o OCR bruto:

  data/ocr/nat720/questoes.json      -> 720 questões (Enem 2009–2024), banco-base
  data/ocr/e360v2/questoes.jsonl     -> 360 questões (Enem 2016–2023) com figuras
                                        isoladas do enunciado e de alternativas

O nat720 é o superconjunto (todas com enunciado, alternativas A–E, gabarito,
habilidade/competência e dificuldade na escala TRI). O e360v2 mapeia para o
nat720 (mapped_naturezas_question) e fornece figuras limpas do enunciado e das
alternativas, que anexamos ao modelo correspondente.

Cada questão vira um "modelo" — a forma real como o ENEM cobra a habilidade —
enriquecido com atributos de PADRÃO (tema, tipo de comando, contexto). Os padrões
recorrentes são agregados por (habilidade × tema) e calibrados pela TRI.

Saídas:
  docs/api/modelos_cn.json           -> {meta, modelos, padroes}
  docs/assets/modelos.js             -> window.ENEM_MODELOS
  docs/assets/img/modelos/*.webp     -> recorte-fonte de cada questão + figuras
"""
import json, os, re, unicodedata
from collections import defaultdict, Counter
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OCR = os.path.join(ROOT, "data", "ocr")
NAT = os.path.join(OCR, "nat720")
E360 = os.path.join(OCR, "e360v2")
API = os.path.join(ROOT, "docs", "api")
ASSETS = os.path.join(ROOT, "docs", "assets")
IMGDIR = os.path.join(ASSETS, "img", "modelos")

TIER = [(-1e9, 560, 1), (560, 620, 2), (620, 680, 3), (680, 740, 4), (740, 1e9, 5)]
def tier_de(b):
    if b is None:
        return None
    for lo, hi, n in TIER:
        if lo <= b < hi:
            return n
    return None

def deacc(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

# ---- Classificadores de PADRÃO (vocabulário de Ciências da Natureza) ----------
TEMAS = [
    ("Ondas e som",       ["onda","som","frequ","timbre","acustic","sonor","hertz","ultrassom","eco "]),
    ("Óptica",            ["luz","optic","espelho","lente","reflex","imagem","raio de luz","cor da","difrac","refrac"]),
    ("Eletromagnetismo",  ["corrente","tensao","resistor","circuito","volt","ampere","capacitor","campo eletric","magnet","eletroima","eletrica"]),
    ("Mecânica",          ["forca","velocidade","acelera","energia cin","movimento","atrito","queda","trabalho","potencia mec","impuls","gravita"]),
    ("Termologia",        ["calor","temperatura","termic","dilata","gas ideal","caloria","conduc","entalpia","termodin"]),
    ("Estequiometria",    ["mol ","massa molar","estequiom","rendimento","concentrac","solucao","proporcao","reagente","molar"]),
    ("Química orgânica",  ["organic","hidrocarbon","alcool","ester ","polimer","cadeia carbon","isomer","funcao organic","carbono"]),
    ("Físico-química",    ["equilibrio quim","acido","base","ph ","oxidac","reducao","eletroqu","pilha","cinetica quim","reacao"]),
    ("Ecologia",          ["ecossistema","cadeia alimentar","biodiversidade","populacao","ambiental","polui","ciclo do","desmatam","habitat","trofic"]),
    ("Fisiologia humana", ["sangue","hormon","sistema nervoso","rim ","coracao","respirac","digest","muscul","insulina","pressao arterial","imun","fisiolog"]),
    ("Genética",          ["gene","dna","cromossom","alelo","hereditar","mutac","rna","genotip","fenotip","heredogr"]),
    ("Citologia/Bioquímica",["celula","membrana","enzima","mitocondria","fotossintese","atp","metabol","proteina","lipid","organela"]),
    ("Microbiologia",     ["bacteria","virus","fungo","vacina","antibiotic","infecc","patogen","micro-organism"]),
    ("Botânica",          ["planta","vegetal","folha","raiz","semente","clorofila","floema","xilema"]),
]
COMANDOS = [
    ("Calcular",    ["calcul","valor de","qual o valor","quantos","quantas","estim","obtenha","determine o","aproximadamente igual","numero de"]),
    ("Identificar", ["identifi","qual e o","qual e a","que fenomeno","assinale","o nome","corresponde a","qual das","qual o composto","qual a substancia","qual estrutura"]),
    ("Explicar",    ["explica","por que","deve-se a","a razao","justifica","responsavel por","ocorre porque","o que causa","isso porque"]),
    ("Aplicar",     ["para que","a fim de","com o objetivo","estrategia","solucao para","recomenda","permite que","utilizad","deve-se utilizar"]),
    ("Analisar",    ["analis","com base","de acordo com","a partir d","considerando","conclui-se","pode-se afirmar","infere-se","observa-se","verifica-se"]),
]
CONTEXTOS = [
    ("Saúde",              ["paciente","doenca","medicament","saude","tratamento","diagnostic","sintoma","organismo humano","exame","farmac"]),
    ("Meio ambiente",      ["ambient","polui","rio ","atmosfera","residuo","sustenta","clima","efluente","emissao","aquec"]),
    ("Experimental",       ["experimento","laboratorio","medida","grafico","tabela","amostra","ensaio","procedimento","aparato","recipiente"]),
    ("Ciência e história", ["historic","seculo","descobr","pesquisador","cientista","estudo publicado","observou-se"]),
    ("Cotidiano e tecnologia",["casa","cidade","carro","celular","aparelho","industri","tecnolog","dispositivo","produto","aliment","energia eletric","combustivel"]),
]

def classify(text, table, default):
    t = deacc((text or "").lower())
    best, score = default, 0
    for label, kws in table:
        c = sum(t.count(deacc(k.lower())) for k in kws)
        if c > score:
            best, score = label, c
    return best


def to_webp(src, dst, max_w=1000, quality=82):
    """Converte um PNG/JPG para webp, limitando a largura. Retorna KB gravados."""
    try:
        im = Image.open(src).convert("RGB")
    except Exception:
        return 0
    if im.width > max_w:
        h = round(im.height * max_w / im.width)
        im = im.resize((max_w, h), Image.LANCZOS)
    im.save(dst, "WEBP", quality=quality, method=6)
    return round(os.path.getsize(dst) / 1024)


def main():
    os.makedirs(API, exist_ok=True)
    os.makedirs(IMGDIR, exist_ok=True)

    nat = json.load(open(os.path.join(NAT, "questoes.json"), encoding="utf-8"))
    e360 = [json.loads(l) for l in open(os.path.join(E360, "questoes.jsonl"), encoding="utf-8")]
    # e360 indexado pela questão nat correspondente (para anexar figuras limpas)
    e360_by_nat = {}
    for r in e360:
        mq = r["auditoria"].get("mapped_naturezas_question")
        if mq:
            e360_by_nat[mq] = r

    records = []
    for q in nat:
        num = q["questao"]
        b = q.get("dificuldade_escala_enem")
        gab = q.get("gabarito")
        if gab not in ("A", "B", "C", "D", "E"):
            gab = None
        alts_src = q.get("alternativas") or {}
        alts = [{"l": l, "t": (alts_src.get(l) or "").strip()} for l in "ABCDE" if l in alts_src]
        enun = re.sub(r"\s+", " ", q.get("enunciado") or "").strip()

        # imagem-fonte da questão (recorte integral de alta fidelidade)
        figs = []
        fonte_png = os.path.join(NAT, q.get("imagem_fonte", ""))
        fonte_web = "modelos/q%03d.webp" % num
        if os.path.exists(fonte_png):
            to_webp(fonte_png, os.path.join(IMGDIR, os.path.basename(fonte_web)))
        else:
            fonte_web = None

        # figuras isoladas do enunciado vindas do ENEM 360 (quando mapeado)
        er = e360_by_nat.get(num)
        if er:
            for i, rel in enumerate(er.get("imagens_enunciado", [])):
                srcp = os.path.join(E360, rel)
                if os.path.exists(srcp):
                    outrel = "modelos/q%03d_fig%d.webp" % (num, i)
                    to_webp(srcp, os.path.join(IMGDIR, os.path.basename(outrel)), max_w=900)
                    figs.append(outrel)
            # imagens de alternativas gráficas
            for a in er.get("alternativas", []):
                for j, rel in enumerate(a.get("imagens", [])):
                    srcp = os.path.join(E360, rel)
                    if os.path.exists(srcp):
                        outrel = "modelos/q%03d_alt%s.webp" % (num, a["letra"])
                        to_webp(srcp, os.path.join(IMGDIR, os.path.basename(outrel)), max_w=600)
                        for al in alts:
                            if al["l"] == a["letra"] and not al["t"]:
                                al["img"] = outrel

        hab = q.get("habilidade")
        records.append({
            "id": "q%03d" % num,
            "num": num,
            "ano": q.get("ano"),
            "aplicacao": q.get("aplicacao"),
            "fonte": "Naturezas 720 (Enem 2009–2024)",
            "hab": hab,
            "comp": q.get("competencia"),
            "hab_desc": q.get("habilidade_descricao"),
            "b_enem": b,
            "tier": tier_de(b),
            "status": q.get("status_item"),
            "enun": enun[:2000],
            "alts": alts,
            "gab": gab,
            "gab_fonte": "microdados" if gab and q.get("status_item") == "válida" else ("material" if gab else None),
            "fonte_img": fonte_web,
            "figs": figs,
            "tema": classify(enun + " " + (q.get("habilidade_descricao") or ""), TEMAS, "Interdisciplinar"),
            "comando": classify(enun[-400:] or enun, COMANDOS, "Analisar"),
            "contexto": classify(enun, CONTEXTOS, "Cotidiano e tecnologia"),
        })

    records.sort(key=lambda r: (r["num"]))
    padroes = build_padroes(records)

    anos = sorted({r["ano"] for r in records if r["ano"]})
    meta = {
        "n_modelos": len(records),
        "n_padroes": len(padroes),
        "com_gabarito": sum(1 for r in records if r["gab"]),
        "com_figura": sum(1 for r in records if r["fonte_img"] or r["figs"]),
        "anuladas": sum(1 for r in records if r["status"] == "anulada"),
        "anos": anos,
        "habilidades": sorted({r["hab"] for r in records if r["hab"]}),
        "por_tema": dict(Counter(r["tema"] for r in records).most_common()),
        "por_ano": dict(sorted(Counter(r["ano"] for r in records if r["ano"]).items())),
        "fonte": "Questões reais do ENEM (CN), pacotes auditados Naturezas 720 e ENEM 360; "
                 "gabarito e dificuldade na escala TRI conforme microdados do INEP.",
    }
    payload = {"meta": meta, "modelos": records, "padroes": padroes}

    with open(os.path.join(API, "modelos_cn.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(ASSETS, "modelos.js"), "w", encoding="utf-8") as f:
        f.write("// Gerado por scripts/build_modelos.py — não editar à mão.\nwindow.ENEM_MODELOS=")
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")

    imgcount = len([n for n in os.listdir(IMGDIR)])
    print(f"OK modelos: {meta['n_modelos']} | gabarito {meta['com_gabarito']} | "
          f"figura {meta['com_figura']} | anuladas {meta['anuladas']} | imagens {imgcount}")
    print(f"OK padroes: {meta['n_padroes']} | anos {anos[0]}–{anos[-1]}")
    print("temas:", meta["por_tema"])
    print("top padroes:")
    for m in padroes[:10]:
        print(f"  H{str(m['hab']):>3} {m['tema']:<22} n={m['n']:>2} anos={m['anos'][0]}–{m['anos'][-1]} "
              f"dif~{m['dif_media']} ({m['comando']})")


def build_padroes(recs):
    groups = defaultdict(list)
    for r in recs:
        if r["hab"] is None:
            continue
        groups[(r["hab"], r["tema"])].append(r)
    out = []
    for (hab, tema), rs in groups.items():
        difs = [r["b_enem"] for r in rs if r["b_enem"]]
        anos = sorted({r["ano"] for r in rs if r["ano"]})
        out.append({
            "hab": hab, "tema": tema,
            "comando": Counter(r["comando"] for r in rs).most_common(1)[0][0],
            "contexto": Counter(r["contexto"] for r in rs).most_common(1)[0][0],
            "n": len(rs), "anos": anos, "span": (max(anos) - min(anos)) if anos else 0,
            "dif_media": round(sum(difs) / len(difs), 1) if difs else None,
            "tier": tier_de(sum(difs) / len(difs)) if difs else None,
            "exemplos": [r["id"] for r in sorted(rs, key=lambda x: x["b_enem"] or 0)][:6],
        })
    out.sort(key=lambda m: (-m["n"], -m["span"], -(m["dif_media"] or 0)))
    return out


if __name__ == "__main__":
    main()
