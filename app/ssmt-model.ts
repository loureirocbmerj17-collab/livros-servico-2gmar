export const operationalStockEquipment='Mat Operacional/Estoque';
export const ssmtSections=['Militares','Viaturas','Ocorrências','Assinaturas'];
export const equipmentKinds=['AR','ASE','V1','V4','Outra'];
export const fuelTypes=['Gasolina','Óleo 2T','Gasolina misturada'];
export const nextDay=(date:string)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)};
export function ssmtBlank(date:string){return {date,endDate:nextDay(date),responsible:'',operators:[] as any[],inventory:[] as any[],activations:[] as any[],refuels:[] as any[],purchases:[] as any[],stock:fuelTypes.map(fuel=>({fuel,initial:'0',incoming:'0',outgoing:'0'})),changes:[] as any[],occurrences:[] as any[],sisgeoResponsible:'',sisgeoChecklist:'',radios:'0',chargers:'0',covers:'0',fuelCards:false,keys:false,observations:'',deactivation:'',carryDate:'',confirmed:false};}
export const stockEnd=(s:any)=>Math.round((Number(s.initial)+Number(s.incoming)-Number(s.outgoing))*1000)/1000;
export function validateSsmt(d:any,sign=false):string[]{
 const errors:string[]=[];const str=(v:any)=>typeof v==='string'&&v.length<=5000;const number=(v:any)=>typeof v==='string'&&/^\d+(\.\d{1,3})?$/.test(v)&&Number(v)<=10000000;const time=(v:any)=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 if(!d||typeof d!=='object')return ['Conteúdo inválido.'];
 for(const key of ['operators','inventory'])if(!Array.isArray(d[key])||d[key].length>150)return ['Lista inválida: '+key];
 for(const key of ['date','endDate','responsible','observations','carryDate'])if(!str(d[key]))errors.push('Campo inválido: '+key);
 if(errors.length)return errors;
 if(d.endDate!==nextDay(d.date))errors.push('A passagem deve ser no dia seguinte.');
 if(typeof d.confirmed!=='boolean')errors.push('Confirme a revisão do serviço.');
 if(d.operators.some((r:any)=>!r||!/^\d{3,12}$/.test(r.rg)||!str(r.name)||r.hours!==24))errors.push('Operadores devem ter RG e jornada de 24 horas.');
 for(const r of d.inventory)if(!r||!str(r.id)||!str(r.prefix)||!['','OP','INOP'].includes(r.condition)||!str(r.location)||!str(r.note)||!str(r.unavailableReason)||typeof r.unavailable!=='boolean'||(r.hours!==''&&!number(r.hours)))errors.push('Inventário inválido.');
 if(d.inventory.some((v:any)=>typeof v.sisgeo!=='boolean'||!str(v.driver)))errors.push('Confira os campos SISGEO e condutor de cada viatura.');
 if(sign){if(!d.responsible||!d.operators.some((o:any)=>o.rg===d.responsible))errors.push('Escolha o responsável entre os motoristas.');if(!d.confirmed)errors.push('Confirme a revisão das viaturas.');if(!d.chiefDriverRg)errors.push('Selecione o encarregado de motoristas.');if(d.inventory.some((v:any)=>!v.condition||!v.location.trim()||(v.unavailable?!v.unavailableReason.trim():v.hours==='')))errors.push('Preencha condição, local e odômetro ou justifique a leitura indisponível.');}
 return [...new Set(errors)];
}
