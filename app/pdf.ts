import {PDFDocument,rgb,PDFPage,PDFFont} from 'pdf-lib';
import {roles,units,support} from './book-model';
import fontkit from '@pdf-lib/fontkit';
import * as fonts from './pdf-fonts';
import {timaoPng} from './brand';
import {readDrawing} from './handwriting';
const C={navy:rgb(.055,.16,.29),red:rgb(.73,.055,.11),gold:rgb(.94,.73,.12),ink:rgb(.10,.15,.22),muted:rgb(.36,.41,.47),line:rgb(.79,.82,.86),pale:rgb(.95,.96,.98),white:rgb(1,1,1)};
const W=595.28,H=841.89,M=36,CW=W-M*2;
const clean=(v:unknown)=>String(v??'').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[’]/g,"'").replace(/[^\x20-\x7E\xA0-\xFF\n]/g,' ').trim();
const value=(v:unknown)=>clean(v)||'Não informado';
const dateBR=(s:string)=>s?.split('-').reverse().join('/')||'-';
export async function makePdf(book:any){
 const d=typeof book.data==='string'?JSON.parse(book.data):book.data;
 const doc=await PDFDocument.create();doc.setTitle(`Livro do Oficial de Dia - ${dateBR(book.date)} - 2º GMAR`);doc.setAuthor('2º Grupamento Marítimo');doc.setSubject('Registro de serviço e passagem de operações');
 doc.registerFontkit(fontkit);
 const regular=await doc.embedFont(fonts.sans,{subset:true}),bold=await doc.embedFont(fonts.bold,{subset:true}),serif=await doc.embedFont(fonts.serif,{subset:true});
 const logo=await doc.embedPng(timaoPng);let page!:PDFPage;let y=0;
 function text(s:unknown,x:number,top:number,size=9,font:PDFFont=regular,color=C.ink){page.drawText(clean(s),{x,y:H-top-size,size,font,color});}
 function line(x:number,top:number,x2:number,color=C.line){page.drawLine({start:{x,y:H-top},end:{x:x2,y:H-top},thickness:.5,color});}
 function rect(x:number,top:number,w:number,h:number,color=C.white,border?:ReturnType<typeof rgb>){page.drawRectangle({x,y:H-top-h,width:w,height:h,color,...(border?{borderColor:border,borderWidth:.5}:{})});}
 function wrap(s:unknown,width:number,font:PDFFont=regular,size=9){const out:string[]=[];for(const paragraph of value(s).split('\n')){let row='';for(let word of paragraph.split(/\s+/)){while(font.widthOfTextAtSize(word,size)>width){if(row){out.push(row);row='';}let n=word.length;while(n>1&&font.widthOfTextAtSize(word.slice(0,n),size)>width)n--;out.push(word.slice(0,n));word=word.slice(n);}if(!word)continue;const next=row?row+' '+word:word;if(font.widthOfTextAtSize(next,size)>width){out.push(row);row=word;}else row=next;}out.push(row);}return out;}
 function newPage(subtitle:string){page=doc.addPage([W,H]);rect(M,24,CW,64,C.navy);rect(M,88,CW,3,C.gold);rect(M,91,95,3,C.red);rect(M+7,29,57,54);const dim=logo.scaleToFit(53,51);page.drawImage(logo,{x:M+9+(53-dim.width)/2,y:H-30-dim.height,width:dim.width,height:dim.height});text('CBMERJ  /  2º GRUPAMENTO MARÍTIMO',M+77,34,9,bold,C.white);text('LIVRO DO OFICIAL DE DIA',M+77,49,17,bold,C.white);text(subtitle,M+77,72,8,regular,C.white);y=107;}
 function ensure(h:number,label='Continuação do registro'){if(y+h>785)newPage(label);}
 function section(number:string,title:string){ensure(48);rect(M,y,4,22,C.red);rect(M+4,y,CW-4,22,C.pale);text(number,M+12,y+5,10,bold,C.red);text(title,M+Math.max(42,bold.widthOfTextAtSize(clean(number),10)+21),y+5,10,bold,C.navy);y+=28;}
 function table(headers:string[],rows:unknown[][],widths:number[],size=8.3){
 const head=()=>{rect(M,y,CW,22,C.navy);let x=M;headers.forEach((s,i)=>{text(s,x+7,y+6,7.6,bold,C.white);x+=widths[i];});y+=22;};ensure(50);head();
 rows.forEach((row,index)=>{const parts=row.map((s,i)=>wrap(s,widths[i]-14,regular,size));let offset=0;const count=Math.max(...parts.map(p=>p.length));while(offset<count){const remaining=Math.floor((785-y-12)/(size+3));if(remaining<1){newPage('Continuação da tabela');head();continue;}const take=Math.min(count-offset,remaining),rh=Math.max(24,take*(size+3)+12);if(y+rh>785){newPage('Continuação da tabela');head();continue;}let x=M;parts.forEach((p,i)=>{rect(x,y,widths[i],rh,index%2?C.white:C.pale,C.line);p.slice(offset,offset+take).forEach((s,j)=>text(s,x+7,y+6+j*(size+3),size));x+=widths[i];});y+=rh;offset+=take;}});y+=10;
 }
 function block(number:string,title:string,content:unknown,min=65){section(number,title);const lines=wrap(content,CW-22,serif,10.5);let at=0;while(at<lines.length){if(y+42>785)newPage(title+' - continuação');const available=Math.floor((785-y-16)/15);const chunk=lines.slice(at,at+available);const height=Math.max(at===0?Math.min(min,785-y):0,chunk.length*15+16);rect(M,y,CW,height,C.white,C.line);for(let i=0;i<Math.floor((height-10)/15);i++)line(M+10,y+18+i*15,M+CW-10,C.pale);chunk.forEach((s,i)=>text(s,M+11,y+8+i*15,10.5,serif));y+=height+12;at+=chunk.length;}}
 const total=(a:any[])=>!Array.isArray(a)||a.some(v=>v==='')?'Pendente':a.reduce((s,v)=>s+Number(v),0);
 newPage('Barra da Tijuca • Registro operacional e passagem de serviço');
 table(['SERVIÇO DO DIA','PARA O DIA','SITUAÇÃO / VERSÃO'],[[dateBR(book.date),dateBR(d.endDate),`${book.status} / v${book.version}`]],[CW*.30,CW*.30,CW*.40]);
 section('01','ALA DE SERVIÇO');
 const pair=[[0,6],[1,7],[2,8],[3,9],[4,10],[5,11],[12,13]];
 table(['FUNÇÃO','MILITAR DE SERVIÇO','FUNÇÃO','MILITAR DE SERVIÇO'],pair.map(([a,b])=>[roles[a],value(d.crew?.[a]),roles[b],value(d.crew?.[b])]),[90,CW/2-90,90,CW/2-90],7.8);
 section('02','ATIVAÇÃO / DESATIVAÇÃO DA PRAIA');
 table(['ATIVAÇÃO','DESATIVAÇÃO','CONDIÇÕES METEOROLÓGICAS'],[[value(d.activation),value(d.deactivation),value(d.weather)]],[100,100,CW-200]);
 section('03','APOIO OPERACIONAL');
 table(['ATIVADO NO SERVIÇO','INFORMAÇÃO','ATIVADO NO SERVIÇO','INFORMAÇÃO'],[['Mergulhadores',value(d.divers),'Motossocorristas',value(d.riders)]],[155,CW/2-155,155,CW/2-155],8);
 table(['APOIO NO SOCORRO','QTD.','APOIO NO SOCORRO','QTD.'],[0,1,2,3].map(i=>[support[i],value(d.support?.[i]),support[i+4],value(d.support?.[i+4])]),[CW/2-65,65,CW/2-65,65],8);
 // The statistical spread opens on its own page to keep the operational tables together.
 newPage('Estatísticas do serviço e alterações de pessoal');
 section('04–05','PREVENÇÕES E SOCORROS');
 table(['UNIDADE','PREVENÇÕES','SOCORROS'],[...units.map((u,i)=>[u,value(d.prevention?.[i]),value(d.rescues?.[i])]),['TOTAL',total(d.prevention),total(d.rescues)]],[CW-200,100,100]);
 section('06','POSTOS COM MAIORES QUANTITATIVOS');
 table(['INDICADOR','POSTO','QUANTIDADE'],[['Prevenções',value(d.topPrevention),value(d.topPreventionCount)],['Socorros',value(d.topRescue),value(d.topRescueCount)]],[95,CW-180,85]);
 block('07','ALTERAÇÕES DE PESSOAL',d.personnel,65);text('Licenciado • Dispensado • Preso • Detido',M+10,y-9,7,regular,C.muted);y+=6;
 block('08','FALTAS, ATRASOS E OBSERVAÇÕES',d.absences,65);
 newPage('Ordens em vigor, meios e ocorrências');
 block('09','ORDENS EM VIGOR',d.orders,40);
 block('10','ALTERAÇÕES COM VIATURAS',d.vehicles,40);
 block('11','ALTERAÇÕES COM EMBARCAÇÕES',d.boats,40);
 block('12','OCORRÊNCIAS',d.occurrences,50);
 block('13','OUTRAS OBSERVAÇÕES',d.notes,60);
 if(d.assignmentAudit)block('REGISTRO','RETIFICAÇÃO DE RESPONSABILIDADE',d.assignmentAudit,45);
 if(d.dependencySummary)block('CONTROLE','OUTROS LIVROS: SITUAÇÃO NA ASSINATURA DO AUTOR',d.dependencySummary,60);
 ensure(202+10*(wrap(book.signature||'Pendente.',CW-20,regular,7).length+wrap(book.review||'Pendente.',CW-20,regular,7).length),'Encerramento e assinaturas');section('VISTO','ENCERRAMENTO E ASSINATURAS');
 rect(M,y,CW,104,C.white,C.line);
 const drawing=book.signature?readDrawing(d.signatureDrawing):null;
 if(drawing){const scale=.4,x=M+(CW-600*scale)/2,top=y+2;for(const stroke of drawing.strokes)for(let i=1;i<stroke.length;i++)page.drawLine({start:{x:x+stroke[i-1][0]*scale,y:H-top-stroke[i-1][1]*scale},end:{x:x+stroke[i][0]*scale,y:H-top-stroke[i][1]*scale},thickness:1.15,color:C.ink});}
 else text(book.signature?'Assinatura manuscrita não coletada nesta versão.':'Aguardando assinatura manuscrita e confirmação por senha.',M+13,y+28,9,regular,C.muted);
 line(M+70,y+75,M+CW-70);const name=`${book.author_name} - RG ${book.author}`;text(name,M+(CW-bold.widthOfTextAtSize(clean(name),9))/2,y+80,9,bold);text('Oficial de Dia / Chefe de Operações do 2º GMAR',M+(CW-regular.widthOfTextAtSize('Oficial de Dia / Chefe de Operações do 2º GMAR',8))/2,y+94,8,regular,C.muted);y+=112;
 function proof(label:string,attestation:string|null){const lines=wrap(attestation||'Pendente.',CW-20,regular,7);ensure(22+lines.length*10);text(label,M+8,y,8,bold,C.navy);y+=13;lines.forEach(s=>{text(s,M+8,y,7,regular,C.muted);y+=10;});y+=8;}
 proof('ASSINATURA ELETRÔNICA DO AUTOR',book.signature);proof('CONFERÊNCIA DO SUBCOMANDANTE',book.review);
 ensure(20);text('A assinatura por senha e o resumo SHA-256 vinculam o registro à sua versão.',M+8,y,7,regular,C.muted);
 const pages=doc.getPages();pages.forEach((p,i)=>{page=p;line(M,804,W-M);text(`2º GMAR  |  Serviço ${dateBR(book.date)}  |  v${book.version}  |  ${book.status}`,M,813,7,regular,C.muted);text(`Folha ${String(i+1).padStart(2,'0')} de ${String(pages.length).padStart(2,'0')}`,W-M-62,813,7,bold,C.navy);});
 return doc.saveAsBase64();
}
