// Importação de assinatura a partir de imagem (foto, digitalização ou PNG).
// A imagem é convertida, no navegador, para o mesmo formato vetorial da assinatura desenhada
// ({width:600,height:180,strokes}), de modo que servidor, histórico e PDFs continuam iguais.
import {readDrawing} from './handwriting';

export type Pixels={width:number,height:number,data:Uint8ClampedArray|Uint8Array|number[]};
const W=600,H=180,MARGIN=8,MAX_STROKES=100,MAX_POINTS=4000,MAX_RAW=95000;

// Limiar de Otsu sobre a luminância dos pixels visíveis; a tinta é a parte mais escura.
function inkMask(img:Pixels){
 const {width,height,data}=img,n=width*height,lum=new Uint8Array(n),opaque=new Uint8Array(n),hist=new Array(256).fill(0);let count=0;
 for(let i=0;i<n;i++){const a=data[i*4+3];if(a<40)continue;const l=Math.round(0.299*data[i*4]+0.587*data[i*4+1]+0.114*data[i*4+2]);lum[i]=l;opaque[i]=1;hist[l]++;count++;}
 if(!count)throw Error('A imagem está vazia ou transparente.');
 let sum=0;for(let t=0;t<256;t++)sum+=t*hist[t];let sumB=0,wB=0,best=0,threshold=127;
 for(let t=0;t<256;t++){wB+=hist[t];if(!wB)continue;const wF=count-wB;if(!wF)break;sumB+=t*hist[t];const mB=sumB/wB,mF=(sum-sumB)/wF,between=(wB/count)*(wF/count)*(mB-mF)**2;if(between>best){best=between;threshold=t;}}
 // Imagem quase uniforme (sem contraste) ou com fundo transparente e traço opaco.
 const transparentBackground=count<n*0.9;
 const limit=transparentBackground?255:Math.min(threshold,200);
 const mask=new Uint8Array(n);let ink=0;for(let i=0;i<n;i++)if(opaque[i]&&(transparentBackground||lum[i]<=limit)){mask[i]=1;ink++;}
 if(!transparentBackground&&best<20)throw Error('Não foi possível separar a assinatura do fundo. Use fundo claro e traço escuro.');
 if(ink<20)throw Error('Nenhum traço de assinatura encontrado na imagem.');
 if(ink>n*0.5)throw Error('A imagem tem tinta demais para ser uma assinatura. Recorte apenas a assinatura, com fundo claro.');
 return mask;
}

// Reduz para a área útil de 600×180, preservando proporção e centralizando.
function fitGrid(mask:Uint8Array,width:number,height:number){
 let x0=width,y0=height,x1=-1,y1=-1;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 const bw=x1-x0+1,bh=y1-y0+1,scale=Math.min((W-2*MARGIN)/bw,(H-2*MARGIN)/bh);
 const gw=Math.max(1,Math.round(bw*scale)),gh=Math.max(1,Math.round(bh*scale)),ox=Math.round((W-gw)/2),oy=Math.round((H-gh)/2);
 const grid=new Uint8Array(gw*gh);
 for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){
  const sx0=x0+Math.floor(gx/scale),sx1=Math.max(sx0+1,x0+Math.floor((gx+1)/scale)),sy0=y0+Math.floor(gy/scale),sy1=Math.max(sy0+1,y0+Math.floor((gy+1)/scale));
  let on=0,all=0;for(let y=sy0;y<Math.min(sy1,y0+bh);y++)for(let x=sx0;x<Math.min(sx1,x0+bw);x++){all++;on+=mask[y*width+x];}
  grid[gy*gw+gx]=all&&on/all>=0.3?1:0;
 }
 return {grid,gw,gh,ox,oy};
}

// Remove sujeiras isoladas (componentes muito pequenos).
function despeckle(g:Uint8Array,w:number,h:number,min=4){
 const seen=new Uint8Array(g.length),kept:number[][]=[];
 for(let i=0;i<g.length;i++){if(!g[i]||seen[i])continue;const stack=[i],comp:number[]=[];seen[i]=1;
  while(stack.length){const p=stack.pop()!;comp.push(p);const x=p%w,y=(p-x)/w;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const q=ny*w+nx;if(g[q]&&!seen[q]){seen[q]=1;stack.push(q);}}}
  if(comp.length<min)for(const p of comp)g[p]=0;else kept.push(comp);}
 return kept;
}

// Afinamento de Zhang-Suen: deixa o traço com 1 pixel de largura.
function thin(g:Uint8Array,w:number,h:number){
 const at=(x:number,y:number)=>x<0||y<0||x>=w||y>=h?0:g[y*w+x];let changed=true;
 while(changed){changed=false;for(const step of [0,1]){const del:number[]=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!g[y*w+x])continue;
   const p=[at(x,y-1),at(x+1,y-1),at(x+1,y),at(x+1,y+1),at(x,y+1),at(x-1,y+1),at(x-1,y),at(x-1,y-1)];
   const b=p.reduce((s,v)=>s+v,0);if(b<2||b>6)continue;let a=0;for(let k=0;k<8;k++)if(!p[k]&&p[(k+1)%8])a++;if(a!==1)continue;
   if(step===0?(p[0]*p[2]*p[4]===0&&p[2]*p[4]*p[6]===0):(p[0]*p[2]*p[6]===0&&p[0]*p[4]*p[6]===0))del.push(y*w+x);}
  if(del.length){changed=true;for(const i of del)g[i]=0;}}}
}

