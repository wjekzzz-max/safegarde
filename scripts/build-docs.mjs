import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

const documents = [
  { source: 'README.md', title: '개발 및 프로젝트 안내' },
  { source: 'README-PRODUCTION.md', title: '실제 운영 및 배포 가이드' },
  { source: 'docs/DEVICE-API.md', title: 'Nano ESP32 장치 API 명세' },
];

marked.setOptions({ gfm: true, breaks: false });

const styles = `
:root{--bg:#07111f;--panel:#0d1b2c;--line:#29445f;--text:#e8f1fa;--muted:#91a7bc;--brand:#55bff5;--code:#071522}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.75 system-ui,-apple-system,'Segoe UI','Noto Sans KR',sans-serif}.layout{display:grid;grid-template-columns:290px minmax(0,1fr);min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;padding:25px 18px;overflow:auto;border-right:1px solid var(--line);background:#081522}.brand{padding:0 8px 20px;border-bottom:1px solid var(--line)}.brand strong{display:block;color:var(--brand);font-size:21px}.brand span{color:var(--muted);font-size:10px}.search{width:100%;margin:18px 0 12px;padding:10px 12px;border:1px solid var(--line);border-radius:7px;outline:none;background:var(--panel);color:var(--text)}.toc{display:grid;gap:2px}.toc a{padding:5px 8px;border-radius:5px;color:var(--muted);font-size:11px;line-height:1.35;text-decoration:none}.toc a.level-1{margin-top:9px;color:var(--text);font-size:12px;font-weight:700}.toc a.level-2{padding-left:14px}.toc a.level-3{padding-left:24px;font-size:10px}.toc a:hover{background:#17324c;color:var(--brand)}main{min-width:0}.top{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;padding:12px 28px;border-bottom:1px solid var(--line);background:#07111fe8;backdrop-filter:blur(12px)}.top span{color:var(--muted);font-size:10px}.top button,.copy{padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--text);cursor:pointer}.document{max-width:1000px;margin:auto;padding:35px 50px 100px}.document h1{margin:15px 0 30px;padding-bottom:15px;border-bottom:2px solid var(--brand);font-size:31px}.document h2{margin:46px 0 15px;padding-bottom:8px;border-bottom:1px solid var(--line);font-size:22px}.document h3{margin:29px 0 10px;color:#bde8ff;font-size:17px}.document p,.document li{color:#c9d7e4}.document a{color:var(--brand)}.document blockquote{margin:20px 0;padding:12px 16px;border-left:4px solid #f3b84b;background:#3b2b132e}.document blockquote p{margin:0;color:#f3d9a6}.document table{width:100%;margin:18px 0;border-collapse:collapse;font-size:13px}.document th,.document td{padding:9px 11px;border:1px solid var(--line);text-align:left}.document th{background:#15304a}.document tr:nth-child(even){background:#0b1928}.document pre{position:relative;margin:18px 0;padding:16px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--code);line-height:1.5}.document code{font-family:'Cascadia Code',Consolas,monospace;font-size:12px}.document :not(pre)>code{padding:2px 5px;border-radius:4px;background:#173047;color:#9fddff}.copy{position:absolute;top:8px;right:8px;padding:4px 7px;font-size:9px}mark{background:#ffdc6266;color:#fff}.no-results{display:none;margin:30px;padding:20px;color:var(--muted);text-align:center}@media(max-width:850px){.layout{grid-template-columns:1fr}.sidebar{position:static;height:auto;max-height:300px}.document{padding:25px 18px 70px}.document table{display:block;overflow:auto}}@media print{body{background:#fff;color:#111}.layout{display:block}.sidebar,.top,.copy{display:none!important}.document{max-width:none;padding:0}.document p,.document li,.document h1,.document h2,.document h3{color:#111}.document pre{white-space:pre-wrap;background:#f5f5f5;color:#111}}
`;

const behavior = `
const doc=document.querySelector('#document'),toc=document.querySelector('#toc'),counts=new Map();
doc.querySelectorAll('h1,h2,h3').forEach(h=>{const base=h.textContent.trim().toLowerCase().replace(/[^가-힣a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'section',count=counts.get(base)||0;counts.set(base,count+1);h.id=count?base+'-'+(count+1):base;const a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent;a.className='level-'+h.tagName.slice(1);toc.appendChild(a)});
doc.querySelectorAll('pre').forEach(pre=>{const b=document.createElement('button');b.className='copy';b.textContent='복사';pre.appendChild(b)});
doc.addEventListener('click',async e=>{const b=e.target.closest('.copy');if(!b)return;await navigator.clipboard.writeText(b.closest('pre').querySelector('code')?.textContent||'');b.textContent='완료';setTimeout(()=>b.textContent='복사',1200)});
const original=doc.innerHTML;
document.querySelector('#search').addEventListener('input',e=>{const q=e.target.value.trim();doc.innerHTML=original;if(!q){document.querySelector('#noResults').style.display='none';return}const walker=document.createTreeWalker(doc,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())if(!['CODE','SCRIPT','STYLE'].includes(walker.currentNode.parentElement?.tagName))nodes.push(walker.currentNode);let found=0;nodes.forEach(n=>{const text=n.nodeValue,i=text.toLowerCase().indexOf(q.toLowerCase());if(i<0)return;const f=document.createDocumentFragment();f.append(text.slice(0,i));const m=document.createElement('mark');m.textContent=text.slice(i,i+q.length);f.append(m,text.slice(i+q.length));n.replaceWith(f);found++});document.querySelector('#noResults').style.display=found?'none':'block';doc.querySelector('mark')?.scrollIntoView({behavior:'smooth',block:'center'})});
`;

const combinedMarkdown = documents.map((document, index) => {
  const markdown = readFileSync(document.source, 'utf8').replace(/^# .+$/m, '');
  const divider = index ? '\n\n<div style="margin:80px 0;border-top:3px double #29445f"></div>\n\n' : '';
  return `${divider}# ${document.title}\n\n> 원본: ${document.source}\n\n${markdown}`;
}).join('\n\n');

const content = marked.parse(combinedMarkdown);
const html = `<!doctype html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SAFE 전체 프로젝트 문서</title><style>${styles}</style></head>
<body><div class="layout"><aside class="sidebar"><div class="brand"><strong>SAFE 전체 프로젝트 문서</strong><span>개발 · 운영 · Nano ESP32 API</span></div><input class="search" id="search" placeholder="전체 문서에서 검색"><nav class="toc" id="toc"></nav></aside><main><div class="top"><span>이 파일 하나만 복사하여 오프라인에서 열 수 있습니다.</span><button onclick="window.print()">인쇄 / PDF 저장</button></div><div class="no-results" id="noResults">검색 결과가 없습니다.</div><article class="document" id="document">${content}</article></main></div><script>${behavior}</script></body></html>`;

writeFileSync('SAFE-DOCUMENTATION.html', html, 'utf8');
console.log('Generated SAFE-DOCUMENTATION.html');
