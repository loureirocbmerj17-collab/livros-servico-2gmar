import {Pool} from 'pg';
import fs from 'node:fs/promises';
if(!process.env.DATABASE_URL)throw Error('Configure DATABASE_URL no ambiente.');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT.replace(/\\n/g,'\n')}:{})},max:1});
try{await pool.query(await fs.readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));await pool.query(await fs.readFile(new URL('../supabase/storage.sql',import.meta.url),'utf8'));console.log('Estrutura e armazenamento configurados.');}finally{await pool.end()}
