'use client';
import {useState} from 'react';
async function action(op:string,data:any){const r=await fetch('/api/service',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,...data})});const v=await r.json();if(!r.ok)throw Error(v.error||'Não foi possível concluir.');return v;}
export default function AccountPanel({user,token,onDone,onCancel}:{user?:any,token?:string,onDone:()=>void,onCancel?:()=>void}){
 const [form,setForm]=useState({rg:user?.rg||'',email:user?.email||'',current:'',password:'',repeat:''}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const change=(key:string,value:string)=>setForm(f=>({...f,[key]:value}));
 const profile=!!user,reset=!!token;
 return <section className="panel form-panel"><h1>{profile?'Atualização cadastral obrigatória':reset?'Criar nova senha':'Esqueci minha senha'}</h1>
 <p>{profile?'Confirme seu RG, cadastre seu e-mail e crie uma senha pessoal para acessar os livros.':reset?'O link vale por 30 minutos e só pode ser utilizado uma vez.':'Informe seu RG e o e-mail cadastrado. O link será enviado se os dados corresponderem a um cadastro ativo.'}</p>
 {error&&<div role="alert" className="alert error">{error}</div>}{message&&<p role="status">{message}</p>}
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{if((profile||reset)&&form.password!==form.repeat)throw Error('As novas senhas não coincidem.');const r=await action(profile?'profile':reset?'resetPassword':'forgotPassword',{...form,token});if(profile)onDone();else{setMessage(r.message);setForm(f=>({...f,password:'',repeat:''}));}}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>
 {!reset&&<><label>Confirme seu RG<input required inputMode="numeric" value={form.rg} onChange={e=>change('rg',e.target.value.replace(/\D/g,''))}/></label><label>E-mail pessoal<input required type="email" autoComplete="email" maxLength={254} value={form.email} onChange={e=>change('email',e.target.value)}/></label></>}
 {profile&&<label>Senha atual (no primeiro acesso, seu RG)<input required type="password" autoComplete="current-password" value={form.current} onChange={e=>change('current',e.target.value)}/></label>}
 {(profile||reset)&&<><label>Nova senha pessoal<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={e=>change('password',e.target.value)}/></label><label>Repita a nova senha<input required type="password" autoComplete="new-password" value={form.repeat} onChange={e=>change('repeat',e.target.value)}/></label></>}
 <div className="review-actions"><button disabled={busy} className="primary">{busy?'Aguarde…':profile?'Salvar cadastro e continuar':reset?'Atualizar senha':'Enviar link de recuperação'}</button>{onCancel&&<button type="button" disabled={busy} onClick={onCancel}>{profile?'Sair':'Voltar ao login'}</button>}</div></form></section>;
}
const BOOKS:Record<string,string>={officer:'Oficial de Dia',supervisor:'Supervisor',adjunto:'Adjunto',nautica:'Náutica',ssmt:'SSMT'};
const KINDS:Record<string,string>={reminder:'1º e-mail — designação',reminder2:'2º e-mail — lembrete (12 h)',reminder3:'3º e-mail — último lembrete (24 h)',schedule:'1º e-mail — escala indisponível',schedule2:'2º e-mail — escala indisponível',schedule3:'3º e-mail — escala indisponível',recovery:'Recuperação de senha'};
const STATUS:Record<string,string>={accepted:'Enviado (aceito pelo Gmail)',uncertain:'Sem confirmação — conferir na conta remetente',failed:'Falhou',sending:'Enviando',pending:'Pendente',missing_email:'Não enviado — militar sem e-mail cadastrado',unassigned:'Não enviado — responsável não identificado na escala',not_configured:'Não enviado — e-mail do sistema não configurado'};
const br=(d:string)=>d?d.split('-').reverse().join('/'):'';
const when=(t:string)=>{const d=new Date(String(t).replace(' ','T').replace(/([+-]\d{2})$/,'$1:00'));return isNaN(d.getTime())?t:d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});};
const order=(k:string)=>k.endsWith('3')?3:k.endsWith('2')?2:1;
export function MailStatus(){
 const [status,setStatus]=useState<any>(null),[error,setError]=useState(''),[date,setDate]=useState(''),[book,setBook]=useState('');
 async function refresh(){try{const r=await fetch('/api/service?op=mailStatus',{cache:'no-store'}),v=await r.json();if(!r.ok)throw Error(v.error);setStatus(v);setError('');}catch(e:any){setError(e.message);}}
 const logs=(status?.logs||[]).filter((r:any)=>r.service_date&&(!date||r.service_date===date)&&(!book||r.book_type===book));
 const groups=new Map<string,any[]>();for(const r of logs){const k=r.service_date+'|'+r.book_type;if(!groups.has(k))groups.set(k,[]);groups.get(k)!.push(r);}
 const keys=[...groups.keys()].sort((a,b)=>b.localeCompare(a));
 return <section className="panel form-panel"><h1>Notificações por e-mail</h1><button onClick={refresh}>Consultar configuração e histórico</button>{error&&<p role="alert">{error}</p>}{status&&<><p>{status.provider==='gmail'?'Gmail':'Resend'}: {status.configured?'Credenciais cadastradas — entrega depende do provedor':status.provider==='gmail'?'Pendente: GMAIL_USER e GMAIL_APP_PASSWORD':'Pendente: RESEND_API_KEY e MAIL_FROM'} · Agendador: {status.cronConfigured?'Credencial configurada':'Pendente: CRON_SECRET'}</p>
 <p>1º e-mail: Supervisor às 18h do dia; demais livros às 06h do dia seguinte. 2º e 3º e-mails: 12 h e 24 h depois, somente enquanto o livro não estiver assinado (sem livro → responsável da escala; rascunho → quem salvou). “Enviado” significa aceito pelo Gmail, não leitura confirmada.</p>
 <div className="row"><label>Data do serviço<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Livro<select value={book} onChange={e=>setBook(e.target.value)}><option value="">Todos</option>{Object.entries(BOOKS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>{(date||book)&&<button onClick={()=>{setDate('');setBook('');}}>Limpar filtros</button>}</div>
 {!keys.length&&<p>Nenhuma notificação registrada {date||book?'para este filtro':'nos últimos 45 dias'}.</p>}
 {keys.map(k=>{const items=groups.get(k)!.sort((a:any,b:any)=>order(a.kind)-order(b.kind)),[d,t]=k.split('|');return <article className="review-queue-card" key={k}><b>Serviço {br(d)} · Livro {BOOKS[t]||t}</b>{items.map((r:any)=><div key={r.id} style={{marginTop:8}}><p><b>{KINDS[r.kind]||r.kind}</b> · {when(r.updated_at)}</p><p>{r.name||'—'}{r.rg?' · RG '+r.rg:''}{r.recipient?' · '+r.recipient:''}</p><p>{STATUS[r.status]||r.status}{r.attempts>1?' · '+r.attempts+' tentativas':''}</p></div>)}</article>;})}
 <details><summary>Recuperação de senha ({(status.logs||[]).filter((r:any)=>!r.service_date).length})</summary>{(status.logs||[]).filter((r:any)=>!r.service_date).map((r:any)=><p key={r.id}>{when(r.updated_at)} · {STATUS[r.status]||r.status}</p>)}</details></>}</section>;
}
