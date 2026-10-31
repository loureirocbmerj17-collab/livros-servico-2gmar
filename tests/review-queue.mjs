import assert from 'node:assert/strict';
export async function run({post,get,sql,password}){
 for(const rg of ['99998','99996']){await post('login',{rg,password});assert.equal((await get('op=reviewQueue&month=2026-10')).status,403);}
 await post('login',{rg:'99997',password});
 assert.equal((await get('op=reviewQueue&month=invalid')).status,400);
 const source=(await sql.query("SELECT * FROM livros.books WHERE date='2026-10-23'")).rows[0];
 for(const [day,author,status] of [['01','99998','Assinado'],['02','99998','Assinado'],['03','99997','Assinado'],['04','99998','Rascunho']]){
 await sql.query("INSERT INTO livros.books(date,author,author_name,version,status,data,signature,actor,updated,pdf) VALUES($1,$2,'TESTE',1,$3,$4,'signed',$2,$5,'')",['2031-01-'+day,author,status,JSON.stringify({...JSON.parse(source.data),date:'2031-01-'+day}),new Date().toISOString()]);
 if(day!=='02')for(const type of ['supervisor','adjunto','nautica','ssmt'])await sql.query('INSERT INTO livros.service_attestations VALUES($1,$2,1,$3,$4,$3,$4)',['2031-01-'+day,type,author,JSON.stringify({chief:{attestation:'test-chief'},rg:author,attestation:'test-officer'})]);
 }
 let rows=await (await get('op=reviewQueue&month=2031-01')).json();
 assert.deepEqual(rows.map(r=>r.group),['ready','pending','pending','pending']);
 assert.ok(rows[2].reasons.some(r=>r.includes('Outro subcomandante')));
 assert.equal(rows[1].dependencies.filter(d=>!d.complete).length,4);
 assert.equal(rows.some(r=>r.data||r.signature),false);
 await post('login',{rg:'99999',password});
 assert.equal((await get('op=reviewQueue&month=2031-01')).status,200);
 await post('review',{date:'2031-01-01',version:1,password},403);
 await post('login',{rg:'99997',password});
 await post('review',{date:'2031-01-01',version:1,password});
 rows=await (await get('op=reviewQueue&month=2031-01')).json();assert.equal(rows[0].group,'reviewed');
 await post('review',{date:'2031-01-01',version:1,password},409);
 await post('review',{date:'2031-01-02',version:1,password},409);
 console.log('PASS SUBCMT queue: reviewer-only; month validation; ready/pending/self/draft/reviewed; individual review and duplicate protection.');
}
