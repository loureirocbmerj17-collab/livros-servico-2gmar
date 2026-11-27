import {attachmentKind,attachmentPath,attachmentLimit,AttachmentKind,Attachment} from './attachment-model';
export const bookTables={officer:['books','revisions'],nautica:['nautical_books','nautical_revisions'],ssmt:['ssmt_books','ssmt_revisions'],supervisor:['supervisor_books','supervisor_revisions'],adjunto:['adjunto_books','adjunto_revisions']} as const;
export function attachmentFail(message:string,status=400):never{throw Object.assign(Error(message),{status});}
export function attachmentReadPolicy(u:any,kind:AttachmentKind){if(!u)attachmentFail('Entre com seu RG e senha.',401);if(kind==='officer'&&u.role==='enlisted')attachmentFail('Acesso restrito aos oficiais.',403);}
export async function attachmentEditable(db:any,u:any,kind:AttachmentKind,date:string,version:number,retifying=false){attachmentReadPolicy(u,kind);attachmentPath(date,kind);const old=await db.prepare(`SELECT author,status,review,version,data FROM livros.${bookTables[kind][0]} WHERE date=?`).bind(date).first();if(!old)attachmentFail('Salve o rascunho antes de adicionar anexos.',409);if(old.author!==u.rg)attachmentFail('Somente o autor pode alterar anexos.',403);if(old.version!==version)attachmentFail('O livro foi atualizado. Reabra o serviço.',409);if(old.review||old.status==='Conferido'||(old.status==='Assinado'&&!retifying))attachmentFail('Use Retificar livro quando permitido. Livro conferido não pode ser alterado.',409);return old;}
export async function canonicalAttachments(db:any,u:any,kind:AttachmentKind,date:string,input:any,old:any){
 if(input===undefined)input=JSON.parse(old?.data||'{}').attachments||[];
 if(!Array.isArray(input)||input.length>attachmentLimit)attachmentFail('São permitidos até 10 anexos por livro.');
 const ids=new Set<string>(),previous=JSON.parse(old?.data||'{}').attachments||[],out:Attachment[]=[];
 for(const a of input){if(!a||typeof a.id!=='string'||!/^[-a-f0-9]{36}$/.test(a.id)||ids.has(a.id)||typeof a.description!=='string'||a.description.length>300)attachmentFail('Anexo inválido ou repetido.');ids.add(a.id);
 const row=await db.prepare('SELECT * FROM livros.book_attachments WHERE id=? AND book_type=? AND service_date=?').bind(a.id,kind,date).first();
 if(!row||row.status!=='ready'||(row.owner_rg!==u.rg&&!previous.some((v:any)=>v.id===a.id)))attachmentFail('Anexo não pertence a este livro.',403);
 out.push({id:row.id,name:row.name,mime:row.mime,size:Number(row.size),sha256:row.sha256,preview:!!row.preview_id,description:a.description.trim()});}
 return out;
}
export async function accessibleAttachment(db:any,u:any,id:string){if(!/^[-a-f0-9]{36}$/.test(id))attachmentFail('Anexo não encontrado.',404);const a=await db.prepare('SELECT * FROM livros.book_attachments WHERE id=? AND status=?').bind(id,'ready').first();if(!a)attachmentFail('Anexo não encontrado.',404);const kind=attachmentKind(a.book_type);attachmentReadPolicy(u,kind);
 const [table,revisions]=bookTables[kind];const saved=await db.prepare(`SELECT 1 AS found FROM livros.${revisions} WHERE date=? AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(data::jsonb->'attachments','[]'::jsonb)) a WHERE a->>'id'=?) LIMIT 1`).bind(a.service_date,id).first();
 const book=await db.prepare(`SELECT author,data FROM livros.${table} WHERE date=?`).bind(a.service_date).first();const referenced=JSON.parse(book?.data||'{}').attachments?.some((v:any)=>v.id===id);
 if(!saved&&!referenced&&!(book?.author===u.rg&&a.owner_rg===u.rg))attachmentFail('Anexo não vinculado a um livro acessível.',403);return a;
}
