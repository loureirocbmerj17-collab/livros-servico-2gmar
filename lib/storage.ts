// PDFs exist only in response memory, never in the database or object storage.
export function downloadPdf(bytes:Uint8Array,filename:string){
 let offset=0;const stream=new ReadableStream<Uint8Array>({pull(controller){if(offset>=bytes.length){controller.close();return;}controller.enqueue(bytes.slice(offset,offset+64*1024));offset+=64*1024;}});
 return new Response(stream,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}

// One-off admin maintenance: Storage API removes bytes as well as metadata.
// Called only after data-only migration and successful regeneration checks.
export async function removeLegacyPdfs(names:string[]){
 if(!names.length)return;
 if(names.length>1000||names.some(n=>!/^([a-f0-9]{64})\/Livro-(Oficial|Nautica|SSMT)-[0-9v.-]+\.pdf$/.test(n)))throw Error('Arquivos inesperados; limpeza interrompida.');
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)throw Error('Armazenamento legado não configurado.');
 const headers:Record<string,string>={apikey:key,'Content-Type':'application/json'};if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 const response=await fetch(new URL('/storage/v1/object/livros-pdf',base),{method:'DELETE',headers,body:JSON.stringify({prefixes:names}),signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('Falha ao remover PDFs antigos.');
}
