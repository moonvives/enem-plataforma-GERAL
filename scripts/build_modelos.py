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
import csv, glob, hashlib, json, os, re, unicodedata
from collections import defaultdict, Counter
# Pillow é importado sob demanda dentro de to_webp(), para que os testes das
# funções puras (parsing/gabarito/dedup) rodem sem a dependência de imagem.

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OCR = os.path.join(ROOT, "data", "ocr")
NAT = os.path.join(OCR, "nat720")
E360 = os.path.join(OCR, "e360v2")
API = os.path.join(ROOT, "docs", "api")
ASSETS = os.path.join(ROOT, "docs", "assets")
IMGDIR = os.path.join(ASSETS, "img", "modelos")
MICRO = os.path.join(ROOT, "data", "microdados")

# Marcadores que aparecem no OCR das alternativas. Alguns extratores convertem
# o C circulado em ©; tratá-lo explicitamente evita perder a alternativa C.
CIRC_MAP = {
    "Ⓐ": "A", "Ⓑ": "B", "Ⓒ": "C", "Ⓓ": "D", "Ⓔ": "E",
    "ⓐ": "A", "ⓑ": "B", "ⓒ": "C", "ⓓ": "D", "ⓔ": "E",
    "①": "A", "②": "B", "③": "C", "④": "D", "⑤": "E",
    "©": "C",
}
ALT_MARKER = re.compile(r"^\s*([A-EⒶ-ⓔ①-⑤©])(?:[.)\-:]|\s)+\s*(.*)$")

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


def recognize_alternative(line):
    """Retorna (letra, texto) para uma linha de alternativa reconhecida."""
    match = ALT_MARKER.match(line or "")
    if not match:
        return None
    return CIRC_MAP.get(match.group(1), match.group(1)), match.group(2).strip()


def _number(value):
    try:
        return round(float(str(value).replace(",", ".")), 1)
    except (TypeError, ValueError):
        return None


def load_gabaritos():
    """Carrega gabaritos por CO_ITEM e por (ano, habilidade, dificuldade).

    Ano+dificuldade não identifica um item de forma segura: dois itens podem ter
    o mesmo parâmetro b. A chave secundária inclui a habilidade e só é aceita
    quando aponta para um único CO_ITEM. Assim nunca misturamos gabaritos de
    itens diferentes apenas porque os seus parâmetros TRI coincidem.
    """
    by_item = defaultdict(Counter)
    by_signature = defaultdict(Counter)
    items_by_signature = defaultdict(set)
    for path in glob.glob(os.path.join(MICRO, "ITENS_PROVA_*.csv")):
        year = int(os.path.basename(path).split("_")[-1].split(".")[0])
        rows = None
        for encoding in ("latin-1", "utf-8"):
            try:
                with open(path, encoding=encoding, newline="") as stream:
                    rows = list(csv.DictReader(stream, delimiter=";"))
                break
            except UnicodeDecodeError:
                continue
        for row in rows or []:
            if row.get("SG_AREA") != "CN":
                continue
            try:
                hab = int(row.get("CO_HABILIDADE") or 0)
                b_enem = round(500 + 100 * float(row["NU_PARAM_B"].replace(",", ".")), 1)
            except (KeyError, TypeError, ValueError):
                continue
            answer = (row.get("TX_GABARITO") or "").strip()
            item = (row.get("CO_ITEM") or "").strip()
            if answer not in "ABCDE" or not item or not hab:
                continue
            by_item[item][answer] += 1
            key = (year, hab, b_enem)
            by_signature[key][answer] += 1
            items_by_signature[key].add(item)
    return {
        "by_item": by_item,
        "by_signature": by_signature,
        "items_by_signature": items_by_signature,
    }


