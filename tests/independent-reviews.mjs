import assert from 'node:assert/strict';
export async function run({post,sql,password,drawing}){
 const {dependencies}=await import('../.qa/service-policy.mjs');let day=1;
 for(const [op,table,type,source] of [['nautical','nautical_books','nautica','2026-11-02'],['ssmt','ssmt_books','ssmt','2026-12-12']])for(const first of ['Review','ChiefReview']){
 const original=(await sql.query(`SELECT * FROM livros.${table} WHERE date=$1`,[source])).rows[0];const date=`2027-04-0${day++}`;const d={...JSON.parse(original.data),date,endDate:`2027-04-0${day}`};delete d.manualRosterId;
 globalThis.scaleCrew=Array(15).fill('');globalThis.scaleCrew[0]='CAP RG 99998 OFICIAL';globalThis.scaleCrew[8]='CB RG 99996 OPERADOR';globalThis.scaleCrew[12]='CB RG 99996 MOTORISTA';
 await post('login',{rg:'99996',password});await post(op+'Sign',{date,version:0,data:d,password,drawing});
 const second=first==='Review'?'ChiefReview':'Review';const actor=a=>a==='Review'?'99998':'99997';
 await post('login',{rg:actor(first),password});await post(op+first,{date,version:1,password,drawing});await post(op+first,{date,version:2,password,drawing},409);
 const before=(await sql.query(`SELECT * FROM livros.${table} WHERE date=$1`,[date])).rows[0];assert.equal(before.status,'Assinado');const firstProof=JSON.parse(before.review);assert.equal(first==='Review'?firstProof.rg:firstProof.chief.rg,actor(first));
 let rows=(await sql.query('SELECT * FROM livros.service_attestations WHERE date=$1',[date])).rows;assert.equal(dependencies(rows,'99998').find(r=>r.id===type).complete,false);
 await post('login',{rg:'99996',password});await post(op+'Save',{date,version:2,data:d},409);
 await post('login',{rg:actor(second),password});await post(op+second,{date,version:1,password,drawing},409);await post(op+second,{date,version:2,password,drawing});
 const after=(await sql.query(`SELECT * FROM livros.${table} WHERE date=$1`,[date])).rows[0];assert.equal(after.status,'Conferido');assert.equal(after.data,before.data);assert.equal(after.signature,before.signature);const proof=JSON.parse(after.review);assert.equal(proof.rg,'99998');assert.equal(proof.chief.rg,'99997');assert.equal(first==='Review'?proof.attestation:proof.chief.attestation,first==='Review'?firstProof.attestation:firstProof.chief.attestation);
 rows=(await sql.query('SELECT * FROM livros.service_attestations WHERE date=$1',[date])).rows;assert.equal(dependencies(rows,'99998').find(r=>r.id===type).complete,true);assert.equal(dependencies(rows,'99997').find(r=>r.id===type).complete,false);
 }
 console.log('PASS both signature orders in Náutica/SSMT: immutable first signature, no overwrite, duplicate rejection, stale-version rejection, both required for Major dependency.');
}
