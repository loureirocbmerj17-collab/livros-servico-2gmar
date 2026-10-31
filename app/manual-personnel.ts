export function manualPersonnel(data:any){
 const rows=data.manualPersonnel||[];
 if(!Array.isArray(rows)||rows.length>150||rows.some((p:any)=>!p||!/^\d{3,12}$/.test(p.rg)||typeof p.name!=='string'||!p.name.trim()||p.name.length>150))throw Object.assign(Error('Confira os militares informados manualmente.'),{status:400});
 return rows.map((p:any)=>({rg:p.rg,name:p.name.trim(),manual:true}));
}
