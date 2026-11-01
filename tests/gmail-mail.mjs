import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
export async function run({sql,context,dispatchNotifications}){
 const {mailReady,sendMail}=await import('../.qa/mail-service.mjs');
 const original=nodemailer.createTransport;
 process.env.MAIL_PROVIDER='gmail';process.env.GMAIL_USER='sender@example.test';
 assert.equal(mailReady(),false); // Resend credentials must not silently enable Gmail.
 process.env.GMAIL_APP_PASSWORD='abcd efgh ijkl mnop';
 assert.equal(mailReady(),true);
 let calls=0,closed=0,options,message;
 nodemailer.createTransport=o=>{options=o;return {sendMail:async m=>{calls++;message=m;return {accepted:[m.to.address],rejected:[],messageId:m.messageId};},close:()=>closed++};};
 try{
  const result=await sendMail('fixture',{to:'recipient@example.test',subject:'Teste',text:'Conteúdo'});
  assert.match(result,/^<[a-f0-9]{64}@gmail.com>$/);
  assert.equal(options.host,'smtp.gmail.com');assert.equal(options.secure,true);assert.equal(options.port,465);
  assert.equal(options.auth.pass,'abcdefghijklmnop');assert.equal(options.debug,false);
  assert.equal(message.from.address,'sender@example.test');assert.equal(message.to.address,'recipient@example.test');assert.equal(closed,1);
  const now=new Date('2026-11-20T21:00:00Z');
  await Promise.all([dispatchNotifications(context,now),dispatchNotifications(context,now)]);
  assert.equal(calls,2); // One direct test + exactly one reminder under concurrency.
  await dispatchNotifications(context,now);assert.equal(calls,2);
  nodemailer.createTransport=()=>({sendMail:async()=>{calls++;throw Error('Secret details must not escape');},close:()=>closed++});
  await assert.rejects(sendMail('failure',{to:'recipient@example.test',subject:'Teste',text:'x'}),e=>e.message.includes('Gmail')&&!e.message.includes('Secret'));
  const failureDate=new Date('2026-11-21T21:00:00Z'),before=calls;
  await dispatchNotifications(context,failureDate);await dispatchNotifications(context,failureDate);
  assert.equal(calls,before+1);
  const log=(await sql.query("SELECT * FROM livros.mail_log WHERE service_date='2026-11-21' AND book_type='supervisor'")).rows[0];
  assert.equal(log.status,'uncertain');assert.equal(log.attempts,1);
  // Simulate termination after reservation and before final provider response.
  await sql.query("UPDATE livros.mail_log SET status='sending',lease_until=now()-interval '5 minutes' WHERE id=$1",[log.id]);
  await dispatchNotifications(context,failureDate);assert.equal(calls,before+1);
  assert.equal((await sql.query('SELECT status FROM livros.mail_log WHERE id=$1',[log.id])).rows[0].status,'uncertain');
 }finally{nodemailer.createTransport=original;delete process.env.MAIL_PROVIDER;delete process.env.GMAIL_USER;delete process.env.GMAIL_APP_PASSWORD;}
 console.log('PASS Gmail: TLS, private app password, sender, sanitized errors, concurrent dedupe, no automatic retry after ambiguous send/crash. Mock transport only.');
}
