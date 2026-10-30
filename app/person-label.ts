export function personLabel(person:{rank?:string,name?:string}|null|undefined){return [person?.rank,person?.name].filter(Boolean).join(' ').trim();}
