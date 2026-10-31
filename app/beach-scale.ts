import {beachPosts} from './supervisor-model';
type Row={y:number,items:{str:string,x:number,w:number}[]};
function key(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f\u200b-\u200f]/g,'').toUpperCase().replace(/[’']/g,'').replace(/[,]/g,'.').replace(/\b0+(\d)/g,'$1').replace(/[^A-Z0-9.]/g,'');}
export function beachPostName(s:string){const n=key(s);const aliases:Record<string,string>={'Q.MAR':'QUEBRA-MAR','QMAR':'QUEBRA-MAR','POSTOBR':'BR','P.RETORNO':'RETORNO','PRETORNO':'RETORNO'};return aliases[n]||beachPosts.find(p=>key(p)===n)||'';}
// Only read the two POSTO / MILITAR / MILITAR blocks, never leave or overaviso tables.
export function parseBeachRows(rows:Row[]){const posts=beachPosts.map(post=>({post,rgs:[] as string[]}));const warnings:string[]=[];let split=0,active=false,recognized=0;
 for(const row of rows){const labels=row.items.filter(i=>key(i.str)==='POSTO');if(labels.length===2&&row.items.filter(i=>key(i.str)==='MILITAR').length>=4){split=(labels[1].x+labels[1].w/2);active=true;continue;}if(!active)continue;
 const text=row.items.map(i=>i.str).join(' ');if(/DISPENSA|LICEN[CÇ]A|PERMUTAS|OBS:/.test(text)){active=false;continue;}
 // Boundary is just before the second post column; names in the left block end before it.
 const boundary=split-35;
 for(const items of [row.items.filter(i=>i.x+i.w/2<boundary),row.items.filter(i=>i.x+i.w/2>=boundary)]){const postItem=items.find(i=>beachPostName(i.str));if(!postItem)continue;recognized++;const post=posts.find(p=>p.post===beachPostName(postItem.str))!;const values=items.filter(i=>i!==postItem&&i.x>postItem.x).map(i=>i.str).join(' ');const rgs=[...values.matchAll(/\b\d{4,8}\b/g)].map(m=>m[0].replace(/^0+/,''));for(const rg of rgs){if(posts.some(p=>p.rgs.includes(rg))){warnings.push('RG '+rg+' aparece repetido; confira os postos manualmente.');continue;}post.rgs.push(rg);}}
 }
 if(!recognized)return {beachPosts:[],beachWarnings:['Tabela de postos não reconhecida. Preenchimento manual disponível.']};
 return {beachPosts:posts,beachWarnings:warnings};
}
