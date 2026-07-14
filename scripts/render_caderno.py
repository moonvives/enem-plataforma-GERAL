#!/usr/bin/env python3
import argparse,json,fitz
from pathlib import Path
from PIL import Image
def render(pdf,out,scale,quality):
 out.mkdir(parents=True,exist_ok=True);doc=fitz.open(pdf);pages=[]
 for n,page in enumerate(doc,1):
  name=f'pagina-{n:03d}.webp';target=out/name
  if not target.exists() or target.stat().st_size == 0:
   pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False);Image.frombytes('RGB',(pix.width,pix.height),pix.samples).save(target,'WEBP',quality=quality,method=6)
  pages.append({'pagina':n,'imagem':name})
 (out/'manifest.json').write_text(json.dumps({'titulo':pdf.stem,'total_paginas':len(doc),'formato':'WebP','paginas':pages},ensure_ascii=False,separators=(',',':')))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('pdf',type=Path);p.add_argument('output',type=Path);p.add_argument('--scale',type=float,default=1.15);p.add_argument('--quality',type=int,default=72);a=p.parse_args();render(a.pdf,a.output,a.scale,a.quality)
