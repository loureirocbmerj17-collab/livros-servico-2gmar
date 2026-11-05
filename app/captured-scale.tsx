'use client';
import {useEffect,useState} from 'react';
type Capture={date:string,assignments:{label:string,text:string}[],source?:any};
export default function CapturedScale({date,capture,editable,onCapture}:{date:string,capture?:Capture,editable:boolean,onCapture?:(capture:Capture)=>void}){
 const [loaded,setLoaded]=useState<Capture|null>(null),[error,setError]=useState('');
 useEffect(()=>{setLoaded(null);setError('');if(capture?.date===date||!editable)return;const controller=new AbortController();
 fetch('/api/service?'+new URLSearchParams({op:'dayPersonnel',date}),{cache:'no-store',signal:controller.signal}).then(r=>r.json()).then(r=>{if(!controller.signal.aborted&&r.found&&r.capture){setLoaded(r.capture);onCapture?.(r.capture);}else if(!controller.signal.aborted)setError(r.message||'Não foi possível ler a escala. Tente reimportar.');}).catch(()=>{if(!controller.signal.aborted)setError('Não foi possível ler a escala. Tente reimportar.');});
 return ()=>controller.abort();
 // onCapture is a parent state setter; it is deliberately not a fetch dependency.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[date,capture?.date,editable]);
 const value=capture?.date===date?capture:loaded?.date===date?loaded:null;
 if(!value?.assignments?.length)return error?<p role="status">{error}</p>:null;
 return <details className="import-box" open><summary><strong>Texto importado da escala de serviço</strong></summary><p>Militares e anotações são capturados mesmo sem RG ou cadastro. A assinatura continua vinculada ao usuário responsável.</p><div className="table-wrap"><table><thead><tr><th>Função / posto</th><th>Conforme a escala</th></tr></thead><tbody>{value.assignments.map((a,i)=><tr key={i}><td>{a.label}</td><td style={{whiteSpace:'pre-wrap'}}>{a.text}</td></tr>)}</tbody></table></div></details>;
}
