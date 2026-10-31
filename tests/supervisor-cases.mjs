import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PDFDocument} from 'pdf-lib';
export async function run({post,get,sql,drawing,password,qa}){
 const {supervisorBlank,validateSupervisor,effectivePosts}=await import('../.qa/supervisor-model.mjs');
 const {forecastRows}=await import('../.qa/supervisor-weather.mjs');
 const {parseBeachRows,beachPostName}=await import('../.qa/beach-scale.mjs');
 assert.equal(beachPostName('Q. MAR'),'QUEBRA-MAR');assert.equal(beachPostName('POSTO 3,5'),'POSTO 3.5');assert.equal(beachPostName('P. RETORNO'),'RETORNO');
 const row=(values)=>({y:1,items:values.map(([str,x,w=30])=>({str,x,w}))});
 const parsed=parseBeachRows([row([['POSTO',20],['MILITAR',100],['MILITAR',200],['POSTO',320],['MILITAR',400],['MILITAR',500]]),row([['JOATINGA',20],['099996 TESTE',100],['POSTO 8',320],['99998 TESTE',400]]),row([['LICENÇA MÉDICA',20]]),row([['JOATINGA',20],['99997 FORA',100]])]);
 assert.deepEqual(parsed.beachPosts[0].rgs,['99996']);assert.deepEqual(parsed.beachPosts[18].rgs,['99998']);
 assert.deepEqual(forecastRows('2026-10-31',{},{}).map(w=>w.air),['','']);
 const f=forecastRows('2026-10-31',{hourly:{time:['2026-10-31T09:00'],temperature_2m:[28],wind_direction_10m:[180]}},{hourly:{time:['2026-10-31T15:00'],wave_height:[1.2]}});assert.equal(f[0].wind,'S');assert.equal(f[0].wave,'');assert.equal(f[1].wave,'1.2');assert.equal(f[0].current,'');assert.equal(f[0].water,'');
 const d=supervisorBlank('2027-01-02');assert.ok(validateSupervisor(d,true).length);assert.deepEqual(validateSupervisor(d),[]);
 Object.assign(d,{responsible:'99996',weatherStatus:'manual',confirmed:true,noLate:true,noAbsent:true,observations:'Não houve alterações.',activation:{total:'2',partial:'0'},stats:{rescues:'0',lost:'0',preventions:'0'}});d.weather=d.weather.map(w=>({...w,wave:'1.5',current:'S',wind:'SE',air:'28',water:'25'}));for(const m of Object.values(d.meals)){m.quantity='0';m.changes='Não houve fornecimento.';}
 d.posts[0].rgs=['99996'];d.posts[1].rgs=['99998'];d.movements=[{id:'test-move',rg:'99996',from:d.posts[0].post,to:d.posts[1].post,swapRg:'99998',time:'10:00',reason:'Reforço operacional autorizado.'}];
 assert.deepEqual(effectivePosts(d.posts,d.movements)[0].rgs,['99998']);assert.deepEqual(d.posts[0].rgs,['99996']);assert.deepEqual(validateSupervisor(d,true),[]);assert.ok(validateSupervisor({...d,stats:{}},true).length);assert.ok(validateSupervisor({...d,posts:[null]}).length);
 globalThis.scaleCrew=['TEN RG 99998 TESTE','','','','','SUBTEN RG 99996 TESTE'];
 await post('login',{rg:'99996',password});assert.equal((await get('op=supervisorList')).status,200);assert.equal((await get('op=supervisorMonthPdf&month=2027-01')).status,403);
 await post('supervisorSave',{date:d.date,version:0,data:d});await post('supervisorSign',{date:d.date,version:1,data:{...d,responsible:'99998'},password,drawing},403);await post('supervisorSign',{date:d.date,version:1,data:d,password:'wrong',drawing},401);await post('supervisorSign',{date:d.date,version:1,data:d,password,drawing});
 await post('supervisorSave',{date:d.date,version:1,data:d},409);
 await post('login',{rg:'99997',password});await post('supervisorSave',{date:d.date,version:2,data:d},403);await post('supervisorReview',{date:d.date,version:2,password,drawing},403);
 await post('login',{rg:'99996',password});await post('supervisorSave',{date:d.date,version:2,data:d});assert.equal((await sql.query("SELECT signature FROM livros.supervisor_books WHERE date=$1",[d.date])).rows[0].signature,null);
 assert.equal((await sql.query("SELECT * FROM livros.service_attestations WHERE date=$1 AND book_type='supervisor'",[d.date])).rows.length,0);
 await post('supervisorSign',{date:d.date,version:3,data:d,password,drawing});
 await post('login',{rg:'99998',password});await post('supervisorReview',{date:d.date,version:4,password,drawing});
 assert.equal((await sql.query("SELECT officer_rg FROM livros.service_attestations WHERE date=$1 AND book_type='supervisor'",[d.date])).rows[0].officer_rg,'99998');
 await post('login',{rg:'99996',password});await post('supervisorSave',{date:d.date,version:5,data:d},409);await assert.rejects(sql.query('DELETE FROM livros.supervisor_books'));await assert.rejects(sql.query('DELETE FROM livros.supervisor_revisions'));
 const pdf=await get('op=supervisorPdf&date='+d.date);assert.equal(pdf.status,200);const bytes=new Uint8Array(await pdf.arrayBuffer());fs.writeFileSync(qa+'/supervisor.pdf',bytes);assert.ok((await PDFDocument.load(bytes)).getPageCount()>=3);
 assert.equal((await get('op=supervisorPdf&date='+d.date+'&version=2')).status,200);
 await post('login',{rg:'99998',password});assert.equal((await get('op=monthPdf&type=supervisor&month=2027-01')).status,200);
 globalThis.scaleCrew=null;const manual={...d,date:'2027-01-03',endDate:'2027-01-04'};await post('login',{rg:'99996',password});await post('supervisorSave',{date:manual.date,version:0,data:manual},403);await post('supervisorResolve',{date:manual.date,reason:'Escala indisponível; assumo o serviço de Supervisor.',password});await post('supervisorSign',{date:manual.date,version:0,data:manual,password,drawing});
 assert.match((await sql.query('SELECT data FROM livros.supervisor_books WHERE date=$1',[manual.date])).rows[0].data,/Escala indisponível; assumo/);
 assert.equal((await sql.query("SELECT count(*) n FROM livros.supervisor_books WHERE pdf<>''")).rows[0].n,0);
 console.log('PASS Supervisor: roster columns; exact forecast hours/nulls; movements; validation; author/scale/password; justified replacement; retification history; Officer attestation; lock; daily/historical/monthly PDFs; enlisted bulk restriction.');
}
