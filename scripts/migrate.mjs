import {Pool} from 'pg';
import fs from 'node:fs/promises';
if(!process.env.DATABASE_URL)throw Error('Configure DATABASE_URL no ambiente.');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT.replace(/\\n/g,'\n')}:{})},max:1});
try{await pool.query(await fs.readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));for(const name of ['access-rules.sql','nautica.sql','ssmt.sql'])await pool.query(await fs.readFile(new URL('../supabase/'+name,import.meta.url),'utf8'));for(const name of (await fs.readdir(new URL('../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort())await pool.query(await fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));console.log('Estrutura configurada; PDFs somente sob demanda.');}finally{await pool.end()}
