'use client';
import {useEffect,useState,useRef} from 'react';
const prefix='gmar-draft-v1:';
export function useDraftRecovery(type:string,rg:string|undefined,date:string,version:number,data:any,dirty:boolean,enabled:boolean,onRestore:(d:any)=>void){
 const pending=useRef(false);
 const key=prefix+[rg,type,date].join(':');
 const [candidate,setCandidate]=useState<any>(null),[state,setState]=useState('');
 useEffect(()=>{pending.current=false;setCandidate(null);setState('');if(!enabled||!rg)return;try{const raw=localStorage.getItem(key);if(!raw)return;const saved=JSON.parse(raw);if(saved.version!==version||Date.now()-saved.at>7*86400000){localStorage.removeItem(key);return;}pending.current=true;setCandidate(saved);}catch{setState('Não foi possível recuperar o rascunho neste dispositivo.');}},[key,version,enabled,rg]);
 useEffect(()=>{if(!enabled||!rg||!dirty||!data||data.date!==date||pending.current)return;try{const clean={...data};delete clean.signatureDrawing;localStorage.setItem(key,JSON.stringify({version,at:Date.now(),data:clean}));setState('Rascunho protegido automaticamente neste dispositivo. Salve para registrar no sistema.');}catch{setState('Não foi possível proteger o rascunho neste dispositivo. Use Salvar rascunho.');}},[data,dirty,enabled,key,version,rg,date]);
 function clear(){pending.current=false;try{localStorage.removeItem(key);}catch{}setCandidate(null);setState('');}
 return {clear,panel:enabled&&(candidate||state)?<div role="status" className="note">{candidate?<><span>Há um rascunho não enviado, salvo em {new Date(candidate.at).toLocaleString('pt-BR')}.</span><button type="button" onClick={()=>{pending.current=false;onRestore(candidate.data);setCandidate(null);}}>Recuperar rascunho</button><button type="button" onClick={clear}>Descartar cópia local</button></>:state}</div>:null};
}
export function ReadingWarnings({data}:{data:any}){
 const warnings=(data?.inventory||[]).filter((r:any)=>!r.unavailable&&r.hours!==''&&r.previousHours!==''&&Number.isFinite(Number(r.hours))&&Number(r.hours)<Number(r.previousHours));
 return warnings.length?<div className="alert error" role="alert"><div><b>Confira as leituras abaixo do registro anterior:</b>{warnings.map((r:any)=><p key={r.id}>{r.prefix}: anterior {r.previousHours}; informado {r.hours}. Se houve troca ou correção do medidor, registre o motivo nas observações.</p>)}</div></div>:null;
}
export function SigningChecklist({issues}:{issues:string[]}){return <div className={issues.length?'note':'alert success'}><div><b>{issues.length?'Pendências antes da assinatura':'Campos obrigatórios preenchidos'}</b>{issues.length?<ul>{issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>:<p>Confira os dados. Sua identidade e a escala também serão validadas ao assinar.</p>}</div></div>}
