// Server-only SISGEO fleet adapter. No cookies, tokens or user credentials.
export const FLEET_URL='https://sisgeo.cbmerj.rj.gov.br/Sisgeo/Manager/GetConsultaViatura';
export type FleetKind='nautical'|'ssmt';
const allowed={nautical:['AMA','BIR','RTE','AQ','AQS'],ssmt:['AR','ASE','V1','V4','VL']};
export const fleetKey=(s:string)=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const MANAGER='https://sisgeo.cbmerj.rj.gov.br/Sisgeo/Manager/';
// SISGEO sends local civil time, without an offset. Rio uses UTC-03.
export function checklistTime(value:unknown):number|null{
 if(typeof value!=='string')return null;
 const m=/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);if(!m)return null;
 const [,d,mo,y,h,mi,s]=m,iso=`${y}-${mo}-${d}T${h}:${mi}:${s}`,utc=Date.parse(iso+'Z');
 if(!Number.isFinite(utc)||new Date(utc).toISOString().slice(0,19)!==iso)return null;
 return utc+3*3600000;
}
export function parseChecklist(value:any,key:string,date:string,now=new Date()){
 if(!Array.isArray(value)||value.length>3000)throw Error('Checklist SISGEO inválido.');
 const start=Date.parse(date+'T08:00:00-03:00'),end=start+86400000;
 let latest:number|null=null;
 for(const r of value){
  const time=checklistTime(r?.DataCadastro);
  // An unfilled template also returns items/odometer. Only saved, dated items
  // belonging to this vehicle prove a conference. Item condition 0 is valid.
  if(fleetKey(r?.Viatura)!==key||!Number.isInteger(r?.Id)||r.Id<=0||!Number.isInteger(r?.IdItem)||r.IdItem<=0||![0,1,2].includes(r?.Conferencia)||time===null)continue;
  if(time>=start&&time<end&&time<=now.getTime()&&(latest===null||time>latest))latest=time;
 }
 return latest===null?null:new Date(latest).toISOString();
}
async function managerQuery(endpoint:string,payload:object,signal:AbortSignal){
 const r=await fetch(MANAGER+endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),redirect:'manual',cache:'no-store',signal});
 if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))throw Error('Consulta SISGEO indisponível.');
 const text=await r.text();if(text.length>2000000)throw Error('Resposta SISGEO acima do limite.');return JSON.parse(text);
}
export async function enrichFleet(rows:any[],date:string,now=new Date(),query=managerQuery,budgetMs=15000){
 const start=Date.parse(date+'T08:00:00-03:00');
 const days=[date],next=new Date(start+86400000).toISOString().slice(0,10);
 // Before 08h, the same service spans two calendar-day queries.
 if(now.getTime()>=Date.parse(next+'T00:00:00-03:00'))days.push(next);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),budgetMs);
 const output=rows.map(row=>({...row,conferenceAt:null,conferenceStatus:'unavailable',sisgeo:null}));let cursor=0;
 try{
  await Promise.all(Array.from({length:Math.min(4,rows.length)},async()=>{
   while(cursor<output.length&&!controller.signal.aborted){
    const row=output[cursor++];let complete=true,latest:string|null=null;
    for(const day of days){
     try{
      const value=await query('GetViaturaConferenciaViatura',{viatura:row.key,data:day+' 00:00:00'},AbortSignal.any([controller.signal,AbortSignal.timeout(5000)]));
      const at=parseChecklist(value,row.key,date,now);if(at&&(!latest||at>latest))latest=at;
     }catch{complete=false;}
    }
    row.conferenceAt=latest;row.sisgeo=latest?true:null;row.conferenceStatus=latest?'confirmed':complete?'not_found':'unavailable';
    // The fleet endpoint already supplies the current reading. Consult the
    // dedicated endpoint only when missing; never use the checklist's old reading.
    if(!row.hours&&!controller.signal.aborted)try{
     const value=await query('GetViaturaOdometroAtual',{viatura:row.key},AbortSignal.any([controller.signal,AbortSignal.timeout(3000)]));
     const reading=typeof value==='string'||typeof value==='number'?String(value).trim().replace(',','.'):'';
     if(/^\d+(\.\d{1,3})?$/.test(reading))row.hours=reading;
    }catch{/* Keep unavailable reading blank. */}
   }
  }));
 }finally{clearTimeout(timer);}
 return output;
}
export function currentFleetService(date:string,now=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(v=>[v.type,v.value]));
 const day=p.year+'-'+p.month+'-'+p.day;
 const service=Number(p.hour)<8?new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10):day;
 return date===service;
}
export function parseFleet(value:any,kind:FleetKind){
 if(!Array.isArray(value)||value.length>3000)throw Error('Formato da frota SISGEO inválido.');
 const seen=new Set<string>();const rows:any[]=[];
 for(const r of value){
  if(r?.UnidadeLotacao!=='2GMAR'||!allowed[kind].includes(r.Prefixo))continue;
  const key=fleetKey(r.Viatura);
  if(typeof r.Id!=='string'||!key.startsWith(r.Prefixo)||!/^[A-Z0-9]{3,30}$/.test(key)||![0,1].includes(r.Situacao))throw Error('Cadastro SISGEO incompleto; inventário preservado.');
  if(seen.has(key))throw Error('Prefixo duplicado na resposta SISGEO; inventário preservado.');seen.add(key);
  const raw=r.Odometro===null||r.Odometro===undefined?'':String(r.Odometro).trim();
  const hours=raw.replace(',','.');if(hours&&!/^\d+(\.\d{1,3})?$/.test(hours))throw Error('Leitura SISGEO inválida; inventário preservado.');
  // Situacao = mechanical OP/INOP; SituacaoOperacional can mean lack of crew.
  // ConferenciaViatura is an undocumented numeric value, not a timestamp.
  rows.push({externalId:r.Id,key,prefix:r.Prefixo+'-'+key.slice(r.Prefixo.length),kind:r.Prefixo,condition:r.Situacao===1?'OP':'INOP',hours,sisgeo:null,
   operational:typeof r.SituacaoOperacional==='string'?r.SituacaoOperacional:'',model:typeof r.Modelo==='string'?r.Modelo:'',description:typeof r.Descricao==='string'?r.Descricao:'',conferenceCode:r.ConferenciaViatura===null?null:String(r.ConferenciaViatura)});
 }
 return rows;
}
export async function loadFleet(kind:FleetKind,date:string,now=new Date()){
 const response=await fetch(FLEET_URL,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({unidadecarga:'',unidadelotacao:'2GMAR',finalidade:'',ano:'',prefixo:'',situacaoconsulta:'1,0',viatura:''}),redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('Consulta de viaturas SISGEO indisponível ou exige autenticação.');
 const text=await response.text();if(text.length>4000000)throw Error('Resposta da frota acima do limite.');
 return enrichFleet(parseFleet(JSON.parse(text),kind),date,now);
}
export async function syncFleet(db:any,rg:string,kind:FleetKind,date:string,now=new Date(),loader=loadFleet){
 if(!currentFleetService(date,now))return {found:false,historical:true,message:'O SISGEO fornece a frota atual, sem histórico por serviço. Dados deste dia preservados; preenchimento manual disponível.'};
 const table=kind==='nautical'?'livros.nautical_equipment':'livros.ssmt_equipment';
 try{
  const rows=await loader(kind,date,now),catalog=(await db.prepare('SELECT * FROM '+table+' ORDER BY id').all()).results;
  // Empty response is ambiguous (outage/filter change): never mass-deactivate on it.
  if(!rows.length)throw Error('Nenhum equipamento retornado; cadastros preservados.');
  const at=now.toISOString(),statements:any[]=[],present=new Set<string>();
  for(const row of rows){
   const matches=catalog.filter((e:any)=>fleetKey(e.prefix)===row.key),old=matches.find((e:any)=>e.initial_data?.sisgeo?.id===row.externalId)||matches[0];
   const id=old?.id||'sisgeo-'+row.key;present.add(id);
   const meta={id:row.externalId,key:row.key,at,serviceDate:date,lotacao:'2GMAR',condition:row.condition,hours:row.hours,conferenceCode:row.conferenceCode,conferenceAt:row.conferenceAt||null,conferenceStatus:row.conferenceStatus||'unavailable',operational:row.operational};
   const initial={...(old?.initial_data||{}),condition:row.condition,hours:row.hours,sisgeo:meta};
   statements.push(db.prepare('INSERT INTO '+table+'(id,prefix,kind,model,description,active,initial_data,updated,actor) VALUES(?,?,?,?,?,true,?::jsonb,?,?) ON CONFLICT(prefix) DO UPDATE SET active=true,initial_data=excluded.initial_data,updated=excluded.updated,actor=excluded.actor WHERE '+table+'.updated<=excluded.updated').bind(id,old?.prefix||row.prefix,old?.kind||row.kind,old?.model||row.model,old?.description||row.description,JSON.stringify(initial),at,rg));
   for(const duplicate of matches.filter((e:any)=>e.id!==id))statements.push(db.prepare('UPDATE '+table+' SET active=false,initial_data=?,updated=?,actor=? WHERE id=? AND updated<=?').bind(JSON.stringify({...duplicate.initial_data,sisgeo:{...meta,duplicateOf:id}}),at,rg,duplicate.id,at));
  }
  for(const old of catalog)if(old.initial_data?.sisgeo&&!present.has(old.id)&&!rows.some((r:any)=>r.key===fleetKey(old.prefix)))statements.push(db.prepare('UPDATE '+table+' SET active=false,updated=?,actor=? WHERE id=? AND updated<=?').bind(at,rg,old.id,at));
  statements.push(db.prepare('INSERT INTO admin_log(actor,action,updated) VALUES(?,?,?)').bind(rg,'Sincronização SISGEO '+kind+': '+rows.length+' equipamentos da lotação 2GMAR; sem alteração de livros assinados.',at));
  await db.batch(statements);
  const equipment=(await db.prepare('SELECT * FROM '+table+' ORDER BY prefix').all()).results;
  const confirmed=rows.filter((r:any)=>r.conferenceAt).length,unavailable=rows.filter((r:any)=>!r.conferenceStatus||r.conferenceStatus==='unavailable').length;
  const source={provider:'SisGeO',date,queriedAt:at,lotacao:'2GMAR',window:'08h às 08h',conferenceDateAvailable:true,confirmed,unavailable};
  return {found:true,equipment,source,message:`Frota e leituras atuais importadas do SISGEO. ${confirmed} de ${rows.length} equipamentos com checklist registrado neste serviço (08h às 08h). Sem registro válido, a conferência fica em branco.${unavailable?' Consulta do checklist indisponível para '+unavailable+' equipamento(s); tente atualizar novamente.':''}`};
 }catch(e:any){return {found:false,message:(e?.message||'SISGEO indisponível.')+' Inventário preservado; tente atualizar ou preencha manualmente.'};}
}
