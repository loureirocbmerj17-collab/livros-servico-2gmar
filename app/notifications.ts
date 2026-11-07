import {assignmentRg,nauticalAssignments} from './service-policy';
import {personLabel} from './person-label';
import {appOrigin,mailReady,mailProvider,sendMail,mailHash,Message} from './mail-service';
const names:Record<string,string>={officer:'Oficial de Dia',supervisor:'Supervisor',adjunto:'Adjunto',nautica:'Náutica',ssmt:'SSMT'};
export function serviceWindow(now:Date){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const today=parts.year+'-'+parts.month+'-'+parts.day,hour=Number(parts.hour);
 if(hour===18)return {date:today,types:['supervisor']};
 if(hour===6)return {date:new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10),types:['officer','adjunto','nautica','ssmt']};
 return null;
}
const FOUR=['officer','adjunto','nautica','ssmt'];
const shift=(date:string,days:number)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
// Lembretes 2 e 3 (12 h e 24 h depois do 1º e-mail), enviados só enquanto o livro não estiver assinado.
//  06h: 2º do Supervisor de ontem; 3º dos demais livros de anteontem.
//  18h: 2º dos demais livros de ontem; 3º do Supervisor de ontem.
export function followUpWindows(now:Date){
 const first=serviceWindow(now);if(!first)return [];
 if(first.types[0]==='supervisor'){const y=shift(first.date,-1);return [{date:y,types:FOUR,stage:2},{date:y,types:['supervisor'],stage:3}];}
 return [{date:first.date,types:['supervisor'],stage:2},{date:shift(first.date,-1),types:FOUR,stage:3}];
}
const bookTables:Record<string,string>={officer:'livros.books',supervisor:'livros.supervisor_books',adjunto:'livros.adjunto_books',nautica:'livros.nautical_books',ssmt:'livros.ssmt_books'};
function seniority(rank:string){const r=rank.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(/sub.*ten|^st\b/.test(r))return 5;if(/ten.*cel/.test(r))return 1;if(/cel|coronel/.test(r))return 0;if(/maj/.test(r))return 2;if(/cap/.test(r))return 3;if(/ten/.test(r))return 4;if(/1.*sgt|1.*sarg/.test(r))return 6;if(/2.*sgt|2.*sarg/.test(r))return 7;if(/3.*sgt|3.*sarg/.test(r))return 8;if(/cb|cabo/.test(r))return 9;if(/sd|sold/.test(r))return 10;return 99;}
export function scheduledRecipients(scale:any,people:any[],events:any[]){
 const crew=scale?.crew||[],operators=nauticalAssignments(scale?.nauticalOperators?.length?scale.nauticalOperators:crew.slice(8,11)).map(assignmentRg);
 const sorted=people.filter(p=>operators.includes(p.rg)).sort((a,b)=>seniority(a.rank)-seniority(b.rank)||Number(a.rg)-Number(b.rg));
 const chiefAssignment=scale?.serviceAssignments?.find((a:any)=>/ENC(?:ARREGADO)?[. ]*(?:DE )?MOT/i.test(a.label))?.value;
 const map:Record<string,string>={officer:assignmentRg(crew[0]||''),supervisor:assignmentRg(crew[5]||''),adjunto:assignmentRg(scale?.adjunto||''),nautica:sorted[0]?.rg||'',ssmt:assignmentRg(chiefAssignment||crew[14]||crew[13]||'')};
 for(const e of events){if(!names[e.book_type])continue;let payload:any;try{payload=JSON.parse(e.replacement);}catch{}
  if(payload?.kind==='manualRoster'){map[e.book_type]=e.actor;if(payload.officerRg)map.officer=payload.officerRg;}
  else if(assignmentRg(e.replacement)===e.actor)map[e.book_type]=e.actor;
 }
 return map;
}
// Envio com reserva prévia e chave fixa por mensagem: impede duplicidade em repetições.
async function deliver(db:any,now:Date,send:typeof sendMail,id:string,fresh:Message):Promise<string>{
 const gmail=mailProvider()==='gmail';
 const prior=await db.prepare('SELECT * FROM livros.mail_log WHERE id=?').bind(id).first();
 if(['accepted','uncertain'].includes(prior.status))return '';
 if(gmail&&prior.first_attempt_at){await db.prepare("UPDATE livros.mail_log SET status='uncertain',detail='Tentativa anterior sem confirmação; conferir no provedor. Gmail não permite repetição idempotente.',updated_at=now() WHERE id=? AND status NOT IN ('accepted','uncertain')").bind(id).run();return '';}
 if(prior.first_attempt_at&&now.getTime()-new Date(prior.first_attempt_at).getTime()>23*3600000){await db.prepare("UPDATE livros.mail_log SET status='uncertain',detail='Prazo de repetição segura encerrado; conferir no provedor antes de qualquer reenvio.',updated_at=now() WHERE id=?").bind(id).run();return '';}
 const message:Message=prior.payload||fresh;
 // Reserve SMTP as uncertain BEFORE network I/O: a crash cannot trigger a duplicate.
 const gmailClaim="UPDATE livros.mail_log SET status='uncertain',payload=?,recipient=?,first_attempt_at=now(),detail='Envio Gmail reservado; conferir no provedor se não houver confirmação.',updated_at=now() WHERE id=? AND first_attempt_at IS NULL AND status NOT IN ('accepted','uncertain') RETURNING id";
 const claimed=await db.prepare(gmail?gmailClaim:"UPDATE livros.mail_log SET status='sending',payload=?,recipient=?,lease_until=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now()),updated_at=now() WHERE id=? AND status NOT IN ('accepted','uncertain') AND (lease_until IS NULL OR lease_until<now()) RETURNING id").bind(JSON.stringify(message),message.to,id).first();
 if(!claimed)return '';
 for(let attempt=0;attempt<(gmail?1:2);attempt++){
  await db.prepare('UPDATE livros.mail_log SET attempts=attempts+1,updated_at=now() WHERE id=?').bind(id).run();
  try{const provider=await send(mailHash(id),message);await db.prepare("UPDATE livros.mail_log SET status='accepted',provider_id=?,detail='Aceito pelo provedor; não equivale a confirmação de entrega.',lease_until=NULL,updated_at=now() WHERE id=?").bind(provider,id).run();return 'accepted';}
  catch{if(gmail){await db.prepare("UPDATE livros.mail_log SET status='uncertain',detail='Gmail não confirmou o envio; conferir a conta remetente. Sem reenvio automático para evitar duplicidade.',lease_until=NULL,updated_at=now() WHERE id=?").bind(id).run();return 'uncertain';}else if(attempt===1){await db.prepare("UPDATE livros.mail_log SET status='failed',detail='Sem confirmação de envio; nova tentativa usa a mesma chave.',lease_until=NULL,updated_at=now() WHERE id=?").bind(id).run();return 'failed';}}
 }
 return '';
}
async function processWindow(c:{db:any,scale:(date:string)=>Promise<any>},now:Date,send:typeof sendMail,window:{date:string,types:string[]}){
 const {db}=c,{date,types}=window;const people=(await db.prepare('SELECT rg,name,rank,email FROM users WHERE active=1').all()).results;
 let scale:any;try{scale=await c.scale(date);}catch{
  await db.prepare("INSERT INTO livros.mail_log(id,kind,service_date,status,detail) VALUES(?,'schedule',?,'pending','Escala indisponível; não houve envio.') ON CONFLICT(id) DO UPDATE SET detail=excluded.detail,updated_at=now()").bind('scale:'+date+':'+types[0],date).run();
  return {pending:'Escala indisponível.'};
 }
 const events=(await db.prepare('SELECT * FROM livros.assignment_events WHERE date=? ORDER BY id').bind(date).all()).results;
 const recipients=scheduledRecipients(scale,people,events),outcomes:any[]=[];
 for(const type of types){
  const rg=recipients[type],person=people.find((p:any)=>p.rg===rg),id='reminder:'+date+':'+type+':'+(rg||'unassigned');
  const status=!rg?'unassigned':!person?.email?'missing_email':!mailReady()?'not_configured':'pending';
  await db.prepare("INSERT INTO livros.mail_log(id,kind,rg,recipient,service_date,book_type,status,detail) VALUES(?,'reminder',?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(id,rg||'',person?.email||'',date,type,status,status==='pending'?'':status==='missing_email'?'E-mail ausente ou militar não cadastrado.':status==='unassigned'?'Responsável não identificado.':status==='not_configured'?'Configurar o provedor de e-mail e remetente.':'').run();
  if(status!=='pending'){outcomes.push({type,status});continue;}
  const dateBR=date.split('-').reverse().join('/'),end=shift(date,1).split('-').reverse().join('/');
  const result=await deliver(db,now,send,id,{to:person.email,subject:'2º GMAR — Preenchimento do Livro '+names[type]+' — '+dateBR,text:'Prezado militar '+personLabel(person)+',\n\nConforme a escala do 2º GMAR, consta sua designação para o Livro '+names[type]+', serviço de '+dateBR+' para '+end+'.\n\nAcesse com RG e senha para preencher e assinar:\n'+appOrigin()+'/?book='+type+'&date='+date+'\n\nCaso tenha ocorrido alteração, troca ou permuta e você não seja o responsável nesta data, desconsidere esta mensagem.\n\nMensagem automática — Sistema de Livros de Serviço do 2º GMAR.'});
  if(result)outcomes.push({type,status:result});
 }
 return {date,outcomes};
}

async function processFollowUp(c:{db:any,scale:(date:string)=>Promise<any>},now:Date,send:typeof sendMail,window:{date:string,types:string[],stage:number}){
 const {db}=c,{date,types,stage}=window;const people=(await db.prepare('SELECT rg,name,rank,email FROM users WHERE active=1').all()).results;
 const kind='reminder'+stage,outcomes:any[]=[],dateBR=date.split('-').reverse().join('/'),end=shift(date,1).split('-').reverse().join('/');
 let recipients:Record<string,string>|null=null,scaleFailed=false;
 for(const type of types){
  const book=await db.prepare('SELECT author,status,version FROM '+bookTables[type]+' WHERE date=?').bind(date).first();
  if(book&&['Assinado','Conferido'].includes(book.status))continue; // concluído: nenhum lembrete
  let rg=book?.author||'';
  if(!book){
   if(!recipients&&!scaleFailed){try{const scale=await c.scale(date);const events=(await db.prepare('SELECT * FROM livros.assignment_events WHERE date=? ORDER BY id').bind(date).all()).results;recipients=scheduledRecipients(scale,people,events);}catch{scaleFailed=true;}}
   if(scaleFailed){await db.prepare("INSERT INTO livros.mail_log(id,kind,service_date,book_type,status,detail) VALUES(?,?,?,?,'pending','Escala indisponível; lembrete não enviado.') ON CONFLICT(id) DO NOTHING").bind('scale'+stage+':'+date+':'+type,'schedule'+stage,date,type).run();outcomes.push({type,status:'pending'});continue;}
   rg=recipients![type]||'';
  }
  const person=people.find((p:any)=>p.rg===rg),id=kind+':'+date+':'+type+':'+(rg||'unassigned');
  const status=!rg?'unassigned':!person?.email?'missing_email':!mailReady()?'not_configured':'pending';
  await db.prepare("INSERT INTO livros.mail_log(id,kind,rg,recipient,service_date,book_type,status,detail) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(id,kind,rg||'',person?.email||'',date,type,status,status==='pending'?'':status==='missing_email'?'E-mail ausente ou militar não cadastrado.':status==='unassigned'?'Responsável não identificado.':'Configurar o provedor de e-mail e remetente.').run();
  if(status!=='pending'){outcomes.push({type,status});continue;}
  const link=appOrigin()+'/?book='+type+'&date='+date,last=stage===3?'Último lembrete':'Lembrete';
  const message:Message=book?{to:person.email,subject:'2º GMAR — '+last+': Livro '+names[type]+' de '+dateBR+' salvo sem assinatura',text:'Prezado militar '+personLabel(person)+',\n\nO Livro '+names[type]+' do serviço de '+dateBR+' para '+end+' está salvo apenas como RASCUNHO (versão '+book.version+'), sem assinatura. O livro só é concluído depois de assinado.\n\nAcesse o livro com RG e senha e assine na última seção (não é necessário retificar):\n'+link+'\n\n'+(stage===3?'Este é o último lembrete automático deste serviço.':'Novo lembrete será enviado em 12 horas enquanto o livro não for assinado.')+'\n\nMensagem automática — Sistema de Livros de Serviço do 2º GMAR.'}
   :{to:person.email,subject:'2º GMAR — '+last+': Livro '+names[type]+' de '+dateBR+' ainda não preenchido',text:'Prezado militar '+personLabel(person)+',\n\nConforme a escala do 2º GMAR, consta sua designação para o Livro '+names[type]+', serviço de '+dateBR+' para '+end+'. Até agora o livro não foi registrado no sistema.\n\nAcesse com RG e senha para preencher e assinar:\n'+link+'\n\n'+(stage===3?'Este é o último lembrete automático deste serviço.':'Novo lembrete será enviado em 12 horas enquanto o livro não for assinado.')+'\n\nCaso tenha ocorrido alteração, troca ou permuta e você não seja o responsável nesta data, desconsidere esta mensagem.\n\nMensagem automática — Sistema de Livros de Serviço do 2º GMAR.'};
  const result=await deliver(db,now,send,id,message);if(result)outcomes.push({type,status:result});
 }
 return {date,stage,outcomes};
}

// Each scheduled invocation retries pending work from the previous 23 hours,
// using a refreshed roster and the same provider idempotency key.
export async function dispatchNotifications(c:{db:any,scale:(date:string)=>Promise<any>},now=new Date(),send=sendMail){
 const window=serviceWindow(now);if(!window)return {skipped:'Fora do horário programado.'};
 const result=await processWindow(c,now,send,window);
 const pending=(await c.db.prepare("SELECT DISTINCT service_date,book_type,id,kind FROM livros.mail_log WHERE status IN ('failed','sending','pending','missing_email','not_configured') AND kind IN ('reminder','schedule') AND created_at>? AND service_date<>'' ORDER BY service_date LIMIT 20").bind(new Date(now.getTime()-23*3600000).toISOString()).all()).results;
 const done=new Set(window.types.map(type=>window.date+':'+type));
 for(const row of pending){
  const types=row.kind==='schedule'?(row.id.endsWith(':supervisor')?['supervisor']:['officer','adjunto','nautica','ssmt']):[row.book_type];
  const todo=types.filter((type:string)=>names[type]&&!done.has(row.service_date+':'+type));
  if(todo.length){todo.forEach((type:string)=>done.add(row.service_date+':'+type));await processWindow(c,now,send,{date:row.service_date,types:todo});}
 }
 const followUps=[];for(const w of followUpWindows(now))followUps.push(await processFollowUp(c,now,send,w));
 return {...result,followUps};
}
