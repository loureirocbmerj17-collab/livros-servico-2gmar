export const attachmentKinds={officer:'Oficial de Dia',nautica:'Náutica',ssmt:'SSMT',supervisor:'Supervisor',adjunto:'Adjunto'};
export type AttachmentKind=keyof typeof attachmentKinds;
export type Attachment={id:string,name:string,mime:string,size:number,sha256:string,preview:boolean,description:string};
export const attachmentLimit=10,attachmentMaxBytes=3*1024*1024;
export function attachmentKind(v:unknown):AttachmentKind{if(typeof v!=='string'||!Object.hasOwn(attachmentKinds,v))throw Object.assign(Error('Livro inválido.'),{status:400});return v as AttachmentKind;}
export function attachmentPath(date:string,kind:AttachmentKind){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Object.assign(Error('Data inválida.'),{status:400});return [date.slice(0,4),date.slice(5,7)+' - '+['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][Number(date.slice(5,7))-1],attachmentKinds[kind],date];}
export function attachmentUrl(id:string,download=false,preview=false){return '/api/attachments/file?'+new URLSearchParams({id,...(download?{download:'1'}:{}),...(preview?{preview:'1'}:{})});}
