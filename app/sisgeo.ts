export const SISGEO_URL='https://sisgeo.cbmerj.rj.gov.br/Sisgeo/Mar/GetConsultaParciaisMaritimo';
const codes=['2GMAR','D3/M','D4/M','D5/M'];
const metrics=['PrevencaoTotal','ResgateTotal','PerdidoTotal','ApoioTotal','OutroTotal'];
export function parseSisgeo(rows:any,date:string){
 if(!Array.isArray(rows)||!rows.length||rows.length>10000)throw new Error('O SisGeO não retornou registros válidos para este dia.');
 const sums=codes.map(()=>metrics.map(()=>0)),seen=codes.map(()=>false),posts=new Map<string,any>();
 for(const r of rows){
  const i=codes.indexOf(r?.Grupamento);if(i<0)continue;
  if(typeof r.Posto!=='string'||metrics.some(k=>typeof r[k]!=='number'||!Number.isSafeInteger(r[k])||r[k]<0))throw new Error('O formato das estatísticas do SisGeO mudou. Use a mensagem ou preencha manualmente.');
  // Empty catalogue entries are not proof of a reported zero for the service.
  if(!(Number(r.CodigoParcial)>0||metrics.some(k=>r[k]>0)))continue;
  seen[i]=true;metrics.forEach((k,j)=>{sums[i][j]+=r[k];if(!Number.isSafeInteger(sums[i][j]))throw new Error('Quantitativo inválido.');});
  const name=r.Posto.trim(),key=r.Grupamento+'|'+name;const p=posts.get(key)||{unit:r.Grupamento,post:name,prevention:0,rescues:0};p.prevention+=r.PrevencaoTotal;p.rescues+=r.ResgateTotal;posts.set(key,p);
 }
 if(!seen.some(Boolean))throw new Error('Não há lançamentos identificados para este dia. Campos mantidos; ausência de lançamento não significa zero.');
 const patch:any={prevention:sums.map((s,i)=>seen[i]?String(s[0]):''),rescues:sums.map((s,i)=>seen[i]?String(s[1]):'')};
 if(seen.every(Boolean))for(const [key,metric] of [['topPrevention','prevention'],['topRescue','rescues']]){const max=Math.max(...Array.from(posts.values()).map(p=>p[metric]));patch[key]=max?Array.from(posts.values()).filter(p=>p[metric]===max).map(p=>`${p.post} (${p.unit})`).join('; '):'NÃO HOUVE';patch[key+'Count']=String(max);}
 return {date,patch,units:codes.map((code,i)=>({code,reported:seen[i],prevention:sums[i][0],rescues:sums[i][1],lost:sums[i][2],aid:sums[i][3],other:sums[i][4]})),warnings:[...seen.flatMap((v,i)=>v?[]:[`Sem lançamento identificado em ${codes[i]}; os campos desta unidade serão preservados.`]),'Consulta inclui registros em andamento. Confira os quantitativos antes de assinar.'],source:{provider:'SisGeO',date,queriedAt:new Date().toISOString(),onlyClosed:false}};
}
const sisgeoUnavailable = (message: string) => Object.assign(new Error(message), {status: 503});
const retryableStatus = new Set([502, 503, 504]);
const safeCode = (value: unknown) => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value) ? value : undefined;
const waitBeforeRetry = () => new Promise<void>(resolve => setTimeout(resolve, 350));

export async function loadSisgeo(date:string){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Data inválida.');
 const body = JSON.stringify({grupamento:codes.join(','),dataInicio:date+' 00:00:00',dataFim:date+' 23:59:59',agrupado:false,evesp:'',somenteFechadas:false});
 // The upstream POST only reads statistics. Retry a transport failure or temporary gateway response once.
 for (let attempt = 1; attempt <= 2; attempt++) {
  let response: Response;
  let payload: string | undefined;
  const signal = AbortSignal.timeout(10000);
  try {
   response = await fetch(SISGEO_URL,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body,redirect:'manual',signal});
   if(response.ok && response.headers.get('content-type')?.includes('application/json')) payload = await response.text();
   else await response.body?.cancel().catch(()=>{});
  } catch(error) {
   const failure = error as {code?:unknown,cause?:{code?:unknown}};
   console.warn('sisgeo_stats_transport_failure',{date,attempt,timeout:signal.aborted,code:safeCode(failure?.cause?.code)??safeCode(failure?.code)??'UNKNOWN'});
   if(attempt===1){await waitBeforeRetry();continue;}
   throw sisgeoUnavailable(signal.aborted
    ? 'O SisGeO demorou a responder. Tente novamente ou preencha manualmente.'
    : 'Não foi possível conectar ao SisGeO. Tente novamente ou preencha manualmente.');
  }
  if(retryableStatus.has(response.status)){
   console.warn('sisgeo_stats_gateway_failure',{date,attempt,status:response.status});
   if(attempt===1){await waitBeforeRetry();continue;}
  }
  if(payload===undefined){
   if([401,403].includes(response.status)||(response.status>=300&&response.status<400)){
    throw sisgeoUnavailable('O SisGeO restringiu o acesso à consulta. Preencha manualmente.');
   }
   throw sisgeoUnavailable('O SisGeO não retornou as estatísticas. Tente novamente ou preencha manualmente.');
  }
  if(payload.length>4000000)throw sisgeoUnavailable('Resposta do SisGeO excedeu o limite.');
  let rows: unknown;
  try { rows = JSON.parse(payload); }
  catch { throw sisgeoUnavailable('O SisGeO retornou uma resposta inválida. Preencha manualmente.'); }
  return parseSisgeo(rows,date);
 }
 throw sisgeoUnavailable('O SisGeO está indisponível. Preencha manualmente.');
}
