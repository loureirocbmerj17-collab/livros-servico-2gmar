import assert from 'node:assert/strict';
export async function run({post,get,sql,password,drawing}){
 const date='2032-04-02';
 globalThis.scaleCrew=Array(15).fill('');globalThis.scaleCrew[0]='CAP RG 99998';globalThis.scaleCrew[5]='SUBTEN RG 99996';globalThis.scaleCrew[8]='SUBTEN RG 99996';globalThis.scaleCrew[12]='CB RG 99996';globalThis.scaleCrew[13]='CB RG 99996';globalThis.scaleCrew[14]='CB RG 99996';globalThis.scaleAdjunto='SUBTEN RG 99996';
 await post('login',{rg:'99998',password});
 const {blank}=await import('../.qa/book-model.mjs');const officer={...blank(date),crew:globalThis.scaleCrew.slice(0,14),activation:'08:00',deactivation:'18:00',prevention:['0','0','0','0'],rescues:['0','0','0','0']};
 await post('save',{date,version:0,data:officer});await post('sign',{date,version:1,data:officer,password,drawing});
 assert.equal((await (await get('op=book&date='+date)).json()).status,'Assinado');
 await post('login',{rg:'99996',password});
 for(const type of ['supervisor','adjunto','nautical','ssmt']){
  const context=await (await get('op='+type+'Context&date='+date)).json();
  const d={...context.blank,responsible:'99996',confirmed:true};
  if(['supervisor','adjunto'].includes(type)){
   d.weatherStatus='manual';d.weather=d.weather.map(w=>({...w,wave:'1',current:'S',wind:'S',air:'27',water:'24'}));
   d.activation={total:'0',partial:'0'};d.stats={rescues:'0',lost:'0',preventions:'0',deaths:'0'};
   d.observations='';d.noLate=false;d.noAbsent=false;
   if(type==='adjunto')d.obm=d.obm.map(r=>({...r,answer:'Sim'}));
  }else if(type==='nautical'){d.sisgeoResponsible='99996';d.sisgeoChecklist='Não realizado';d.deactivation='18:00';}
  for(const item of d.inventory||[]){item.hours=item.hours||'00000';item.condition=item.condition||'OP';item.location=item.location||'Galpão Náutica';}
  await post(type+'Save',{date,version:0,data:d});await post(type+'Sign',{date,version:1,data:d,password,drawing});
  const saved=await(await get('op='+type+'Book&date='+date)).json();assert.equal(saved.status,'Assinado');assert.equal(saved.review,null);
  assert.equal((await get('op='+type+'Pdf&date='+date)).status,200);
  if(['supervisor','adjunto'].includes(type)){
   d.manualPersonnel=[{rg:'543210',name:'CB MILITAR MANUAL'}];d.late=[{rg:'543210',time:'08:10',reason:'Transporte'}];
   await post(type+'Save',{date,version:2,data:d});
   const edited=await(await get('op='+type+'Book&date='+date)).json();assert.equal(edited.data.personnel.find(p=>p.rg==='543210').name,'CB MILITAR MANUAL');
   assert.equal(edited.data.manualPersonnel[0].rg,'543210');assert.equal(edited.data.late[0].rg,'543210');
   await post(type+'Sign',{date,version:3,data:{...d,late:[{...d.late[0],time:''}]},password,drawing},400);
  }
 }
 console.log('PASS five-book audit: zero-change service saved/signed before secondary signatures, optional empty absences/observations, PDFs, manual personnel preserved through retification, conditional incident validation.');
}
