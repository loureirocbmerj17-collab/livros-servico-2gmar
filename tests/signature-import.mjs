// Importação de assinatura por imagem: a conversão gera traços aceitos pelo mesmo validador do servidor.
import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
fs.mkdirSync('.qa',{recursive:true});
for(const n of ['handwriting','signature-import']){const out=ts.transpileModule(fs.readFileSync('app/'+n+'.ts','utf8'),{fileName:n+'.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}});assert.deepEqual(out.diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[],'erro de sintaxe em '+n);fs.writeFileSync('.qa/'+n+'.mjs',out.outputText.replace(/from '\.\/([^']+)'/g,"from './$1.mjs'"));}
const {imageToStrokes}=await import('../.qa/signature-import.mjs');const {readDrawing}=await import('../.qa/handwriting.mjs');

// Imagem RGBA sintética com caneta circular; "bg" define fundo (RGB ou transparente).
function canvas(w,h,bg){const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){d.set(bg,i*4);}return {width:w,height:h,data:d};}
function pen(img,x,y,r,rgba){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r)continue;const px=Math.round(x+dx),py=Math.round(y+dy);if(px<0||py<0||px>=img.width||py>=img.height)continue;img.data.set(rgba,(py*img.width+px)*4);}}
function signature(img,r,rgba){// laçadas cursivas + traço final + ponto
 for(let t=0;t<=1;t+=0.0007){const x=60+t*560,y=150+55*Math.sin(t*18)+25*Math.cos(t*43);pen(img,x,y,r,rgba);}
 for(let t=0;t<=1;t+=0.002)pen(img,120+t*480,235+8*Math.sin(t*6),r,rgba);
 pen(img,650,80,r+2,rgba);}
const valid=(strokes)=>{const raw=JSON.stringify({width:600,height:180,strokes});assert.ok(readDrawing(raw),'traços devem passar no validador do servidor');assert.ok(raw.length<=95000);assert.ok(strokes.reduce((n,s)=>n+s.length,0)<=4000);assert.ok(strokes.length<=100);for(const s of strokes)for(const [x,y] of s){assert.ok(x>=0&&x<=600&&y>=0&&y<=180);}return raw;};
const span=(strokes)=>{const xs=strokes.flat().map(p=>p[0]),ys=strokes.flat().map(p=>p[1]);return [Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)];};

// 1. Foto: fundo branco com ruído leve e tinta azul-escura espessa.
let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
const photo=canvas(800,320,[245,243,238,255]);for(let i=0;i<photo.width*photo.height;i++){const n=Math.round((rnd()-0.5)*14);for(let c=0;c<3;c++)photo.data[i*4+c]=Math.max(0,Math.min(255,photo.data[i*4+c]+n));}
signature(photo,4,[25,35,90,255]);
const a=imageToStrokes(photo);valid(a);const [sw,sh]=span(a);assert.ok(sw>500&&sh>120,'assinatura deve ocupar o campo: '+sw+'x'+sh);
fs.writeFileSync('.qa/signature-photo.json',JSON.stringify(a));

// 2. PNG com fundo transparente e traço preto fino.
const png=canvas(900,300,[0,0,0,0]);signature(png,2,[0,0,0,255]);valid(imageToStrokes(png));

// 3. Recusas com mensagem clara.
assert.throws(()=>imageToStrokes(canvas(400,200,[255,255,255,255])),/separar|Nenhum traço/);
assert.throws(()=>imageToStrokes(canvas(400,200,[0,0,0,0])),/vazia/);
const gray=canvas(300,120,[128,128,128,255]);for(let i=0;i<gray.width*gray.height;i++)gray.data[i*4]=128+Math.round((rnd()-0.5)*6);assert.throws(()=>imageToStrokes(gray),/separar/);
const dark=canvas(300,120,[20,20,20,255]);for(let x=0;x<300;x+=10)pen(dark,x,60,3,[250,250,250,255]);assert.throws(()=>imageToStrokes(dark),/tinta demais/);

// 4. Rabisco muito denso: ou vira assinatura válida dentro dos limites, ou é recusado — nunca dado inválido.
const dense=canvas(1200,400,[255,255,255,255]);for(let k=0;k<400;k++){const x=rnd()*1150+25,y=rnd()*350+25,l=rnd()*40;for(let t=0;t<l;t++)pen(dense,x+t,y+Math.sin(t)*5,1,[0,0,0,255]);}
try{valid(imageToStrokes(dense));}catch(e){assert.match(e.message,/detalhada demais|tinta demais|separar/);}

// 5. Campo de assinatura: botão de importação e seletor de imagem presentes; bloqueados quando o campo está desabilitado.
{const React=(await import('react')).default;const {create,act}=await import('react-test-renderer');globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const out=ts.transpileModule(fs.readFileSync('app/signature-pad.tsx','utf8'),{fileName:'signature-pad.tsx',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
 assert.deepEqual(out.diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[],'erro de sintaxe em signature-pad');fs.writeFileSync('.qa/signature-pad.mjs',out.outputText.replace(/from '\.\/([^']+)'/g,"from './$1.mjs'"));
 const {default:SignaturePad}=await import('../.qa/signature-pad.mjs');
 for(const disabled of [false,true]){let root;await act(()=>{root=create(React.createElement(SignaturePad,{onChange:()=>{},disabled}),{createNodeMock:()=>({getContext:()=>null,getBoundingClientRect:()=>({left:0,top:0,width:600,height:180})})});});
  const button=root.root.findAll(n=>n.type==='button'&&JSON.stringify(n.props.children).includes('Importar assinatura'))[0];assert.ok(button,'botão de importação');assert.equal(button.props.disabled,disabled);
  const input=root.root.find(n=>n.type==='input'&&n.props.type==='file');assert.match(input.props.accept,/image\//);assert.equal(input.props.hidden,true);assert.equal(input.props.style?.display,'none','o CSS global (input{display:block}) anula [hidden]; o seletor precisa de display:none explícito');
  assert.match(JSON.stringify(root.toJSON()),/salva no computador ou no telefone/);await act(()=>root.unmount());}}
console.log('PASS assinatura importada: foto e PNG convertidos em traços válidos (limites do servidor); imagens vazias, sem contraste, escuras ou densas demais recusadas com orientação.');
