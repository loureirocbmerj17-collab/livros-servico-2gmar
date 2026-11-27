import {database} from '../lib/database';
import {createHash} from 'node:crypto';
import {needsProfile} from './account-server';
import {attachmentFail} from './attachment-server';
export const tokenHash=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function attachmentUser(req:Request){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)gmar_session=([^;]+)/)?.[1];if(!token)attachmentFail('Entre com seu RG e senha.',401);const u=await database.prepare('SELECT u.* FROM users u JOIN sessions s ON s.rg=u.rg WHERE s.id=? AND s.expires>? AND u.active=1').bind(tokenHash(token),Date.now()).first<any>();if(!u)attachmentFail('Sessão encerrada.',401);if(needsProfile(u))attachmentFail('Atualize seu cadastro para continuar.',428);return u;}
export function requireOrigin(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)attachmentFail('Origem inválida.',403);}
export function attachmentError(e:any){return Response.json({error:e.status?e.message:'Não foi possível concluir. Confira a conexão com o Drive e tente novamente.'},{status:e.status||503,headers:{'Cache-Control':'no-store'}});}
