import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {create,act} from 'react-test-renderer';
fs.mkdirSync('.qa',{recursive:true});
fs.writeFileSync('.qa/draft-recovery.mjs',ts.transpileModule(fs.readFileSync('app/draft-recovery.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText);
const {useDraftRecovery,ReadingWarnings,SigningChecklist}=await import('../.qa/draft-recovery.mjs');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
let hook,restored;
function Harness(p){hook=useDraftRecovery('ssmt',p.rg||'123',p.date||'2026-10-30',p.version||0,p.data,p.dirty,p.enabled!==false,d=>restored=d);return hook.panel;}
const data={date:'2026-10-30',observations:'Trabalho em andamento',signatureDrawing:'not stored'};
let root;await act(()=>{root=create(React.createElement(Harness,{data,dirty:true}));});
const key='gmar-draft-v1:123:ssmt:2026-10-30';assert.equal(JSON.parse(values.get(key)).data.observations,data.observations);assert.equal(JSON.parse(values.get(key)).data.signatureDrawing,undefined);
await act(()=>root.unmount());await act(()=>{root=create(React.createElement(Harness,{data:{...data,observations:'blank'},dirty:true}));});
assert.equal(JSON.parse(values.get(key)).data.observations,data.observations,'Opening must not overwrite pending recovery');
await act(()=>root.root.findAllByType('button')[0].props.onClick());assert.equal(restored.observations,data.observations);
await act(()=>hook.clear());assert.equal(values.has(key),false);
await act(()=>root.unmount());values.set(key,JSON.stringify({version:0,at:Date.now(),data}));
await act(()=>{root=create(React.createElement(Harness,{data,version:1,dirty:false}));});assert.equal(values.has(key),false,'Stale server version invalidates local copy');await act(()=>root.unmount());
values.set(key,JSON.stringify({version:0,at:Date.now(),data}));await act(()=>{root=create(React.createElement(Harness,{data,rg:'456',dirty:false}));});assert.equal(root.toJSON(),null,'Another RG cannot recover the local draft');await act(()=>root.unmount());
await act(()=>{root=create(React.createElement(ReadingWarnings,{data:{inventory:[{id:'v',prefix:'ASE',hours:'9',previousHours:'10',unavailable:false}]}}));});assert.match(JSON.stringify(root.toJSON()),/anterior/);await act(()=>root.unmount());
await act(()=>{root=create(React.createElement(SigningChecklist,{issues:['Confirme as viaturas']}));});assert.match(JSON.stringify(root.toJSON()),/Confirme as viaturas/);await act(()=>root.unmount());
console.log('PASS UI safeguards: local autosave, explicit recovery, no signature storage, stale-version and RG isolation, reading warning and signature checklist.');
// Supervisor interactions: all nine sections, explicit no-occurrence actions, review mode and read-only existing books.
for(const n of ['form-controls','supervisor-panel','signature-pad','adjunto-fields'])fs.writeFileSync('.qa/'+n+'.mjs',ts.transpileModule(fs.readFileSync('app/'+n+'.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from '\.\/([^']+)'/g,"from './$1.mjs'"));
fs.writeFileSync('.qa/download.mjs',ts.transpileModule(fs.readFileSync('app/download.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
const {default:SupervisorPanel}=await import('../.qa/supervisor-panel.mjs');const {supervisorBlank}=await import('../.qa/supervisor-model.mjs');
let savedBook=null;const sd=supervisorBlank('2026-10-31');sd.responsible='99996';
globalThis.fetch=async(url,init)=>{const op=init?.body?JSON.parse(init.body).op:new URL(url,'https://test.local').searchParams.get('op');const responses={supervisorPeople:[{rg:'99996',name:'SUPERVISOR',rank:'SUBTEN'}],supervisorList:[],supervisorBook:savedBook,supervisorContext:{blank:sd,roster:{found:true,warnings:[]}}};return Response.json(responses[op]);};
await act(()=>{root=create(React.createElement(SupervisorPanel,{user:{rg:'99996',name:'SUPERVISOR',role:'enlisted'},onDirty:()=>{}}));});
const text=n=>n.children.map(c=>typeof c==='string'?c:text(c)).join('');const button=label=>root.root.findAllByType('button').find(b=>text(b)===label);
await act(()=>button('Abrir serviço').props.onClick());assert.ok(button('Salvar rascunho'));
for(const section of ['2. Ativação da praia','3. Alimentação','4. Estatísticas','5. Atrasos','6. Faltas','7. Apoio operacional','8. Postos e remanejamentos','9. Observações e assinatura']){await act(()=>button(section).props.onClick());assert.ok(JSON.stringify(root.toJSON()).includes(section.split('. ')[1]));}
await act(()=>button('5. Atrasos').props.onClick());await act(()=>button('Não houve atrasos').props.onClick());assert.ok(root.root.findAllByType('p').some(p=>text(p)==='Não houve atrasos.'));
await act(()=>root.unmount());savedBook={date:sd.date,version:1,author:'99996',status:'Assinado',data:sd};
await act(()=>{root=create(React.createElement(SupervisorPanel,{user:{rg:'99996',name:'SUPERVISOR',role:'enlisted'},onDirty:()=>{}}));});await act(()=>button('Abrir serviço').props.onClick());assert.ok(button('Retificar livro'));assert.equal(button('Salvar rascunho'),undefined);await act(()=>button('Retificar livro').props.onClick());assert.ok(button('Salvar rascunho'));await act(()=>root.unmount());
console.log('PASS Supervisor UI: nine sections, explicit Não houve, existing books open read-only, Retificar livro enables editing.');
const {adjuntoBlank}=await import('../.qa/adjunto-model.mjs');const ad=adjuntoBlank('2026-10-31');
globalThis.fetch=async(url,init)=>{const op=init?.body?JSON.parse(init.body).op:new URL(url,'https://test.local').searchParams.get('op');return Response.json({adjuntoPeople:[{rg:'99996',name:'ADJUNTO',rank:'SUBTEN'}],adjuntoList:[],adjuntoBook:null,adjuntoContext:{blank:ad,roster:{found:true,warnings:[]}}}[op]);};
await act(()=>{root=create(React.createElement(SupervisorPanel,{kind:'adjunto',user:{rg:'99996',name:'ADJUNTO',role:'enlisted'},onDirty:()=>{}}));});await act(()=>button('Abrir serviço').props.onClick());await act(()=>button('7. Militares do expediente').props.onClick());await act(()=>button('Adicionar militar do expediente hoje').props.onClick());
const freeFields=root.root.findAllByType('input').filter(n=>n.props.type==='text');assert.equal(freeFields.length,2);await act(()=>freeFields[0].props.onChange({target:{value:'Subten Militar Livre'}}));await act(()=>freeFields[1].props.onChange({target:{value:'Seção livre'}}));await act(()=>button('Adicionar militar do expediente hoje').props.onClick());assert.equal(root.root.findAllByType('input').filter(n=>n.props.type==='text').length,4);
await act(()=>button('6. Arranchamento').props.onClick());assert.equal(root.root.findAllByType('input').filter(n=>n.props.type==='number').length,5);assert.match(text(root.root),/expediente e praia/);await act(()=>button('2. Situação da OBM').props.onClick());assert.equal(root.root.findAllByType('button').filter(b=>b.children.join('')==='Sim').length,5);await act(()=>root.unmount());
console.log('PASS Adjunto UI: free military/section fields, add multiple personnel, one five-meal ration form for the whole unit, OBM yes/no controls.');

await import('./review-console.mjs');

const {YesNo,MilitaryPicker}=await import('../.qa/form-controls.mjs');
let answer='';
function Choice(){const [v,setV]=React.useState('');return React.createElement(YesNo,{value:v,onChange:value=>{answer=value;setV(value);}});}
await act(()=>{root=create(React.createElement(Choice));});
assert.ok(root.root.findAllByType('button').every(b=>b.props['aria-pressed']===false));
await act(()=>root.root.findAllByType('button')[0].props.onClick());assert.equal(answer,'Sim');assert.equal(root.root.findAllByType('button')[0].props['aria-pressed'],true);
await act(()=>root.root.findAllByType('button')[1].props.onClick());assert.equal(answer,'Não');await act(()=>root.unmount());
let manualPerson,selectedRg;
await act(()=>{root=create(React.createElement(MilitaryPicker,{value:'',options:[{value:'12345',label:'CB ESCALADO RG 12345'}],onChange:v=>selectedRg=v,onManual:(rg,name)=>manualPerson={rg,name}}));});
await act(()=>root.root.findAllByType('button')[0].props.onClick());
await act(()=>root.root.findByProps({'aria-label':'RG manual'}).props.onChange({target:{value:'0054321'}}));
await act(()=>root.root.findByProps({'aria-label':'Nome manual'}).props.onChange({target:{value:'CB TESTE MANUAL'}}));
await act(()=>root.root.findAllByType('button').find(b=>b.children.join('')==='Usar militar informado').props.onClick());
assert.deepEqual(manualPerson,{rg:'54321',name:'CB TESTE MANUAL'});assert.equal(selectedRg,'54321');
await act(()=>root.unmount());console.log('PASS controls: explicit Yes/No selection, selected state, manual military and normalized RG.');
