#!/usr/bin/env python3
"""Recalibração da TRI de Ciências da Natureza e geração dos PADRÕES de
cobrança por habilidade, a partir dos microdados oficiais do INEP
(arquivos ITENS_PROVA), fonte autoritativa em data/microdados/.

Regras de calibração (para não introduzir erro):
  - apenas área CN;
  - dedup por CO_ITEM (mesmo item em cadernos/cores diferentes conta 1x);
  - exclui a aplicação-piloto de 2009 (escala incompatível);
  - exclui itens anulados (IN_ITEM_ABAN);
  - exclui parâmetros b fora de [-3, 4] (ruído);
  - escala ENEM: b_enem = 500 + 100 * b.

Saídas: docs/api/padroes_cn.json e docs/assets/padroes.js (window.ENEM_PADROES).
"""
from __future__ import annotations
import csv, glob, json, os, statistics as st
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_DIR = ROOT / "data" / "microdados"
OUT_API = ROOT / "docs" / "api"
OUT_ASSETS = ROOT / "docs" / "assets"

HAB_DESC = {
    1: "Fenômenos ondulatórios e oscilatórios em seus usos e contextos.",
    2: "Solução de problemas de comunicação, transporte ou saúde e o desenvolvimento científico-tecnológico.",
    3: "Interpretações científicas frente ao senso comum ao longo do tempo e entre culturas.",
    4: "Propostas de intervenção no ambiente: qualidade de vida e conservação da biodiversidade.",
    5: "Dimensionamento de circuitos ou dispositivos elétricos de uso cotidiano.",
    6: "Manuais de instalação ou utilização de aparelhos e sistemas tecnológicos.",
    7: "Testes de controle, parâmetros e critérios para comparar materiais e produtos.",
    8: "Etapas de obtenção, transformação, uso ou reciclagem de recursos.",
    9: "Ciclos biogeoquímicos e fluxo de energia para a vida.",
    10: "Perturbações ambientais: fontes, transporte e efeitos dos poluentes.",
    11: "Biotecnologia: benefícios, limitações e aspectos éticos.",
    12: "Impactos ambientais decorrentes de atividades sociais ou econômicas.",
    13: "Mecanismos de transmissão da vida e manifestação de características.",
    14: "Padrões em processos vitais: equilíbrio, defesa, sexualidade.",
    15: "Modelos e experimentos para explicar fenômenos biológicos.",
    16: "Papel da evolução em padrões, processos e organização taxonômica.",
    17: "Relacionar informações em diferentes linguagens e representações.",
    18: "Relacionar propriedades de produtos, sistemas ou procedimentos tecnológicos.",
    19: "Métodos e procedimentos das ciências para diagnosticar ou solucionar problemas.",
    20: "Movimentos de partículas, substâncias, objetos ou corpos celestes.",
    21: "Leis físicas ou químicas para interpretar processos naturais ou tecnológicos.",
    22: "Interação entre radiação e matéria.",
    23: "Geração, uso ou transformação de energia em ambientes específicos.",
    24: "Códigos e nomenclatura química para caracterizar materiais e transformações.",
    25: "Caracterização de materiais: etapas, rendimentos e implicações.",
    26: "Implicações socioambientais e econômicas na produção e consumo de recursos.",
    27: "Propostas de intervenção no ambiente com base em conhecimentos químicos.",
    28: "Características adaptativas dos organismos ao modo de vida e distribuição.",
    29: "Experimentos e técnicas que utilizam seres vivos.",
    30: "Propostas individuais ou coletivas para a manutenção da saúde.",
}
AREA_DISC = {1:"Física",2:"Física",3:"Interdisciplinar",4:"Biologia",5:"Física",6:"Física",
    7:"Química",8:"Química",9:"Biologia",10:"Química",11:"Biologia",12:"Biologia",13:"Biologia",
    14:"Biologia",15:"Biologia",16:"Biologia",17:"Interdisciplinar",18:"Interdisciplinar",
    19:"Interdisciplinar",20:"Física",21:"Física",22:"Física",23:"Física",24:"Química",25:"Química",
    26:"Química",27:"Química",28:"Biologia",29:"Biologia",30:"Biologia"}

def competencia(h):
    for lo,hi,c in [(1,4,1),(5,7,2),(8,12,3),(13,16,4),(17,19,5),(20,23,6),(24,27,7),(28,30,8)]:
        if lo<=h<=hi: return c

def tier(b):
    faixas=[(560,1,"Muito fácil"),(620,2,"Fácil"),(680,3,"Mediana"),(740,4,"Difícil"),(1e9,5,"Muito difícil")]
    for hi,n,r in faixas:
        if b<hi: return {"nivel":n,"rotulo":r}

