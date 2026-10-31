import {adjuntoGet,adjuntoPost} from '../../adjunto-server';
import {supervisorGet,supervisorPost} from '../../supervisor-server';
import {ssmtGet,ssmtPost} from '../../ssmt-server';
import {nauticalGet,nauticalPost} from '../../nautica-server';
import {personLabel} from '../../person-label';
import {normalizeRg,assignmentRg,canSignAssigned,dependencies} from '../../service-policy';
import { makeMonthlyPdf } from '../../monthly-pdf';
import { loadSisgeo } from '../../sisgeo';
import { database } from '../../../lib/database';
import {makeNauticalPdf} from '../../nautica-pdf';
import {makeSsmtPdf} from '../../ssmt-pdf';
import { downloadPdf, removeLegacyPdfs } from '../../../lib/storage';
import { timingSafeEqual } from 'node:crypto';
export const runtime='nodejs';
export const maxDuration=60;
import { blank, validateBook, roles } from '../../book-model';
import { makePdf } from '../../pdf';
import { readDrawing } from '../../handwriting';
import { DEFAULT_FOLDER, folderId, loadScale } from '../../scale';
export const dynamic='force-dynamic';
const db=()=>database;
const nauticalContext=()=>({db:db(),check,hash,downloadPdf,scale:async(date:string)=>{const folder=await db().prepare('SELECT value FROM settings WHERE key=?').bind('scaleFolder').first<any>();return loadScale(folder?.value||DEFAULT_FOLDER,date);}});
const clean=(u:any)=>({rg:u.rg,name:u.name,role:u.role,active:u.active,rank:u.rank,firstLogin:u.first_login,nauticaChief:!!u.nautica_chief,ssmtChief:!!u.ssmt_chief});
const json=(v:any,status=200,extra:any={})=>v instanceof Response?v:Response.json(v,{status,headers:{'Cache-Control':'no-store',...extra}});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
async function password(p:string,salt=crypto.randomUUID()){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256);return salt+':'+Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function check(p:string,stored:string){return await password(p,stored.split(':')[0])===stored;}
async function me(req:Request){const cookie=req.headers.get('cookie')?.match(/(?:^|;\s*)gmar_session=([^;]+)/)?.[1];if(!cookie)return null;return await db().prepare("SELECT u.*,(u.rg=(SELECT value FROM livros.settings WHERE key='nauticalChief')) AS nautica_chief,(u.rg=(SELECT value FROM livros.settings WHERE key='ssmtChief')) AS ssmt_chief FROM users u JOIN sessions s ON s.rg=u.rg WHERE s.id=? AND s.expires>? AND u.active=1").bind(await hash(cookie),Date.now()).first<any>();}
async function issue(rg:string){const token=crypto.randomUUID()+crypto.randomUUID();await db().prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await hash(token),rg,Date.now()+8*3600000).run();return {'Set-Cookie':`gmar_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`};}
function fail(msg:string,status=400):never{throw Object.assign(new Error(msg),{status});}
export async function GET(req:Request){try{
 const url=new URL(req.url),op=url.searchParams.get('op');const u=await me(req);
 if(op==='me'){const count=await db().prepare('SELECT count(*) n FROM users').first<any>();return json({user:u?clean(u):null,setup:Number(count.n)===0});}
 if(!u)fail('Entre com seu RG e senha.',401);
 if(op==='operationalOverview'){const row=await db().prepare('SELECT date,status,data FROM livros.nautical_books ORDER BY date DESC LIMIT 1').first<any>();const vehicle=await db().prepare('SELECT date,status,data FROM livros.ssmt_books ORDER BY date DESC LIMIT 1').first<any>();return json({ssmt:vehicle?{date:vehicle.date,status:vehicle.status,inventory:JSON.parse(vehicle.data).inventory}:null,nautica:row?{date:row.date,status:row.status,inventory:JSON.parse(row.data).inventory}:null});}
 if(op?.startsWith('adjunto'))return json(await adjuntoGet(op,u,url,nauticalContext()));
 if(op==='monthPdf'&&url.searchParams.get('type')==='adjunto')return json(await adjuntoGet('adjuntoMonthPdf',u,url,nauticalContext()));
 if(op?.startsWith('supervisor'))return json(await supervisorGet(op,u,url,nauticalContext()));
 if(op==='monthPdf'&&url.searchParams.get('type')==='supervisor')return json(await supervisorGet('supervisorMonthPdf',u,url,nauticalContext()));
 if(op?.startsWith('ssmt'))return json(await ssmtGet(op,u,url,nauticalContext()));
 if(op==='monthPdf'&&url.searchParams.get('type')==='ssmt')return json(await ssmtGet('ssmtMonthPdf',u,url,nauticalContext()));
 if(op?.startsWith('nautical'))return json(await nauticalGet(op,u,url,nauticalContext()));
 if(op==='monthPdf'&&url.searchParams.get('type')==='nautica')return json(await nauticalGet('nauticalMonthPdf',u,url,nauticalContext()));
 if(u.role==='enlisted')fail('Este acesso é restrito aos oficiais.',403);
 if(op==='dependencies'){const book=await db().prepare('SELECT author FROM books WHERE date=?').bind(url.searchParams.get('date')).first<any>();const rows=(await db().prepare('SELECT * FROM livros.service_attestations WHERE date=?').bind(url.searchParams.get('date')).all()).results;return json(dependencies(rows,book?.author||''));}
 if(op==='scaleConfig'){const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind('scaleFolder').first<any>();return json({folder:row?.value||DEFAULT_FOLDER});}
 if(op==='users'){if(u.role!=='admin')fail('Acesso restrito à administração.',403);return json((await db().prepare('SELECT rg,name,rank,role,active FROM users ORDER BY name').all()).results);}
 if(op==='list')return json((await db().prepare('SELECT date,author,author_name,version,status,updated FROM books ORDER BY date DESC').all()).results);
 const date=url.searchParams.get('date');
 if(op==='monthPdf'){if((url.searchParams.get('type')||'officer')!=='officer')fail('Este tipo de livro ainda não está disponível.',400);const month=url.searchParams.get('month')||'';if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))fail('Mês inválido.');const records=(await db().prepare('SELECT date,author_name,status,version,data,signature,review,updated FROM books WHERE date LIKE ? ORDER BY date').bind(month+'-%').all()).results;if(!records.length)fail('Nenhum livro salvo neste mês.',404);const bytes=await makeMonthlyPdf(month,records,undefined,makePdf);return downloadPdf(bytes,`Livro-Oficial-${month}.pdf`);}
 if(op==='book'){const book=await db().prepare('SELECT date,author,author_name,version,status,data,signature,review,updated FROM books WHERE date=?').bind(date).first<any>();return json(book?{...book,data:JSON.parse(book.data)}:null);}
 if(op==='history')return json((await db().prepare('SELECT version,actor,updated,status,data,signature,review FROM revisions WHERE date=? ORDER BY version DESC').bind(date).all()).results);
 if(op==='pdf'){const version=url.searchParams.get('version');const b=await db().prepare(version?'SELECT r.*,b.author,b.author_name FROM revisions r JOIN books b ON b.date=r.date WHERE r.date=? AND r.version=?':'SELECT * FROM books WHERE date=?').bind(...(version?[date,Number(version)]:[date])).first<any>();if(!b)fail('PDF não encontrado.',404);const bytes=Uint8Array.from(atob(await makePdf(b)),c=>c.charCodeAt(0));return downloadPdf(bytes,`Livro-Oficial-${date}${version?'-v'+Number(version):''}.pdf`);}
 fail('Operação desconhecida.',404);
 }catch(e:any){if(!e.status)console.error('service_failure',{code:typeof e.code==='string'&&/^[A-Z0-9_]{1,60}$/.test(e.code)?e.code:'UNKNOWN'});return json({error:e.status?e.message:'Não foi possível concluir a operação. Tente novamente ou contate a administração.'},e.status||500);}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)fail('Origem inválida.',403);
 const input=await req.text();if(input.length>250000)fail('Conteúdo muito extenso. Reduza o texto ou simplifique a assinatura.');const b=JSON.parse(input);const op=b.op;let u=await me(req);
 if(op==='setup'||op==='login'){
 const rg=normalizeRg(b.rg);if(!/^\d{3,12}$/.test(rg)||typeof b.password!=='string')fail('Informe RG e senha.');
 if(op==='setup'){
 const expected=process.env.SETUP_TOKEN||'';const supplied=typeof b.setupToken==='string'?b.setupToken:'';if(expected.length<32||supplied.length>256||!timingSafeEqual(Buffer.from(await hash(expected)),Buffer.from(await hash(supplied))))fail('Código de configuração inicial inválido.',403);
 if(b.password.length<8)fail('Use uma senha com pelo menos 8 caracteres.');if(!String(b.name||'').trim())fail('Informe nome e posto.');
 const results=await db().batch([db().prepare("SELECT pg_advisory_xact_lock(2042026)"),db().prepare("INSERT INTO users(rg,name,role,password) SELECT ?,?,'admin',? WHERE NOT EXISTS(SELECT 1 FROM users)").bind(rg,String(b.name).slice(0,150),await password(b.password))]);const r=results[1];if(!r.meta.changes)fail('A configuração inicial já foi realizada.',409);
 }else{
 const key='rg:'+rg;const a=await db().prepare('SELECT * FROM attempts WHERE key=?').bind(key).first<any>();if(a&&a.expires>Date.now()&&a.count>=8)fail('Muitas tentativas. Aguarde 15 minutos.',429);
 await db().prepare('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN attempts.expires<? THEN 1 ELSE attempts.count+1 END,expires=CASE WHEN attempts.expires<? THEN excluded.expires ELSE attempts.expires END').bind(key,Date.now()+900000,Date.now(),Date.now()).run();
 const found=await db().prepare('SELECT * FROM users WHERE rg=? AND active=1').bind(rg).first<any>();if(!found||!await check(b.password,found.password))fail('RG ou senha incorretos.',401);await db().prepare('DELETE FROM attempts WHERE key=?').bind(key).run();
 }
 return json({ok:true},200,await issue(rg));}
 if(!u)fail('Sessão encerrada. Entre novamente.',401);
 if(typeof op==='string'&&op.startsWith('adjunto'))return json(await adjuntoPost(op,u,b,nauticalContext()));
 if(typeof op==='string'&&op.startsWith('supervisor'))return json(await supervisorPost(op,u,b,nauticalContext()));
 if(typeof op==='string'&&op.startsWith('ssmt'))return json(await ssmtPost(op,u,b,nauticalContext()));
 if(typeof op==='string'&&op.startsWith('nautical'))return json(await nauticalPost(op,u,b,nauticalContext()));
 if(u.role==='enlisted'&&!['logout','password'].includes(op))fail('Este acesso é restrito aos oficiais.',403);
 if(op==='cleanupLegacyPdfs'){
 if(u.role!=='admin')fail('Acesso restrito à administração.',403);
 for(const [table,revisions,render] of [['books','revisions',makePdf],['nautical_books','nautical_revisions',makeNauticalPdf],['ssmt_books','ssmt_revisions',makeSsmtPdf]] as const){
 const rows=(await db().prepare(`SELECT r.*,b.author,b.author_name FROM livros.${revisions} r JOIN livros.${table} b ON b.date=r.date`).all()).results;
 for(const row of rows){if(row.pdf)fail('Aplique a migração de PDFs antes da limpeza.',409);await render(row);}
 }
 const files=(await db().prepare("SELECT name FROM storage.objects WHERE bucket_id='livros-pdf' ORDER BY name").all()).results;
 await removeLegacyPdfs(files.map((f:any)=>f.name));
 await db().prepare('INSERT INTO admin_log(actor,action,updated) VALUES(?,?,?)').bind(u.rg,`PDFs legados removidos do armazenamento: ${files.length}; dados e assinaturas preservados.`,new Date().toISOString()).run();
 return json({ok:true,removed:files.length});
 }
 if(op==='resolveAssignment'){if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||isNaN(Date.parse(b.date)))fail('Data inválida.');const reason=String(b.reason||'').trim();if(reason.length<20||reason.length>1500)fail('Descreva o motivo da substituição com 20 a 1500 caracteres.');const old=await db().prepare('SELECT author,status FROM books WHERE date=?').bind(b.date).first<any>();if(old&&(old.author!==u.rg||old.status==='Conferido'))fail('Este livro não permite alteração de responsabilidade.',403);if(!await check(String(b.password||''),u.password))fail('Confirme sua senha para registrar a substituição.',401);let previous='Escala indisponível';try{const folder=await db().prepare('SELECT value FROM settings WHERE key=?').bind('scaleFolder').first<any>();previous=(await loadScale(folder?.value||DEFAULT_FOLDER,b.date)).crew[0]||'Oficial não identificado na escala';}catch{}const replacement=`${u.rank||''} ${u.name} RG ${u.rg}`.trim();await db().prepare('INSERT INTO livros.assignment_events(date,book_type,actor,previous_assignment,replacement,reason,created_at) VALUES(?,?,?,?,?,?,?)').bind(b.date,'officer',u.rg,previous,replacement,reason,new Date().toISOString()).run();return json({replacement});}
 if(op==='sisgeo'){try{return json({found:true,...await loadSisgeo(b.date)});}catch(e:any){return json({found:false,message:e.name==='TimeoutError'?'O SisGeO demorou a responder. Tente novamente.':e.message});}}
 if(op==='scaleConfig'){if(u.role!=='admin')fail('Apenas a administração pode alterar a pasta.',403);const id=folderId(String(b.folder||''));await db().batch([db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('scaleFolder',id),db().prepare('INSERT INTO admin_log(actor,action,updated) VALUES(?,?,?)').bind(u.rg,'Pasta de escalas alterada para '+id,new Date().toISOString())]);return json({folder:id});}
 if(op==='scale'){if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||isNaN(Date.parse(b.date)))fail('Data inválida.');const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind('scaleFolder').first<any>();try{return json({found:true,...await loadScale(row?.value||DEFAULT_FOLDER,b.date)});}catch(e:any){return json({found:false,message:e.name==='TimeoutError'?'O Drive demorou a responder. Tente novamente ou preencha manualmente.':e.message});}}
 if(op==='logout'){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)gmar_session=([^;]+)/)?.[1];if(token)await db().prepare('DELETE FROM sessions WHERE id=?').bind(await hash(token)).run();return json({ok:true},200,{'Set-Cookie':'gmar_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});}
 if(op==='password'){if(!await check(b.current,u.password))fail('Senha atual incorreta.');if(String(b.password).length<8)fail('A nova senha deve ter pelo menos 8 caracteres.');await db().batch([db().prepare('UPDATE users SET password=?,first_login=false WHERE rg=?').bind(await password(b.password),u.rg),db().prepare('DELETE FROM sessions WHERE rg=?').bind(u.rg)]);return json({ok:true},200,await issue(u.rg));}
 if(op==='user'){
 if(u.role!=='admin')fail('Somente a administração pode cadastrar usuários.',403);const rg=normalizeRg(b.rg);if(!/^\d{3,12}$/.test(rg)||!String(b.name).trim()||!['officer','reviewer','admin','enlisted'].includes(b.role))fail('Dados do usuário inválidos.');if(rg===u.rg&&(b.role!=='admin'||!b.active))fail('Você não pode remover seu próprio acesso administrativo.');
 const old=await db().prepare('SELECT * FROM users WHERE rg=?').bind(rg).first<any>();if(!old&&String(b.password||'').length<8)fail('Defina uma senha com pelo menos 8 caracteres.');if(b.password&&b.password.length<8)fail('Use pelo menos 8 caracteres.');const pw=b.password?await password(b.password):old.password;
 await db().batch([db().prepare('INSERT INTO users(rg,name,role,password,active,rank) VALUES(?,?,?,?,?,?) ON CONFLICT(rg) DO UPDATE SET name=excluded.name,role=excluded.role,password=excluded.password,active=excluded.active,rank=excluded.rank').bind(rg,String(b.name).slice(0,150),b.role,pw,b.active?1:0,String(b.rank??old?.rank??'').slice(0,60)),db().prepare('DELETE FROM sessions WHERE rg=?').bind(rg),db().prepare('INSERT INTO admin_log(actor,action,updated) VALUES(?,?,?)').bind(u.rg,`Usuário ${rg}: perfil ${b.role}; ativo ${!!b.active}; senha alterada ${!!b.password}`,new Date().toISOString())]);return json({ok:true});}
 if(!['save','sign','review'].includes(op))fail('Operação desconhecida.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||isNaN(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date)fail('Data inválida.');
 const old=await db().prepare('SELECT * FROM books WHERE date=?').bind(b.date).first<any>();
 if(old?.status==='Conferido')fail('O livro já foi conferido e está bloqueado.',409);
 if(old&&old.version!==b.version)fail('Outra alteração foi salva. Reabra o livro para carregar a versão atual.',409);
 if(op!=='review'&&old&&old.author!==u.rg)fail('Apenas o autor pode editar este livro.',403);
 if(op==='review'&&(u.role!=='reviewer'||!old||old.status!=='Assinado'))fail('A conferência exige perfil de subcomandante e livro assinado.',403);
 if(op==='review'&&old.author===u.rg)fail('Outro subcomandante deve conferir o livro que você confeccionou.',403);
 const data=op==='review'?JSON.parse(old.data):b.data;
 if(!data||typeof data!=='object'||data.date!==b.date)fail('Conteúdo ou data inválidos.');
 for(const key of ['crew','support','prevention','rescues','physical','forms'])if(!Array.isArray(data[key])||data[key].some((v:any)=>typeof v!=='string'))fail('Campos inválidos.');
 if(data.crew.length===12&&op!=='review')data.crew=[...data.crew,'',''];
 if(![12,roles.length].includes(data.crew.length)||data.support.length!==8||['prevention','rescues','physical','forms'].some(k=>data[k].length!==4))fail('Quantidades de campos inválidas.');
 for(const [k,v] of Object.entries(data))if(!Array.isArray(v)&&typeof v!=='string')fail('Conteúdo inválido.');
 const events=(await db().prepare('SELECT * FROM livros.assignment_events WHERE date=? AND book_type=? AND actor=? ORDER BY id').bind(b.date,'officer',u.rg).all()).results;
 if(op!=='review'){delete data.assignmentAudit;delete data.dependencySummary;if(events.length)data.assignmentAudit=events.map((e:any)=>`${e.created_at} | RG ${e.actor} | Anterior: ${e.previous_assignment} | Responsável: ${e.replacement} | Motivo: ${e.reason}`).join('\n');}
 if(op==='sign'){
 if(assignmentRg(data.crew[0])!==u.rg)fail('O RG do Oficial de Dia no livro deve ser o mesmo do usuário. Use Solucionar responsabilidade para registrar uma substituição.',403);
 let assigned=false;try{const folder=await db().prepare('SELECT value FROM settings WHERE key=?').bind('scaleFolder').first<any>();assigned=canSignAssigned('officer',(await loadScale(folder?.value||DEFAULT_FOLDER,b.date)).crew,u.rg);}catch{}
 if(!assigned&&!events.length)fail('Não foi possível confirmar seu RG como Oficial de Dia na escala. Use Solucionar responsabilidade e registre a justificativa.',403);
 const deps=dependencies((await db().prepare('SELECT * FROM livros.service_attestations WHERE date=?').bind(b.date).all()).results,u.rg);data.dependencySummary=deps.map(d=>`${d.name}: ${d.complete?'conferido pelo Oficial de Dia':'PENDENTE de assinatura e conferência pelo Oficial de Dia'}`).join('\n');
 }
 if(op==='review'){const deps=dependencies((await db().prepare('SELECT * FROM livros.service_attestations WHERE date=?').bind(b.date).all()).results,old.author);if(deps.some(d=>!d.complete))fail('Conferência bloqueada. Livros pendentes de visto do Oficial de Dia: '+deps.filter(d=>!d.complete).map(d=>d.name).join(', '),409);}
 if(op==='sign'){if(!readDrawing(b.drawing))fail('Desenhe sua assinatura antes de confirmar.');data.signatureDrawing=b.drawing;const issues=validateBook(data);if(issues.length)fail(issues.join(' '));}
 if(op==='sign'||op==='review'){if(!b.password||!await check(b.password,u.password))fail('Confirme sua senha para assinar.',401);}
 const now=new Date().toISOString(),version=(old?.version||0)+1,digest=await hash(JSON.stringify(data));
 const attestation=`${personLabel(u)} - RG ${u.rg} | ${now} | SHA-256 ${digest}${op==='review'?' | Supervisor, Adjunto, Náutica e SSMT: assinados e conferidos pelo Oficial de Dia.':''}`;
 const next:any={date:b.date,author:old?.author||u.rg,author_name:old?.author_name||personLabel(u),version,status:op==='review'?'Conferido':op==='sign'?'Assinado':'Rascunho',data:JSON.stringify(data),signature:op==='review'?old.signature:op==='sign'?attestation:null,review:op==='review'?attestation:null,actor:u.rg,updated:now};next.pdf='';
 if(old){const r=await db().prepare('UPDATE books SET version=?,status=?,data=?,signature=?,review=?,actor=?,updated=?,pdf=? WHERE date=? AND version=? AND status<>?').bind(version,next.status,next.data,next.signature,next.review,u.rg,now,next.pdf,b.date,b.version,'Conferido').run();if(!r.meta.changes)fail('A versão mudou. Reabra o livro.',409);}else{try{await db().prepare('INSERT INTO books VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(next.date,next.author,next.author_name,version,next.status,next.data,next.signature,next.review,u.rg,now,next.pdf).run();}catch{fail('Já existe livro nesta data. Consulte o acervo.',409);}}
 return json({ok:true,version,status:next.status});
 }catch(e:any){if(!e.status)console.error('service_failure',{code:typeof e.code==='string'&&/^[A-Z0-9_]{1,60}$/.test(e.code)?e.code:'UNKNOWN'});return json({error:e.status?e.message:'Não foi possível concluir a operação. Tente novamente ou contate a administração.'},e.status||500);}}
