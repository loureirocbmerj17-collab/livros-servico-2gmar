import {nauticalBlank,validateNautical,stockEnd,equipmentKinds,operationalStockEquipment} from './nautica-model';
import {assignmentRg,normalizeRg,nauticalAssignments} from './service-policy';
import {personLabel} from './person-label';
import {readDrawing} from './handwriting';
import {makeNauticalPdf} from './nautica-pdf';
import {makeMonthlyPdf} from './monthly-pdf';
type Context={db:any,check:(p:string,s:string)=>Promise<boolean>,hash:(s:string)=>Promise<string>,scale:(date:string)=>Promise<any>,storePdf:(bytes:Uint8Array,name:string)=>Promise<string>};
const fail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status})};
const validDate=(date:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Data inválida.');};
const results=async(db:any,q:string,...args:any[])=>(await db.prepare(q).bind(...args).all()).results;
const one=async(db:any,q:string,...args:any[])=>db.prepare(q).bind(...args).first();
async function roster(c:Context,date:string){try{const scale=await c.scale(date);const raw=nauticalAssignments(scale.nauticalOperators||scale.crew.slice(8,11).filter(Boolean));const rgs=[...new Set(raw.map(assignmentRg).filter(Boolean))];const people=await results(c.db,'SELECT rg,name,rank FROM users WHERE active=1');return {found:true,source:scale.source||null,warnings:(scale.warnings||[]).filter((message:string)=>!/^OF\.? (?:DE )?RAS AOS DESTACAMENTOS:/i.test(message)),dayCrew:[...new Set([scale.crew[0],scale.crew[6]].filter(Boolean).map(assignmentRg).filter(Boolean))].map(rg=>{const p=people.find((p:any)=>p.rg===rg);return {rg,name:(p?personLabel(p):'RG '+rg)+(rg===assignmentRg(scale.crew[0])?' · Oficial de dia':' · Oficial médico')};}),operators:rgs.map(rg=>{const p=people.find((p:any)=>p.rg===rg);return {rg,name:p?personLabel(p):raw.find((s:string)=>assignmentRg(s)===rg),hours:24}}),officerRg:assignmentRg(scale.crew[0])};}catch(e:any){return {found:false,source:null,warnings:[e?.message||'Escala não localizada ou indisponível. Use o preenchimento manual.'],operators:[],officerRg:''};}}
async function purchaseMonth(c:Context,date:string){return results(c.db,'SELECT * FROM livros.nautical_purchases WHERE date LIKE ? AND date<=? ORDER BY date,id',date.slice(0,7)+'-%',date);}
export async function nauticalGet(op:string,u:any,url:URL,c:Context){
 const date=url.searchParams.get('date')||'';
 if(op==='nauticalList'){return results(c.db,'SELECT date,author_name,status,version FROM livros.nautical_books ORDER BY date DESC');}
 if(op==='nauticalPeople')return results(c.db,'SELECT rg,name,rank FROM users WHERE active=1 ORDER BY name');
 if(op==='nauticalEquipment')return results(c.db,'SELECT * FROM livros.nautical_equipment ORDER BY prefix');
 if(op==='nauticalMonthPdf'){if(u.role==='enlisted')fail('Exportação mensal restrita aos oficiais.',403);const month=url.searchParams.get('month')||'';if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))fail('Mês inválido.');const books=await results(c.db,'SELECT date,author_name,status,version,pdf FROM livros.nautical_books WHERE date LIKE ? ORDER BY date',month+'-%');if(!books.length)fail('Nenhum livro da Náutica neste mês.',404);return {downloadUrl:await c.storePdf(await makeMonthlyPdf(month,books,'LIVRO DA NÁUTICA'),`Livro-Nautica-${month}.pdf`)};}
 validDate(date);
 if(op==='nauticalContext'){
 const [r,equipment,previous,monthPurchases]=await Promise.all([roster(c,date),results(c.db,'SELECT * FROM livros.nautical_equipment WHERE active=true ORDER BY prefix'),one(c.db,"SELECT date,data FROM livros.nautical_books WHERE date<? AND status IN ('Assinado','Conferido') ORDER BY date DESC LIMIT 1",date),purchaseMonth(c,date)]);
 const latest=await one(c.db,'SELECT data FROM livros.nautical_books WHERE date<? ORDER BY date DESC LIMIT 1',date);const latestInventory=latest?JSON.parse(latest.data).inventory:[];
 const d=nauticalBlank(date),prev=previous?JSON.parse(previous.data):null;d.operators=r.operators;(d as any).dayCrew=(r as any).dayCrew||[];d.inventory=equipment.map((e:any)=>{const old=prev?.inventory.find((i:any)=>i.id===e.id)||e.initial_data;return {id:e.id,prefix:e.prefix,kind:e.kind,condition:old?.condition||'',location:old?.location||'Galpão Náutica',hours:latestInventory.find((i:any)=>i.id===e.id)?.hours||old?.hours||'00000',previousHours:old?.hours||'',unavailable:!!old?.unavailable,unavailableReason:old?.unavailableReason||'',note:old?.note||''}});if(prev){d.carryDate=previous.date;d.changes=prev.changes.filter((r:any)=>r.status==='Pendente');d.stock=prev.stock.map((s:any)=>({fuel:s.fuel,initial:String(stockEnd(s)),incoming:'0',outgoing:'0'}));}return {roster:r,blank:d,monthPurchases};
 }
 const book=await one(c.db,'SELECT * FROM livros.nautical_books WHERE date=?',date);
 // Single-day nautical consultation is available to the unit; bulk lists remain restricted.
 if(op==='nauticalBook')return book?{...book,pdf:undefined,data:JSON.parse(book.data),review:book.review?JSON.parse(book.review):null}:null;
 if(op==='nauticalHistory')return results(c.db,'SELECT version,actor,updated,status,data,signature,review FROM livros.nautical_revisions WHERE date=? ORDER BY version DESC',date);
 if(op==='nauticalPdf'){const version=url.searchParams.get('version');const r=version?await one(c.db,'SELECT pdf FROM livros.nautical_revisions WHERE date=? AND version=?',date,Number(version)):book;if(!r)fail('PDF não encontrado.',404);return {downloadUrl:await c.storePdf(Uint8Array.from(Buffer.from(r.pdf,'base64')),`Livro-Nautica-${date}${version?'-v'+version:''}.pdf`)};}
 fail('Operação desconhecida.',404);
}
export async function nauticalPost(op:string,u:any,b:any,c:Context){
 const {db}=c;const now=new Date().toISOString();
 if(op==='nauticalEquipmentSave'){
 if(u.role!=='admin')fail('Cadastro de equipamentos restrito à administração.',403);
 const prefix=String(b.prefix||'').trim().toUpperCase();if(!/^[A-Z0-9ÁÉÍÓÚÃÕÇ .\/-]{2,40}$/.test(prefix)||!equipmentKinds.includes(b.kind))fail('Informe identificação e tipo de equipamento.');
 const id=b.id||crypto.randomUUID(),initial=b.initial_data||{};if(typeof b.active!=='boolean'||!['','OP','INOP'].includes(initial.condition||'')||[b.model,b.description,initial.location,initial.hours,initial.note].some(v=>v!==undefined&&(typeof v!=='string'||v.length>1000))||(initial.hours&&!/^\d+(\.\d{1,3})?$/.test(initial.hours)))fail('Dados do equipamento inválidos.');
 const old=await one(db,'SELECT * FROM livros.nautical_equipment WHERE id=?',id);if(old&&old.updated!==b.updated)fail('Cadastro alterado; recarregue a lista.',409);
 try{await db.batch([db.prepare('INSERT INTO livros.nautical_equipment(id,prefix,kind,model,description,active,initial_data,updated,actor) VALUES(?,?,?,?,?,?,?::jsonb,?,?) ON CONFLICT(id) DO UPDATE SET prefix=excluded.prefix,kind=excluded.kind,model=excluded.model,description=excluded.description,active=excluded.active,initial_data=excluded.initial_data,updated=excluded.updated,actor=excluded.actor').bind(id,prefix,b.kind,b.model||'',b.description||'',b.active,JSON.stringify(initial),now,u.rg),db.prepare('INSERT INTO admin_log(actor,action,updated) VALUES(?,?,?)').bind(u.rg,'Equipamento Náutica: '+JSON.stringify({before:old,after:{id,prefix,kind:b.kind,model:b.model,description:b.description,active:b.active,initial_data:initial}}),now)]);}catch(e:any){if(e.code==='23505')fail('Já existe equipamento com este prefixo.',409);throw e;}return {ok:true,id};
 }
 validDate(b.date);const old=await one(db,'SELECT * FROM livros.nautical_books WHERE date=?',b.date);
 if(old?.status==='Conferido')fail('Livro conferido pelo Oficial de Dia e bloqueado.',409);
 if(op==='nauticalManualRoster'){
 if(old?.review)fail('Conferência do Chefe registrada: edição bloqueada.',409);
 if(old&&old.author!==u.rg)fail('Somente o autor pode preencher a escala manual.',403);
 if((old?.version||0)!==b.version)fail('Reabra o livro atualizado.',409);
 const reason=String(b.reason||'').trim();if(reason.length<20||reason.length>1500)fail('Informe justificativa de 20 a 1500 caracteres.');if(!await c.check(String(b.password||''),u.password))fail('Senha incorreta.',401);
 const r=await roster(c,b.date);if(r.found&&r.operators.length&&!JSON.parse(old?.data||'{}').manualRosterId)fail('A escala está disponível. Reimporte ou registre a substituição de responsabilidade.',409);
 if(!Array.isArray(b.operators)||!b.operators.length||b.operators.length>10||b.operators.some((v:any)=>typeof v!=='string'))fail('Informe de 1 a 10 RGs de operadores.');
 const rgs=b.operators.map(normalizeRg);if(new Set(rgs).size!==rgs.length)fail('Operador repetido.');if(!rgs.includes(u.rg))fail('O responsável pelo preenchimento deve estar entre os operadores.',403);
 const people=await results(db,'SELECT rg,name,rank,role FROM users WHERE active=1');
 const person=(rg:string)=>{const p=people.find((p:any)=>p.rg===rg);if(!p)fail('RG '+rg+' não está ativo no cadastro.');return p;};
 const operators=rgs.map((rg:string)=>({rg,name:personLabel(person(rg)),hours:24}));
 const dayCrew:any[]=[];for(const [key,label] of [['officerRg','Oficial de dia'],['medicalRg','Oficial médico']]){const rg=normalizeRg(String(b[key]||''));if(!rg)continue;const p=person(rg);if(p.role==='enlisted')fail(label+' deve ser um oficial cadastrado.');if(!dayCrew.some(p=>p.rg===rg))dayCrew.push({rg,name:personLabel(p)+' · '+label});}
 const composition={kind:'manualRoster',operators,dayCrew,officerRg:normalizeRg(String(b.officerRg||'')),medicalRg:normalizeRg(String(b.medicalRg||''))};
 const event=await one(db,'INSERT INTO livros.assignment_events(date,book_type,actor,previous_assignment,replacement,reason,created_at) VALUES(?,?,?,?,?,?,?) RETURNING id',b.date,'nautica',u.rg,JSON.stringify({operators:r.operators,source:r.source,warnings:r.warnings}),JSON.stringify(composition),'Preenchimento manual: '+reason,now);
 return {...composition,manualRosterId:event.id};
 }
 if(op==='nauticalResolve'){
 const kind=b.function==='officer'?'officer':'nautica';if(kind==='officer'&&u.role==='enlisted')fail('Visto restrito ao Oficial de Dia.',403);if(kind==='nautica'&&old&&old.author!==u.rg)fail('Somente o autor pode retificar a responsabilidade deste livro.',403);
 const officerBook=kind==='officer'?await one(db,'SELECT author,status FROM books WHERE date=?',b.date):null;if(officerBook&&officerBook.author!==u.rg)fail('O Oficial responsável pelo livro do dia deve realizar o visto.',403);
 const reason=String(b.reason||'').trim();if(reason.length<20||reason.length>1500)fail('Informe justificativa de 20 a 1500 caracteres.');if(!await c.check(String(b.password||''),u.password))fail('Senha incorreta.',401);
 const r=await roster(c,b.date);const replacement=`${personLabel(u)} RG ${u.rg}`;await db.prepare('INSERT INTO livros.assignment_events(date,book_type,actor,previous_assignment,replacement,reason,created_at) VALUES(?,?,?,?,?,?,?)').bind(b.date,kind,u.rg,kind==='officer'?r.officerRg||'Escala indisponível':r.operators.map((p:any)=>p.name+' RG '+p.rg).join('; ')||'Escala indisponível',replacement,reason,now).run();return {operator:{rg:u.rg,name:personLabel(u),hours:24},replacement};
 }
 if(op==='nauticalChiefReview'){if(!u.nautica_chief||!old||old.status!=='Assinado'||old.author===u.rg)fail('Conferência restrita ao Chefe de Náutica, em livro assinado por outro operador.',403);if(old.version!==b.version)fail('Reabra o livro atualizado.',409);if(old.review)fail('Conferência já registrada.',409);if(!await c.check(String(b.password||''),u.password)||!readDrawing(b.drawing))fail('Confirme senha e assinatura manuscrita.',401);const chief={rg:u.rg,name:personLabel(u),at:now,drawing:b.drawing,attestation:`${personLabel(u)} - RG ${u.rg} | ${now} | SHA-256 ${await c.hash(old.data)}`};const next={...old,version:old.version+1,review:JSON.stringify({chief}),actor:u.rg,updated:now};next.pdf=await makeNauticalPdf(next);const r=await db.prepare('UPDATE livros.nautical_books SET version=?,review=?,actor=?,updated=?,pdf=? WHERE date=? AND version=?').bind(next.version,next.review,u.rg,now,next.pdf,b.date,b.version).run();if(!r.meta.changes)fail('Versão alterada.',409);return {ok:true};}
 if(old?.review&&op!=='nauticalReview')fail('Conferência do Chefe registrada: edição bloqueada.',409);
 if(!['nauticalSave','nauticalSign','nauticalReview'].includes(op))fail('Operação desconhecida.');
 if(old&&old.version!==b.version||!old&&b.version!==0)fail('A versão mudou. Reabra o livro.',409);
 const review=op==='nauticalReview',sign=op==='nauticalSign';if(!review&&old&&old.author!==u.rg)fail('Somente quem confeccionou pode retificar.',403);
 if(review&&(u.role==='enlisted'||!old||old.status!=='Assinado'||old.author===u.rg))fail('O visto exige outro militar, Oficial de Dia, e livro assinado.',403);
 if(review&&!JSON.parse(old.review||'{}').chief)fail('Aguarde a conferência do Chefe de Náutica.',409);
 let d=review?JSON.parse(old.data):b.data;if(!d||d.date!==b.date)fail('Dados inválidos.');
 if(!review&&d&&Array.isArray(d.stock)&&Array.isArray(d.purchases)&&Array.isArray(d.refuels))d={...d,stock:d.stock.map((s:any)=>({...s,incoming:String(d.purchases.filter((r:any)=>r.fuel===s.fuel).reduce((n:number,r:any)=>n+Number(r.liters||0),0)),outgoing:String(d.refuels.filter((r:any)=>r.fuel===s.fuel).reduce((n:number,r:any)=>n+Number(r.liters||0),0))}))};
 if(!review){d={...d};for(const key of ['radios','chargers','covers'])if(d[key]===undefined||d[key]===null||d[key]==='')d[key]='0';}
 const errors=validateNautical(d,sign);if(errors.length)fail(errors.join(' '));
 const events=await results(db,'SELECT * FROM livros.assignment_events WHERE date=? AND book_type=? AND actor=? ORDER BY id',b.date,review?'officer':'nautica',u.rg);
 if(!old&&!review&&!events.length){const r=await roster(c,b.date);if(!r.operators.some((p:any)=>p.rg===u.rg)&&!events.length)fail('Seu RG deve constar na Náutica do dia para confeccionar o livro. Use Solucionar responsabilidade.',403);}
 if(!review){d=JSON.parse(JSON.stringify(d));delete d.signatureDrawing;delete d.assignmentAudit;delete d.monthPurchases;delete d.scaleSource;
 if(events.length)d.assignmentAudit=events.map((e:any)=>`${e.created_at} | RG ${e.actor} | Antes: ${e.previous_assignment} | Responsável: ${e.replacement} | Motivo: ${e.reason}`).join('\n');
 const equipment=await results(db,'SELECT id,prefix,kind FROM livros.nautical_equipment');const ids=new Set(equipment.map((e:any)=>e.id));if(d.inventory.some((i:any)=>!ids.has(i.id))||new Set(d.inventory.map((i:any)=>i.id)).size!==d.inventory.length)fail('Equipamento inválido ou repetido.');
 for(const key of ['activations','refuels','purchases','changes','occurrences'])if(d[key].some((r:any)=>r.equipment&&!ids.has(r.equipment)&&!(key==='refuels'&&r.equipment===operationalStockEquipment)))fail('Selecione equipamento cadastrado.');
 d.inventory=d.inventory.map((i:any)=>({...i,prefix:equipment.find((e:any)=>e.id===i.id).prefix,kind:equipment.find((e:any)=>e.id===i.id).kind}));
 const users=await results(db,'SELECT rg,name,rank FROM users WHERE active=1');const dayRoster=d.manualRosterId?null:await roster(c,b.date);if(d.manualRosterId){const event=events.find((e:any)=>String(e.id)===String(d.manualRosterId));let manual:any;try{manual=JSON.parse(event?.replacement||'{}');}catch{}if(manual?.kind!=='manualRoster')fail('Confirme o preenchimento manual antes de salvar.');if(JSON.stringify(d.operators.map((p:any)=>p.rg))!==JSON.stringify(manual.operators.map((p:any)=>p.rg)))fail('Operadores alterados: confirme novamente o preenchimento manual.');d.dayCrew=manual.dayCrew;d.manualOfficerRg=manual.officerRg;}else{d.dayCrew=(dayRoster as any).dayCrew||[];delete d.manualOfficerRg;}const operatorIds=new Set(d.operators.map((p:any)=>p.rg));if((d.sisgeoResponsible&&!operatorIds.has(d.sisgeoResponsible))||d.refuels.some((r:any)=>!operatorIds.has(r.responsible)))fail('Responsáveis pelo SISGEO e abastecimentos devem ser operadores da aba 1.');const allowedCrew=new Set([...operatorIds,...d.dayCrew.map((p:any)=>p.rg)]);if(d.activations.some((a:any)=>a.crew.some((rg:string)=>!allowedCrew.has(rg))))fail('A guarnição deve conter somente operadores da aba 1, o oficial de dia ou o oficial médico da escala.');d.operators=d.operators.map((p:any)=>{const found=users.find((x:any)=>x.rg===normalizeRg(p.rg));if(!found)fail('Operador não cadastrado no efetivo.');return {rg:found.rg,name:personLabel(found),hours:24}});
 if(new Set(d.operators.map((p:any)=>p.rg)).size!==d.operators.length)fail('Operador repetido.');
 const referenced=new Set([d.sisgeoResponsible,...d.activations.flatMap((a:any)=>a.crew),...d.refuels.map((r:any)=>r.responsible)]);if([...referenced].some(rg=>rg&&!users.some((p:any)=>p.rg===rg)))fail('Selecione militares cadastrados para guarnições e abastecimentos.');d.personnel=users.filter((p:any)=>referenced.has(p.rg)).map((p:any)=>({rg:p.rg,name:personLabel(p)}));
 if(d.sisgeoResponsible&&!users.some((p:any)=>p.rg===d.sisgeoResponsible))fail('Responsável SISGEO inválido.');
 d.monthPurchases=[...(await purchaseMonth(c,b.date)).filter((p:any)=>p.date!==b.date),...d.purchases.map((p:any)=>({...p,date:b.date}))].map((p:any)=>({...p,prefix:equipment.find((e:any)=>e.id===p.equipment)?.prefix||p.equipment}));
 }
 if(sign||review){if(!await c.check(String(b.password||''),u.password))fail('Confirme sua senha.',401);if(!readDrawing(b.drawing))fail('Desenhe sua assinatura.');const r=sign&&d.manualRosterId?{operators:[],source:null,officerRg:'',found:false}:await roster(c,b.date);
 if(sign){if(d.responsible!==u.rg)fail('O responsável selecionado deve ser o usuário autenticado.',403);if(!r.operators.some((p:any)=>p.rg===u.rg)&&!events.length)fail('Seu RG não foi confirmado na Náutica do dia. Use Solucionar responsabilidade.',403);d.scaleSource=r.source;d.signatureDrawing=b.drawing;}
 else{const officerBook=await one(db,'SELECT author FROM books WHERE date=?',b.date);if(officerBook&&officerBook.author!==u.rg)fail('O visto pertence ao autor do Livro do Oficial de Dia desta data.',403);if(r.officerRg!==u.rg&&!(d.manualRosterId&&!r.found&&d.manualOfficerRg===u.rg)&&!events.length)fail('Seu RG não consta como Oficial de Dia. Registre a substituição justificada.',403);}
 }
 const version=(old?.version||0)+1;const attestation=`${personLabel(u)} - RG ${u.rg} | ${now} | SHA-256 ${await c.hash(JSON.stringify(d))}`;
 const reviewValue=review?JSON.stringify({chief:JSON.parse(old.review||'{}').chief,rg:u.rg,name:personLabel(u),at:now,attestation,drawing:b.drawing,assignmentAudit:events.map((e:any)=>`${e.created_at} | ${e.previous_assignment} → ${e.replacement} | ${e.reason}`).join('\n')}):null;
 const next={date:b.date,author:old?.author||u.rg,author_name:old?.author_name||personLabel(u),version,status:review?'Conferido':sign?'Assinado':'Rascunho',data:review?old.data:JSON.stringify(d),signature:review?old.signature:sign?attestation:null,review:reviewValue,actor:u.rg,updated:now,pdf:''};next.pdf=await makeNauticalPdf(next);
 if(old){const r=await db.prepare("UPDATE livros.nautical_books SET version=?,status=?,data=?,signature=?,review=?,actor=?,updated=?,pdf=? WHERE date=? AND version=? AND status<>'Conferido'").bind(version,next.status,next.data,next.signature,next.review,u.rg,now,next.pdf,b.date,b.version).run();if(!r.meta.changes)fail('Versão alterada. Reabra o livro.',409);}else{try{await db.prepare('INSERT INTO livros.nautical_books(date,author,author_name,version,status,data,signature,review,actor,updated,pdf) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(next.date,next.author,next.author_name,version,next.status,next.data,next.signature,next.review,u.rg,now,next.pdf).run();}catch(e:any){if(e.code==='23505')fail('Já existe livro neste dia. Reabra o serviço.',409);throw e;}}
 return {ok:true,version,status:next.status};
}
