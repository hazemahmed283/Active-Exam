import re, json
txt=open('dump.txt',encoding='utf-8').read()
parts=re.split(r'\n\s*Question #(\d+)\s*\n',txt)
# parts[0]=preamble; then (num, body) pairs
qs={}
for i in range(1,len(parts),2):
    n=int(parts[i]); body=parts[i+1]
    body=body.replace('\f','\n')
    # cut footer/header junk
    body=re.split(r'\n\s*Hide Solution',body)[0]
    m=re.search(r'\n\s*Correct Answer:\s*([A-Z](?:\s*,\s*[A-Z])*)\s*\n',body)
    if not m:
        print('NO ANSWER',n); continue
    pre=body[:m.start()]; post=body[m.end():]
    ans=[a.strip() for a in m.group(1).split(',')]
    # votes
    votes=re.findall(r'^\s*([A-Z]{1,5})\s+(\d+(?:\.\d+)?)%',post,re.M)
    # remove stray header junk in pre (site header repeated before question)
    qs[n]={'num':n,'pre':pre,'answer':ans,'votes':votes}
json.dump(qs,open('raw.json','w'))
print(len(qs))
