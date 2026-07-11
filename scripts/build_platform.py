#!/usr/bin/env python3
from __future__ import annotations
import json,math
from collections import Counter,defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'data';DOCS=ROOT/'docs';YEARS=list(range(2010,2026));AREAS={'CH':'Ciências Humanas','CN':'Ciências da Natureza','LC':'Linguagens e Códigos','MT':'Matemática'}
def pct(v,p):
 if not v:return None
 v=sorted(v);x=(len(v)-1)*p;a,b=math.floor(x),math.ceil(x);return round(v[a] if a==b else v[a]*(b-x)+v[b]*(x-a),1)
def valid(i):
 try:return not i.get('abandonado') and i.get('gabarito') in 'ABCDE' and float(i.get('a'))>0 and 0<=float(i.get('c'))<=1 and 200<=float(i.get('b_enem'))<=900
 except:return False
def level(v):return 'Sem calibração' if v is None else 'Muito fácil' if v<560 else 'Fácil' if v<620 else 'Mediana' if v<680 else 'Difícil' if v<740 else 'Muito difícil'
def matrix():
 raw=json.loads((DATA/'matriz_referencia_enem.json').read_text())['matriz_referencia_enem']['areas'];flat=[];lookup={}
 for area in raw:
  for comp in area['competencias']:
   for skill in comp['habilidades']:
    r={'area':area['codigo'],'area_nome':area['nome'],'competencia':comp['numero'],'competencia_descricao':comp['descricao'],'habilidade':int(skill['codigo'][1:]),'codigo':skill['codigo'],'descricao':skill['descricao']};flat.append(r);lookup[(r['area'],r['habilidade'])]=r
 return flat,lookup
def main():
 src=json.loads((DATA/'microdados.json').read_text());skills,lookup=matrix();items=[];groups=defaultdict(list)
 for raw in src['itens']:
  if raw.get('ano') not in YEARS or raw.get('area') not in AREAS:continue
  i=dict(raw);i['validado']=valid(i);i['area_nome']=AREAS[i['area']];i['id']=f"{i['ano']}-{i['area']}-{i['co_item']}";i['fonte']='INEP — Microdados ENEM / ITENS_PROVA';s=lookup.get((i['area'],i.get('habilidade')));i['habilidade_descricao']=s['descricao'] if s else None;i['competencia']=s['competencia'] if s else None;items.append(i)
  if i.get('habilidade') is not None:groups[(i['area'],int(i['habilidade']))].append(i)
 patterns=[]
 for s in skills:
  g=groups.get((s['area'],s['habilidade']),[]);v=[i for i in g if i['validado']];bs=[float(i['b_enem']) for i in v];aa=[float(i['a']) for i in v];yy=Counter(i['ano'] for i in v);med=pct(bs,.5)
  patterns.append({**s,'total_catalogado':len(g),'total_validado':len(v),'anos_com_aparicao':sum(bool(yy[y]) for y in YEARS),'por_ano':[{'ano':y,'total':yy[y]} for y in YEARS],'dificuldade_tipica':med,'dificuldade_rotulo':level(med),'faixa_observada':{'min':round(min(bs),1) if bs else None,'q1':pct(bs,.25),'q3':pct(bs,.75),'max':round(max(bs),1) if bs else None},'discriminacao_mediana':pct(aa,.5),'padrao_cobranca':f"A cobrança recorrente exige a operação cognitiva descrita na matriz — {s['descricao']} — aplicada a textos-base, recursos visuais, dados ou situações-problema."})
 for a in AREAS:
  for rank,p in enumerate(sorted((x for x in patterns if x['area']==a),key=lambda x:(-x['total_validado'],x['habilidade'])),1):p['ranking_area']=rank
 patterns.sort(key=lambda p:(p['area'],p['ranking_area']));tot=Counter(i['area'] for i in items);vt=Counter(i['area'] for i in items if i['validado']);meta={'titulo':'Banco multiarea de itens do ENEM','fonte':'INEP — Microdados ENEM, tabelas ITENS_PROVA','recorte':'2010–2025','anos':YEARS,'total_catalogado':len(items),'total_validado':sum(vt.values()),'criterio_validacao':'Item não abandonado, gabarito A–E, a > 0, 0 ≤ c ≤ 1 e dificuldade transformada entre 200 e 900.','por_area':[{'area':a,'nome':AREAS[a],'catalogado':tot[a],'validado':vt[a]} for a in AREAS]};compact=[{k:i.get(k) for k in ('ano','area','co_item','habilidade','competencia','validado','b_enem','a')} for i in items];ip={'meta':meta,'itens':compact};pp={'meta':meta,'padroes':patterns};mp={'meta':{'fonte':'Matriz de Referência do ENEM'},'habilidades':skills};q=json.loads((DATA/'questions.json').read_text());(DOCS/'api').mkdir(exist_ok=True)
 for path,payload in [(DATA/'itens_multiarea.json',ip),(DATA/'padroes.json',pp),(DATA/'matriz.json',mp),(DOCS/'api'/'itens.json',ip),(DOCS/'api'/'padroes.json',pp),(DOCS/'api'/'matriz.json',mp),(DOCS/'api'/'questions.json',q)]:path.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
 print(json.dumps(meta,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
