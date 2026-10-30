export const units=['2º GMAR · Barra','DBM 3/M · Recreio','DBM 4/M · Guaratiba','DBM 5/M · Sepetiba'];
export const roles=['Of. de Dia e Cmt. Op.','Of. de RAS – 2º GMAR','Of. de RAS – DBM','Cmt. da Guarda','Comunicante','Supervisor de Praia','Of. Médico','Téc. Enfermagem','OER AMA 1 (24h)','OER AMA 2 (24h)','OER AMA 3','COMAT','Motorista ASE','Motorista AR / SOS'];
export const support=['PMERJ','PCERJ','Marinha do Brasil','GOA','GBS','Capitania dos Portos','Guarda Municipal','CET-Rio'];
export const sections=['Início e importação','Ala de serviço','Ativação e apoio','Estatísticas','Alterações de pessoal','Ordens e meios','Ocorrências e assinatura'];
export function blank(date:string){return {date,endDate:nextDay(date),crew:roles.map(()=>''),activation:'',deactivation:'',weather:'',divers:'Não',riders:'Não',support:support.map(()=>'0'),prevention:units.map(()=>''),rescues:units.map(()=>''),physical:units.map(()=>''),forms:units.map(()=>''),topPrevention:'',topPreventionCount:'',topRescue:'',topRescueCount:'',personnel:'',absences:'',orders:'',vehicles:'',boats:'',occurrences:'',notes:'',sourceMessage:''};}
export function nextDay(date:string){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
export function parseMessage(raw:string){
 const text=raw.replace(/\*/g,'').replace(/\r/g,'');const warnings:string[]=[];const patch:any={sourceMessage:raw};
 const date=text.match(/Servi[çc]o de praia do dia\s*(\d{2})\/(\d{2})\/(\d{4})/i);if(date)patch.date=`${date[3]}-${date[2]}-${date[1]}`;
 const hour=text.match(/encerrado\s+[àa]s\s*(\d{1,2}):(\d{2})/i);if(hour)patch.deactivation=`${hour[1].padStart(2,'0')}:${hour[2]}`;
 const extract=(name:string,end:string,key:string)=>{const s=text.match(new RegExp(name+'\\s*:\\s*([\\s\\S]*?)(?='+end+'|$)','i'))?.[1];if(!s){warnings.push('Bloco não encontrado: '+name);return;}patch[key]=['Barra','Recreio','Guaratiba','Sepetiba'].map(u=>{const m=s.match(new RegExp(u+'\\s*:\\s*(\\d+)','i'));return m?String(Number(m[1])):'';});const total=s.match(/Total\s*:\s*(\d+)/i);if(patch[key].includes(''))warnings.push('Há unidades sem valor em '+name);if(total&&patch[key].every((x:string)=>x!=='')&&patch[key].reduce((a:number,b:string)=>a+Number(b),0)!==Number(total[1]))warnings.push('Total divergente em '+name+'; confira os valores.');};
 extract('Preven[çc][õo]es','Posto com maior|Socorros','prevention');extract('Socorros','Posto com maior|REFERENTE','rescues');
 for(const [word,key] of [['preven[çc][õo]es','topPrevention'],['resgates|socorros','topRescue']]){const m=text.match(new RegExp('Posto com maior n[úu]mero de (?:'+word+')\\s*:\\s*([^;\\n]+)','i'));if(m){const c=m[1].trim().match(/^(.*?)\s+COM\s+(\d+)\s*$/i);patch[key]=c?c[1].trim():m[1].trim();patch[key+'Count']=c?String(Number(c[2])):/N[ÃA]O HOUVE/i.test(m[1])?'0':'';}}
 return {patch,warnings};
}
export function validateBook(d:any){const issues:string[]=[];if(!d.crew?.[0]?.trim())issues.push('Identifique o Oficial de Dia.');if(!d.activation||!d.deactivation)issues.push('Informe os horários de ativação e desativação.');for(const k of ['prevention','rescues'])if(!Array.isArray(d[k])||d[k].length!==4||d[k].some((v:any)=>v===''||!/^\d+$/.test(String(v))))issues.push('Complete os quatro valores de '+({prevention:'prevenções',rescues:'socorros',physical:'BRO físicos',forms:'BRO Forms'} as any)[k]+'.');return issues;}
export function lines(d:any){const total=(a:any[])=>a?.some(v=>v==='')?'Não informado':a?.reduce((s,v)=>s+Number(v),0);return [
'1. ALA DE SERVIÇO',...roles.map((r,i)=>r+': '+(d.crew?.[i]||'Não informado')),'',
'2. ATIVAÇÃO / DESATIVAÇÃO DA PRAIA',`Ativação: ${d.activation||'Não informada'} | Desativação: ${d.deactivation||'Não informada'}`,`Condições meteorológicas: ${d.weather||'Não informadas'}`,'',
'3. APOIO OPERACIONAL',`Mergulhadores: ${d.divers||'Não informado'} | Motossocorristas: ${d.riders||'Não informado'}`,...support.map((s,i)=>s+': '+(d.support?.[i]||'Não informado')),'',
'4. ESTATÍSTICA - PREVENÇÕES',...units.map((u,i)=>u+': '+(d.prevention?.[i]??'')),`Total: ${total(d.prevention)}`,'',
'5. SOCORROS',...units.map((u,i)=>u+': '+(d.rescues?.[i]??'')),`Total: ${total(d.rescues)}`,'',
'6. POSTOS COM MAIORES QUANTITATIVOS',`Prevenções: ${d.topPrevention||'Não informado'} | Quantidade: ${d.topPreventionCount}`,`Socorros: ${d.topRescue||'Não informado'} | Quantidade: ${d.topRescueCount}`,'',
'7. ALTERAÇÕES DE PESSOAL 1 (LICENCIADO / DISPENSADO / PRESO / DETIDO)',d.personnel||'Não informado','',
'8. ALTERAÇÕES DE PESSOAL 2 (NOME, RG, FALTAS, ATRASOS, OBSERVAÇÕES)',d.absences||'Não informado','',
'9. ORDENS EM VIGOR',d.orders||'Não informado','',
'10. ALTERAÇÕES COM VIATURAS',d.vehicles||'Não informado','',
'11. ALTERAÇÕES COM EMBARCAÇÕES',d.boats||'Não informado','',
'12. OCORRÊNCIAS (DESAPARECIDOS, ÓBITOS E OUTROS SOCORROS)',d.occurrences||'Não informado','',
'13. OUTRAS OBSERVAÇÕES',d.notes||'Não informado'];}
