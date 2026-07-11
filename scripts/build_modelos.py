#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_modelos.py — Catálogo de MODELOS DE QUESTÕES do ENEM (Ciências da Natureza).

Extrai questões reais e completas (enunciado + alternativas A–E + habilidade +
ano + dificuldade TRI) a partir do texto OCR do eBook PPL/anexos e do ENEM 360 CN,
enriquece cada item com atributos de PADRÃO (tema, tipo de comando, contexto) e
agrega os padrões recorrentes de cobrança calibrados pela TRI.

Cada questão vira um "modelo" — a forma real com que o ENEM cobra aquela
habilidade — e os padrões mostram o que se repete ao longo dos anos.

Saídas:
  docs/api/modelos_cn.json    -> {meta, modelos:[questões enriquecidas], padroes:[...]}
  docs/assets/modelos.js      -> window.ENEM_MODELOS
  docs/assets/img/provas/*.png-> figuras copiadas
"""
import csv, glob, json, os, re, shutil, unicodedata
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OCR = os.path.join(ROOT, "data", "ocr")
MICRO = os.path.join(ROOT, "data", "microdados")
API = os.path.join(ROOT, "docs", "api")
ASSETS = os.path.join(ROOT, "docs", "assets")
IMGDIR = os.path.join(ASSETS, "img", "provas")

SOURCES = [
    ("PPL/Anexos", "ppl",  os.path.join(OCR, "ppl",  "97b17cd6ad8a4cf79fccef6bb228f9a8_md_full.md"), os.path.join(OCR, "ppl",  "images")),
    ("ENEM 360",   "e360", os.path.join(OCR, "e360", "2338b2bd62e04ddeb4bb36f90a5815af_md_full.md"), os.path.join(OCR, "e360", "images")),
]

HEAD = re.compile(
    r"Quest[ãa]o\s+(\d{2,3})\s*\(\s*H(\d{1,2})\s*\|\s*(?:Enem\s+)?(\d{4})\s*(?:\|\s*([\d.,]+))?\s*\)"
    r"(?:\s*Dificuldade\s+([\d.,]+))?",
    re.IGNORECASE)
IMG = re.compile(r"!\[\]\(images/([^)]+)\)")
ALT = re.compile(r"^\s*([A-EⒶ-ⓔ①-⑤])\s+(\S.*)$")
CIRCLED = set("ⒶⒷⒸⒹⒺⓐⓑⓒⓓⓔ①②③④⑤")
CIRC_MAP = {"Ⓐ":"A","Ⓑ":"B","Ⓒ":"C","Ⓓ":"D","Ⓔ":"E",
            "ⓐ":"A","ⓑ":"B","ⓒ":"C","ⓓ":"D","ⓔ":"E",
            "①":"A","②":"B","③":"C","④":"D","⑤":"E"}

# régua TRI ENEM
TIER = [(-1e9,560,1),(560,620,2),(620,680,3),(680,740,4),(740,1e9,5)]
def tier_de(b):
    if b is None: return None
    for lo,hi,n in TIER:
        if lo<=b<hi: return n
    return None


def deacc(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def norm_num(s):
    return round(float(s.replace(".", "").replace(",", ".")), 1)


TEMAS = [
    ("Ondas e som",       ["onda","som","frequ","timbre","acustic","sonor","hertz","ultrassom","eco ","refrac"]),
    ("Óptica",            ["luz","optic","espelho","lente","reflex","imagem","raio de luz","cor "]),
    ("Eletromagnetismo",  ["corrente","tensao","resistor","circuito","volt","ampere","capacitor","campo eletric","magnet","eletroima"]),
    ("Mecânica",          ["forca","velocidade","acelera","energia cin","movimento","atrito","queda","trabalho","potencia mec","impuls"]),
    ("Termologia",        ["calor","temperatura","termic","dilata","gas ideal","caloria","conduc"]),
    ("Estequiometria",    ["mol ","massa molar","estequiom","rendimento","concentrac","solucao","proporcao","reagente"]),
    ("Química orgânica",  ["organic","hidrocarbon","alcool","ester","polimer","cadeia carbon","isomer","funcao organic"]),
    ("Físico-química",    ["equilibrio quim","acido","base","ph ","oxidac","reducao","eletroqu","pilha","cinetica quim","entalpia","termoquim"]),
    ("Ecologia",          ["ecossistema","cadeia alimentar","biodiversidade","populacao","ambiental","polui","ciclo do","desmatam","habitat"]),
    ("Fisiologia humana", ["sangue","hormon","sistema nervoso","rim ","coracao","respirac","digest","muscul","insulina","pressao arterial","imun"]),
    ("Genética",          ["gene","dna","cromossom","alelo","hereditar","mutac","rna","genotip","fenotip"]),
    ("Citologia/Bioquímica",["celula","membrana","enzima","mitocondria","fotossintese","atp","metabol","proteina","lipid"]),
    ("Microbiologia",     ["bacteria","virus","fungo","vacina","antibiotic","infecc","patogen"]),
    ("Botânica",          ["planta","vegetal","folha","raiz","semente","clorofila","floema","xilema"]),
]
COMANDOS = [
    ("Calcular",    ["calcul","valor de","qual o valor","quantos","quantas","estim","obtenha","determine o","aproximadamente igual"]),
    ("Identificar", ["identifi","qual e o","qual e a","que fenomeno","assinale","o nome","corresponde a","qual das","qual o composto","qual a substancia"]),
    ("Explicar",    ["explica","por que","deve-se a","a razao","justifica","responsavel por","ocorre porque","o que causa"]),
    ("Aplicar",     ["para que","a fim de","com o objetivo","estrategia","solucao para","recomenda","permite que","utilizad"]),
    ("Analisar",    ["analis","com base","de acordo com","a partir d","considerando","conclui-se","pode-se afirmar","infere-se","observa-se"]),
]
CONTEXTOS = [
    ("Saúde",              ["paciente","doenca","medicament","saude","tratamento","diagnostic","sintoma","organismo humano","exame"]),
    ("Meio ambiente",      ["ambient","polui","rio ","atmosfera","residuo","sustenta","clima","efluente","emissao"]),
    ("Experimental",       ["experimento","laboratorio","medida","grafico","tabela","amostra","ensaio","procedimento","aparato"]),
    ("Ciência e história", ["historic","seculo","descobr","pesquisador","cientista","estudo publicado","observou-se"]),
    ("Cotidiano e tecnologia",["casa","cidade","carro","celular","aparelho","industri","tecnolog","dispositivo","produto","aliment","energia eletric"]),
]

def classify(text, table, default):
    t = deacc(text.lower())
    best, score = default, 0
    for label, kws in table:
        c = sum(t.count(deacc(k.lower())) for k in kws)
        if c > score:
            best, score = label, c
    return best


LEAD_CIRC = re.compile(r"^[①②③④⑤Ⓐ-ⓔ●∙•\s]+")

def build_alts(lines, alt_idx):
    if not alt_idx:
        return strip_lead(" ".join(lines)), [], None
    first = alt_idx[0][0]
    enun = strip_lead(" ".join(lines[:first]))
    seen, bullet_answer, circled_answer = {}, None, None
    for j, letter, txt, circ in alt_idx:
        if letter not in seen:
            # o marcador ● (às vezes • ∙) prefixando o texto sinaliza o gabarito
            if re.match(r"^[●∙•]\s*", txt):
                if bullet_answer is None:
                    bullet_answer = letter
                txt = re.sub(r"^[●∙•]\s*", "", txt)
            seen[letter] = txt
            if circ and circled_answer is None:
                circled_answer = letter
    missing = [l for l in "ABCDE" if l not in seen]
    orphan = None
    for ln in lines[first:]:
        s = ln.strip()
        if not s or ALT.match(s):
            continue
        low = deacc(s.lower())
        if low.startswith(("dispon","fonte","acesso","adaptado","figura")):
            continue
        if len(s) < 170 and orphan is None:
            orphan = re.sub(r"^[●∙•]\s*", "", s)
    # prioridade de detecção do gabarito: ● > letra circulada > única letra ausente
    gab = None
    if bullet_answer:
        gab = bullet_answer
    elif circled_answer:
        gab = circled_answer
    elif len(missing) == 1:
        gab = missing[0]
        if orphan:
            seen[missing[0]] = orphan
    alts = [{"l": l, "t": re.sub(r"\s+", " ", seen[l]).strip()[:360]} for l in "ABCDE" if l in seen]
    return enun, alts, gab

def strip_lead(s):
    return LEAD_CIRC.sub("", s).strip()


def parse_source(fonte, label, mdpath, imgsrc, records, imgs_needed):
    with open(mdpath, encoding="utf-8") as f:
        raw = f.read()
    heads = list(HEAD.finditer(raw))
    for i, m in enumerate(heads):
        num, hab, ano = int(m.group(1)), int(m.group(2)), int(m.group(3))
        dif = m.group(4) or m.group(5)
        if not (2009 <= ano <= 2025) or not (1 <= hab <= 30):
            continue
        block = raw[m.end(): heads[i+1].start() if i+1 < len(heads) else len(raw)]
        figs = IMG.findall(block)
        for fn in figs:
            imgs_needed.add((imgsrc, fn))
        clean = IMG.sub(" ", block)
        clean = re.sub(r"^#+\s*", "", clean, flags=re.MULTILINE)
        lines = [ln.strip() for ln in clean.split("\n")]
        alt_idx = []
        for j, ln in enumerate(lines):
            am = ALT.match(ln)
            if am:
                letter = CIRC_MAP.get(am.group(1), am.group(1))
                if letter in "ABCDE":
                    alt_idx.append((j, letter, am.group(2).strip(), am.group(1) in CIRCLED))
        enun, alts, gab = build_alts(lines, alt_idx)
        enun = re.sub(r"\s+", " ", enun).strip()
        if len(enun) < 25 or len(alts) < 4:
            continue
        b = norm_num(dif) if dif else None
        records.append({
            "id": f"{label}-{num:03d}",
            "fonte": fonte,
            "num": num, "hab": hab, "ano": ano,
            "b_enem": b, "tier": tier_de(b),
            "enun": enun[:1500],
            "alts": alts, "gab": gab,
            "fig": ("provas/" + figs[0]) if figs else None,
            "tema": classify(enun, TEMAS, "Interdisciplinar"),
            "comando": classify(enun[-360:] or enun, COMANDOS, "Analisar"),
            "contexto": classify(enun, CONTEXTOS, "Cotidiano e tecnologia"),
        })


def load_gabaritos():
    """Lookup autoritativo (ano, b_enem arredondado) -> Counter de TX_GABARITO.
    O par (ano, b_enem) identifica o item nos microdados do INEP; TX_GABARITO
    é a resposta oficial. Em 95% dos itens todas as cores compartilham a mesma
    letra; nos poucos itens com ordem embaralhada, usamos o modo (letra mais
    frequente) e deixamos a checagem via OCR desempatar."""
    look = defaultdict(Counter)
    for path in glob.glob(os.path.join(MICRO, "ITENS_PROVA_*.csv")):
        yr = int(os.path.basename(path).split("_")[-1].split(".")[0])
        try:
            rows = list(csv.DictReader(open(path, encoding="latin-1"), delimiter=";"))
        except Exception:
            rows = list(csv.DictReader(open(path, encoding="utf-8"), delimiter=";"))
        for r in rows:
            if r.get("SG_AREA") != "CN":
                continue
            try:
                be = round(500 + 100 * float(r["NU_PARAM_B"].replace(",", ".")), 1)
            except (ValueError, KeyError):
                continue
            g = r.get("TX_GABARITO", "")
            if g in "ABCDE":
                look[(yr, be)][g] += 1
    return look


def recover_gabarito(rec, look):
    """Define o gabarito oficial a partir dos microdados; retorna (letra, fonte)."""
    be = rec["b_enem"]
    if be is None:
        return rec["gab"], ("ocr" if rec["gab"] else None)
    cands = None
    for delta in (0.0, -0.1, 0.1):
        cands = look.get((rec["ano"], round(be + delta, 1)))
        if cands:
            break
    if not cands:
        return rec["gab"], ("ocr" if rec["gab"] else None)
    if len(cands) == 1:
        return cands.most_common(1)[0][0], "microdados"
    # item embaralhado entre cores: se a leitura OCR está entre as candidatas, usa-a
    if rec["gab"] in cands:
        return rec["gab"], "microdados"
    return cands.most_common(1)[0][0], "microdados"


def build_padroes(recs):
    groups = defaultdict(list)
    for r in recs:
        groups[(r["hab"], r["tema"])].append(r)
    out = []
    for (hab, tema), rs in groups.items():
        difs = [r["b_enem"] for r in rs if r["b_enem"]]
        anos = sorted({r["ano"] for r in rs})
        out.append({
            "hab": hab, "tema": tema,
            "comando": Counter(r["comando"] for r in rs).most_common(1)[0][0],
            "contexto": Counter(r["contexto"] for r in rs).most_common(1)[0][0],
            "n": len(rs), "anos": anos, "span": (max(anos)-min(anos)) if anos else 0,
            "dif_media": round(sum(difs)/len(difs), 1) if difs else None,
            "tier": tier_de(sum(difs)/len(difs)) if difs else None,
            "exemplos": [r["id"] for r in sorted(rs, key=lambda x: x["b_enem"] or 0)][:5],
        })
    out.sort(key=lambda m: (-m["n"], -m["span"], -(m["dif_media"] or 0)))
    return out


def main():
    os.makedirs(API, exist_ok=True); os.makedirs(IMGDIR, exist_ok=True)
    records, imgs_needed = [], set()
    for fonte, label, mdpath, imgsrc in SOURCES:
        if os.path.exists(mdpath):
            parse_source(fonte, label, mdpath, imgsrc, records, imgs_needed)
    best = {}
    for r in records:
        if r["id"] not in best or len(r["alts"]) > len(best[r["id"]]["alts"]):
            best[r["id"]] = r
    records = sorted(best.values(), key=lambda r: (r["hab"], r["ano"], r["num"]))
    # gabarito autoritativo via microdados do INEP
    look = load_gabaritos()
    for r in records:
        g, fonte = recover_gabarito(r, look)
        r["gab"], r["gab_fonte"] = g, fonte
    copied = 0
    for imgsrc, fn in imgs_needed:
        src = os.path.join(imgsrc, fn)
        if os.path.exists(src):
            shutil.copy(src, os.path.join(IMGDIR, fn)); copied += 1
    padroes = build_padroes(records)
    meta = {
        "n_modelos": len(records),
        "n_padroes": len(padroes),
        "com_gabarito": sum(1 for r in records if r["gab"]),
        "gabarito_oficial": sum(1 for r in records if r.get("gab_fonte") == "microdados"),
        "com_figura": sum(1 for r in records if r["fig"]),
        "anos": sorted({r["ano"] for r in records}),
        "habilidades": sorted({r["hab"] for r in records}),
        "por_tema": dict(Counter(r["tema"] for r in records).most_common()),
        "fonte": "Questões reais do ENEM (CN) — eBook PPL/anexos e ENEM 360; dificuldade em escala TRI do INEP.",
    }
    payload = {"meta": meta, "modelos": records, "padroes": padroes}
    with open(os.path.join(API, "modelos_cn.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(ASSETS, "modelos.js"), "w", encoding="utf-8") as f:
        f.write("// Gerado por scripts/build_modelos.py — não editar à mão.\nwindow.ENEM_MODELOS=")
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")
    print(f"OK modelos: {meta['n_modelos']} | gabarito {meta['com_gabarito']} | figura {meta['com_figura']} | figs {copied}")
    print(f"OK padroes: {meta['n_padroes']} | anos {meta['anos']}")
    print("temas:", meta["por_tema"])
    print("top padroes:")
    for m in padroes[:10]:
        print(f"  H{m['hab']:>2} {m['tema']:<22} n={m['n']:>2} anos={m['anos']} dif~{m['dif_media']} ({m['comando']})")


if __name__ == "__main__":
    main()
