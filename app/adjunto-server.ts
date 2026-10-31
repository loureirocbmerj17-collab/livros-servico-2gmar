import {adjuntoBlank,validateAdjunto} from './adjunto-model';
import {supervisorForecast as adjuntoForecast} from './supervisor-weather';
import {assignmentRg} from './service-policy';
import {personLabel} from './person-label';
import {readDrawing} from './handwriting';
import {makeAdjuntoPdf} from './adjunto-pdf';
import {makeMonthlyPdf} from './monthly-pdf';
import {loadSisgeo} from './sisgeo';
type Context={db:any,check:(p:string,s:string)=>Promise<boolean>,hash:(s:string)=>Promise<string>,scale:(date:string)=>Promise<any>,downloadPdf:(bytes:Uint8Array,name:string)=>Response};
const fail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status})};
const validDate=(date:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Data inválida.');};
const rows=async(db:any,q:string,...args:any[])=>(await db.prepare(q).bind(...args).all()).results;
const one=async(db:any,q:string,...args:any[])=>db.prepare(q).bind(...args).first();
async function roster(c:Context,date:string){try{const s=await c.scale(date);return {found:true,responsible:assignmentRg(s.adjunto||''),officerRg:assignmentRg(s.crew[0]||''),assignments:s.serviceAssignments||[],crew:s.crew,posts:s.beachPosts||[],source:s.source||null,warnings:s.beachWarnings||[]};}catch(e:any){return {found:false,responsible:'',officerRg:'',assignments:[],crew:[],posts:[],source:null,warnings:[e.message||'Escala indisponível. Preencha manualmente.']};}}
export async function adjuntoGet(op:string,u:any,url:URL,c:Context){
 const date=url.searchParams.get('date')||'';
 if(op==='adjuntoPeople')return rows(c.db,'SELECT rg,name,rank FROM users WHERE active=1 ORDER BY name');
 if(op==='adjuntoList')return rows(c.db,'SELECT date,author_name,status,version FROM livros.adjunto_books ORDER BY date DESC');
 if(op==='adjuntoMonthPdf'){if(u.role==='enlisted')fail('Exportação mensal restrita aos oficiais.',403);const month=url.searchParams.get('month')||'';if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))fail('Mês inválido.');const books=await rows(c.db,'SELECT * FROM livros.adjunto_books WHERE date LIKE ? ORDER BY date',month+'-%');if(!books.length)fail('Nenhum livro do Adjunto neste mês.',404);return c.downloadPdf(await makeMonthlyPdf(month,books,'LIVRO DO ADJUNTO',makeAdjuntoPdf),`Livro-Adjunto-${month}.pdf`);}
 validDate(date);
 if(op==='adjuntoContext'){const r=await roster(c,date);const d=adjuntoBlank(date);d.responsible=r.responsible;d.officerRg=r.officerRg;if(r.posts.length)d.activation.total=String(new Set(r.posts.flatMap((p:any)=>p.rgs)).size);
 const values=[r.crew[0],r.crew[1],r.crew[11],r.crew[4],undefined,[r.crew[8],r.crew[9],r.crew[10]].filter(Boolean).join('; '),r.crew[6],r.crew[7],r.crew[12],r.crew[13]];
 d.serviceCrew=d.serviceCrew.map((row:any,i:number)=>({...row,military:values[i]||r.assignments.filter((a:any)=>i===4?/PERMANENCIA/i.test(a.label):i===10?/APROVISIONAMENTO|APROVISIONADOR/i.test(a.label):i>=11?new RegExp('SUPERVISOR.*SETOR.*'+(i-10),'i').test(a.label):false).map((a:any)=>a.value).join('; ')}));return {roster:r,blank:d};}
 if(op==='adjuntoForecast')return adjuntoForecast(date);
 if(op==='adjuntoStats'){const s=await loadSisgeo(date);const unit=s.units.find((v:any)=>v.code==='2GMAR');if(!unit?.reported)fail('SISGEO sem dados confirmados para o 2º GMAR. Preencha manualmente.');return {stats:{rescues:String(unit!.rescues),preventions:String(unit!.prevention)},source:s.source};}
 const book=await one(c.db,'SELECT * FROM livros.adjunto_books WHERE date=?',date);
 if(op==='adjuntoBook')return book?{...book,pdf:undefined,data:JSON.parse(book.data),review:book.review?JSON.parse(book.review):null}:null;
 if(op==='adjuntoHistory')return rows(c.db,'SELECT version,actor,updated,status FROM livros.adjunto_revisions WHERE date=? ORDER BY version DESC',date);
 if(op==='adjuntoPdf'){const version=url.searchParams.get('version');if(version&&!/^\d+$/.test(version))fail('Versão inválida.');const r=version?await one(c.db,'SELECT r.*,b.author,b.author_name FROM livros.adjunto_revisions r JOIN livros.adjunto_books b ON b.date=r.date WHERE r.date=? AND r.version=?',date,Number(version)):book;if(!r)fail('Livro não encontrado.',404);return c.downloadPdf(Uint8Array.from(Buffer.from(await makeAdjuntoPdf(r),'base64')),`Livro-Adjunto-${date}${version?'-v'+version:''}.pdf`);}
 fail('Operação desconhecida.',404);
}
export async function adjuntoPost(op:string,u:any,b:any,c:Context){
 const {db}=c;validDate(b.date);const now=new Date().toISOString();const old=await one(db,'SELECT * FROM livros.adjunto_books WHERE date=?',b.date);
 if(old?.status==='Conferido')fail('Livro conferido pelo Oficial de Dia e bloqueado.',409);
 if(op==='adjuntoResolve'){
 const kind=b.function==='officer'?'officer':'adjunto';if(kind==='officer'&&u.role==='enlisted')fail('Visto restrito ao Oficial de Dia.',403);if(kind==='adjunto'&&old&&old.author!==u.rg)fail('Somente o autor pode retificar a responsabilidade.',403);
 const ob=kind==='officer'?await one(db,'SELECT author FROM books WHERE date=?',b.date):null;if(ob&&ob.author!==u.rg)fail('O autor do Livro do Oficial de Dia deve realizar o visto.',403);
 const reason=String(b.reason||'').trim();if(reason.length<20||reason.length>1500)fail('Informe justificativa de 20 a 1500 caracteres.');if(!await c.check(String(b.password||''),u.password))fail('Senha incorreta.',401);
 const r=await roster(c,b.date);await db.prepare('INSERT INTO livros.assignment_events(date,book_type,actor,previous_assignment,replacement,reason,created_at) VALUES(?,?,?,?,?,?,?)').bind(b.date,kind,u.rg,(kind==='officer'?r.officerRg:r.responsible)||'Escala indisponível',personLabel(u)+' RG '+u.rg,reason,now).run();return {ok:true,responsible:u.rg};
 }
 if(!['adjuntoSave','adjuntoSign','adjuntoReview'].includes(op))fail('Operação desconhecida.');
 if((old?.version||0)!==b.version)fail('A versão mudou. Reabra o livro atualizado.',409);
 const review=op==='adjuntoReview',sign=op==='adjuntoSign';
 if(!review&&old&&old.author!==u.rg)fail('Somente quem confeccionou pode retificar.',403);
 if(review&&(u.role==='enlisted'||!old||old.status!=='Assinado'||old.author===u.rg))fail('O visto exige outro militar, Oficial de Dia, em livro assinado.',403);
 let d=review?JSON.parse(old.data):b.data;if(!d||d.date!==b.date)fail('Dados inválidos.');const errors=validateAdjunto(d,sign);if(errors.length)fail(errors.join(' '));
 const events=await rows(db,'SELECT * FROM livros.assignment_events WHERE date=? AND book_type=? AND actor=? ORDER BY id',b.date,review?'officer':'adjunto',u.rg);
 const r=await roster(c,b.date);
 if(!review){if((!old||sign)&&r.responsible!==u.rg&&!events.length)fail('Seu RG deve constar como Adjunto na escala. Use Solucionar responsabilidade.',403);
 d=JSON.parse(JSON.stringify(d));delete d.signatureDrawing;delete d.assignmentAudit;delete d.personnel;delete d.scaleSource;
 d.officerRg=r.officerRg;d.scaleSource=r.source;d.rosterSnapshot=r.found?{assignments:r.assignments,adjunto:r.responsible}:old?JSON.parse(old.data).rosterSnapshot:null;
 const people=await rows(db,'SELECT rg,name,rank FROM users WHERE active=1');
 const referenced=new Set([d.responsible,d.officerRg,...d.posts.flatMap((p:any)=>p.rgs),...d.late.map((p:any)=>p.rg),...d.absent.map((p:any)=>p.rg),...d.swaps.flatMap((p:any)=>[p.outgoing,p.incoming])].filter(Boolean));
 const imported=new Set(r.posts.flatMap((p:any)=>p.rgs));const prior=new Set(old?JSON.parse(old.data).posts.flatMap((p:any)=>p.rgs):[]);
 for(const rg of referenced)if(!people.some((p:any)=>p.rg===rg)&&!imported.has(rg)&&!prior.has(rg))fail('RG '+rg+' não está ativo no cadastro. Corrija antes de salvar.');
 d.personnel=people.filter((p:any)=>referenced.has(p.rg)).map((p:any)=>({rg:p.rg,name:personLabel(p)}));
 d.assignmentAudit=events.map((e:any)=>`${e.created_at} | RG ${e.actor} | Antes: ${e.previous_assignment} | Responsável: ${e.replacement} | Motivo: ${e.reason}`).join('\n');
 }
 if(sign||review){if(!await c.check(String(b.password||''),u.password))fail('Senha incorreta.',401);if(!readDrawing(b.drawing))fail('Desenhe sua assinatura.');if(sign){if(d.responsible!==u.rg)fail('O responsável deve ser o usuário autenticado.',403);d.signatureDrawing=b.drawing;}else{const ob=await one(db,'SELECT author FROM books WHERE date=?',b.date);if(ob&&ob.author!==u.rg)fail('O visto pertence ao autor do Livro do Oficial de Dia.',403);if(r.officerRg!==u.rg&&!events.length)fail('Seu RG não consta como Oficial de Dia. Registre a substituição justificada.',403);}}
 const version=(old?.version||0)+1,attestation=`${personLabel(u)} - RG ${u.rg} | ${now} | SHA-256 ${await c.hash(JSON.stringify(d))}`;
 const next={date:b.date,author:old?.author||u.rg,author_name:old?.author_name||personLabel(u),version,status:review?'Conferido':sign?'Assinado':'Rascunho',data:review?old.data:JSON.stringify(d),signature:review?old.signature:sign?attestation:null,review:review?JSON.stringify({rg:u.rg,name:personLabel(u),at:now,attestation,drawing:b.drawing,assignmentAudit:events.map((e:any)=>`${e.created_at} | ${e.previous_assignment} → ${e.replacement} | ${e.reason}`).join('\n')}):null};
 if(old){const updated=await db.prepare("UPDATE livros.adjunto_books SET version=?,status=?,data=?,signature=?,review=?,actor=?,updated=?,pdf='' WHERE date=? AND version=? AND status<>'Conferido'").bind(version,next.status,next.data,next.signature,next.review,u.rg,now,b.date,b.version).run();if(!updated.meta.changes)fail('Versão alterada. Reabra o livro.',409);}else{try{await db.prepare("INSERT INTO livros.adjunto_books(date,author,author_name,version,status,data,signature,review,actor,updated,pdf) VALUES(?,?,?,?,?,?,?,?,?,?,'')").bind(next.date,next.author,next.author_name,version,next.status,next.data,next.signature,next.review,u.rg,now).run();}catch(e:any){if(e.code==='23505')fail('Já existe livro neste dia. Reabra o serviço.',409);throw e;}}
 return {ok:true,version,status:next.status};
}