def recover_gabarito(rec, lookup):
    """Recupera (gabarito, fonte, CO_ITEM) sem cruzar itens diferentes."""
    raw_existing = rec.get("gab")
    existing = raw_existing if isinstance(raw_existing, str) and raw_existing in "ABCDE" else None
    item = str(rec.get("co_item") or "").strip()
    candidates = lookup["by_item"].get(item) if item else None
    if candidates:
        answer = existing if existing in candidates else candidates.most_common(1)[0][0]
        return answer, "microdados", item

    b_enem = _number(rec.get("b_enem"))
    hab = rec.get("hab")
    year = rec.get("ano")
    if b_enem is not None and hab and year:
        for delta in (0.0, -0.1, 0.1):
            key = (int(year), int(hab), round(b_enem + delta, 1))
            item_codes = lookup["items_by_signature"].get(key, set())
            # Mais de um CO_ITEM na mesma assinatura é ambíguo: preservamos o
            # gabarito auditado em vez de escolher o modo de itens distintos.
            if len(item_codes) != 1:
                continue
            candidates = lookup["by_signature"].get(key)
            item = next(iter(item_codes))
            answer = existing if existing in candidates else candidates.most_common(1)[0][0]
            return answer, "microdados", item
    return existing, ("material" if existing else None), None


def _canonical_text(value):
    value = deacc(str(value or "").lower())
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def question_key(rec):
    """Identidade independente do ID da fonte para deduplicar questões."""
    if rec.get("co_item"):
        return "co_item:" + str(rec["co_item"])
    alternatives = "|".join(
        "%s:%s" % (alt.get("l", ""), _canonical_text(alt.get("t", "")))
        for alt in rec.get("alts", [])
    )
    content = "%s|%s" % (_canonical_text(rec.get("enun")), alternatives)
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:24]
    # A aplicação/fonte não entra na chave: o mesmo item pode ser descrito como
    # "Regular", "PPL/Anexos" ou "ENEM 360" em pacotes distintos.
    return "content:%s:%s" % (rec.get("ano") or "", digest)


def _merge_unique(left, right):
    return list(dict.fromkeys((left or []) + (right or [])))


def deduplicate_records(records):
    """Deduplica itens e combina figuras/alternativas úteis das duas fontes."""
    best = {}
    order = []
    for rec in records:
        key = question_key(rec)
        if key not in best:
            best[key] = rec
            order.append(key)
            continue
        current = best[key]
        score = lambda row: (len(row.get("enun") or ""), len(row.get("alts") or []), bool(row.get("gab")))
        winner, other = (rec, current) if score(rec) > score(current) else (current, rec)
        winner["figs"] = _merge_unique(winner.get("figs"), other.get("figs"))
        winner["fontes"] = _merge_unique(
            winner.get("fontes") or ([winner.get("fonte")] if winner.get("fonte") else []),
            other.get("fontes") or ([other.get("fonte")] if other.get("fonte") else []),
        )
        other_alts = {alt.get("l"): alt for alt in other.get("alts", [])}
        for alt in winner.get("alts", []):
            peer = other_alts.get(alt.get("l"), {})
            alt["imgs"] = _merge_unique(
                alt.get("imgs") or ([alt.get("img")] if alt.get("img") else []),
                peer.get("imgs") or ([peer.get("img")] if peer.get("img") else []),
            )
            if alt["imgs"]:
                alt["img"] = alt["imgs"][0]  # compatibilidade com clientes antigos
            if not alt.get("t") and peer.get("t"):
                alt["t"] = peer["t"]
        best[key] = winner
    return [best[key] for key in order]

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

