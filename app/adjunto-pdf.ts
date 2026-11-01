import {PDFDocument,rgb,PDFPage,PDFFont} from 'pdf-lib';

import fontkit from '@pdf-lib/fontkit';
import * as fonts from './pdf-fonts';
import {nauticalLogo as timaoPng} from './nautica-brand';
import {readDrawing} from './handwriting';
const C={navy:rgb(.055,.16,.29),red:rgb(.73,.055,.11),gold:rgb(.94,.73,.12),ink:rgb(.10,.15,.22),muted:rgb(.36,.41,.47),line:rgb(.79,.82,.86),pale:rgb(.95,.96,.98),white:rgb(1,1,1)};
const W=595.28,H=841.89,M=36,CW=W-M*2;
const clean=(v:unknown)=>String(v??'').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[’]/g,"'").replace(/[^\x20-\x7E\xA0-\xFF\n]/g,' ').trim();
const value=(v:unknown)=>clean(v)||'Não informado';
const dateBR=(s:string)=>s?.split('-').reverse().join('/')||'-';
export async function makeAdjuntoPdf(book:any){
 const d=typeof book.data==='string'?JSON.parse(book.data):book.data;
 const doc=await PDFDocument.create();doc.setTitle(`Livro do Adjunto - ${dateBR(book.date)} - 2º GMAR`);doc.setAuthor('2º Grupamento Marítimo');doc.setSubject('Registro de serviço e passagem de operações');
 doc.registerFontkit(fontkit);
 const regular=await doc.embedFont(fonts.sans,{subset:true}),bold=await doc.embedFont(fonts.bold,{subset:true}),serif=await doc.embedFont(fonts.serif,{subset:true});
 const logo=await doc.embedPng(timaoPng);let page!:PDFPage;let y=0;
 function text(s:unknown,x:number,top:number,size=9,font:PDFFont=regular,color=C.ink){page.drawText(clean(s),{x,y:H-top-size,size,font,color});}
 function line(x:number,top:number,x2:number,color=C.line){page.drawLine({start:{x,y:H-top},end:{x:x2,y:H-top},thickness:.5,color});}
 function rect(x:number,top:number,w:number,h:number,color=C.white,border?:ReturnType<typeof rgb>){page.drawRectangle({x,y:H-top-h,width:w,height:h,color,...(border?{borderColor:border,borderWidth:.5}:{})});}
 function wrap(s:unknown,width:number,font:PDFFont=regular,size=9){const out:string[]=[];for(const paragraph of value(s).split('\n')){let row='';for(let word of paragraph.split(/\s+/)){while(font.widthOfTextAtSize(word,size)>width){if(row){out.push(row);row='';}let n=word.length;while(n>1&&font.widthOfTextAtSize(word.slice(0,n),size)>width)n--;out.push(word.slice(0,n));word=word.slice(n);}if(!word)continue;const next=row?row+' '+word:word;if(font.widthOfTextAtSize(next,size)>width){out.push(row);row=word;}else row=next;}out.push(row);}return out;}
 function newPage(subtitle:string){page=doc.addPage([W,H]);rect(M,24,CW,64,C.navy);rect(M,88,CW,3,C.gold);rect(M,91,95,3,C.red);rect(M+7,29,57,54);const dim=logo.scaleToFit(53,51);page.drawImage(logo,{x:M+9+(53-dim.width)/2,y:H-30-dim.height,width:dim.width,height:dim.height});text('CBMERJ  /  2º GRUPAMENTO MARÍTIMO',M+77,34,9,bold,C.white);text('LIVRO DO ADJUNTO',M+77,49,17,bold,C.white);text(subtitle,M+77,72,8,regular,C.white);y=107;}
 function ensure(h:number,label='Continuação do registro'){if(y+h>785)newPage(label);}
 function section(number:string,title:string){ensure(85);rect(M,y,4,22,C.red);rect(M+4,y,CW-4,22,C.pale);text(number,M+12,y+5,10,bold,C.red);text(title,M+Math.max(42,bold.widthOfTextAtSize(clean(number),10)+21),y+5,10,bold,C.navy);y+=28;}
 function table(headers:string[],rows:unknown[][],widths:number[],size=8.3){
 const head=()=>{rect(M,y,CW,22,C.navy);let x=M;headers.forEach((s,i)=>{text(s,x+7,y+6,7.6,bold,C.white);x+=widths[i];});y+=22;};ensure(50);head();
 rows.forEach((row,index)=>{const parts=row.map((s,i)=>wrap(s,widths[i]-14,regular,size));let offset=0;const count=Math.max(...parts.map(p=>p.length));while(offset<count){const remaining=Math.floor((785-y-12)/(size+3));if(remaining<1){newPage('Continuação da tabela');head();continue;}const take=Math.min(count-offset,remaining),rh=Math.max(24,take*(size+3)+12);if(y+rh>785){newPage('Continuação da tabela');head();continue;}let x=M;parts.forEach((p,i)=>{rect(x,y,widths[i],rh,index%2?C.white:C.pale,C.line);p.slice(offset,offset+take).forEach((s,j)=>text(s,x+7,y+6+j*(size+3),size));x+=widths[i];});y+=rh;offset+=take;}});y+=10;
 }
 function block(number:string,title:string,content:unknown,min=65){section(number,title);const lines=wrap(content,CW-22,serif,10.5);let at=0;while(at<lines.length){if(y+42>785)newPage(title+' - continuação');const available=Math.floor((785-y-16)/15);const chunk=lines.slice(at,at+available);const height=Math.max(at===0?Math.min(min,785-y):0,chunk.length*15+16);rect(M,y,CW,height,C.white,C.line);for(let i=0;i<Math.floor((height-10)/15);i++)line(M+10,y+18+i*15,M+CW-10,C.pale);chunk.forEach((s,i)=>text(s,M+11,y+8+i*15,10.5,serif));y+=height+12;at+=chunk.length;}}
 const person=(rg:string)=>rg?(d.personnel?.find((p:any)=>p.rg===rg)?.name||'Militar')+' / RG '+rg:'Não informado';
 newPage('Barra da Tijuca | Serviço de praia');
 table(['SERVIÇO','PASSAGEM','SITUAÇÃO / VERSÃO'],[[dateBR(book.date),dateBR(d.endDate),`${book.status} / v${book.version}`]],[160,160,CW-320]);
 block('SERVIÇO','RESPONSÁVEIS','Adjunto: '+person(d.responsible)+'\nOficial de Dia: '+person(d.officerRg),35);
 section('01','ALA DE SERVIÇO');table(['FUNÇÃO','MILITAR / RG'],d.serviceCrew.map((r:any)=>[r.role,r.military||'Não informado']),[180,CW-180]);
 section('02','SITUAÇÃO DA OBM NA ASSUNÇÃO');table(['QUESITO','SIM / NÃO','OBSERVAÇÕES'],d.obm.map((r:any)=>[r.question,r.answer,r.note||'-']),[220,65,CW-285]);
 section('03','CONDIÇÕES METEOROLÓGICAS');table(['PERÍODO','ONDAS / CORRENTE','VENTO / AMBIENTE / ÁGUA'],d.weather.map((w:any)=>[w.period,w.wave+' m / '+w.current,w.wind+' / '+w.air+' °C / '+w.water+' °C']),[100,190,CW-290]);
 block('FONTE','CONFERÊNCIA DA PREVISÃO',(d.weatherStatus||'Pendente')+' | '+d.weatherNote+'\n'+(d.forecastSource?[d.forecastSource.atmosphere,d.forecastSource.waves,d.forecastSource.queriedAt].filter(Boolean).join(' | '):'Preenchimento manual.'),35);
 section('04','ATIVAÇÃO DA PRAIA');table(['TOTAL DE GVs','PARCIAL'],[[d.activation.total,d.activation.partial]],[CW/2,CW/2]);
 section('05','ATRASOS E FALTAS');table(['ATRASO: MILITAR / RG','APRESENTAÇÃO / MOTIVO'],d.late.length?d.late.map((r:any)=>[person(r.rg),r.time+' / '+r.reason]):[['Sem alterações','-']],[250,CW-250]);table(['FALTAS: MILITAR / RG'],d.absent.length?d.absent.map((r:any)=>[person(r.rg)]):[['Sem alterações']],[CW]);
 section('06','ARRANCHAMENTO — TODO O EFETIVO');table(['REFEIÇÃO','QUANT. / HORÁRIO','OBSERVAÇÕES'],d.rations.map((r:any)=>[r.meal,r.quantity+' / '+(r.time||'-'),r.note]),[110,120,CW-230]);
 section('07','MILITARES DO EXPEDIENTE');table(['MILITAR','SEÇÃO'],d.office.length?d.office.map((r:any)=>[r.military,r.section]):[[d.noOffice?'Não houve':'Pendente','-']],[300,CW-300]);
 section('08','ESTATÍSTICAS DO 2º GMAR');table(['PREVENÇÕES','SOCORROS','ÓBITOS'],[[d.stats.preventions,d.stats.rescues,d.stats.deaths]],[CW/3,CW/3,CW/3]);
 section('09','PERMUTAS');table(['FUNÇÃO / HORÁRIO','SAÍDA / ENTRADA / MOTIVO'],d.swaps.length?d.swaps.map((r:any)=>[r.function+' / '+r.time,'Sai: '+person(r.outgoing)+'\nEntra: '+person(r.incoming)+'\n'+r.reason]):[['Não houve','-']],[170,CW-170]);
 block('10','OBSERVAÇÕES / ALTERAÇÕES NO SERVIÇO',d.observations,80);
 if(d.scaleSource)block('ESCALA','ORIGEM DA ESCALA',[d.scaleSource.name,d.scaleSource.url,'Consulta: '+d.scaleSource.checkedAt].filter(Boolean).join('\n'),35);
 if(d.assignmentAudit)block('AUDIT','RETIFICAÇÃO DA RESPONSABILIDADE',d.assignmentAudit,40);
 const review=book.review?JSON.parse(book.review):null;
 if(review?.assignmentAudit)block('AUDIT','RETIFICAÇÃO DO OFICIAL DE DIA',review.assignmentAudit,40);
 ensure(330,'Assinaturas e encerramento');section('11','ASSINATURAS E CONFERÊNCIA');
 function signature(title:string,name:string,raw:string,proof:string){ensure(150,'Assinaturas e encerramento');text(title,M,y,10,bold,C.navy);y+=20;const drawing=readDrawing(raw);if(drawing){const scale=.30,x=M+165,top=y;for(const s of drawing.strokes)for(let i=1;i<s.length;i++)page.drawLine({start:{x:x+s[i-1][0]*scale,y:H-top-s[i-1][1]*scale},end:{x:x+s[i][0]*scale,y:H-top-s[i][1]*scale},thickness:1.1,color:C.ink});}else text('Assinatura pendente.',M+15,y+20,9,regular,C.muted);y+=58;line(M+50,y,M+CW-50);y+=6;for(const s of wrap(name,CW,regular,9)){text(s,M,y,9,bold);y+=12;}for(const s of wrap(proof||'Confirmação por senha pendente.',CW,regular,7)){ensure(12);text(s,M,y,7,regular,C.muted);y+=10;}y+=18;}
 signature('MILITAR RESPONSÁVEL',book.author_name+' / RG '+book.author,book.signature?d.signatureDrawing:'',book.signature);

 signature('VISTO DO OFICIAL DE DIA',review?.rg?review.name+' / RG '+review.rg:'Oficial de Dia do respectivo serviço',review?.drawing||'',review?.attestation||'');
 const pages=doc.getPages();pages.forEach((p,i)=>{page=p;line(M,804,W-M);text(`2º GMAR | Adjunto | ${dateBR(book.date)} | v${book.version} | ${book.status}`,M,813,7,regular,C.muted);text(`Folha ${i+1} de ${pages.length}`,W-M-62,813,7,bold,C.navy);});return doc.saveAsBase64();
}
