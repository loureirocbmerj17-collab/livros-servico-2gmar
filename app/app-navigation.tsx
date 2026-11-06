'use client';
import {useState} from 'react';
import {Home,Menu,X,BookOpen,Anchor,Truck,ClipboardCheck,ClipboardList,CalendarDays,ShieldCheck,Users,Mail,KeyRound} from 'lucide-react';
import {personLabel} from './person-label';
const entries=[
 {view:'home',label:'Início',icon:Home},
 {view:'dashboard',label:'Oficial de Dia',icon:BookOpen},
 {view:'nautica',label:'Náutica',icon:Anchor},
 {view:'ssmt',label:'SSMT',icon:Truck},
 {view:'supervisor',label:'Supervisor',icon:ClipboardCheck},
 {view:'adjunto',label:'Adjunto',icon:ClipboardList},
 {view:'archive',label:'Consultar livros',icon:CalendarDays},
 {view:'reviewQueue',label:'Conferência SUBCMT',icon:ShieldCheck},
 {view:'users',label:'Usuários e perfis',icon:Users},
 {view:'mail',label:'Notificações por e-mail',icon:Mail},
 {view:'password',label:'Minha senha',icon:KeyRound}
];
export function canAccessView(role:string,view:string){
 if(!['enlisted','officer','reviewer','admin'].includes(role))return false;
 if(['users','mail'].includes(view))return role==='admin';
 if(view==='reviewQueue')return ['reviewer','admin'].includes(role);
 if(['book','dashboard','archive'].includes(view))return role!=='enlisted';
 return ['home','nautica','ssmt','supervisor','adjunto','password'].includes(view);
}
export function viewLabel(view:string){return view==='book'?'Oficial de Dia':view==='home'?'Condição operacional':entries.find(e=>e.view===view)?.label||'Livros da unidade';}
export default function AppNavigation({user,view,onNavigate}:{user:any,view:string,onNavigate:(view:string)=>boolean}){
 const [expanded,setExpanded]=useState(false);
 function go(target:string){if(onNavigate(target))setExpanded(false);}
 return <aside className="sidebar app-navigation" aria-label="Navegação da unidade" onKeyDown={e=>{if(e.key==='Escape')setExpanded(false);}}>
  <div className="navigation-header">
   <button className="brand" aria-label="2º GMAR — página inicial" onClick={()=>go('home')}><span className="brand-icon"><img src="/timao-unidade.png" alt=""/></span><span className="brand-name"><strong>2º GMAR</strong><small>LIVROS DA UNIDADE</small></span></button>
   <div className="mobile-navigation-actions"><button aria-label="Página inicial" onClick={()=>go('home')}><Home size={20}/><span>Início</span></button><button aria-expanded={expanded} aria-controls="unit-navigation" onClick={()=>setExpanded(v=>!v)}>{expanded?<X size={20}/>:<Menu size={20}/>}<span>Menu</span></button></div>
  </div>
  <nav id="unit-navigation" className={'navigation-links'+(expanded?' expanded':'')} aria-label="Livros e serviços">
   {entries.filter(e=>canAccessView(user.role,e.view)).map(({view:target,label,icon:Icon})=><button key={target} className={'nav'+(view===target||(view==='book'&&target==='dashboard')?' active':'')} aria-current={view===target||(view==='book'&&target==='dashboard')?'page':undefined} onClick={()=>go(target)}><Icon size={20} aria-hidden="true"/><span>{label}</span></button>)}
   <div className="navigation-user"><strong>{personLabel(user)}</strong><small>RG {user.rg}</small></div>
  </nav>
 </aside>;
}
