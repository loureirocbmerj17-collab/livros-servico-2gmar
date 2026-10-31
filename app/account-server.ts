import {randomBytes} from 'node:crypto';
import {normalizeRg} from './service-policy';
import {appOrigin,mailReady,mailHash,sendMail} from './mail-service';
const fail=(s:string,status=400):never=>{throw Object.assign(Error(s),{status})};
export const needsProfile=(u:any)=>!!u.first_login||!u.email;
const emailValue=(v:any)=>String(v||'').trim().toLowerCase();
function validPassword(p:any,rg:string){if(typeof p!=='string'||p.length<8||p.length>128||normalizeRg(p)===rg)fail('Crie uma senha pessoal de 8 a 128 caracteres, diferente do RG.');}
export async function accountAction(op:string,b:any,u:any,c:any):Promise<{ok:boolean,message?:string,renewSession?:string}>{
 const {db,password,check}=c;
 if(op==='profile'){
  if(!u)fail('Entre novamente.',401);
  if(normalizeRg(b.rg)!==u.rg)fail('Confirme seu próprio RG.');
  const email=emailValue(b.email);if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))fail('Informe um e-mail válido.');
  if(!await check(String(b.current||''),u.password))fail('Senha atual incorreta.',401);
  validPassword(b.password,u.rg);
  await db.batch([db.prepare('UPDATE users SET email=?,password=?,first_login=false,profile_completed_at=now() WHERE rg=?').bind(email,await password(b.password),u.rg),db.prepare('DELETE FROM sessions WHERE rg=?').bind(u.rg),db.prepare('DELETE FROM livros.password_resets WHERE rg=?').bind(u.rg),db.prepare('INSERT INTO admin_log(actor,action,updated) VALUES(?,?,?)').bind(u.rg,'Atualização do próprio cadastro e senha.',new Date().toISOString())]);
  return {ok:true,renewSession:u.rg};
 }
 if(op==='forgotPassword'){
  const rg=normalizeRg(b.rg),email=emailValue(b.email);if(!/^\d{3,12}$/.test(rg)||email.length>254)fail('Confira RG e e-mail.');
  const limited=await db.prepare("INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN attempts.expires<? THEN 1 ELSE attempts.count+1 END,expires=CASE WHEN attempts.expires<? THEN excluded.expires ELSE attempts.expires END RETURNING count").bind('reset:'+rg,Date.now()+3600000,Date.now(),Date.now()).first();
  if(Number(limited.count)>3)fail('Aguarde uma hora antes de solicitar outro link.',429);
  if(!mailReady())fail('Recuperação por e-mail ainda não configurada. Contate a administração.',503);
  const found=await db.prepare('SELECT rg,email,password FROM users WHERE rg=? AND email=? AND active=1').bind(rg,email).first();
  if(found){
   const token=randomBytes(32).toString('hex'),id=mailHash(token);
   await db.prepare("INSERT INTO livros.password_resets(token_hash,rg,password_hash,email,expires_at) VALUES(?,?,?,?,now()+interval '30 minutes')").bind(id,rg,found.password,email).run();
   await db.prepare("INSERT INTO livros.mail_log(id,kind,rg,recipient,status) VALUES(?,'recovery',?,?,'pending')").bind(id,rg,email).run();
   try{
    const provider=await sendMail(id,{to:email,subject:'2º GMAR — Recuperação de senha',text:'Use o link abaixo para criar uma nova senha. Validade: 30 minutos. Se não solicitou, desconsidere.\n\n'+appOrigin()+'/#reset='+token});
    await db.prepare("UPDATE livros.mail_log SET status='accepted',attempts=1,provider_id=?,updated_at=now() WHERE id=?").bind(provider,id).run();
   }catch{
    await db.batch([db.prepare('DELETE FROM livros.password_resets WHERE token_hash=?').bind(id),db.prepare("UPDATE livros.mail_log SET status='failed',attempts=1,detail='Envio não confirmado; solicitar novo link.',updated_at=now() WHERE id=?").bind(id)]);
   }
  }
  return {ok:true,message:'Se o RG e o e-mail corresponderem a um cadastro ativo, você receberá um link. Verifique também o spam.'};
 }
 if(op==='resetPassword'){
  if(!/^[a-f0-9]{64}$/.test(String(b.token||'')))fail('Link inválido ou expirado.');
  const tokenHash=mailHash(b.token),reset=await db.prepare("SELECT rg FROM livros.password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>now()").bind(tokenHash).first();
  if(!reset)fail('Link inválido ou expirado. Solicite outro.');
  validPassword(b.password,reset.rg);
  const result=await db.prepare("WITH consumed AS (UPDATE livros.password_resets r SET used_at=now() FROM livros.users u WHERE r.token_hash=? AND r.used_at IS NULL AND r.expires_at>now() AND u.rg=r.rg AND u.password=r.password_hash AND u.email=r.email AND u.active=1 RETURNING r.rg,r.password_hash,r.email), changed AS (UPDATE livros.users u SET password=?,first_login=false FROM consumed c WHERE u.rg=c.rg AND u.password=c.password_hash AND u.email=c.email AND u.active=1 RETURNING u.rg), sessions_removed AS (DELETE FROM livros.sessions WHERE rg IN (SELECT rg FROM changed)) SELECT rg FROM changed").bind(tokenHash,await password(b.password)).first();
  if(!result)fail('Link já utilizado, expirado ou cadastro alterado.');
  return {ok:true,message:'Senha atualizada. Entre com seu RG e a nova senha.'};
 }
 return fail('Operação desconhecida.',404);
}
