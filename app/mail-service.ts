import {createHash} from 'node:crypto';
export const appOrigin=()=>process.env.APP_ORIGIN||'https://livros-servico-2gmar.vercel.app';
export const mailReady=()=>!!(process.env.RESEND_API_KEY&&process.env.MAIL_FROM);
export const mailHash=(s:string)=>createHash('sha256').update(s).digest('hex');
export type Message={to:string;subject:string;text:string};
export async function sendMail(id:string,m:Message){
 if(!mailReady())throw Error('Serviço de e-mail não configurado.');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:process.env.MAIL_FROM,to:[m.to],subject:m.subject,text:m.text}),signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>({}));if(!r.ok||!data.id)throw Error('Provedor de e-mail não confirmou o envio (HTTP '+r.status+').');return String(data.id);
}
