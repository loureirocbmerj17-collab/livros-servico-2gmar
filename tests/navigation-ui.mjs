import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import AppNavigation,{canAccessView} from '../.qa/app-navigation.mjs';
import Page from '../.qa/page.mjs';
import SupervisorPanel from '../.qa/supervisor-panel.mjs';
const text=n=>n.children.map(c=>typeof c==='string'?c:text(c)).join('');
globalThis.window={location:{hash:'',search:'',pathname:'/'},history:{replaceState(){}},addEventListener(){},removeEventListener(){}};
for(const role of ['enlisted','officer','reviewer','admin']){
 const user={rg:'99996',name:'TESTE',role};
 globalThis.fetch=async(url,init)=>{const op=init?.body?JSON.parse(init.body).op:new URL(url,'https://test.local').searchParams.get('op');return Response.json(op==='me'?{user,setup:false}:op==='operationalOverview'?{}:[]);};
 let root;await act(()=>{root=create(React.createElement(Page));});
 const nav=()=>root.root.findByType(AppNavigation);
 const menu=()=>nav().findAllByType('button').find(b=>b.props['aria-controls']==='unit-navigation');
 const link=label=>nav().findAllByType('button').find(b=>text(b)===label);
 assert.equal(!!link('Oficial de Dia'),role!=='enlisted');assert.equal(!!link('Consultar livros'),role!=='enlisted');assert.equal(!!link('Conferência SUBCMT'),['reviewer','admin'].includes(role));assert.equal(!!link('Usuários e perfis'),role==='admin');
 for(const label of ['Início','Náutica','SSMT','Supervisor','Adjunto']){assert.ok(link(label));assert.ok(link(label).findAllByType('svg').length,label+' must have an icon');}
 await act(()=>menu().props.onClick());assert.equal(menu().props['aria-expanded'],true);
 await act(()=>link('Supervisor').props.onClick());assert.equal(nav().props.view,'supervisor');assert.equal(menu().props['aria-expanded'],false);
 await act(()=>root.root.findByType(SupervisorPanel).props.onDirty(true));
 let prompts=0;globalThis.confirm=()=>{prompts++;return false;};
 await act(()=>menu().props.onClick());await act(()=>link('SSMT').props.onClick());assert.equal(nav().props.view,'supervisor');assert.equal(menu().props['aria-expanded'],true);assert.equal(prompts,1);
 globalThis.confirm=()=>{prompts++;return true;};await act(()=>link('SSMT').props.onClick());assert.equal(nav().props.view,'ssmt');assert.equal(menu().props['aria-expanded'],false);
 globalThis.confirm=()=>{throw Error('Clean navigation must not ask confirmation');};
 await act(()=>nav().findAllByType('button').find(b=>b.props['aria-label']==='2º GMAR — página inicial').props.onClick());assert.equal(nav().props.view,'home');
 await act(()=>link('Adjunto').props.onClick());assert.equal(nav().props.view,'adjunto');
 await act(()=>nav().findAllByType('button').find(b=>b.props['aria-label']==='Página inicial').props.onClick());assert.equal(nav().props.view,'home');
 if(role==='enlisted'){await act(()=>{assert.equal(nav().props.onNavigate('archive'),false);});assert.equal(nav().props.view,'home');}
 await act(()=>root.unmount());
}
assert.equal(canAccessView('officer','reviewQueue'),false);assert.equal(canAccessView('reviewer','users'),false);assert.equal(canAccessView('enlisted','book'),false);
console.log('PASS navigation: four roles, icons, menu toggle, cross-book navigation, brand/home links, dirty cancel/accept and forbidden destinations.');
