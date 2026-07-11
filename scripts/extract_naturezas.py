#!/usr/bin/env python3
import csv,json,re,fitz
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];PDF=ROOT/'data/naturezas/Geral/Naturezas.pdf';HEADER=re.compile(r'Questão\s+(\d{3})\s*\((?:H(\d+)\s*\|\s*)?(\d{4})(?:\s*\|\s*([^)]+))?\)')
def comp(h):
 if not h:return None
 for c,(a,b) in enumerate([(1,4),(5,7),(8,12),(13,16),(17,19),(20,23),(24,27),(28,30)],1):
  if a<=h<=b:return c
def clean(t):return re.sub(r'\n{3,}','\n\n',re.sub(r'\nPágina\d+\s*','\n',t)).strip()
def main():
 doc=fitz.open(PDF);answers={}
 for pn in list(range(276,285))+[310,334,357,378]:
  for n,l in re.findall(r'Questão\s+(\d{3})\s*\n([A-EX])\s*\n',doc[pn-1].get_text('text')):answers[int(n)]=l
 qs=[]
 for page in doc:
  if page.number+1<29:continue
  text=page.get_text('text');mm=list(HEADER.finditer(text))
  for idx,m in enumerate(mm):
   n=int(m[1]);h=int(m[2]) if m[2] else None;year=int(m[3]);raw=(m[4] or '').strip();end=mm[idx+1].start() if idx+1<len(mm) else len(text);ann='anulad' in raw.lower();difficulty=None
   if raw and not ann:
    try:difficulty=float(raw.replace('.','').replace(',','.'))
    except:pass
   qs.append({'numero':n,'codigo':f'REG-{n:03d}','ano':year,'habilidade':h,'competencia':comp(h),'dificuldade':difficulty,'gabarito':answers.get(n),'anulada_tri':ann,'pagina_pdf':page.number+1,'imagem':f'assets/cadernos/naturezas/pagina-{page.number+1:03d}.webp','texto_extraido':clean(text[m.end():end]),'fonte':'Naturezas.pdf — acervo fornecido pela usuária'})
 qs=list({q['numero']:q for q in qs}.values());qs.sort(key=lambda q:q['numero'])
 with (ROOT/'data/microdados/ITENS_PROVA_2024.csv').open(encoding='latin1') as f:rows=[r for r in csv.DictReader(f,delimiter=';') if r['SG_AREA']=='CN' and r['CO_PROVA']=='1420']
 rows.sort(key=lambda r:int(r['CO_POSICAO']))
 for r in rows:
  q=qs[675+int(r['CO_POSICAO'])-91];q['habilidade']=int(r['CO_HABILIDADE']);q['competencia']=comp(q['habilidade']);q['co_item']=int(r['CO_ITEM']);q['gabarito']=r['TX_GABARITO'];q['anulada_tri']=r['TX_GABARITO']=='X' or not r['NU_PARAM_B'];q['dificuldade']=round(500+100*float(r['NU_PARAM_B']),1) if r['NU_PARAM_B'] else None
 payload={'meta':{'titulo':'Ciências da Natureza por Habilidades e Dificuldades','total_questoes':len(qs),'anos':'2009–2024','total_paginas':len(doc)},'questoes':qs}
 for p in [ROOT/'data/questions_regular.json',ROOT/'docs/api/questions_regular.json']:p.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
 (ROOT/'docs/api/fundamentos_natureza.json').write_text(json.dumps({'paginas':[{'pagina':n,'texto':clean(doc[n-1].get_text('text'))} for n in range(8,29)]},ensure_ascii=False,separators=(',',':')))
 print(len(qs))
if __name__=='__main__':main()
