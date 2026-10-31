import {timingSafeEqual} from 'node:crypto';
import {database} from '../../../lib/database';
import {dispatchNotifications} from '../../notifications';
import {loadScale,DEFAULT_FOLDER} from '../../scale';
export const runtime='nodejs';
export const maxDuration=300;
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const expected=process.env.CRON_SECRET||'',provided=req.headers.get('authorization')||'';
 if(expected.length<32||provided.length!==('Bearer '+expected).length||!timingSafeEqual(Buffer.from(provided),Buffer.from('Bearer '+expected)))return Response.json({error:'Não autorizado.'},{status:401});
 try{const folder=await database.prepare("SELECT value FROM settings WHERE key='scaleFolder'").first<any>();return Response.json(await dispatchNotifications({db:database,scale:date=>loadScale(folder?.value||DEFAULT_FOLDER,date)}));}catch{return Response.json({error:'Falha ao processar notificações.'},{status:500});}
}