# Modelos de Biologia com granularidade suficiente para o catálogo pedagógico.
# A nomenclatura foi auditada a partir dos quatro arquivos VTT fornecidos pelo
# usuário (Fisiologia Humana I/II, Evolução e Taxonomia e Metabolismo
# Energético). Os exemplos e as contagens continuam vindo exclusivamente das
# questões oficiais do banco: as transcrições não são publicadas nem tratadas
# como fonte de questão.
MODELOS_BIOLOGIA = [
    ("Filogenia e cladogramas", [
        "cladograma", "arvore filogen", "filogen", "ancestral comum",
        "parentesco evolut", "grupo monofilet", "taxon",
    ]),
    ("Seleção natural e adaptação", [
        "selecao natural", "pressao seletiva", "mais apto", "adaptacao",
        "resistencia bacter", "resistencia a antibiot", "darwin", "camuflagem",
    ]),
    ("Evidências evolutivas e especiação", [
        "especiacao", "isolamento reprodutivo", "orgao homologo",
        "estruturas homolog", "orgao analogo", "estruturas analog",
        "orgao vestigial", "convergencia evolutiva", "registro fossil",
    ]),
    ("Taxonomia e nomenclatura", [
        "taxonomia", "nomenclatura binomial", "nome cientifico", "genero e especie",
        "classificacao biologica", "categoria taxonomica", "reino", "filo",
    ]),
    ("Célula procarionte e antibióticos", [
        "procarionte", "peptidoglicano", "plasmidio", "parede celular",
        "antibiotico", "antimicrobiano", "bacteriana", "microbiota", "cissiparidade",
    ]),
    ("Membrana plasmática e mosaico fluido", [
        "membrana plasmatica", "mosaico fluido", "bicamada lipidica", "fosfolipid",
        "permeabilidade seletiva", "proteina de membrana", "fluidez da membrana",
        "membrana celular", "anfifilic",
    ]),
    ("Osmose e difusão", [
        "osmose", "difusao", "semipermeavel", "desidratacao osmotica", "salgamento",
        "meio hipertonic", "meio hipotonic", "solvente", "concentracao de soluto",
    ]),
    ("Organelas e suas funções", [
        "organela", "reticulo endoplasmatic", "complexo de golgi", "lisossomo",
        "sintese proteica", "vesicula de secrecao", "vacuolo", "celula secretora",
        "eucromatina",
    ]),
    ("Mitocôndria e teoria endossimbiótica", [
        "endossimbio", "teoria endossimbiotica", "dna proprio", "dna mitocondrial",
        "cloroplasto", "procarionte ancestral", "autoduplicacao", "margulis",
    ]),
    ("Enzimas e catálise", [
        "catalisador biologic", "energia de ativacao", "atividade enzimatica",
        "catalase", "substrato", "ph otimo", "enzima", "desnatur",
    ]),
    ("Dogma central e síntese proteica", [
        "dogma central", "transcricao", "traducao", "rna mensageiro",
        "rna transportador", "biologia molecular", "expressao genica", "ribossomo le",
    ]),
    ("Estrutura e pareamento do DNA", [
        "dupla helice", "dupla fita", "pareamento", "base nitrogenada", "nucleotideo",
        "adenina", "timina", "citosina", "guanina", "uracila", "chargaff", "purina",
        "pirimidina",
    ]),
    ("Código genético (códons)", [
        "codigo genetico", "codon", "codons", "trinca", "degenerado", "nao ambiguo",
        "universal", "aminoacido correspond",
    ]),
    ("Mutação e regulação gênica", [
        "mutacao", "mutacoes", "epigenetic", "regulacao da expressao", "remodelamento",
        "cromatina", "insercao de base", "delecao",
    ]),
    ("Biotecnologia e engenharia genética", [
        "biotecnologia", "engenharia genetica", "transgenia", "transgenic", "terapia genica",
        "clonagem", "hibridismo", "mapeamento genetico", "edicao de genoma", "edicao genica",
        "geneticamente modificad", "organismo geneticamente",
    ]),
    ("Digestão e absorção", [
        "sistema digest", "digestao", "enzima digest", "intestino", "estomago",
        "absorcao de nutrientes", "vilosidade", "bile", "suco pancreatico",
    ]),
    ("Excreção e osmorregulação", [
        "sistema excret", "excrecao", "osmorregul", "nefron", "rim ", "rins ",
        "urina", "ureia", "vasopressina", "hormonio antidiuretico", " aldosterona",
    ]),
    ("Sangue, circulação e coagulação", [
        "hemacia", "eritroc", "hemoglobina", "plaqueta", "coagulacao", "hemofilia",
        "sistema circulatorio", "circulacao sanguinea", "vaso sanguineo", "coracao",
    ]),
    ("Endocrinologia e homeostase", [
        "sistema endocrino", "hormonio", "insulina", "glucagon", "glicemia",
        "tireoide", "tiroxina", "glandula", "feedback negativo", "adrenalina",
    ]),
    ("Imunidade e vacinação", [
        "imunidade", "resposta imune", "anticorpo", "antigeno", "vacina",
        "linfocito", "leucocito", "memoria imunologica", "imunizacao", "soro ",
    ]),
    ("Doenças infecciosas e vetores", [
        "zoonose", "vetor biologico", "doenca de chagas", "malaria", "esquistossom",
        "leishmaniose", "barbeiro", "parasita", "profilaxia", "transmissao da doenca",
        "cisticercose", "teniase", "filariose", "caramujo",
    ]),
    ("Dengue", [
        "dengue", "aedes", "sorotipo", "variabilidade antigenica", "febre amarela",
        "arbovirus", "flavivirus", "aedes aegypti",
    ]),
    ("Relações ecológicas", [
        "mutualismo", "protocooperacao", "comensalismo", "competicao", "predacao",
        "parasitismo", "relacao ecologica", "relacoes ecologicas", "inquilinismo",
        "predador", "presa",
    ]),
    ("Controle biológico", [
        "controle biologico", "predador natural", "parasitoide", "inimigo natural",
        "praga", "agrotoxico", "inseticida", "defensivo agricola",
    ]),
    ("Corredor ecológico e fragmentação", [
        "corredor ecologic", "fragmentacao", "fluxo genico", "efeito de borda",
        "conectividade", "ilha de habitat", "fragmento florestal",
    ]),
    ("Biomas brasileiros", [
        "caatinga", "cerrado", "mangue", "manguezal", "bioma", "pneumatoforo",
        "escassez hidrica", "queimada", "aerenquima", "xerofit",
    ]),
    ("Biodegradação e remediação", [
        "biodegradavel", "biodegradacao", "biossurfactante", "atenuacao natural",
        "remediacao", "polimero biodegradavel", "biorremediacao",
    ]),
    ("Eutrofização", [
        "eutrofizacao", "corpo hidrico", "oxigenio dissolvido", "proliferacao de algas",
        "decomposicao anaerobia", "excesso de nutrientes", "esgoto domestic",
    ]),
    ("Impermeabilização e erosão do solo", [
        "impermeabilizacao", "erosao", "escoamento", "infiltracao", "cobertura vegetal",
        "concregrama", "pisograma", "assoreamento",
    ]),
    ("Chuva ácida", [
        "chuva acida", "acido sulfurico", "acido nitrico", "oxido de enxofre",
        "dioxido de enxofre", "carbonato de calcio", "marmore", "so2", "no2",
    ]),
    ("Transformação do habitat", [
        "transformacao do habitat", "alteracao de habitat", "hidreletric", "represa",
        "barragem", "desmatamento", "mitigacao", "adaptacao climatica", "usina",
    ]),
    ("Descarte de resíduos", [
        "aterro sanitario", "lixao", "chorume", "metais pesados", "descarte de lixo",
        "residuos solidos", "pilhas e baterias", "coleta seletiva", "reciclagem",
    ]),
    ("Fermentação", [
        "fermentacao", "processo anaerob", "metabolismo anaerob", "fermentacao alcoolica",
        "fermentacao latica", "levedura", "acido latico", "etanol e gas carbonico",
    ]),
    ("Respiração celular", [
        "respiracao celular", "respiracao aerobica", "glicolise", "ciclo de krebs",
        "cadeia respiratoria", "fosforilacao oxidativa", "atp sintase", "mitocondria",
    ]),
    ("Fotossíntese", [
        "fotossintese", "cloroplasto", "clorofila", "ciclo de calvin",
        "fase clara", "fase escura", "fixacao de carbono", "fotofosforilacao",
    ]),
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


def classify_tema(text):
    """Prioriza modelos específicos de Biologia e usa o tema amplo como fallback."""
    modelo = classify(text, MODELOS_BIOLOGIA, None)
    return modelo or classify(text, TEMAS, "Interdisciplinar")


def to_webp(src, dst, max_w=1000, quality=82):
    """Converte um PNG/JPG para webp, limitando a largura. Retorna KB gravados."""
    from PIL import Image
    try:
        im = Image.open(src).convert("RGB")
    except Exception:
        return 0
    if im.width > max_w:
        h = round(im.height * max_w / im.width)
        im = im.resize((max_w, h), Image.LANCZOS)
    im.save(dst, "WEBP", quality=quality, method=6)
    return round(os.path.getsize(dst) / 1024)


def keep_image(src, outrel, max_w=1000):
    """Converte a imagem-fonte para webp; se a fonte não existir mas o webp já
    estiver presente (build reproduzível a partir dos JSONs versionados), mantém
    a referência. Retorna o caminho relativo ou None."""
    dst = os.path.join(IMGDIR, os.path.basename(outrel))
    if os.path.exists(src):
        to_webp(src, dst, max_w=max_w)
        return outrel
    return outrel if os.path.exists(dst) else None


PLACEHOLDER = re.compile(r"alternativa visual|consulte|recorte|ver imagem|ver figura", re.I)
def is_placeholder(txt):
    return bool(txt) and bool(PLACEHOLDER.search(txt))


def main():
    os.makedirs(API, exist_ok=True)
    os.makedirs(IMGDIR, exist_ok=True)

    nat = json.load(open(os.path.join(NAT, "questoes.json"), encoding="utf-8"))
    e360 = [json.loads(l) for l in open(os.path.join(E360, "questoes.jsonl"), encoding="utf-8")]
    gabaritos = load_gabaritos()
    # Backfill de metadados por número da questão a partir da extração regular
    # (que já traz habilidade/competência/dificuldade do Enem 2024, ausentes no
    # pacote-fonte nat720). As numerações coincidem (676–720 = Enem 2024).
    regular_por_num = {}
    reg_path = os.path.join(API, "questions_regular.json")
    if os.path.exists(reg_path):
        for q in json.load(open(reg_path, encoding="utf-8")).get("questoes", []):
            regular_por_num[q.get("numero")] = q
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
        alts = []
        for l in "ABCDE":
            if l in alts_src:
                t = (alts_src.get(l) or "").strip()
                # texto-marcador de alternativa gráfica vira vazio: a página exibe
                # o recorte original em vez de um rótulo sem conteúdo real
                if is_placeholder(t):
                    t = ""
                alts.append({"l": l, "t": t})
        enun = re.sub(r"\s+", " ", q.get("enunciado") or "").strip()

        # imagem-fonte da questão (recorte integral de alta fidelidade).
        # Converte se a fonte existir; se ela estiver ausente (checkout limpo,
        # pacotes-fonte não versionados) mas o webp já estiver gravado, mantém
        # a referência — o build permanece reprodutível sem reescrever o catálogo
        # com imagens faltando.
        figs = []
        fonte_web = keep_image(os.path.join(NAT, q.get("imagem_fonte", "")),
                               "modelos/q%03d.webp" % num)

        # figuras isoladas do enunciado vindas do ENEM 360 (quando mapeado)
        er = e360_by_nat.get(num)
        if er:
            for i, rel in enumerate(er.get("imagens_enunciado", [])):
                outrel = keep_image(os.path.join(E360, rel), "modelos/q%03d_fig%d.webp" % (num, i), max_w=900)
                if outrel:
                    figs.append(outrel)
            # imagens de alternativas gráficas: anexa sempre que houver imagem,
            # mesmo que o texto seja um marcador (ex.: "Alternativa visual A —…").
            for a in er.get("alternativas", []):
                if not a.get("imagens"):
                    continue
                alt_images = []
                for image_index, image_rel in enumerate(a["imagens"]):
                    outrel = keep_image(
                        os.path.join(E360, image_rel),
                        "modelos/q%03d_alt%s_%02d.webp" % (num, a["letra"], image_index + 1),
                        max_w=600,
                    )
                    if outrel:
                        alt_images.append(outrel)
                if alt_images:
                    for al in alts:
                        if al["l"] == a["letra"]:
                            al["imgs"] = alt_images
                            al["img"] = alt_images[0]  # compatibilidade com o renderer anterior
                            if is_placeholder(al["t"]):
                                al["t"] = ""

        hab = q.get("habilidade")
        comp = q.get("competencia")
        # Backfill de habilidade/competência/dificuldade a partir da extração
        # regular quando o pacote-fonte não traz (caso do Enem 2024).
        reg = regular_por_num.get(num)
        if reg and reg.get("ano") == q.get("ano"):
            if hab is None and reg.get("habilidade"):
                hab = reg["habilidade"]
            if comp is None and reg.get("competencia"):
                comp = reg["competencia"]
            if b is None and reg.get("dificuldade"):
                b = round(float(reg["dificuldade"]), 1)
        # Descarta valores de TRI implausíveis (erro na fonte): fora da faixa
        # 200–900 eles distorceriam o tier, a ordenação e as médias de padrão.
        if b is not None and not (200 <= b <= 900):
            b = None
        record = {
            "id": "q%03d" % num,
            "num": num,
            "ano": q.get("ano"),
            "aplicacao": q.get("aplicacao"),
            "fonte": "Naturezas 720 (Enem 2009–2024)",
            "hab": hab,
            "comp": comp,
            "hab_desc": q.get("habilidade_descricao"),
            "b_enem": b,
            "tier": tier_de(b),
            "status": q.get("status_item"),
            "enun": enun[:2000],
            "alts": alts,
            "gab": gab,
            "fonte_img": fonte_web,
            "figs": figs,
            "tema": classify_tema(enun + " " + (q.get("habilidade_descricao") or "")),
            "comando": classify(enun[-400:] or enun, COMANDOS, "Analisar"),
            "contexto": classify(enun, CONTEXTOS, "Cotidiano e tecnologia"),
        }
        official_answer, answer_source, co_item = recover_gabarito(record, gabaritos)
        record["gab"] = official_answer
        record["gab_fonte"] = answer_source
        if co_item:
            record["co_item"] = co_item
        records.append(record)

    records = deduplicate_records(records)
    records.sort(key=lambda r: (r["num"]))
    padroes = build_padroes(records)

    anos = sorted({r["ano"] for r in records if r["ano"]})
    # Conteúdo de estudo (extraído das videoaulas) associado a cada modelo de Biologia.
    biology_content = {}
    _content_path = os.path.join(ROOT, "data", "modelos_biologia_conteudo.json")
    if os.path.exists(_content_path):
        biology_content = {k: v for k, v in json.load(open(_content_path, encoding="utf-8")).items()
                           if not k.startswith("_")}
    biology_names = [name for name, _keywords in MODELOS_BIOLOGIA]
    biology_counts = Counter(r["tema"] for r in records if r["tema"] in biology_names)

    # Conteúdo de Física (mecânica) extraído das videoaulas. Os modelos são
    # renderizados independentemente da contagem; a contagem é uma estimativa
    # por palavras-chave sobre as questões oficiais de Física (Mecânica).
    fisica_content = {}
    _fis_path = os.path.join(ROOT, "data", "modelos_fisica_conteudo.json")
    if os.path.exists(_fis_path):
        fisica_content = {k: v for k, v in json.load(open(_fis_path, encoding="utf-8")).items()
                          if not k.startswith("_")}
    FIS_KW = {
        "Movimento uniforme": ["velocidade constante", "movimento uniforme", "km/h"],
        "Movimento acelerado e frenagem": ["aceleracao", "frenagem", "desacelera", "freio"],
        "Gráfico posição × tempo": ["posicao em funcao do tempo", "inclinacao", "grafico da posicao"],
        "Composição de movimentos e trajetória": ["trajetoria", "correnteza", "lancada sobre"],
        "Queda livre": ["queda livre", "resistencia do ar", "caem"],
        "Lançamentos": ["lancamento", "alcance", "obliquo", "horizontalmente"],
        "Peso, massa e normal": ["balanca", "massa", "peso", "gravidade da lua"],
        "Atrito": ["atrito", "coeficiente de atrito", "deslizamento", "escorrega"],
        "Tensão e polias": ["polia", "tensao", "corda", "arquimedes"],
        "Aceleração centrípeta": ["centripeta", "circular", "tangencial"],
        "Impulso e quantidade de movimento": ["impulso", "cinto de seguranca", "colisao"],
        "Tipos de energia mecânica": ["energia potencial", "energia cinetica", "energia elastica"],
        "Conservação e transformação de energia": ["conservacao de energia", "mola", "deformacao"],
        "Trabalho e potência": ["trabalho realizado", "potencia", "watt"],
        "Colisões e quantidade de movimento": ["pendulo", "colidem", "quantidade de movimento"],
        "Pressão": ["pressao", "forca sobre", "pascal"],
        "Hidrostática": ["hidrostatica", "mergulh", "pressao atmosferica", "fluido"],
        "Rotação e translação": ["rotacao", "translacao", "estacao do ano", "eixo terrestre"],
        "Gravitação": ["gravitacao", "forca gravitacional", "buraco negro", "orbita"],
        "Resistores e leis de Ohm": ["resistor", "resistencia eletrica", "lei de ohm", "resistividade", "ohm"],
        "Aparelhos de medida": ["voltimetro", "amperimetro", "multimetro", "medir a corrente"],
        "Geradores e receptores": ["gerador", "bateria", "pilha", "capacidade de carga"],
        "Circuitos: série e paralelo": ["em serie", "em paralelo", "circuito", "resistencia equivalente", "lampadas"],
        "Energia elétrica e consumo (kWh)": ["kwh", "consumo de energia", "quilowatt", "consumo mensal"],
        "Carga elétrica e baterias": ["ampere hora", "amper hora", "mah", "coulomb", "carga da bateria"],
        "Potência dissipada": ["potencia dissipada", "disjuntor", "efeito joule", "chuveiro eletrico"],
        "Placas solares": ["placa solar", "painel solar", "irradiancia", "fotovoltaic", "energia solar"],
        "Indução eletromagnética": ["inducao", "campo magnetico", "espira", "eletromagnetica", "magnetico alternado"],
    }
    PHYS_BROAD = {"Mecânica", "Eletromagnetismo", "Termologia", "Óptica", "Ondas e som"}
    _fis_tab = [(n, kw) for n, kw in FIS_KW.items()]
    fisica_counts = Counter()
    for r in records:
        if r["tema"] in PHYS_BROAD:
            m = classify(r["enun"], _fis_tab, None)
            if m:
                fisica_counts[m] += 1

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
        "modelos_biologia": [
            dict({"tema": name, "questoes": biology_counts.get(name, 0)},
                 **{k: v for k, v in (biology_content.get(name) or {}).items()})
            for name in biology_names if biology_counts.get(name, 0)
        ],
        "modelos_fisica": [
            dict({"tema": name, "questoes": fisica_counts.get(name, 0)}, **v)
            for name, v in fisica_content.items()
        ],
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
