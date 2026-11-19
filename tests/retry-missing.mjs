import assert from 'node:assert/strict';
import {retryMissingEmails} from '../.qa/notifications.mjs';
let sends=0;const logs={};
const db={prepare(sql){let values;return {bind(...v){values=v;return this},async first(){if(sql.startsWith('SELECT * FROM livros.mail_log')){const id=values[0];return logs[id]||(id==='already'?null:{id,rg:'999',book_type:'adjunto',service_date:id,status:'missing_email'});}if(sql.startsWith('SELECT author,status'))return values[0]==='done'?{author:'999',status:'Assinado'}:values[0]==='other'?{author:'123',status:'Rascunho'}:null;if(sql.startsWith('SELECT rg,name'))return {rg:'999',email:'test@example.test',name:'TESTE',rank:'SD'};if(sql.startsWith('UPDATE'))return {id:values.at(-1)};throw Error(sql)},async run(){if(sql.includes("status='accepted'"))logs[values.at(-1)]={status:'accepted'};return {}}}}};
const results=await retryMissingEmails(db,['done','other','already','open'],async()=>{sends++;return 'fake'});
assert.equal(sends,1);assert.equal(results.completed,1);assert.equal(results.changed_author,1);assert.equal(results.skipped,1);assert.equal(results.accepted,1);
await retryMissingEmails(db,['open'],async()=>{sends++;return 'fake'});assert.equal(sends,1);
console.log('PASS catch-up: signed books, changed author and previous sends skipped; one real pending message.');
