import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fonts from './pdf-fonts';
import {timaoPng} from './brand';
export async function makeMonthlyPdf(month:string,books:any[],title="LIVRO DO OFICIAL DE DIA"){
 if(!books.length||books.length>31)throw new Error('Quantidade de livros inválida para o mês.');
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const font=await doc.embedFont(fonts.sans,{subset:true}),bold=await doc.embedFont(fonts.bold,{subset:true}),logo=await doc.embedPng(timaoPng);
 const page=doc.addPage([595.28,841.89]),navy=rgb(.055,.16,.29),grey=rgb(.35,.4,.46);
 const clean=(s:string)=>s.replace(/[^\x20-\x7e\xa0-\xff]/g,' ');
 const text=(s:string,x:number,y:number,size=10,strong=false)=>page.drawText(clean(s),{x,y,size,font:strong?bold:font,color:navy});
 page.drawRectangle({x:36,y:720,width:523,height:90,color:navy});page.drawRectangle({x:36,y:715,width:523,height:4,color:rgb(.94,.73,.12)});const dim=logo.scaleToFit(64,64);page.drawImage(logo,{x:48,y:733,...dim});
 page.drawText('2º GMAR | '+title,{x:130,y:777,size:13,font:bold,color:rgb(1,1,1)});page.drawText('VOLUME MENSAL - '+month.split('-').reverse().join('/'),{x:130,y:750,size:15,font:bold,color:rgb(1,1,1)});
 text('Índice dos serviços',36,687,16,true);text('Últimas versões salvas, com assinaturas e situação original.',36,667,10);
 const days=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();const missing=Array.from({length:days},(_,i)=>String(i+1).padStart(2,'0')).filter(d=>!books.some(b=>b.date===month+'-'+d));
 text('Dias sem livro: '+(missing.join(', ')||'nenhum'),36,647,8);
 text('DIA',36,621,9,true);text('RESPONSÁVEL',92,621,9,true);text('SITUAÇÃO / VERSÃO',340,621,9,true);text('PÁGINA',505,621,9,true);
 let y=603,total=0;
 for(const book of books){total+=book.pdf.length;if(total>45*1024*1024)throw new Error('Volume mensal muito grande. Baixe os PDFs diários.');const pdf=await PDFDocument.load(book.pdf);const first=doc.getPageCount()+1;const pages=await doc.copyPages(pdf,pdf.getPageIndices());pages.forEach(p=>doc.addPage(p));text(book.date.slice(8)+'/'+month.slice(5),36,y,9);let name=clean(book.author_name);while(font.widthOfTextAtSize(name,8)>230)name=name.slice(0,-1);text(name,92,y,8);text(`${book.status} / v${book.version}`,340,y,9);text(String(first),515,y,9);page.drawLine({start:{x:36,y:y-5},end:{x:559,y:y-5},thickness:.3,color:rgb(.8,.83,.86)});y-=16;}
 text('Este volume inclui rascunhos e livros pendentes, quando existentes.',36,77,9);text('A exportação não substitui a assinatura nem a conferência dos livros.',36,61,9);page.drawText('Gerado em '+new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),{x:36,y:40,size:8,font,color:grey});doc.setTitle(title+' - '+month+' - 2º GMAR');doc.setAuthor('2º Grupamento Marítimo');return doc.save();
}
