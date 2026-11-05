// Pure merge shared by the server and client. Never copies a checker into a driver.
export function mergeFleetInventory(current:any[],equipment:any[],kind:'nautical'|'ssmt',date:string){
 const byId=new Map(equipment.map(e=>[e.id,e]));
 const activeKeys=new Set(equipment.filter(e=>e.active!==false&&e.initial_data?.sisgeo).map(e=>e.initial_data.sisgeo.key));
 const key=(v:string)=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 const merged=equipment.filter(e=>e.active!==false).map(e=>{
  const old=current.find(i=>i.id===e.id)||current.find(i=>key(i.prefix)===key(e.prefix));
  const initial=e.initial_data||{},source=initial.sisgeo,live=source?.serviceDate===date;
  const item={id:e.id,prefix:e.prefix,kind:e.kind,condition:old?.condition||initial.condition||'',location:old?.location||initial.location||(kind==='nautical'?'Galpão Náutica':'2º GMAR'),hours:old?.hours??initial.hours??'',previousHours:old?.previousHours||old?.hours||'',unavailable:old?.unavailable||false,unavailableReason:old?.unavailableReason||'',note:old?.note||'',driver:old?.driver||'',sisgeo:old?.sisgeo??null,...old};
  if(live)return {...item,id:e.id,prefix:e.prefix,condition:source.condition,hours:source.hours,unavailable:false,unavailableReason:'',sisgeo:source.conferenceAt?true:null,fleetSource:source};
  return item;
 });
 // Only exclusively manual rows survive absence from the remote fleet.
 for(const old of current)if(!byId.has(old.id)&&!old.fleetSource&&!activeKeys.has(key(old.prefix)))merged.push(old);
 return merged;
}
