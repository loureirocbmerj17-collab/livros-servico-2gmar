'use client';
import {useEffect,useRef,useState} from 'react';
import {Plus,Clock,UserMinus,ArrowLeftRight,DoorOpen,ClipboardList} from 'lucide-react';
import {applyPersonnelEvents,eventLabels,eventText,validateEvent,Military,PersonnelEvent} from './personnel-events';
import {personLabel} from './person-label';
const emptyPerson=():Military=>({rg:'',name:'',rank:''});
function MilitaryField({label,value,roster,people,onChange}:{label:string;value:Military;roster:any[];people:any[];onChange:(p:Military)=>void}){
 const [mode,setMode]=useState('scale'),[query,setQuery]=useState('');
 const select=(p:any)=>onChange({rg:p.rg,name:p.name,rank:p.rank||''});
 const options=[...roster,...(value.rg?[value]:[])].filter((p,i,a)=>a.findIndex(x=>x.rg===p.rg)===i);
 const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const matches=query.trim()?people.filter(p=>normalized(personLabel(p)+' '+p.rg).includes(normalized(query))).slice(0,20):[];
 return <fieldset className="personnel-military"><legend>{label}</legend>
  <label>Militar da escala<select value={value.rg} onChange={e=>{const p=options.find(p=>p.rg===e.target.value);onChange(p?{rg:p.rg,name:p.name,rank:p.rank||''}:emptyPerson());}}><option value="">Selecione</option>{options.map(p=><option key={p.rg} value={p.rg}>{personLabel(p)} · RG {p.rg}</option>)}</select></label>
  <div className="row"><button type="button" onClick={()=>setMode(mode==='search'?'scale':'search')}>Inserir manualmente</button><button type="button" onClick={()=>setMode(mode==='free'?'scale':'free')}>Digitar dados</button></div>
  {mode==='search'&&<div><label>Buscar no efetivo por nome ou RG<input value={query} onChange={e=>setQuery(e.target.value)} autoComplete="off"/></label><div className="personnel-results">{matches.map(p=><button key={p.rg} type="button" onClick={()=>{select(p);setMode('scale');setQuery('');}}>{personLabel(p)} · RG {p.rg}</button>)}</div>{query&&!matches.length&&<p>Nenhum militar encontrado. Use Digitar dados.</p>}</div>}
  {mode==='free'&&<div className="grid2"><label>Posto / graduação<input maxLength={60} value={value.rank} onChange={e=>onChange({...value,rank:e.target.value})}/></label><label>Nome de guerra<input maxLength={150} value={value.name} onChange={e=>onChange({...value,name:e.target.value})}/></label><label>RG<input inputMode="numeric" value={value.rg} onChange={e=>onChange({...value,rg:e.target.value.replace(/\D/g,'').replace(/^0+/,'')})}/></label></div>}
 </fieldset>;
}
export default function PersonnelPanel({data,roster,editable,onChange}:{data:any;roster:any[];editable:boolean;onChange:(data:any)=>void}){
 const [people,setPeople]=useState<any[]>([]),[loadError,setLoadError]=useState('');
 const [event,setEvent]=useState<PersonnelEvent|null>(null),[error,setError]=useState(''),[manual,setManual]=useState<Record<string,boolean>>({});
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(!editable)return;const controller=new AbortController();fetch('/api/service?op=personnelDirectory',{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();setPeople(await r.json());}).catch(()=>{if(!controller.signal.aborted)setLoadError('Busca do efetivo indisponível. Você pode digitar os dados do militar.');});return ()=>controller.abort();},[editable]);
 useEffect(()=>{if(event){dialog.current?.showModal();}else{dialog.current?.close();trigger.current?.focus();}},[!!event]);
 const rows:PersonnelEvent[]=data.personnelEvents||[];
 const base=()=>({...data,personnelManual:data.personnelManual??data.personnel??'',absencesManual:data.absencesManual??data.absences??'',personnelEvents:rows});
 function commit(next:any){try{onChange(applyPersonnelEvents(next));return true;}catch(e:any){setError(e.message);return false;}}
 function open(kind:string,existing?:PersonnelEvent){trigger.current=document.activeElement as HTMLElement;setError('');setEvent(existing?structuredClone(existing):{id:crypto.randomUUID(),kind,military:emptyPerson(),replacement:emptyPerson(),situation:'',duration:'',reason:'',time:'',notes:''});}
 const icons=[ClipboardList,Clock,UserMinus,ArrowLeftRight,DoorOpen];
 return <><h3>Alterações de pessoal</h3>{editable&&<><p>Selecione uma opção para registrar uma alteração.</p><div className="personnel-actions">{Object.entries(eventLabels).map(([kind,label],i)=>{const Icon=icons[i];return <button key={kind} type="button" onClick={()=>open(kind)}><Icon size={20}/>{label}</button>;})}</div></>}
 {rows.map(row=><article className="personnel-entry" key={row.id}><p>{eventText(row)}</p>{editable&&<div className="row"><button onClick={()=>open(row.kind,row)}>Editar lançamento</button><button onClick={()=>{if(confirm('Excluir este lançamento?'))commit({...base(),personnelEvents:rows.filter(r=>r.id!==row.id)});}}>Excluir lançamento</button></div>}</article>)}
 {(['personnel','absences'] as const).map(key=><section key={key}><h3>{key==='personnel'?'7. Licenciados, dispensados, presos ou detidos':'8. Atrasos, faltas, permutas e liberações'}</h3><p style={{whiteSpace:'pre-wrap'}}>{data[key]||'Sem lançamentos.'}</p>{editable&&<button onClick={()=>setManual({...manual,[key]:!manual[key]})}>{manual[key]?'Fechar relato manual':'Digitar relato manualmente'}</button>}{manual[key]&&editable&&<label>Relato livre<textarea rows={4} value={data[key+'Manual']??data[key]??''} onChange={e=>commit({...base(),[key+'Manual']:e.target.value})}/></label>}</section>)}
 {error&&!event&&<p role="alert">{error}</p>}
 <dialog ref={dialog} className="personnel-dialog" onCancel={()=>setEvent(null)} aria-labelledby="personnel-dialog-title">
 {event&&<form onSubmit={e=>{e.preventDefault();const problem=validateEvent(event);if(problem){setError(problem);return;}const next=rows.some(r=>r.id===event.id)?rows.map(r=>r.id===event.id?event:r):[...rows,event];if(commit({...base(),personnelEvents:next}))setEvent(null);}}>
 <h2 id="personnel-dialog-title">{eventLabels[event.kind]}</h2>{loadError&&<p role="status">{loadError}</p>}
 <MilitaryField label={event.kind==='swap'?'Militar que sai do serviço':'Militar'} value={event.military} roster={roster} people={people} onChange={military=>setEvent({...event,military})}/>
 {event.kind==='swap'&&<MilitaryField label="Militar que entra no serviço" value={event.replacement} roster={roster} people={people} onChange={replacement=>setEvent({...event,replacement})}/>}
 {event.kind==='absence'&&<><label>Situação<select required value={event.situation} onChange={e=>setEvent({...event,situation:e.target.value})}><option value="">Selecione</option>{['Licenciado','Dispensado','Preso','Detido'].map(s=><option key={s}>{s}</option>)}</select></label><label>Período<select value={event.duration==='NFPA'?'NFPA':'days'} onChange={e=>setEvent({...event,duration:e.target.value==='NFPA'?'NFPA':''})}><option value="days">Quantidade de dias</option><option>NFPA</option></select></label>{event.duration!=='NFPA'&&<label>Dias<input required type="number" min="1" max="9999" value={event.duration} onChange={e=>setEvent({...event,duration:e.target.value})}/></label>}</>}
 {['delay','missing','release'].includes(event.kind)&&<label>Motivo<textarea required maxLength={3000} value={event.reason} onChange={e=>setEvent({...event,reason:e.target.value})}/></label>}
 {['delay','release'].includes(event.kind)&&<label>{event.kind==='delay'?'Horário de chegada':'Horário da saída'}<input required type="time" value={event.time} onChange={e=>setEvent({...event,time:e.target.value})}/></label>}
 <label>Observações (opcional)<textarea maxLength={3000} value={event.notes} onChange={e=>setEvent({...event,notes:e.target.value})}/></label>{error&&<p role="alert" className="alert error">{error}</p>}
 <div className="row"><button type="button" onClick={()=>setEvent(null)}>Cancelar</button><button className="primary" type="submit"><Plus size={18}/>Adicionar lançamento</button></div><p>Salve o rascunho do livro para registrar as alterações.</p>
 </form>}
 </dialog></>;
}
