import json,re,shutil,os
from PIL import Image
import pdfplumber
PROJ='/home/claude/fortios-exam'
raw=json.load(open('raw.json'))
qimg=json.load(open('qimg.json'))
pdf=pdfplumber.open('/mnt/user-data/uploads/FortiOS_Dump.pdf')
heads=[]
for pi,page in enumerate(pdf.pages):
    ws=page.extract_words()
    for i,w in enumerate(ws):
        if w['text']=='Question' and i+1<len(ws) and ws[i+1]['text'].startswith('#'):
            m=re.match(r'#(\d+)',ws[i+1]['text'])
            if m: heads.append((int(m.group(1)),pi+1))
heads.sort()
startpage={n:p for n,p in heads}
nums=[n for n,_ in heads]
endpage={n:(startpage[nums[i+1]] if i+1<len(nums) else 195) for i,n in enumerate(nums)}
CLI=re.compile(r'^\s*(config|set|unset|end|edit|next|append|diagnose|get|show|execute)\b')
def join(lines):
    s=''
    for l in lines:
        l=l.strip()
        if not l: continue
        if s and re.search(r'[A-Za-z0-9]-$',s) and l[:1].isalnum():
            s+=l
        else: s+=(' ' if s else '')+l
    return s
def blocks_from(lines):
    blocks=[];cur=[]
    def flush():
        nonlocal cur
        if cur:
            if len(cur)>=2 and all(CLI.match(l) for l in cur):
                blocks.append({'kind':'code','text':'\n'.join(l.strip() for l in cur)})
            else:
                blocks.append({'kind':'text','text':join(cur)})
            cur=[]
    for l in lines:
        if not l.strip(): flush()
        else: cur.append(l)
    flush()
    return blocks
EXCLUDE={95:'Drag-and-drop ordering question (the answer is a sequence, not a selection set). It cannot be shown as single/multiple choice without changing the question or leaking the key, so it was left out to reach exactly 100.'}
out=[]
for n in sorted(map(int,raw)):
    r=raw[str(n)]
    lines=r['pre'].split('\n')
    idx=[];exp='A'
    for i,l in enumerate(lines):
        m=re.match(r'^\s*([A-H])\.\s+(.*)$',l)
        if m and m.group(1)==exp: idx.append(i); exp=chr(ord(exp)+1)
    stem=blocks_from(lines[:idx[0]])
    opts=[]
    for k,i in enumerate(idx):
        end=idx[k+1] if k+1<len(idx) else len(lines)
        seg=lines[i:end]; seg[0]=re.sub(r'^\s*[A-H]\.\s+','',seg[0])
        opts.append({'id':chr(65+k),'text':join(seg)})
    stemtxt=' '.join(b['text'] for b in stem)
    key=r['answer']
    votes=[{'answer':a,'percent':float(p)} for a,p in r['votes']]
    imgs=[]
    if n not in EXCLUDE:
        for k,f in enumerate(qimg.get(str(n),[])):
            w,h=Image.open('/tmp/'+f).size
            name=f'q{n}-{k+1}.png'
            shutil.copy('/tmp/'+f,f'{PROJ}/public/images/'+name)
            imgs.append({'src':f'images/{name}','width':w,'height':h,'alt':f'Exhibit for original question #{n}'})
    flags=[]
    top=votes[0]['answer'] if votes else None
    if top and top!=''.join(key):
        flags.append({'code':'votes-differ','note':f"The PDF's answer key is {', '.join(key)}, but the community vote list printed in the PDF ranks {', '.join(top)} first ({votes[0]['percent']:g}%). The exam grades against the PDF answer key."})
    if re.search('exhibit',stemtxt,re.I) and not imgs and n not in EXCLUDE:
        flags.append({'code':'missing-exhibit','note':'This question refers to an exhibit, but the source PDF contains no exhibit image for it. Nothing could be restored, so the question is shown exactly as printed.'})
    out.append({'num':n,'type':'multiple' if len(key)>1 else 'single','chooseCount':len(key),'stem':stem,'options':opts,'answer':key,'images':imgs,'votes':votes,'flags':flags,'sourcePages':[startpage[n],endpage[n]]})
included=[q for q in out if q['num'] not in EXCLUDE]
excluded=[{'num':n,'reason':EXCLUDE[n]} for n in EXCLUDE]
json.dump(included,open(f'{PROJ}/src/data/questions.json','w'),indent=1,ensure_ascii=False)
json.dump(excluded,open(f'{PROJ}/src/data/excluded.json','w'),indent=1,ensure_ascii=False)
d={q['num']:q for q in included}
print(len(out),len(included),len(os.listdir(f'{PROJ}/public/images')))
print(d[2]['options'][0]['text']); print(d[65]['stem'][1]['text'][:160]); print(d[78]['stem'])
print('with images',sum(1 for q in included if q['images']),'multi',sum(1 for q in included if q['type']=='multiple'))
print([(q['num'],f['code']) for q in included for f in q['flags']])
