import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {create,act} from 'react-test-renderer';
for(const f of fs.readdirSync('app').filter(f=>f.endsWith('.tsx'))){
 const src=fs.readFileSync('app/'+f,'utf8').replace("import './globals.css';",'');
 fs.writeFileSync('.qa/'+f.replace('.tsx','.mjs'),ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from '\.\/([^']+)'/g,"from './$1.mjs'"));
}
const user={rg:'99996',name:'TESTE',role:'officer'};
globalThis.window={location:{hash:'',search:'',pathname:'/'},history:{replaceState(){}},addEventListener(){},removeEventListener(){}};
const text=n=>n.children.map(c=>typeof c==='string'?c:text(c)).join('');
let root;
const button=label=>root.root.findAllByType('button').find(b=>text(b).trim()===label.trim());
const click=async label=>{assert.ok(button(label),label);await act(()=>button(label).props.onClick());};
for(const kind of ['supervisor','adjunto','nautical','ssmt','officer']){
 const prefix=kind==='officer'?'':kind;
 const model=await import('../.qa/'+({nautical:'nautica',officer:'book'}[kind]||kind)+'-model.mjs');
 const d=(model.supervisorBlank||model.adjuntoBlank||model.nauticalBlank||model.ssmtBlank||model.blank)('2032-05-01');d.responsible=user.rg;
 let stored={date:d.date,author:user.rg,author_name:'TESTE',status:'Rascunho',version:1,data:d};
 const Page=(await import('../.qa/'+({supervisor:'supervisor-panel',adjunto:'supervisor-panel',nautical:'nautica-panel',ssmt:'ssmt-panel',officer:'page'}[kind])+'.mjs')).default;
 globalThis.window.location.search=kind==='officer'?'?book=officer&date='+d.date:'';
 globalThis.fetch=async(url,init)=>{
  const body=init?.body?JSON.parse(init.body):null,op=body?.op||new URL(url,'https://test.local').searchParams.get('op');
  if(op===(prefix?prefix+'Save':'save')){stored={...stored,version:stored.version+1,data:body.data};return Response.json({ok:true});}
  if(op===(prefix?prefix+'Book':'book'))return Response.json(stored);
  if(op==='me')return Response.json({user,setup:false});
  if(op==='dayPersonnel')return Response.json({people:[]});
  if(op==='operationalOverview')return Response.json({});
  return Response.json([]);
 };
 const mount=async()=>{await act(()=>{root=create(React.createElement(Page,{user,kind:kind==='adjunto'?'adjunto':undefined,initialDate:d.date,onDirty:()=>{}}));});};
 await mount();assert.ok(button('Salvar rascunho'),kind+' saved draft must remain editable');assert.equal(button('Retificar livro'),undefined);
 await click('Salvar rascunho');assert.ok(button('Salvar rascunho'),kind+' save keeps draft editable');
 const signature=kind==='officer'?'Assinar e enviar para conferência':kind==='supervisor'?'Assinar livro do Supervisor':kind==='adjunto'?'Assinar livro do Adjunto':'Assinar como responsável';
 // Advance through sections using their actual navigation labels.
 if(kind==='officer'){for(let i=0;i<6;i++)await click('Próxima etapa ');}else{
  const nav=root.root.findAllByType('nav').find(n=>n.props.className==='nautical-tabs'||n.props['aria-label']==='Seções do Supervisor');
  const buttons=nav.findAllByType('button');await act(()=>buttons.at(-1).props.onClick());
 }
 assert.ok(button(signature),kind+' saved draft exposes signature');await click(signature);
 assert.ok(!root.root.findAllByProps({className:'overlay'}).length,kind+' incomplete draft must show pending fields, not signature modal');
 assert.match(text(root.root),/Informe|Complete|Confirme|Revise|Identifique|Selecione/);
 await act(()=>root.unmount());
 stored={...stored,author:'88888'};await mount();assert.equal(button('Salvar rascunho'),undefined,kind+' another author cannot edit');await act(()=>root.unmount());
 stored={...stored,author:user.rg,status:'Assinado'};await mount();assert.ok(button('Retificar livro'),kind+' signed content needs explicit retification');await act(()=>root.unmount());
 stored={...stored,status:'Conferido'};await mount();assert.equal(button('Salvar rascunho'),undefined);assert.equal(button('Retificar livro'),undefined);await act(()=>root.unmount());
 console.log('PASS draft signing UI: '+kind+' saved/reopened draft, save, validation, ownership and signed/reviewed locks.');
}
