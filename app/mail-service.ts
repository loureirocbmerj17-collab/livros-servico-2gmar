import {createHash} from 'node:crypto';
import nodemailer from 'nodemailer';
export const appOrigin=()=>process.env.APP_ORIGIN||'https://livros-servico-2gmar.vercel.app';
export const mailProvider=()=>process.env.MAIL_PROVIDER||'resend';
export const mailReady=()=>mailProvider()==='gmail'
 ?!!(process.env.GMAIL_USER?.trim()&&process.env.GMAIL_APP_PASSWORD?.replace(/\s/g,''))
 :mailProvider()==='resend'&&!!(process.env.RESEND_API_KEY&&process.env.MAIL_FROM);
export const mailHash=(s:string)=>createHash('sha256').update(s).digest('hex');
export type Message={to:string;subject:string;text:string};
function escapeHtml(value:string){
 return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
export function messageHtml(message:Message){
 const origin=new URL(appOrigin());
 const logo=escapeHtml(new URL('/timao-unidade.png',origin).href);
 const paragraphs=message.text.trim().split(/\n\s*\n/).map(paragraph=>{
  const lines=paragraph.split('\n').map(line=>{
   if(line.startsWith(origin.origin+'/')){
    const link=escapeHtml(line);
    const label=line.includes('/#reset=')?'Criar nova senha':'Abrir livro do serviço';
    return '<a style="display:inline-block;margin:8px 0;padding:12px 18px;background:#18304a;color:white;border-radius:5px;text-decoration:none" href="'+link+'">'+label+'</a><br><small>'+escapeHtml(origin.hostname)+'</small>';
   }
   return escapeHtml(line);
  });
  return '<p style="margin:0 0 16px">'+lines.join('<br>')+'</p>';
 });
 return '<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f2f4f6;font:16px/1.55 Arial,sans-serif;color:#172b46"><div style="max-width:580px;margin:18px auto;background:white"><div style="background:#172b46;color:white;border-bottom:3px solid #d4af51;padding:16px 22px"><img width="44" height="44" alt="" style="vertical-align:middle;margin-right:10px" src="'+logo+'"><strong>2º GMAR · Barra da Tijuca</strong></div><div style="padding:22px"><h1 style="font-size:20px">'+escapeHtml(message.subject.replace(/^2º GMAR — /,''))+'</h1>'+paragraphs.join('')+'</div></div></body></html>';
}
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
    to:{name:'',address:m.to},subject:m.subject,text:m.text,html:messageHtml(m),
    messageId:'<'+mailHash(id)+'@gmail.com>'});
   if(!result.accepted?.length||result.rejected?.length)throw Error('Destinatário não aceito.');
   return String(result.messageId);
  }catch{throw Error('Gmail não confirmou o envio. Confira a configuração e o histórico de e-mails.');}
  finally{transport.close();}
 }
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:process.env.MAIL_FROM,to:[m.to],subject:m.subject,text:m.text,html:messageHtml(m)}),signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>({}));if(!r.ok||!data.id)throw Error('Provedor de e-mail não confirmou o envio (HTTP '+r.status+').');return String(data.id);
}
