import {createHash} from 'node:crypto';
import nodemailer from 'nodemailer';
export const appOrigin=()=>process.env.APP_ORIGIN||'https://livros-servico-2gmar.vercel.app';
export const mailProvider=()=>process.env.MAIL_PROVIDER||'resend';
export const mailReady=()=>mailProvider()==='gmail'
 ?!!(process.env.GMAIL_USER?.trim()&&process.env.GMAIL_APP_PASSWORD?.replace(/\s/g,''))
 :mailProvider()==='resend'&&!!(process.env.RESEND_API_KEY&&process.env.MAIL_FROM);
export const mailHash=(s:string)=>createHash('sha256').update(s).digest('hex');
export type Message={to:string;subject:string;text:string};
export async function sendMail(id:string,m:Message){
 if(!mailReady())throw Error('Serviço de e-mail não configurado.');
 if(mailProvider()==='gmail'){
  const user=process.env.GMAIL_USER!.trim();
  const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,
   auth:{user,pass:process.env.GMAIL_APP_PASSWORD!.replace(/\s/g,'')},
   connectionTimeout:15000,greetingTimeout:10000,socketTimeout:20000,
   disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false});
  try{
   const result=await transport.sendMail({from:{name:'Livros de Serviço — 2º GMAR',address:user},
    to:{name:'',address:m.to},subject:m.subject,text:m.text,
    messageId:'<'+mailHash(id)+'@gmail.com>'});
   if(!result.accepted?.length||result.rejected?.length)throw Error('Destinatário não aceito.');
   return String(result.messageId);
  }catch{throw Error('Gmail não confirmou o envio. Confira a configuração e o histórico de e-mails.');}
  finally{transport.close();}
 }
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:process.env.MAIL_FROM,to:[m.to],subject:m.subject,text:m.text}),signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>({}));if(!r.ok||!data.id)throw Error('Provedor de e-mail não confirmou o envio (HTTP '+r.status+').');return String(data.id);
}
