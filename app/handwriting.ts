export type Drawing={width:number,height:number,strokes:number[][][]};
export function readDrawing(raw:unknown):Drawing|null {
 if(typeof raw!=='string'||raw.length>95000)return null;
 try{const d=JSON.parse(raw);if(d.width!==600||d.height!==180||!Array.isArray(d.strokes)||d.strokes.length>100)return null;let count=0,length=0;
 for(const s of d.strokes){if(!Array.isArray(s)||s.length<2)return null;for(let i=0;i<s.length;i++){const p=s[i];if(!Array.isArray(p)||p.length!==2||p.some((n:any)=>typeof n!=='number'||!Number.isFinite(n))||p[0]<0||p[0]>600||p[1]<0||p[1]>180)return null;count++;if(i)length+=Math.hypot(p[0]-s[i-1][0],p[1]-s[i-1][1]);}}
 return count>=8&&count<=4000&&length>40?d:null;
 }catch{return null;}
}
