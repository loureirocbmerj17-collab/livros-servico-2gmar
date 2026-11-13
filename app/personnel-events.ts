export type Military = {rg:string; name:string; rank:string};
export type PersonnelEvent = {
 id:string; kind:string; military:Military; replacement:Military;
 situation:string; duration:string; reason:string; time:string; notes:string;
};
export const eventLabels:Record<string,string> = {
 absence:'Lançar afastamento', delay:'Lançar atraso', missing:'Lançar falta',
 swap:'Registrar permuta', release:'Registrar liberação antecipada'
};
function militaryLabel(p:Military){return p?`${p.rank} ${p.name}, RG ${p.rg}`.trim():'';}
export function eventText(e:PersonnelEvent){
 const person=militaryLabel(e.military);
 const texts:Record<string,string>={
  absence:`${person} — ${e.situation}. Período: ${e.duration==='NFPA'?'NFPA':e.duration+' dia(s)'}.`,
  delay:`Atraso em formatura: ${person}. Apresentou-se às ${e.time}. Motivo: ${e.reason}.`,
  missing:`Falta de serviço: ${person}. Motivo: ${e.reason}.`,
  swap:`Permuta de serviço autorizada pelo Oficial de Dia: sai ${person}; entra ${militaryLabel(e.replacement)}.`,
  release:`Liberação antecipada: ${person}. Saída às ${e.time}. Motivo: ${e.reason}.`
 };
 return texts[e.kind]+(e.notes?' Observações: '+e.notes:'');
}
export function validateEvent(e:PersonnelEvent){
 if(!e||!eventLabels[e.kind])return 'Selecione o tipo de lançamento.';
 const validPerson=(p:Military)=>p&&/^\d{3,12}$/.test(p.rg)&&typeof p.name==='string'&&!!p.name.trim()&&p.name.length<=150&&typeof p.rank==='string'&&p.rank.length<=60;
 if(!validPerson(e.military))return 'Informe o militar e um RG válido.';
 if(e.kind==='swap'&&(!validPerson(e.replacement)||e.replacement.rg===e.military.rg))return 'Selecione outro militar para entrar na permuta.';
 if(e.kind==='absence'&&(!['Licenciado','Dispensado','Preso','Detido'].includes(e.situation)||!(e.duration==='NFPA'||/^[1-9]\d{0,3}$/.test(e.duration))))return 'Selecione a situação e informe dias ou NFPA.';
 if(['delay','missing','release'].includes(e.kind)&&(typeof e.reason!=='string'||!e.reason.trim()))return 'Informe o motivo.';
 if(['delay','release'].includes(e.kind)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time))return 'Informe um horário válido.';
 if(typeof e.notes!=='string'||e.notes.length>3000||typeof e.reason!=='string'||e.reason.length>3000)return 'Limite de 3.000 caracteres por relato.';
 return '';
}
export function applyPersonnelEvents(data:any){
 if(data.personnelEvents===undefined)return data;
 const rows=data.personnelEvents;
 if(!Array.isArray(rows)||rows.length>150)throw Error('Limite de 150 lançamentos de pessoal.');
 const ids=new Set();
 for(const row of rows){const error=validateEvent(row);if(error)throw Error(error);if(typeof row.id!=='string'||!row.id||row.id.length>100||ids.has(row.id))throw Error('Identificador de lançamento inválido.');ids.add(row.id);}
 const personnelManual=data.personnelManual??'',absencesManual=data.absencesManual??'';
 if(typeof personnelManual!=='string'||typeof absencesManual!=='string')throw Error('Relato manual inválido.');
 return {...data,personnelManual,absencesManual,
  personnel:[personnelManual,...rows.filter(e=>e.kind==='absence').map(eventText)].filter(Boolean).join('\n\n'),
  absences:[absencesManual,...rows.filter(e=>e.kind!=='absence').map(eventText)].filter(Boolean).join('\n\n')};
}
