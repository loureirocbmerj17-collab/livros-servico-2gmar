import ts from 'typescript';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {PGlite} from '@electric-sql/pglite';import {PDFDocument} from 'pdf-lib';
const qa=path.resolve('.qa');fs.mkdirSync(qa,{recursive:true});
function compile(source,dest){fs.writeFileSync(path.join(qa,dest+'.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '\.\/([^']+)'/g,"from './$1.mjs'"))}
for(const n of ['book-model','brand','handwriting','pdf-fonts','pdf','scale','sisgeo','monthly-pdf','service-policy','person-label','nautica-model','nautica-brand','nautica-pdf','nautica-server','ssmt-model','ssmt-pdf','ssmt-server'])compile(fs.readFileSync('app/'+n+'.ts','utf8'),n);
compile(fs.readFileSync('lib/database.ts','utf8'),'database');compile(fs.readFileSync('lib/storage.ts','utf8'),'storage');
const {folderFiles,matchesDay,newestScale,driveFileTimes}=await import(pathToFileURL(path.join(qa,'scale.mjs')));
assert.deepEqual(folderFiles('<tr data-id="doc123"><td aria-label="27 DE OUTUBRO Google Docs Shared"></td></tr><tr data-id="pdf123"><td aria-label="28 DE OUTUBRO.pdf Shared"></td></tr>'),[{id:'doc123',name:'27 DE OUTUBRO',type:'doc'},{id:'pdf123',name:'28 DE OUTUBRO.pdf',type:'pdf'}]);
assert.equal(matchesDay('13 OUTUBRO','2026-10-13'),true);
assert.equal(matchesDay('27 DE OUTUBRO','2026-10-27'),true);
assert.equal(matchesDay('27 DE OUTUBRO DE 2025','2026-10-27'),false);
assert.equal(matchesDay('28 DE OUTUBRO.pdf','2026-10-27'),false);
assert.equal(newestScale([{id:'old',modifiedAt:10},{id:'new',modifiedAt:20}]).id,'new');
assert.equal(newestScale([{id:'old',modifiedAt:20,createdAt:10},{id:'new',modifiedAt:20,createdAt:15}]).id,'new');
assert.throws(()=>newestScale([{id:'unknown'},{id:'new',modifiedAt:20}]),/mais recente/);
const driveMetadata=JSON.stringify([[['file-id',[],'25 DE OUTUBRO','application/pdf',0,null,0,0,0,1700000000000,1800000000000]]]).replace(/./g,c=>'\\x'+c.charCodeAt(0).toString(16).padStart(2,'0'));
assert.equal(driveFileTimes("window['_DRIVE_ivd'] = '"+driveMetadata+"';").get('file-id').modifiedAt,1800000000000);


const sql=new PGlite();await sql.exec(fs.readFileSync('supabase/schema.sql','utf8'));
await sql.exec(fs.readFileSync('supabase/access-rules.sql','utf8'));
await sql.exec(fs.readFileSync('supabase/nautica.sql','utf8'));await sql.exec(fs.readFileSync('supabase/ssmt.sql','utf8'));
const {createDatabase}=await import(pathToFileURL(path.join(qa,'database.mjs')));
const client={async query(q,values){const r=await sql.query(q,values);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length}},release(){}};
globalThis.testDb=createDatabase(()=>({...client,async connect(){return client}}));

globalThis.scaleCrew=['CAP RG 99998 TESTE'];
compile(fs.readFileSync('app/api/service/route.ts','utf8').replace("import { DEFAULT_FOLDER, folderId, loadScale } from '../../scale';","import { DEFAULT_FOLDER, folderId } from '../../scale'; const loadScale=async()=>{if(!globalThis.scaleCrew)throw Error('Indisponível');return {crew:globalThis.scaleCrew}};").replace("import { database } from '../../../lib/database';","const database=globalThis.testDb;").replace("from '../../../lib/storage'","from './storage'").replace(/from '\.\.\/\.\.\/([^']+)'/g,"from './$1'"),'route');
const {POST,GET}=await import(pathToFileURL(path.join(qa,'route.mjs')));const {blank,crewFromScale,roles}=await import(pathToFileURL(path.join(qa,'book-model.mjs')));
{const scale15=Array(15).fill('');scale15[0]='CAP RG 99998 TESTE';scale15[14]='SGT RG 99995 ENCARREGADO';const mapped=crewFromScale(scale15);assert.equal(mapped.length,roles.length);assert.equal(mapped[0],'CAP RG 99998 TESTE');assert.ok(!mapped.includes('SGT RG 99995 ENCARREGADO'));assert.equal(crewFromScale(null).length,roles.length);console.log('PASS escala: Encarregado de motoristas não altera a ala do Oficial de Dia.');}
let cookie='';const password='Test-password-42!',setupToken='TEST-ONLY-INITIAL-SETUP-CODE-32-CHARS';process.env.SETUP_TOKEN=setupToken;
async function post(op,data={},status=200){const r=await POST(new Request('https://test.local/api/service',{method:'POST',headers:{origin:'https://test.local',cookie},body:JSON.stringify({op,...data})}));const v=await r.json();assert.equal(r.status,status,JSON.stringify(v));if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return v}
const get=(params,session=cookie)=>GET(new Request('https://test.local/api/service?'+params,{headers:{cookie:session}}));
assert.equal((await get('op=monthPdf&month=2026-10','')).status,401);
await post('setup',{rg:'99999',name:'TESTE ADMIN',password},403);
await post('setup',{rg:'99999',name:'TESTE ADMIN',password,setupToken});
await post('setup',{rg:'88888',name:'OUTRO ADMIN',password,setupToken},409);
await post('user',{rg:'99998',name:'TESTE OFICIAL',role:'officer',active:true,password});await post('user',{rg:'99997',name:'TESTE SUBCMT',role:'reviewer',active:true,password});
await post('user',{rg:'99996',name:'TESTE PRACA',role:'enlisted',active:true,password});await post('login',{rg:'0099996',password});for(const op of ['list','book','pdf','monthPdf','history','users','dependencies'])assert.equal((await get('op='+op+'&date=2026-10-23')).status,403);await post('save',{},403);await post('resolveAssignment',{},403);
await post('login',{rg:'99998',password:'wrong'},401);await post('login',{rg:'99998',password});
const drawing=JSON.stringify({width:600,height:180,strokes:[[[10,80],[50,40],[80,90],[100,30],[130,70],[200,60],[300,80],[500,50]]]});
assert.equal((await get('op=monthPdf&type=supervisor&month=2026-10')).status,400);
const data=blank('2026-10-23');assert.equal(data.divers,'Não');assert.equal(data.riders,'Não');assert.deepEqual(data.support,Array(8).fill('0'));Object.assign(data,{crew:['OFICIAL DE TESTE RG 99998',...Array(11).fill(''),'MOTORISTA TESTE ASE','MOTORISTA TESTE AR'],activation:'07:00',deactivation:'18:05',prevention:['96','45','20','1'],rescues:Array(4).fill('0'),physical:Array(4).fill(''),forms:Array(4).fill('')});const date=data.date;
await post('save',{date,version:0,data});await post('sign',{date,version:1,data,password},400);await post('sign',{date,version:1,data:{...data,crew:['OUTRO RG 99997',...data.crew.slice(1)]},password,drawing},403);globalThis.scaleCrew=null;await post('sign',{date,version:1,data,password,drawing},403);await post('resolveAssignment',{date,password,reason:'Permuta autorizada para assumir este serviço.'});await post('sign',{date,version:1,data,password,drawing});assert.match((await sql.query('SELECT data FROM livros.books WHERE date=$1',[date])).rows[0].data,/Permuta autorizada/);await assert.rejects(sql.query('DELETE FROM livros.assignment_events'));
await post('save',{date,version:1,data},409);await post('save',{date,version:2,data});await post('sign',{date,version:3,data,password,drawing});
await post('login',{rg:'99997',password});await post('save',{date,version:4,data},403);await post('review',{date,version:4,password},409);for(const type of ['supervisor','adjunto','nautica','ssmt'])await sql.query('INSERT INTO livros.service_attestations VALUES($1,$2,1,$3,$4,$3,$4)',[date,type,'99998','test-attestation']);await post('review',{date,version:4,password});
await post('login',{rg:'99998',password});await post('save',{date,version:5,data},409);
await assert.rejects(sql.query("UPDATE livros.books SET status='Rascunho'"));await assert.rejects(sql.query('DELETE FROM livros.books'));await assert.rejects(sql.query("UPDATE livros.revisions SET status='Rascunho'"));await assert.rejects(sql.query('DELETE FROM livros.revisions'));
const rev=(await sql.query('SELECT * FROM livros.revisions ORDER BY version')).rows;assert.equal(rev.length,5);assert.equal(JSON.parse(rev[1].data).signatureDrawing,drawing);assert.equal(rev[2].signature,null);
const before=(await sql.query('SELECT * FROM livros.books')).rows[0];assert.equal(before.pdf,'');const original=Buffer.from(await (await get('op=pdf&date='+date)).arrayBuffer()).toString('base64');fs.writeFileSync(path.join(qa,'daily.pdf'),Buffer.from(original,'base64'));
const data2={...data,date:'2026-10-24'};await post('save',{date:data2.date,version:0,data:data2});
assert.equal((await get('op=monthPdf&month=2026-13')).status,400);assert.equal((await get('op=monthPdf&month=2026-09')).status,404);
const month=await get('op=monthPdf&month=2026-10');assert.equal(month.status,200);assert.match(month.headers.get('content-type'),/application\/pdf/);assert.equal(month.headers.get('cache-control'),'private, no-store');
const monthly=new Uint8Array(await month.arrayBuffer());fs.writeFileSync(path.join(qa,'monthly.pdf'),monthly);
const dailyDoc=await PDFDocument.load(original),monthDoc=await PDFDocument.load(monthly);const draftPdf=await (await get('op=pdf&date='+data2.date)).arrayBuffer();assert.equal(monthDoc.getPageCount(),1+dailyDoc.getPageCount()+(await PDFDocument.load(draftPdf)).getPageCount());
assert.equal((await sql.query('SELECT pdf FROM livros.books WHERE date=$1',[date])).rows[0].pdf,'');
const single=await get('op=pdf&date='+date+'&version=2');assert.equal(single.status,200);assert.ok((await single.arrayBuffer()).byteLength>1000);
// Legacy 12-slot book must retain exactly the same data and signature through review.
const legacy={...data,date:'2026-10-22',crew:data.crew.slice(0,12),signatureDrawing:drawing};
await sql.query('INSERT INTO livros.books VALUES($1,$2,$3,1,$4,$5,$6,NULL,$2,$7,$8)',[legacy.date,'99998','TESTE OFICIAL','Assinado',JSON.stringify(legacy),'legacy-attestation',new Date().toISOString(),original]);
for(const type of ['supervisor','adjunto','nautica','ssmt'])await sql.query('INSERT INTO livros.service_attestations VALUES($1,$2,1,$3,$4,$3,$4)',[legacy.date,type,'99998','test-attestation']);await post('login',{rg:'99997',password});await post('review',{date:legacy.date,version:1,password});const kept=(await sql.query('SELECT data,signature FROM livros.books WHERE date=$1',[legacy.date])).rows[0];assert.equal(kept.data,JSON.stringify(legacy));assert.equal(kept.signature,'legacy-attestation');
// Batch must roll back all writes when one fails.
await assert.rejects(globalThis.testDb.batch([globalThis.testDb.prepare('INSERT INTO settings VALUES(?,?)').bind('rollback','x'),globalThis.testDb.prepare('INSERT INTO users(rg) VALUES(?)').bind('bad')]));assert.equal((await sql.query("SELECT * FROM livros.settings WHERE key='rollback'")).rows.length,0);
await import('./nautica-cases.mjs').then(m=>m.run({post,get,sql,drawing,password,qa}));
console.log('PASS PostgreSQL: setup protection; login; author/reviewer permissions; signature; retification versions; immutable reviewed books and history; monthly auth/date/missing month/page count; signed download; legacy signature preservation; atomic rollback.');

await import('./ssmt-cases.mjs').then(m=>m.run({post,get,sql,drawing,password,qa}));

const tables=['books','revisions','nautical_books','nautical_revisions','ssmt_books','ssmt_revisions'];
const snapshots={};for(const table of tables)snapshots[table]=(await sql.query(`SELECT to_jsonb(t)-'pdf' d FROM livros.${table} t ORDER BY date,version`)).rows;
await sql.exec(fs.readFileSync('supabase/migrations/20261030172746_pdf_on_demand.sql','utf8'));
for(const table of tables){assert.deepEqual((await sql.query(`SELECT to_jsonb(t)-'pdf' d FROM livros.${table} t ORDER BY date,version`)).rows,snapshots[table]);assert.equal((await sql.query(`SELECT count(*) n FROM livros.${table} WHERE pdf<>''`)).rows[0].n,0);}
await post('login',{rg:'99998',password});
for(const [type,day] of [['pdf','2026-10-23'],['nauticalPdf','2026-11-02'],['ssmtPdf','2026-12-12']]){const r=await get('op='+type+'&date='+day+'&version=1');assert.equal(r.status,200);assert.ok((await r.arrayBuffer()).byteLength>1000);}
await assert.rejects(sql.query("UPDATE livros.revisions SET pdf='payload'"));
console.log('PASS data-only migration: exact preservation of all data/signatures/history; zero PDF bytes; downloads from stored data.');
await sql.close();
