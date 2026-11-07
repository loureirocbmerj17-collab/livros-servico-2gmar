import assert from 'node:assert/strict';
export async function run({post,get,sql,password,qa}){
 await post('login',{rg:'99996',password});
 await sql.query("UPDATE livros.users SET email='',first_login=true WHERE rg='99996'");
 assert.equal((await get('op=nauticalList')).status,428);
 await post('nauticalSave',{},428);
 await post('profile',{rg:'99998',email:'military@example.test',current:password,password},400);
 await post('profile',{rg:'99996',email:'invalid',current:password,password},400);
 await post('profile',{rg:'0099996',email:'military@example.test',current:password,password:'99996'},400);
 await post('profile',{rg:'0099996',email:'military@example.test',current:password,password});
 assert.equal((await get('op=nauticalList')).status,200);
 await post('forgotPassword',{rg:'99996',email:'military@example.test'},503);
 process.env.RESEND_API_KEY='test-only';process.env.MAIL_FROM='test@example.test';
 const original=globalThis.fetch;let link,deliveries=0;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');const m=JSON.parse(options.body);link=m.text.match(/#reset=([a-f0-9]+)/)?.[1];deliveries++;return Response.json({id:'test-provider-id'});};
 await post('forgotPassword',{rg:'99996',email:'wrong@example.test'});assert.equal(deliveries,0);
 await post('forgotPassword',{rg:'99996',email:'military@example.test'});assert.equal(deliveries,1);assert.equal(link.length,64);
 const saved=(await sql.query("SELECT * FROM livros.password_resets WHERE rg='99996'")).rows[0];assert.notEqual(saved.token_hash,link);
 await post('resetPassword',{token:link,password:'New-personal-password!'});
 assert.equal((await get('op=nauticalList')).status,401);
 await post('resetPassword',{token:link,password:'Another-password!'},400);
 await post('login',{rg:'99996',password:'New-personal-password!'});
 // Expired links cannot be consumed.
 const {mailHash}=await import('../.qa/mail-service.mjs');
 const expired='a'.repeat(64);
 await sql.query("INSERT INTO livros.password_resets(token_hash,rg,password_hash,email,expires_at) SELECT $1,rg,password,email,now()-interval '1 minute' FROM livros.users WHERE rg='99996'",[mailHash(expired)]);
 await post('resetPassword',{token:expired,password:'Should-not-change!'},400);
 // Restore test fixture password through authenticated profile.
 await post('profile',{rg:'99996',email:'military@example.test',current:'New-personal-password!',password});
 await post('forgotPassword',{rg:'99996',email:'military@example.test'},429);
 const {serviceWindow,followUpWindows,scheduledRecipients,dispatchNotifications}=await import('../.qa/notifications.mjs');
 assert.deepEqual(serviceWindow(new Date('2026-11-13T09:00:00Z')),{date:'2026-11-12',types:['officer','adjunto','nautica','ssmt']});
 assert.deepEqual(serviceWindow(new Date('2026-11-12T21:00:00Z')),{date:'2026-11-12',types:['supervisor']});
 assert.equal(serviceWindow(new Date('2026-11-12T20:59:00Z')),null);
 const crew=Array(15).fill('');crew[0]='CAP RG 99998';crew[5]='SUBTEN RG 99996';crew[8]='SD RG 99998 / SUBTEN RG 99996';crew[14]='RG 99996';
 const scale={crew,adjunto:'RG 99996'};
 assert.equal(scheduledRecipients(scale,[{rg:'99998',rank:'SD'},{rg:'99996',rank:'SUBTEN'}],[]).nautica,'99996');
 assert.equal(scheduledRecipients(scale,[],[{book_type:'supervisor',actor:'99997',replacement:'MAJ RG 99997'}]).supervisor,'99997');
 let sent=0;const messages=[];
 const context={db:globalThis.testDb,scale:async()=>scale},send=async(id,m)=>{if(/lembrete/i.test(m.subject))return 'fake-follow-up';sent++;messages.push(m);return 'fake-'+sent;};
 const moment=new Date('2026-11-12T21:00:00Z');
 await dispatchNotifications(context,moment,send);await dispatchNotifications(context,moment,send);
 assert.equal(sent,1);assert.match(messages[0].text,/book=supervisor&date=2026-11-12/);
 await sql.query("UPDATE livros.users SET email='' WHERE rg='99996'");
 await dispatchNotifications(context,new Date('2026-11-13T21:00:00Z'),send);assert.equal(sent,1);
 assert.equal((await sql.query("SELECT status FROM livros.mail_log WHERE service_date='2026-11-13' AND book_type='supervisor'")).rows[0].status,'missing_email');
 await sql.query("UPDATE livros.users SET email='military@example.test' WHERE rg='99996'");
 let attempts=0;await dispatchNotifications(context,new Date('2026-11-14T21:00:00Z'),async(id,m)=>{if(!/lembrete/i.test(m.subject))attempts++;throw Error('timeout');});assert.equal(attempts,2);
 await sql.query("UPDATE livros.mail_log SET first_attempt_at='2026-11-14T21:00:00Z' WHERE service_date='2026-11-14'");
 await dispatchNotifications(context,new Date('2026-11-14T21:01:00Z'),send);assert.equal(sent,2);
 await dispatchNotifications({db:globalThis.testDb,scale:async()=>{throw Error('offline');}},new Date('2026-11-15T21:00:00Z'),send);assert.equal(sent,2);
 await dispatchNotifications({db:globalThis.testDb,scale:async()=>({crew:[]})},new Date('2026-11-16T21:00:00Z'),send);assert.equal(sent,2);
 // Lembretes 2 e 3: 12 h e 24 h após o 1º e-mail, somente enquanto o livro não estiver assinado.
 assert.deepEqual(followUpWindows(new Date('2026-12-02T21:00:00Z')),[{date:'2026-12-01',types:['officer','adjunto','nautica','ssmt'],stage:2},{date:'2026-12-01',types:['supervisor'],stage:3}]);
 assert.deepEqual(followUpWindows(new Date('2026-12-03T09:00:00Z')),[{date:'2026-12-02',types:['supervisor'],stage:2},{date:'2026-12-01',types:['officer','adjunto','nautica','ssmt'],stage:3}]);
 assert.deepEqual(followUpWindows(new Date('2026-12-03T10:00:00Z')),[]);
 {
  const all=Array(15).fill('RG 99996'),only={crew:all,adjunto:'RG 99996',nauticalOperators:['SUBTEN RG 99996']};
  const box=[],ctx={db:globalThis.testDb,scale:async()=>only},mail=async(id,m)=>{box.push(m);return 'fake-'+box.length;};
  const book=(table,date,status,version=1)=>sql.query(`INSERT INTO ${table}(date,author,author_name,version,status,data,actor,updated,pdf) SELECT $1,rg,name,$3,$2,'{}',rg,now()::text,'' FROM livros.users WHERE rg='99996'`,[date,status,version]);
  const D='2026-12-01',of=d=>box.filter(m=>m.text.includes('date='+d));
  await book('livros.books',D,'Rascunho',2);await book('livros.supervisor_books',D,'Assinado');await book('livros.ssmt_books',D,'Conferido');
  await dispatchNotifications(ctx,new Date('2026-12-02T09:00:00Z'),mail); // 1º e-mail dos quatro livros (comportamento anterior)
  assert.equal(of(D).length,4);assert.ok(of(D).every(m=>/Preenchimento do Livro/.test(m.subject)));box.length=0;
  await dispatchNotifications(ctx,new Date('2026-12-02T21:00:00Z'),mail);await dispatchNotifications(ctx,new Date('2026-12-02T21:00:00Z'),mail);
  let day=of(D);assert.equal(day.length,3,'2º lembrete: Oficial (rascunho), Adjunto e Náutica (sem livro); SSMT conferido e Supervisor assinado sem e-mail');
  const officer=day.find(m=>m.text.includes('book=officer'));assert.match(officer.subject,/^2º GMAR — Lembrete: Livro Oficial de Dia de 01\/12\/2026 salvo sem assinatura$/);assert.match(officer.text,/RASCUNHO \(versão 2\)/);assert.match(officer.text,/não é necessário retificar/);assert.match(officer.text,/Novo lembrete será enviado em 12 horas/);
  for(const t of ['adjunto','nautica']){const m=day.find(x=>x.text.includes('book='+t+'&'));assert.match(m.subject,/Lembrete: Livro .* ainda não preenchido$/);}
  assert.ok(!day.some(m=>/book=(ssmt|supervisor)&/.test(m.text)));box.length=0;
  await sql.query("UPDATE livros.books SET status='Assinado',version=version+1 WHERE date=$1",[D]);
  await dispatchNotifications(ctx,new Date('2026-12-03T09:00:00Z'),mail);
  day=of(D);assert.equal(day.length,2,'3º lembrete somente para os livros ainda pendentes');assert.ok(day.every(m=>/^2º GMAR — Último lembrete: /.test(m.subject)&&/último lembrete automático/.test(m.text)));
  assert.ok(!day.some(m=>m.text.includes('book=officer')));
  // Supervisor: 1º às 18h do dia, 2º às 06h e 3º às 18h do dia seguinte; rascunho lembra o autor.
  const S='2026-12-05';await book('livros.supervisor_books',S,'Rascunho',3);box.length=0;
  for(const [moment,subject] of [['2026-12-05T21:00:00Z',/Preenchimento do Livro Supervisor/],['2026-12-06T09:00:00Z',/^2º GMAR — Lembrete: Livro Supervisor de 05\/12\/2026 salvo sem assinatura$/],['2026-12-06T21:00:00Z',/^2º GMAR — Último lembrete: Livro Supervisor de 05\/12\/2026 salvo sem assinatura$/]]){
   await dispatchNotifications(ctx,new Date(moment),mail);const m=of(S).filter(x=>x.text.includes('book=supervisor'));assert.equal(m.length,1,moment);assert.match(m[0].subject,subject);box.length=0;}
  await dispatchNotifications(ctx,new Date('2026-12-07T09:00:00Z'),mail);assert.equal(of(S).filter(x=>x.text.includes('book=supervisor')).length,0,'nenhum lembrete do Supervisor depois do 3º');
  const kinds=(await sql.query("SELECT kind,count(*)::int n FROM livros.mail_log WHERE service_date=$1 AND status='accepted' GROUP BY kind ORDER BY kind",[D])).rows;
  assert.deepEqual(kinds,[{kind:'reminder',n:4},{kind:'reminder2',n:3},{kind:'reminder3',n:2}]);
  // Livros fictícios de dezembro permanecem: o banco bloqueia exclusão de livros.
 }
 await import('./gmail-mail.mjs').then(m=>m.run({sql,context,dispatchNotifications}));
 globalThis.fetch=original;delete process.env.RESEND_API_KEY;delete process.env.MAIL_FROM;
 console.log('PASS accounts/mail: compulsory profile, RG normalization, password recovery, hashed single-use token, session revocation, rate limit; Brasília scheduling, seniority, substitutions, missing email, no roster, duplicate prevention and retry. No real mail sent.');
}
