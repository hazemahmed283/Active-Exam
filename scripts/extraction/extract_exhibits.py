"""Maps exhibit images to questions by page position and extracts them (step 2 of the extraction).
Pipeline used (all with the original FortiOS_Dump.pdf, working dir /tmp):
  pdftotext -layout FortiOS_Dump.pdf dump.txt ; python parse.py ; python extract_exhibits.py ; python build_dataset.py
Decorative images (logo 1200x1200, icon 512x512, banner 730x225, tiled watermark layers drawn 3x per page) are skipped.
"""
import json, re
import pdfplumber
from pypdf import PdfReader
from pypdf.filters import _xobj_to_image
PDF='/mnt/user-data/uploads/FortiOS_Dump.pdf'; STEP=567  # page offset of the long web page sliced into pages
pdf=pdfplumber.open(PDF); heads=[]
for pi,page in enumerate(pdf.pages):
    ws=page.extract_words()
    for i,w in enumerate(ws):
        if w['text']=='Question' and i+1<len(ws) and ws[i+1]['text'].startswith('#'):
            m=re.match(r'#(\d+)',ws[i+1]['text'])
            if m: heads.append((pi*STEP+w['top'],int(m.group(1))))
heads.sort(); dec={(1200,1200),(512,512),(730,225)}; ex={}
for pi,page in enumerate(pdf.pages):
    for im in page.images:
        sz=tuple(im['srcsize']); oid=im['stream'].objid
        if sz in dec or sum(1 for x in page.images if x['stream'].objid==oid)>1: continue
        ex[oid]=min(ex.get(oid,1e12),pi*STEP+im['top'])
r=PdfReader(PDF); out={}
import os; os.makedirs('/tmp/exh',exist_ok=True)
for oid,gy in sorted(ex.items(),key=lambda x:x[1]):
    q=[h for h in heads if h[0]<=gy+5][-1][1]
    fn=f'exh/q{q}_{oid}.png'; _xobj_to_image(r.get_object(oid))[2].convert('RGB').save('/tmp/'+fn)
    out.setdefault(str(q),[]).append(fn)
json.dump(out,open('/tmp/qimg.json','w'))
