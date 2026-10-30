import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
export async function run({post,get,sql,drawing,password,qa}){
const date='2026-12-12';await post('login',{rg:'99999',password});await sql.query("INSERT INTO livros.settings(key,value) VALUES('ssmtChief','99997')");
const eq=await post('ssmtEquipmentSave',{prefix:'ASE-TESTE',kind:'ASE',active:true,initial_data:{hours:'100',location:'2º GMAR',condition:'OP'}});
globalThis.scaleCrew=Array(14).fill('');globalThis.scaleCrew[0]='CAP RG 99998 OFICIAL';globalThis.scaleCrew[12]='CB RG 99996 MOTORISTA';globalThis.scaleCrew[13]='CB RG 99996 MOTORISTA';
await post('login',{rg:'99996',password});const c=await(await get('op=ssmtContext&date='+date)).json();assert.equal(c.blank.operators.length,1);assert.equal(c.blank.chiefDriverRg,'99996');assert.equal(c.blank.inventory[0].sisgeo,false);
const d={...c.blank,responsible:'99996',confirmed:true};d.inventory=d.inventory.map(v=>({...v,driver:'99996',sisgeo:true}));
d.inventory=d.inventory.map(v=>({...v,driver:''}));d.refuels=[{invalid:true}];
await post('ssmtSave',{date,version:0,data:d});const next=await(await get('op=ssmtContext&date=2026-12-13')).json();assert.equal(next.blank.inventory[0].hours,'100');assert.equal(next.blank.inventory[0].condition,'OP');await post('ssmtSign',{date,version:1,data:d,password,drawing});
assert.equal((await get('op=monthPdf&type=ssmt&month=2026-12')).status,403);
await post('login',{rg:'99998',password});await post('ssmtReview',{date,version:2,password,drawing},409);
await post('login',{rg:'99997',password});await post('ssmtChiefReview',{date,version:2,password,drawing});
await post('login',{rg:'99996',password});await post('ssmtSave',{date,version:3,data:d},409);
await post('login',{rg:'99998',password});await post('ssmtReview',{date,version:3,password,drawing});
const row=(await sql.query('SELECT * FROM livros.ssmt_books WHERE date=$1',[date])).rows[0];assert.equal(row.status,'Conferido');fs.writeFileSync(path.join(qa,'ssmt-daily.pdf'),new Uint8Array(await (await get('op=ssmtPdf&date='+date)).arrayBuffer()));
assert.equal((await get('op=monthPdf&type=ssmt&month=2026-12')).status,200);
await post('login',{rg:'99996',password});assert.equal((await(await get('op=ssmtList')).json()).length,1);const overview=await(await get('op=operationalOverview')).json();assert.equal(overview.ssmt.date,date);assert.equal(overview.ssmt.inventory[0].sisgeo,true);
assert.equal((await sql.query("SELECT officer_rg FROM livros.service_attestations WHERE date=$1 AND book_type='ssmt'",[date])).rows[0].officer_rg,'99998');
console.log('PASS SSMT: roster deduplication, vehicles, SISGEO, signatures, chief/officer workflow, immutable review, monthly permissions, overview.');}
