export async function downloadBook(params:Record<string,string>){
 const response=await fetch('/api/service?'+new URLSearchParams(params),{cache:'no-store'});
 if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'Não foi possível gerar o PDF. Tente novamente.');}
 if(!response.headers.get('content-type')?.includes('application/pdf'))throw Error('Resposta de download inválida.');
 const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]||'Livro.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
