import {createHash} from 'node:crypto';
// Private bucket. Only authenticated app requests can obtain a short-lived link.
export async function storePdf(bytes:Uint8Array,filename:string){
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,bucket=process.env.SUPABASE_PDF_BUCKET||'livros-pdf';
 if(!base||!key)throw new Error('Armazenamento não configurado.');
 const origin=new URL(base);if(origin.protocol!=='https:')throw new Error('URL de armazenamento inválida.');
 const path=encodeURIComponent(bucket)+'/'+createHash('sha256').update(bytes).digest('hex')+'/'+encodeURIComponent(filename);
 const headers:Record<string,string>={apikey:key};if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 const uploaded=await fetch(`${origin.origin}/storage/v1/object/${path}`,{method:'POST',headers:{...headers,'Content-Type':'application/pdf','x-upsert':'true','Cache-Control':'private, no-store'},body:new Uint8Array(bytes),signal:AbortSignal.timeout(25000)});
 if(!uploaded.ok)throw new Error('Falha ao armazenar PDF.');
 const signed=await fetch(`${origin.origin}/storage/v1/object/sign/${path}`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:120}),signal:AbortSignal.timeout(10000)});
 if(!signed.ok)throw new Error('Falha ao autorizar download.');const result=await signed.json();
 if(typeof result.signedURL!=='string')throw new Error('Link de download indisponível.');
 const url=new URL('/storage/v1'+result.signedURL,origin.origin);url.searchParams.set('download',filename);return url.href;
}