def main():
    rows={}
    for f in sorted(glob.glob(str(CSV_DIR/"ITENS_PROVA_*.csv"))):
        ano=int(''.join(c for c in os.path.basename(f) if c.isdigit())[:4])
        raw=open(f,encoding="latin-1").read()
        for r in csv.DictReader(raw.splitlines(),delimiter=';'):
            if r.get("SG_AREA")!="CN": continue
            co=r.get("CO_ITEM")
            if not co or co in rows: continue
            try: b=float((r.get("NU_PARAM_B") or "").replace(",","."))
            except: b=None
            try: hab=int(r.get("CO_HABILIDADE") or 0)
            except: hab=0
            rows[co]={"ano":ano,"b":b,"hab":hab,
                      "aban":(r.get("IN_ITEM_ABAN") or "0").strip() in ("1","1.0"),
                      "gab":(r.get("TX_GABARITO") or "").strip()}
    itens=list(rows.values())
    # calibração geral (régua/média): não exige habilidade
    calib=[x for x in itens if x["ano"]>=2010 and not x["aban"] and x["b"] is not None
           and -3<=x["b"]<=4]
    for x in calib: x["b_enem"]=round(500+100*x["b"],1)
    # análise por habilidade (cards/ranking): exige habilidade 1..30
    clean=[x for x in calib if 1<=x["hab"]<=30]

    be=[x["b_enem"] for x in calib]
    regua_ord=["Muito fácil","Fácil","Mediana","Difícil","Muito difícil"]
    cont=Counter(tier(v)["rotulo"] for v in be)

    por_hab=defaultdict(list)
    for x in clean: por_hab[x["hab"]].append(x)
    total=len(calib)          # total da calibração
    total_hab=len(clean)      # total com habilidade identificada

    habs=[]
    for h in range(1,31):
        itl=por_hab.get(h,[])
        if not itl:
            continue
        bs=[x["b_enem"] for x in itl]
        anos=Counter(x["ano"] for x in itl)
        gab=Counter(x["gab"] for x in itl if x["gab"] in "ABCDE")
        media=round(sum(bs)/len(bs),1)
        habs.append({
            "id":h,"competencia":competencia(h),"area":AREA_DISC[h],"descricao":HAB_DESC[h],
            "total":len(itl),"freq_pct":round(len(itl)/total_hab*100,1),
            "media_b":media,"tier":tier(media),
            "b_min":round(min(bs),1),"b_max":round(max(bs),1),
            "por_ano":[{"ano":a,"total":anos[a]} for a in sorted(anos)],
            "gab":[{"letra":L,"total":gab.get(L,0)} for L in "ABCDE"],
        })
    ranking=sorted(habs,key=lambda x:(-x["total"],x["id"]))

    payload={
        "meta":{
            "area":"CN","area_nome":"Ciências da Natureza",
            "fonte":"Microdados do ENEM (INEP) — arquivos ITENS_PROVA, 2010–2025",
            "total_calibracao":total,"total_com_habilidade":total_hab,
            "media":round(sum(be)/len(be),1),"desvio":round(st.pstdev(be),1),
            "b_min":round(min(be),1),"b_max":round(max(be),1),
            "regua":[{"rotulo":t,"total":cont.get(t,0),
                      "pct":round(cont.get(t,0)/total*100,1)} for t in regua_ord],
            "por_ano":[{"ano":a,"total":c} for a,c in sorted(Counter(x["ano"] for x in clean).items())],
            "regras":"Exclui 2009 (piloto), itens anulados e b fora de [-3,4]; dedup por CO_ITEM; b_enem=500+100·b.",
        },
        "ranking":[h["id"] for h in ranking],
        "habilidades":{str(h["id"]):h for h in habs},
    }

    OUT_API.mkdir(parents=True,exist_ok=True); OUT_ASSETS.mkdir(parents=True,exist_ok=True)
    (OUT_API/"padroes_cn.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8")
    (OUT_ASSETS/"padroes.js").write_text(
        "// Gerado por scripts/build_padroes.py — não editar à mão.\n"
        "window.ENEM_PADROES = "+json.dumps(payload,ensure_ascii=False)+";\n",encoding="utf-8")
    print(f"OK CN: {total} itens calibrados | média {payload['meta']['media']} | "
          f"régua {[r['total'] for r in payload['meta']['regua']]}")
    print("top5 habilidades:", [(h['id'],h['total']) for h in ranking[:5]])

if __name__=="__main__":
    main()
