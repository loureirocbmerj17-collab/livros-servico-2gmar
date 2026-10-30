import { Pool } from 'pg';
// This module is imported only by the server route. No credentials reach the browser.
let pool:Pool|undefined;
function connection(){
 const source=process.env.DATABASE_URL||process.env.POSTGRES_URL;if(!source)throw new Error('Conexão do banco não configurada.');
 const url=new URL(source);for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
 return pool??=new Pool({connectionString:url.href,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT.replace(/\\n/g,'\n')}:{})}});
}
export function sqlText(sql:string){
 let n=0; // SQL is authored in the route; user values are always parameters.
 return sql.replace(/'([^']|'')*'|\?/g,m=>m==='?'?'$'+(++n):m).replace(/\b(FROM|JOIN|INTO|UPDATE) (users|sessions|attempts|books|revisions|settings|admin_log)\b/gi,'$1 livros.$2');
}
export function createDatabase(getConnection:()=>any=connection){
class Statement{
 constructor(readonly sql:string,readonly values:any[]=[]){ }
 bind(...values:any[]){return new Statement(this.sql,values)}
 async first<T=any>():Promise<T|null>{return (await getConnection().query(sqlText(this.sql),this.values)).rows[0]??null}
 async all(){return {results:(await getConnection().query(sqlText(this.sql),this.values)).rows}}
 async run(){return {meta:{changes:(await getConnection().query(sqlText(this.sql),this.values)).rowCount??0}}}
}
return {
 prepare:(sql:string)=>new Statement(sql),
 async batch(statements:Statement[]){const client=await getConnection().connect();try{await client.query('BEGIN');const results=[];for(const s of statements){const r=await client.query(sqlText(s.sql),s.values);results.push({meta:{changes:r.rowCount??0}})}await client.query('COMMIT');return results}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
};

}
export const database=createDatabase();
