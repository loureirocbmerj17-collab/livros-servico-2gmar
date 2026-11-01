'use client';
import {useRef,useEffect,useState} from 'react';
import {readDrawing} from './handwriting';
import {imageToStrokes} from './signature-import';
// Lê a imagem escolhida (galeria, câmera ou arquivo) e devolve os pixels, reduzida para no máximo 1600 px.
async function filePixels(file:File){
 if(!file.type.startsWith('image/'))throw Error('Escolha um arquivo de imagem (PNG ou JPG).');
 if(file.size>15*1024*1024)throw Error('Imagem acima de 15 MB. Use uma foto menor ou recortada.');
 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise<HTMLImageElement>((ok,bad)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>bad(Error('Não foi possível abrir esta imagem. Use PNG ou JPG.'));i.src=url;});
  const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');if(!ctx)throw Error('Navegador sem suporte à leitura de imagens.');
  ctx.drawImage(img,0,0,w,h);return ctx.getImageData(0,0,w,h);
 }finally{URL.revokeObjectURL(url);}
}
export default function SignaturePad({onChange,disabled=false}:{onChange:(s:string)=>void,disabled?:boolean}){
 const ref=useRef<HTMLCanvasElement>(null),strokes=useRef<number[][][]>([]),active=useRef<number|null>(null);const [hasInk,setHasInk]=useState(false),[importNote,setImportNote]=useState(''),[importing,setImporting]=useState(false);const fileRef=useRef<HTMLInputElement>(null);
 async function importImage(file?:File){if(!file)return;setImporting(true);setImportNote('');try{strokes.current=imageToStrokes(await filePixels(file));finish();setImportNote('Assinatura importada. Confira o desenho abaixo antes de confirmar; se não ficar bom, limpe e desenhe com o dedo.');}catch(e:any){setImportNote(e?.message||'Não foi possível importar a imagem.');}finally{setImporting(false);if(fileRef.current)fileRef.current.value='';}}
 function paint(){const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,600,180);ctx.lineWidth=2.4;ctx.strokeStyle='#111827';ctx.lineCap='round';ctx.lineJoin='round';for(const s of strokes.current){ctx.beginPath();s.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}}
 function point(e:React.PointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect();return [Math.round(Math.max(0,Math.min(600,(e.clientX-r.left)*600/r.width))*10)/10,Math.round(Math.max(0,Math.min(180,(e.clientY-r.top)*180/r.height))*10)/10];}
 function finish(){active.current=null;strokes.current=strokes.current.filter(s=>s.length>1);const raw=JSON.stringify({width:600,height:180,strokes:strokes.current});onChange(readDrawing(raw)?raw:'');setHasInk(strokes.current.length>0);paint();}
 useEffect(()=>{paint();},[]);
 return <div className="signature-pad"><label>Assinatura manuscrita</label><p>Assine com o dedo ou mouse no espaço abaixo, ou importe uma imagem da sua assinatura salva no computador ou no telefone.</p><canvas ref={ref} width={600} height={180} aria-label="Área para desenhar sua assinatura" style={{touchAction:'none'}} onPointerDown={e=>{if(disabled||active.current!==null||strokes.current.length>=100)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);active.current=e.pointerId;strokes.current.push([point(e)]);}} onPointerMove={e=>{if(disabled||active.current!==e.pointerId)return;if(strokes.current.reduce((n,s)=>n+s.length,0)>=4000)return;strokes.current.at(-1)!.push(point(e));setHasInk(true);paint();}} onPointerUp={e=>{if(active.current===e.pointerId)finish();}} onPointerCancel={e=>{if(active.current===e.pointerId)finish();}}/><div className="signature-actions"><button type="button" disabled={disabled||!hasInk} onClick={()=>{strokes.current=[];setHasInk(false);setImportNote('');paint();onChange('');}}>Limpar assinatura</button><button type="button" disabled={disabled||importing} onClick={()=>fileRef.current?.click()}>{importing?'Importando…':'Importar assinatura (imagem)'}</button><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/*" hidden style={{display:'none'}} aria-label="Arquivo de imagem da assinatura" onChange={e=>importImage(e.target.files?.[0])}/></div>{importNote&&<p role="status" className="signature-import-note">{importNote}</p>}<p className="signature-import-tip">Para importar, use foto ou arquivo com a assinatura em tinta escura sobre fundo claro, de preferência recortada.</p></div>;
}
export function SignaturePreview({raw}:{raw:string}){const d=readDrawing(raw);if(!d)return null;return <figure className="signature-preview"><svg viewBox="0 0 600 180" role="img" aria-label="Assinatura manuscrita registrada">{d.strokes.map((s,i)=><polyline key={i} points={s.map(p=>p.join(',')).join(' ')} fill="none" stroke="#111827" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>)}</svg><figcaption>Assinatura manuscrita registrada nesta versão</figcaption></figure>}
