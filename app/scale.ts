import {parseBeachRows} from './beach-scale';
import { getDocumentProxy } from 'unpdf';
// Pasta do ano (ex.: ESCALAS 2026), com uma subpasta por mês (JANEIRO ... DEZEMBRO).
export const DEFAULT_FOLDER='1M-dFG30gP6a_HWn-vVLD8T5e50n_wnzH';
const months=['JANEIRO','FEVEREIRO','MARCO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
export const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
export function folderId(s:string){const v=s.trim();const m=v.match(/^https:\/\/drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]+)(?:[/?#].*)?$/);const id=m?.[1]||v;if(!/^[A-Za-z0-9_-]{15,100}$/.test(id))throw Error('Informe o link de uma pasta do Google Drive.');return id;}
function decode(s:string){return s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
// Decode the public Drive metadata string as data only; never execute page scripts.
export function driveFileTimes(html:string){const result=new Map<string,{modifiedAt:number,createdAt:number}>();try{const raw=html.match(/window\['_DRIVE_ivd'\]\s*=\s*'((?:\\.|[^'\\])*)'/)?.[1];if(!raw)return result;const decoded=raw.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|[\\/'"bfnrt])/g,(_,v:string)=>v[0]==='x'||v[0]==='u'?String.fromCharCode(parseInt(v.slice(1),16)):({'\\':'\\',"'":"'",'"':'"','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'} as Record<string,string>)[v]);const rows=JSON.parse(decoded)?.[0];if(Array.isArray(rows))for(const row of rows){if(Array.isArray(row)&&typeof row[0]==='string'&&Number.isSafeInteger(row[10])&&row[10]>0)result.set(row[0],{modifiedAt:row[10],createdAt:Number.isSafeInteger(row[9])?row[9]:0});}}catch{}return result;}
export function newestScale<T extends {id:string,modifiedAt?:number,createdAt?:number}>(files:T[]):T{if(files.length>1&&files.some(f=>!f.modifiedAt))throw Error('Não foi possível confirmar qual escala é a mais recente. Use o preenchimento manual.');return [...files].sort((a,b)=>(b.modifiedAt||0)-(a.modifiedAt||0)||(b.createdAt||0)-(a.createdAt||0)||a.id.localeCompare(b.id))[0];}
export function folderFiles(html:string){const files:{id:string,name:string,type:'pdf'|'doc',modifiedAt?:number,createdAt?:number}[]=[];for(const row of html.matchAll(/<tr\b[^>]*data-id="([A-Za-z0-9_-]+)"[^>]*>([\s\S]*?)<\/tr>/g)){const docName=row[2].match(/aria-label="([^"]+?) Google Docs(?: [^"]*)?"/)?.[1];const name=docName||row[2].match(/aria-label="([^"]*?\.pdf)(?:\s[^"<>]*)?"/i)?.[1];if(name&&!files.some(f=>f.id===row[1]))files.push({id:row[1],name:decode(name),type:docName?'doc':'pdf'});}const metadata=driveFileTimes(html);return files.map(f=>({...f,...metadata.get(f.id)}));}
// Subpastas da listagem pública (ex.: "NOVEMBRO Shared folder").
export function folderSubfolders(html:string){const out:{id:string,name:string}[]=[];for(const row of html.matchAll(/<tr\b[^>]*data-id="([A-Za-z0-9_-]+)"[^>]*>([\s\S]*?)<\/tr>/g)){const name=row[2].match(/aria-label="([^"]+?) (?:Shared folder|Google Drive Folder|Folder|Pasta compartilhada|Pasta do Google Drive|Pasta)"/)?.[1];if(name&&!out.some(f=>f.id===row[1]))out.push({id:row[1],name:decode(name)});}return out;}
const monthOf=(name:string)=>{const n=normalize(name);const found=months.map((m,i)=>new RegExp('(^|[^A-Z])(?:'+m+'|'+m.slice(0,3)+')(?=[^A-Z]|$)').test(n)?i:-1).filter(i=>i>=0);return found.length===1?found[0]:-1;};
// Escolhe a subpasta do mês do serviço. Retorna null quando a pasta não é organizada por meses.
export function monthFolder(subfolders:{id:string,name:string}[],date:string){const [year,month]=date.split('-').map(Number);const monthly=subfolders.filter(f=>monthOf(f.name)>=0);if(!monthly.length)return null;
 const matches=monthly.filter(f=>{if(monthOf(f.name)!==month-1)return false;const y=normalize(f.name).match(/(?:^|\D)(20\d{2})(?:\D|$)/)?.[1];return !y||Number(y)===year;});
 if(!matches.length)throw Error('Pasta do mês '+months[month-1].replace('MARCO','MARÇO')+' não encontrada na pasta de escalas. Preencha manualmente.');
 if(matches.length>1)throw Error('Mais de uma pasta para o mês '+months[month-1].replace('MARCO','MARÇO')+' na pasta de escalas. Preencha manualmente.');
 return matches[0];}
const folderYear=(html:string)=>Number(normalize(decode(html.match(/<title>([^<]*)<\/title>/i)?.[1]||'')).match(/(?:^|\D)(20\d{2})(?:\D|$)/)?.[1]||0);
export function matchesDay(name:string,date:string){const [year,month,day]=date.split('-').map(Number);const n=normalize(name);const named=new RegExp('(^|\\D)0?'+day+'\\s+(?:DE\\s+)?'+months[month-1]+'(?:\\s+(?:DE\\s+)?(20\\d{2}))?(?=\\D|$)').exec(n);if(named)return !named[2]||Number(named[2])===year;return new RegExp('(^|\\D)0?'+day+'[._ -]0?'+month+'[._ -]'+year+'(\\D|$)').test(n);}
type Row={y:number,items:{str:string,x:number,w:number}[]};
const rules:[number,RegExp][]=[
 [0,/^OF\.? CHEFE DE OPERACOES$/],[1,/^OF\.? (?:DE )?RAS (?:DO |[-–] ?)?2[º°O]? ?GMAR$/],[2,/^OF\.? (?:DE )?RAS (?:AOS DESTACAMENTOS|[-–] ?DBM)$/],
 [3,/^CMT DA GUARDA$/],[4,/^COMUNICACAO(?: \(24H\))?$/],[5,/^SUPERVISOR DE PRAIA$/],
 [6,/^CHEFE DA GUARNICAO ASE \d+$/],[7,/^GUARNICAO ASE \d+(?: \(24X72\))?$/],
 [8,/^MOTO AQUATICA(?: 0?1)? \(24H\)$/],[9,/^MOTO AQUATICA 0?2 \(24H\)$/],[10,/^MOTO AQUATICA AMA-E$/],[11,/^COMAT\s*\/\s*SOP$/], [12,/^MOT\.? ASE ?\d+$/], [13,/^(?:ENCARREGADO DE MOT\/)?MOT\.? AR[-– ]+SOS$/], [14,/^ENCARREGADO DE (?:MOTORISTAS|MOTORISTA|MOT\.?)$/]
];
export async function parseScale(bytes:Uint8Array,expectedDate:string){
 if(bytes.length>5*1024*1024)throw Error('PDF acima do limite de 5 MB. Preencha manualmente.');
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('O Drive não retornou um PDF acessível. Preencha manualmente.');
 const doc=await getDocumentProxy(bytes,{useSystemFonts:false});
 if(doc.numPages>10)throw Error('Escala com mais de 10 páginas: revisão manual necessária.');
 const page=await doc.getPage(1);const tc=await page.getTextContent();
 const items=tc.items.filter((x:any)=>typeof x.str==='string'&&x.str.trim()) as any[];
 const rows:Row[]=[];for(const item of items.sort((a,b)=>b.transform[5]-a.transform[5])){let row=rows.find(r=>Math.abs(r.y-item.transform[5])<2.7);if(!row){row={y:item.transform[5],items:[]};rows.push(row);}row.items.push({str:item.str,x:item.transform[4],w:item.width});}
 for(const r of rows)r.items.sort((a,b)=>a.x-b.x);
 const text=normalize(rows.map(r=>r.items.map(i=>i.str).join(' ')).join('\n'));
 const m=text.match(/SERVICO PARA O DIA\s+(\d{1,2})\s+DE\s+([A-Z]+)\s+(?:DE\s+)?(20\d{2})/);
 const serviceDate=m?`${m[3]}-${String(months.indexOf(m[2])+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';
 if(serviceDate!==expectedDate)throw Error('A data no conteúdo da escala não corresponde ao serviço selecionado. Nenhum dado foi importado.');
 let adjunto='',adjuntoCount=0;const serviceAssignments:{label:string,value:string}[]=[];
 const dayCrew:string[]=[];const nauticalOperators:string[]=[];let nauticalRow=false;
 const crew=Array(14).fill('') as string[];const evidence:{index:number,label:string,value:string}[]=[];const warnings:string[]=[];const seen=new Set<number>();
 let left=0,right=0;
 for(const r of rows){const joined=normalize(r.items.map(i=>i.str).join(' '));
 if(joined.startsWith('FUNCAO')&&joined.includes('MILITAR DE SERVICO')&&joined.includes('SOBREAVISO')){
 const a=r.items.find(i=>normalize(i.str)==='FUNCAO'),b=r.items.find(i=>normalize(i.str)==='MILITAR DE SERVICO'),c=r.items.find(i=>normalize(i.str).includes('SOBREAVISO'));
 if(a&&b&&c){left=(a.x+a.w/2+b.x+b.w/2)/2;right=(b.x+b.w/2+c.x+c.w/2)/2;}else{left=0;right=0;}continue;}
 if(!left||!right)continue;
 if(/^(SOCORRO NOTURNO|GRDMAR|GUARDA|PRAIA ALA)/.test(joined)){left=0;right=0;continue;}
 const serviceValue=r.items.filter(i=>i.x+i.w/2>=left&&i.x+i.w/2<right).map(i=>i.str).join(' ').trim();if(/\b\d{4,8}\b/.test(serviceValue))dayCrew.push(serviceValue);
 const label=r.items.filter(i=>i.x+i.w/2<left).map(i=>i.str).join(' ').trim();if(label&&serviceValue){serviceAssignments.push({label,value:serviceValue});if(/^ADJUNTO (?:AO |DO )?OF\.? (?:DE )?DIA$/.test(normalize(label))){adjuntoCount++;adjunto=adjuntoCount===1?serviceValue:'';}}const rule=rules.find(([,pattern])=>pattern.test(normalize(label)));if(!rule){if(!label&&nauticalRow){const continuation=r.items.filter(i=>i.x+i.w/2>=left&&i.x+i.w/2<right).map(i=>i.str).join(' ').trim();if(/\b\d{4,8}\b/.test(continuation))nauticalOperators.push(continuation);}else nauticalRow=false;continue;}
 nauticalRow=[8,9,10].includes(rule[0]);
 const value=r.items.filter(i=>i.x+i.w/2>=left&&i.x+i.w/2<right).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim();
 if(!/\b\d{4,8}\b/.test(value)){warnings.push(label+': sem militar identificado; preenchimento manual.');continue;}
 if(nauticalRow)nauticalOperators.push(value);
 if(seen.has(rule[0])){crew[rule[0]]='';const prior=evidence.findIndex(e=>e.index===rule[0]);if(prior>=0)evidence.splice(prior,1);warnings.push(label+': mais de uma linha encontrada; confira manualmente.');continue;}
 seen.add(rule[0]);crew[rule[0]]=value;evidence.push({index:rule[0],label,value});}
 if(!crew.some(Boolean))throw Error('O formato das colunas não foi reconhecido com segurança. Preencha a ala manualmente.');
 const beachRows=[...rows];
 for(let number=2;number<=doc.numPages;number++){const content=await (await doc.getPage(number)).getTextContent();const extra:Row[]=[];for(const item of (content.items as any[]).filter(x=>typeof x.str==='string'&&x.str.trim()).sort((a,b)=>b.transform[5]-a.transform[5])){let r=extra.find(r=>Math.abs(r.y-item.transform[5])<2.7);if(!r){r={y:item.transform[5],items:[]};extra.push(r);}r.items.push({str:item.str,x:item.transform[4],w:item.width});}for(const r of extra)r.items.sort((a,b)=>a.x-b.x);beachRows.push(...extra);}
 return {...parseBeachRows(beachRows),adjunto,serviceAssignments,serviceDate,crew,evidence,warnings,dayCrew,nauticalOperators:[...new Set(nauticalOperators)]};
}
async function publicRead(url:string,max:number,signal:AbortSignal){
 let current=url;for(let redirects=0;redirects<5;redirects++){
 const u=new URL(current);if(u.protocol!=='https:'||!(['drive.google.com','drive.usercontent.google.com','drive.googleusercontent.com','docs.google.com'].includes(u.hostname)||u.hostname.endsWith('.docs.googleusercontent.com')||/^doc-[a-z0-9-]+-docstext\.googleusercontent\.com$/.test(u.hostname)))throw Error('O Drive solicitou acesso autenticado ou um endereço não permitido.');
 const res=await fetch(current,{redirect:'manual',signal,headers:{Accept:'*/*'}});
 if(res.status>=300&&res.status<400){const loc=res.headers.get('location');if(!loc)throw Error('Redirecionamento inválido do Drive.');current=new URL(loc,current).href;continue;}
 if(!res.ok)throw Error('Não foi possível ler a pasta ou o PDF no Drive.');
 if(Number(res.headers.get('content-length')||0)>max)throw Error('Arquivo acima do limite permitido.');
 const reader=res.body?.getReader();if(!reader)throw Error('Resposta vazia do Drive.');const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>max)throw Error('Arquivo acima do limite permitido.');chunks.push(value);}}finally{await reader.cancel();}
 const out=new Uint8Array(length);let pos=0;for(const c of chunks){out.set(c,pos);pos+=c.length;}return out;
 }throw Error('O Drive excedeu o limite de redirecionamentos.');
}
export async function loadScale(folder:string,date:string){
 const signal=AbortSignal.timeout(25000);let html=new TextDecoder().decode(await publicRead(`https://drive.google.com/drive/folders/${folderId(folder)}`,4*1024*1024,signal));
 // Pasta do ano: confere o ano no nome e entra na subpasta do mês do serviço.
 const month=monthFolder(folderSubfolders(html),date);
 if(month){const year=folderYear(html);if(year&&year!==Number(date.slice(0,4)))throw Error('A pasta de escalas configurada é de '+year+'. Atualize a pasta do ano para buscar escalas de '+date.slice(0,4)+'.');
  folder=month.id;html=new TextDecoder().decode(await publicRead(`https://drive.google.com/drive/folders/${month.id}`,4*1024*1024,signal));}
 const files=folderFiles(html),candidates=files.filter(f=>matchesDay(f.name,date));
 if(!files.length)throw Error('A listagem pública da pasta não está disponível ou não contém Google Docs ou PDFs. O preenchimento manual continua disponível.');
 if(!candidates.length)throw Error('Escala não localizada para este dia na listagem pública da pasta. Preencha manualmente.');
 const file=newestScale(candidates);const bytes=await publicRead(file.type==='doc'?`https://docs.google.com/document/d/${file.id}/export?format=pdf`:`https://drive.google.com/uc?export=download&id=${file.id}`,5*1024*1024,signal);
 const result=await parseScale(bytes,date);if(candidates.length>1)result.warnings.push('Foram encontradas '+candidates.length+' escalas para este dia. Importada a mais recentemente modificada: '+file.name+'.');return {...result,source:{id:file.id,name:file.name,type:file.type,modifiedAt:file.modifiedAt?new Date(file.modifiedAt).toISOString():null,url:file.type==='doc'?`https://docs.google.com/document/d/${file.id}/edit`:`https://drive.google.com/file/d/${file.id}/view`,folderUrl:`https://drive.google.com/drive/folders/${folder}`,checkedAt:new Date().toISOString()}};
}