// Percorre o esqueleto: começa pelas pontas e segue o vizinho mais alinhado com a direção atual.
function trace(g:Uint8Array,w:number,h:number){
 const seen=new Uint8Array(g.length),nb=(i:number)=>{const x=i%w,y=(i-x)/w,out:number[]=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<w&&ny<h&&g[ny*w+nx])out.push(ny*w+nx);}return out;};
 const xy=(i:number)=>[i%w,(i-i%w)/w],lines:number[][]=[];
 const walk=(start:number)=>{const line=[start];seen[start]=1;let cur=start,dir:[number,number]|null=null;
  while(true){const [cx,cy]=xy(cur);const next=nb(cur).filter(q=>!seen[q]);if(!next.length)break;
   next.sort((a,b)=>{const score=(q:number)=>{const [qx,qy]=xy(q),vx=qx-cx,vy=qy-cy,len=Math.hypot(vx,vy);return (dir?-(vx*dir[0]+vy*dir[1])/len:0)+len*0.01;};return score(a)-score(b);});
   const q=next[0],[qx,qy]=xy(q);const v:[number,number]=[qx-cx,qy-cy],l=Math.hypot(v[0],v[1]);dir=dir?[dir[0]*0.6+v[0]/l*0.4,dir[1]*0.6+v[1]/l*0.4]:[v[0]/l,v[1]/l];
   // marca vizinhos laterais já cobertos para evitar "pelos" de 1 pixel
   for(const r of next)if(r!==q&&nb(r).every(z=>z===cur||z===q||seen[z]))seen[r]=1;
   seen[q]=1;line.push(q);cur=q;}
  lines.push(line);};
 const pixels:number[]=[];for(let i=0;i<g.length;i++)if(g[i])pixels.push(i);
 for(const i of pixels)if(!seen[i]&&nb(i).length<=1)walk(i);
 for(const i of pixels)if(!seen[i])walk(i);
 // Emenda pontas separadas por até 2 pixels (falhas do afinamento).
 const pts=lines.map(l=>l.map(xy));const joined:number[][][]=[];
 for(const l of pts){const prev=joined.find(j=>{const e=j[j.length-1];return Math.hypot(e[0]-l[0][0],e[1]-l[0][1])<=2.9;});if(prev)prev.push(...l);else joined.push(l);}
 return joined;
}

function simplify(pts:number[][],eps:number):number[][]{
 if(pts.length<3)return pts;const [ax,ay]=pts[0],[bx,by]=pts[pts.length-1],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1;let max=0,idx=0;
 for(let i=1;i<pts.length-1;i++){const d=Math.abs(dy*pts[i][0]-dx*pts[i][1]+bx*ay-by*ax)/len;if(d>max){max=d;idx=i;}}
 return max>eps?[...simplify(pts.slice(0,idx+1),eps).slice(0,-1),...simplify(pts.slice(idx),eps)]:[pts[0],pts[pts.length-1]];
}
const strokeLength=(s:number[][])=>s.reduce((n,p,i)=>i?n+Math.hypot(p[0]-s[i-1][0],p[1]-s[i-1][1]):0,0);

export function imageToStrokes(img:Pixels):number[][][]{
 const mask=inkMask(img);const {grid,gw,gh,ox,oy}=fitGrid(mask,img.width,img.height);
 const parts=despeckle(grid,gw,gh);thin(grid,gw,gh);
 // O afinamento pode apagar pingos pequenos (ex.: pingo do i): recoloca um ponto no centro deles.
 const dots=parts.filter(c=>!c.some(p=>grid[p])).map(c=>{const cx=c.reduce((n,p)=>n+p%gw,0)/c.length,cy=c.reduce((n,p)=>n+Math.floor(p/gw),0)/c.length;return [[ox+cx-1,oy+cy+0.5],[ox+cx+2,oy+cy+0.5]];});
 // Linhas curtas: isoladas são pingos (viram um ponto visível); grudadas em outro traço são sobras do afinamento.
 const lines=trace(grid,gw,gh),long=new Set<string>();for(const l of lines)if(l.length>=6)for(const [x,y] of l)long.add(x+','+y);
 const touches=(l:number[][])=>l.some(([x,y])=>{for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(long.has((x+dx)+','+(y+dy)))return true;return false;});
 const traced=lines.flatMap(l=>{if(l.length>=6)return [l.map(([x,y])=>[ox+x+0.5,oy+y+0.5])];if(touches(l))return [];const cx=l.reduce((n,p)=>n+p[0],0)/l.length,cy=l.reduce((n,p)=>n+p[1],0)/l.length;return [[[ox+cx-1,oy+cy+0.5],[ox+cx+2,oy+cy+0.5]]];});
 const raw=[...dots,...traced];
 for(let eps=0.6;eps<=6;eps*=1.5){
  let strokes=raw.map(s=>simplify(s,eps).map(([x,y])=>[Math.round(Math.min(W,Math.max(0,x))*10)/10,Math.round(Math.min(H,Math.max(0,y))*10)/10])).filter(s=>s.length>1&&strokeLength(s)>=1.5);
  if(strokes.length>MAX_STROKES)strokes=[...strokes].sort((a,b)=>strokeLength(b)-strokeLength(a)).slice(0,MAX_STROKES);
  const points=strokes.reduce((n,s)=>n+s.length,0),json=JSON.stringify({width:W,height:H,strokes});
  if(points<=MAX_POINTS&&json.length<=MAX_RAW){if(!readDrawing(json))throw Error('A assinatura da imagem é pequena ou simples demais. Desenhe no campo ou use outra imagem.');return strokes;}
 }
 throw Error('A imagem é detalhada demais para virar assinatura. Recorte somente a assinatura e tente novamente.');
}
