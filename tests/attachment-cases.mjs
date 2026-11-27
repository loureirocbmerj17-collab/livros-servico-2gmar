import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {PDFDocument,PDFName,PDFDict,PDFString,StandardFonts} from 'pdf-lib';
import {attachmentPath,attachmentKind} from '../.qa/attachment-model.mjs';
import {canonicalAttachments,accessibleAttachment,attachmentEditable,bookTables} from '../.qa/attachment-server.mjs';
import {makeMonthlyPdf} from '../.qa/monthly-pdf.mjs';
import {drawAttachments} from '../.qa/attachments-pdf.mjs';
const renders={officer:['pdf','makePdf'],nautica:['nautica-pdf','makeNauticalPdf'],ssmt:['ssmt-pdf','makeSsmtPdf'],supervisor:['supervisor-pdf','makeSupervisorPdf'],adjunto:['adjunto-pdf','makeAdjuntoPdf']};
function links(pdf){return pdf.getPages().flatMap(p=>{const a=p.node.Annots();return a?Array.from({length:a.size()},(_,i)=>{const d=pdf.context.lookup(a.get(i),PDFDict);const action=d.lookup(PDFName.of('A'),PDFDict);return action?.lookup(PDFName.of('URI'),PDFString)?.decodeText();}).filter(Boolean):[];});}
export async function run({sql}){
 const db=globalThis.testDb;
 assert.deepEqual(attachmentPath('2026-11-27','nautica'),['2026','11 - Novembro','Náutica','2026-11-27']);
 assert.throws(()=>attachmentPath('2026-02-30','ssmt'));assert.throws(()=>attachmentKind('__proto__'));
 for(const [kind,[table,revisions]]of Object.entries(bookTables)){
 const original=await db.prepare(`SELECT * FROM livros.${table} LIMIT 1`).first();assert.ok(original,kind);
 const owner={rg:original.author,role:kind==='officer'?'officer':'enlisted'};const id=randomUUID(),name='Relatório de teste.pdf';
 await db.prepare('INSERT INTO livros.book_attachments(id,book_type,service_date,owner_rg,name,mime,size,sha256,status,drive_id) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,kind,original.date,owner.rg,name,'application/pdf',99,'a'.repeat(64),'ready','drive-test').run();
 const input=[{id,description:'Comprovante do serviço',name:'FORGED',mime:'text/html',size:1,sha256:'forged',url:'https://evil.test'}];
 const canonical=await canonicalAttachments(db,owner,kind,original.date,input,original);assert.equal(canonical[0].name,name);assert.equal(canonical[0].mime,'application/pdf');assert.equal(canonical[0].url,undefined);assert.equal(canonical[0].size,99);
 await assert.rejects(()=>canonicalAttachments(db,{...owner,rg:'other'},kind,original.date,input,null));
 await assert.rejects(()=>canonicalAttachments(db,owner,kind,'2001-01-01',input,null));
 await assert.rejects(()=>canonicalAttachments(db,owner,kind,original.date,[...input,...input],original));
 await assert.rejects(()=>canonicalAttachments(db,owner,kind,original.date,[{...input[0],description:'a'.repeat(301)}],original));
 await assert.rejects(()=>attachmentEditable(db,owner,kind,original.date,-1));
 await assert.rejects(()=>attachmentEditable(db,{...owner,rg:'other'},kind,original.date,original.version,true));
 // Fresh independent synthetic book to verify attachment/history access and finalization locks.
 const day='2040-11-'+String(Object.keys(bookTables).indexOf(kind)+1).padStart(2,'0');const data={...JSON.parse(original.data),date:day,attachments:canonical};
 await db.prepare('UPDATE livros.book_attachments SET service_date=? WHERE id=?').bind(day,id).run();
 await db.prepare(`INSERT INTO livros.${table}(date,author,author_name,version,status,data,signature,review,actor,updated,pdf) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(day,owner.rg,original.author_name,1,'Rascunho',JSON.stringify(data),null,null,owner.rg,new Date().toISOString(),'').run();
 assert.ok(await attachmentEditable(db,owner,kind,day,1));
 assert.equal((await accessibleAttachment(db,owner,id)).id,id);
 if(kind==='officer')await assert.rejects(()=>accessibleAttachment(db,{rg:owner.rg,role:'enlisted'},id));
 const [module,fn]=renders[kind],render=(await import('../.qa/'+module+'.mjs'))[fn];
 const book={...original,date:day,data:JSON.stringify(data)};const bytes=Buffer.from(await render(book),'base64');const pdf=await PDFDocument.load(bytes);assert.ok(links(pdf).some(l=>l.endsWith('id='+id)),kind+' daily PDF link');
 const monthly=await PDFDocument.load(await makeMonthlyPdf('2040-11',[book],undefined,render));assert.ok(links(monthly).some(l=>l.endsWith('id='+id)),kind+' monthly PDF link');
 if(kind==='nautica')fs.writeFileSync('/tmp/attachments-nautica.pdf',bytes);
 // Removing from the current version keeps the old version accessible; no Drive deletion.
 delete data.attachments;await db.prepare(`UPDATE livros.${table} SET data=?,version=2 WHERE date=?`).bind(JSON.stringify(data),day).run();assert.equal((await accessibleAttachment(db,{rg:'other',role:'officer'},id)).id,id);
 const historical=await db.prepare(`SELECT * FROM livros.${revisions} WHERE date=? AND version=1`).bind(day).first();assert.ok(JSON.parse(historical.data).attachments.some(a=>a.id===id));
 assert.deepEqual(await canonicalAttachments(db,owner,kind,day,undefined,{data:historical.data}),canonical);
 await db.prepare(`UPDATE livros.${table} SET status='Assinado',version=3 WHERE date=?`).bind(day).run();await assert.rejects(()=>attachmentEditable(db,owner,kind,day,3));assert.ok(await attachmentEditable(db,owner,kind,day,3,true));
 await db.prepare(`UPDATE livros.${table} SET status='Conferido',review='{}',version=4 WHERE date=?`).bind(day).run();await assert.rejects(()=>attachmentEditable(db,owner,kind,day,4,true));
 }
 // Miniature layout and URI annotation with a simulated image, no Google network calls.
 const doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);let page=doc.addPage(),y=120,calls=0;
 const logo=(await import('../.qa/brand.mjs')).timaoPng;const png=await doc.embedPng(logo);assert.ok(png.width);
 await drawAttachments({doc,regular,bold,page:()=>page,y:()=>y,setY:v=>y=v,ensure:h=>{if(y+h>780){page=doc.addPage();y=110;}},section:()=>{}},{date:'2040-01-01',data:{attachments:[{id:randomUUID(),name:'Imagem.jpg',mime:'image/jpeg',size:100,description:'Prévia indisponível não impede o PDF.',preview:true}]}},'nautica',async()=>{calls++;throw Error('Drive indisponível');});assert.equal(calls,1);assert.equal(links(doc).length,1);
 console.log('PASS attachments: all five books, canonical metadata, ownership, profile/date isolation, review locks, retained history, daily/monthly clickable PDFs and unavailable thumbnail fallback.');
}
