export const operationalStockEquipment='Mat Operacional/Estoque';
export const nauticalSections=['Militares','Embarcações','Ativações','Combustível','Alterações','Passagem','Assinaturas'];
export const equipmentKinds=['AMA','BIR','AQ','Motor de popa','Carreta','Outro'];
export const fuelTypes=['Gasolina','Óleo 2T','Gasolina misturada'];
export const nextDay=(date:string)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)};
export function nauticalBlank(date:string){return {date,endDate:nextDay(date),responsible:'',operators:[] as any[],inventory:[] as any[],activations:[] as any[],refuels:[] as any[],purchases:[] as any[],stock:fuelTypes.map(fuel=>({fuel,initial:'0',incoming:'0',outgoing:'0'})),changes:[] as any[],occurrences:[] as any[],sisgeoResponsible:'',sisgeoChecklist:'',radios:'0',chargers:'0',covers:'0',fuelCards:false,keys:false,observations:'',deactivation:'',carryDate:'',confirmed:false};}
// Compras entram no estoque; somente abastecimentos retirados do estoque da unidade saem dele.
export const fromUnitStock=(r:any)=>r?.origin==='Estoque da unidade';
export function stockMovements(d:any){const sum=(rows:any[],fuel:string)=>String(Math.round(rows.filter((r:any)=>r.fuel===fuel).reduce((n:number,r:any)=>n+Number(r.liters||0),0)*1000)/1000);return d.stock.map((s:any)=>({...s,incoming:sum(d.purchases,s.fuel),outgoing:sum(d.refuels.filter(fromUnitStock),s.fuel)}));}
export const stockEnd=(s:any)=>Math.round((Number(s.initial)+Number(s.incoming)-Number(s.outgoing))*1000)/1000;
export function validateNautical(d:any,sign=false):string[]{
 const errors:string[]=[];const str=(v:any)=>typeof v==='string'&&v.length<=5000;const number=(v:any)=>typeof v==='string'&&/^\d+(\.\d{1,3})?$/.test(v)&&Number(v)<=10000000;const time=(v:any)=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 if(!d||typeof d!=='object')return ['Conteúdo inválido.'];
 for(const key of ['operators','inventory','activations','refuels','purchases','stock','changes','occurrences'])if(!Array.isArray(d[key])||d[key].length>150)return ['Lista inválida ou acima de 150 registros: '+key];
 for(const key of ['date','endDate','responsible','sisgeoResponsible','sisgeoChecklist','radios','chargers','covers','observations','deactivation','carryDate'])if(!str(d[key]))errors.push('Campo inválido: '+key);
 if(errors.length)return errors;
 if(d.endDate!==nextDay(d.date))errors.push('A passagem deve ser no dia seguinte.');
 if(!['','Realizado','Não realizado','Parcial'].includes(d.sisgeoChecklist))errors.push('Checklist SISGEO inválido.');
 for(const key of ['fuelCards','keys','confirmed'])if(typeof d[key]!=='boolean')errors.push('Marcação inválida: '+key);
 for(const key of ['radios','chargers','covers'])if(!/^\d{1,5}$/.test(d[key]))errors.push('Quantidade de materiais inválida.');
 if(d.deactivation&&!time(d.deactivation))errors.push('Horário de desativação inválido.');
 if(d.operators.some((r:any)=>!r||!/^\d{3,12}$/.test(r.rg)||!str(r.name)||r.hours!==24))errors.push('Operadores devem ter RG e jornada de 24 horas.');
 for(const r of d.inventory)if(!r||!str(r.id)||!str(r.prefix)||!['','OP','INOP'].includes(r.condition)||!str(r.location)||!str(r.note)||!str(r.unavailableReason)||typeof r.unavailable!=='boolean'||(r.hours!==''&&!number(r.hours)))errors.push('Inventário inválido.');
 for(const key of ['activations','refuels','purchases','changes','occurrences']){const ids=new Set();for(const r of d[key]){if(!r||!str(r.id)||!r.id||ids.has(r.id)){errors.push('Registro repetido ou inválido.');break;}ids.add(r.id);}}
 for(const r of d.activations)if(!str(r.equipment)||!str(r.post)||!Array.isArray(r.crew)||r.crew.some((v:any)=>!str(v))||!time(r.start)||(r.end&&!time(r.end)))errors.push('Informe posto, horários e guarnição da ativação.');
 for(const key of ['refuels','purchases'])for(const r of d[key])if(!str(r.equipment)||!fuelTypes.includes(r.fuel)||!number(r.liters)||Number(r.liters)<=0||(key==='purchases'&&!str(r.receipt))||(key==='refuels'&&(!time(r.time)||!str(r.responsible)||!['Estoque da unidade','Externo'].includes(r.origin))))errors.push('Abastecimento/compra: informe combustível, litros positivos e campos obrigatórios.');
 if(d.stock.length!==3||new Set(d.stock.map((s:any)=>s.fuel)).size!==3||d.stock.some((s:any)=>!fuelTypes.includes(s.fuel)||!number(s.initial)||!number(s.incoming)||!number(s.outgoing)||stockEnd(s)<0))errors.push('Estoque: saldos devem ser numéricos e não negativos.');
 for(const r of d.changes)if(!str(r.equipment)||!str(r.description)||!str(r.order)||!/^\d{4}-\d{2}-\d{2}$/.test(r.since)||!['Pendente','Resolvida'].includes(r.status))errors.push('Alteração de material inválida.');
 for(const r of d.occurrences)if(!time(r.time)||!str(r.event)||!str(r.equipment)||!str(r.description)||!str(r.reason)||!['Sim','Não'].includes(r.questio)||typeof r.cancelled!=='boolean'||(!r.cancelled&&!r.event.trim()))errors.push('Ocorrência: informe horário, evento e Quesito; cancelamentos podem ficar sem evento.');
 if(sign){if(!d.responsible||!d.operators.some((o:any)=>o.rg===d.responsible))errors.push('Selecione o responsável entre os operadores.');if(!d.confirmed)errors.push('Confirme a revisão dos dados recuperados e do inventário.');if(!d.sisgeoChecklist||!d.sisgeoResponsible||!d.deactivation)errors.push('Complete SISGEO e desativação.');if(d.inventory.some((r:any)=>!r.condition||(r.unavailable?!r.unavailableReason.trim():r.hours==='')))errors.push('Confirme OP/INOP e horímetro, ou justifique leitura indisponível, de cada equipamento.');if(d.activations.some((r:any)=>!r.post.trim()||!r.crew.length))errors.push('Complete posto e guarnição das ativações.');if(d.changes.some((r:any)=>!r.description.trim())||d.occurrences.some((r:any)=>!r.description.trim()))errors.push('Descreva as alterações e ocorrências.');}
 return [...new Set(errors)];
}
