// Server-only SISGEO fleet adapter. No cookies, tokens or user credentials.
export const FLEET_URL='https://sisgeo.cbmerj.rj.gov.br/Sisgeo/Manager/GetConsultaViatura';
export type FleetKind='nautical'|'ssmt';
const allowed={nautical:['AMA','BIR','RTE','AQ','AQS'],ssmt:['AR','ASE','V1','V4','VL']};
export const fleetKey=(s:string)=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
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
export async function loadFleet(kind:FleetKind){
 const response=await fetch(FLEET_URL,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({unidadecarga:'',unidadelotacao:'2GMAR',finalidade:'',ano:'',prefixo:'',situacaoconsulta:'1,0',viatura:''}),redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('Consulta de viaturas SISGEO indisponível ou exige autenticação.');
 const text=await response.text();if(text.length>4000000)throw Error('Resposta da frota acima do limite.');
 return parseFleet(JSON.parse(text),kind);
}
export async function syncFleet(db:any,rg:string,kind:FleetKind,date:string,now=new Date(),loader=loadFleet){
 if(!currentFleetService(date,now))return {found:false,historical:true,message:'O SISGEO fornece a frota atual, sem histórico por serviço. Dados deste dia preservados; preenchimento manual disponível.'};
 const table=kind==='nautical'?'livros.nautical_equipment':'livros.ssmt_equipment';
 try{
  const rows=await loader(kind),catalog=(await db.prepare('SELECT * FROM '+table+' ORDER BY id').all()).results;
  // Empty response is ambiguous (outage/filter change): never mass-deactivate on it.
  if(!rows.length)throw Error('Nenhum equipamento retornado; cadastros preservados.');
  const at=now.toISOString(),statements:any[]=[],present=new Set<string>();
  for(const row of rows){
   const matches=catalog.filter((e:any)=>fleetKey(e.prefix)===row.key),old=matches.find((e:any)=>e.initial_data?.sisgeo?.id===row.externalId)||matches[0];
   const id=old?.id||'sisgeo-'+row.key;present.add(id);
   const meta={id:row.externalId,key:row.key,at,serviceDate:date,lotacao:'2GMAR',condition:row.condition,hours:row.hours,conferenceCode:row.conferenceCode,conferenceAt:null,operational:row.operational};
   const initial={...(old?.initial_data||{}),condition:row.condition,hours:row.hours,sisgeo:meta};
   statements.push(db.prepare('INSERT INTO '+table+'(id,prefix,kind,model,description,active,initial_data,updated,actor) VALUES(?,?,?,?,?,true,?::jsonb,?,?) ON CONFLICT(prefix) DO UPDATE SET active=true,initial_data=excluded.initial_data,updated=excluded.updated,actor=excluded.actor WHERE '+table+'.updated<=excluded.updated').bind(id,old?.prefix||row.prefix,old?.kind||row.kind,old?.model||row.model,old?.description||row.description,JSON.stringify(initial),at,rg));
   for(const duplicate of matches.filter((e:any)=>e.id!==id))statements.push(db.prepare('UPDATE '+table+' SET active=false,initial_data=?,updated=?,actor=? WHERE id=? AND updated<=?').bind(JSON.stringify({...duplicate.initial_data,sisgeo:{...meta,duplicateOf:id}}),at,rg,duplicate.id,at));
  }
  for(const old of catalog)if(old.initial_data?.sisgeo&&!present.has(old.id)&&!rows.some((r:any)=>r.key===fleetKey(old.prefix)))statements.push(db.prepare('UPDATE '+table+' SET active=false,updated=?,actor=? WHERE id=? AND updated<=?').bind(at,rg,old.id,at));
  statements.push(db.prepare('INSERT INTO admin_log(actor,action,updated) VALUES(?,?,?)').bind(rg,'Sincronização SISGEO '+kind+': '+rows.length+' equipamentos da lotação 2GMAR; sem alteração de livros assinados.',at));
  await db.batch(statements);
  const equipment=(await db.prepare('SELECT * FROM '+table+' ORDER BY prefix').all()).results;
  const source={provider:'SisGeO',date,queriedAt:at,lotacao:'2GMAR',window:'08h às 08h',conferenceDateAvailable:false};
  return {found:true,equipment,source,message:'Frota e leituras atuais importadas do SISGEO. A consulta não informa a data da conferência; esse campo fica em branco.'};
 }catch(e:any){return {found:false,message:(e?.message||'SISGEO indisponível.')+' Inventário preservado; tente atualizar ou preencha manualmente.'};}
}
