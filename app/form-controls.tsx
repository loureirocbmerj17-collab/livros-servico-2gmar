'use client';
import {useId,useState} from 'react';
export function YesNo({value,onChange,disabled=false}:{value:string,onChange:(v:string)=>void,disabled?:boolean}){
 return <span className="yes-no" role="group" aria-label="Resposta">{['Sim','Não'].map(v=><button type="button" key={v} disabled={disabled} aria-pressed={value===v} onClick={()=>onChange(v)}>{v}</button>)}</span>;
}
export function MilitaryPicker({value,onChange,options,disabled,onManual}:{value:string,onChange:(v:string)=>void,options:{value:string,label:string}[],disabled?:boolean,onManual:(rg:string,name:string)=>void}){
 const id=useId(),[query,setQuery]=useState(''),[manual,setManual]=useState(false),[rg,setRg]=useState(''),[name,setName]=useState('');
 return <span className="military-picker"><input aria-label="Pesquisar militar da escala" placeholder="Pesquisar nome ou RG da escala" disabled={disabled} value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Militar da escala" disabled={disabled} value={value} onChange={e=>onChange(e.target.value)}><option value="">Selecione</option>{value&&!options.some(p=>p.value===value)&&<option value={value}>RG {value} · registro preservado</option>}{options.filter(p=>p.value===value||p.label.toLowerCase().includes(query.toLowerCase())).map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select>
 {!disabled&&<button type="button" onClick={()=>setManual(!manual)}>Adicionar militar manualmente</button>}{manual&&!disabled&&<span><input id={id} aria-label="RG manual" placeholder="RG sem pontos" inputMode="numeric" value={rg} onChange={e=>setRg(e.target.value.replace(/\D/g,'').replace(/^0+/,''))}/><input aria-label="Nome manual" placeholder="Posto/graduação e nome" value={name} maxLength={150} onChange={e=>setName(e.target.value)}/><button type="button" disabled={!/^\d{3,12}$/.test(rg)||!name.trim()} onClick={()=>{onManual(rg,name.trim());onChange(rg);setManual(false);}}>Usar militar informado</button></span>}</span>;
}
