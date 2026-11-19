import {mailHash} from '../../mail-service';
import {timingSafeEqual} from 'node:crypto';
import {database} from '../../../lib/database';
import {retryMissingEmails,sendDutyPreview,sendRequestedDrafts,dispatchNotifications} from '../../notifications';
import {loadScale,DEFAULT_FOLDER} from '../../scale';
export const runtime='nodejs';
export const maxDuration=300;
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const expected=process.env.CRON_SECRET||'',provided=req.headers.get('authorization')||'';
 if(expected.length<32||provided.length!==('Bearer '+expected).length||!timingSafeEqual(Buffer.from(provided),Buffer.from('Bearer '+expected)))return Response.json({error:'Não autorizado.'},{status:401});
 try{const folder=await database.prepare("SELECT value FROM settings WHERE key='scaleFolder'").first<any>();const people=(await database.prepare('SELECT rg,name,rank FROM users WHERE active=1').all()).results;return Response.json(await dispatchNotifications({db:database,scale:date=>loadScale(folder?.value||DEFAULT_FOLDER,date,people)}));}catch{return Response.json({error:'Falha ao processar notificações.'},{status:500});}
}

// A batch must be provisioned in private settings with a random, expiring capability.
export async function POST(req:Request){
 const token=req.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 if(!token)return Response.json({}, {status:403});
 const key='draft-mail:'+mailHash(token);
 const row=await database.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();
 if(!row)return Response.json({}, {status:403});
 const batch=JSON.parse(row.value);
 if(Date.now()>batch.expires)return Response.json({}, {status:403});
 if(batch.retryIds)return Response.json(await retryMissingEmails(database,batch.retryIds));
 if(batch.preview)return Response.json({status:await sendDutyPreview(database,key,batch.preview.to,batch.preview.date)});
 const counts=await sendRequestedDrafts(database,batch.books,key.slice(11));
 return Response.json(counts);
}
