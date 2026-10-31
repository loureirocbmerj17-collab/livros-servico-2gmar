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
export function MailStatus(){
 const [status,setStatus]=useState<any>(null),[error,setError]=useState('');
 async function refresh(){try{const r=await fetch('/api/service?op=mailStatus',{cache:'no-store'}),v=await r.json();if(!r.ok)throw Error(v.error);setStatus(v);setError('');}catch(e:any){setError(e.message);}}
 return <section className="panel form-panel"><h1>Notificações por e-mail</h1><button onClick={refresh}>Consultar configuração e histórico</button>{error&&<p role="alert">{error}</p>}{status&&<><p>Resend: {status.configured?'Configurado':'Pendente: RESEND_API_KEY e MAIL_FROM'} · Agendador: {status.cronConfigured?'Credencial configurada':'Pendente: CRON_SECRET'}</p><p>Supervisor: 18h. Demais livros: 06h do dia seguinte, horário de Brasília. “accepted” significa aceito pelo provedor, não entrega confirmada.</p>{status.logs.map((r:any)=><article className="review-queue-card" key={r.id}><b>{r.service_date||'Recuperação de senha'} · {r.book_type} · RG {r.rg}</b><p>{r.recipient} · {r.status} · {r.attempts} tentativa(s)</p><p>{r.detail}</p><small>{r.updated_at}</small></article>)}</>}</section>;
}
