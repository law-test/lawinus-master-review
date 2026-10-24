export type BodyReadingPosition={page:number;reportedPage:number;fraction:number;leftRatio:number;zoom:number};
export function parseBodyReadingPosition(raw:string|null):BodyReadingPosition|null{
  if(!raw||raw.length>2048)return null;
  try{const p=JSON.parse(raw);if(!p||![p.page,p.reportedPage].every(v=>Number.isInteger(v)&&v>=1&&v<=10000)||!Number.isFinite(p.fraction)||p.fraction<0||p.fraction>1||!Number.isFinite(p.leftRatio)||p.leftRatio<0||p.leftRatio>10||!Number.isFinite(p.zoom)||p.zoom<.5||p.zoom>4)return null;return {page:p.page,reportedPage:p.reportedPage,fraction:p.fraction,leftRatio:p.leftRatio,zoom:p.zoom};}catch{return null;}
}
export function bodyReadingKey(key:string){return 'master-body-position-v1:'+key;}
export function bodyAnchorTop(start:number,height:number,fraction:number){return Math.max(0,start+Math.max(0,Math.min(1,fraction))*Math.max(0,height));}

