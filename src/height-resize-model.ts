export function clampHeight(value:number,min:number,max:number){
  const upper=Math.max(min,max);return Math.min(upper,Math.max(min,Number.isFinite(value)?value:min));
}
export function draggedHeight(start:number,startY:number,currentY:number,scale:number,min:number,max:number){
  return clampHeight(start+(currentY-startY)*(Number.isFinite(scale)?scale:1),min,max);
}
export function keyboardHeight(key:string,value:number,min:number,max:number,step=8):number|null{
  if(key==='Home')return min;if(key==='End')return Math.max(min,max);
  if(key==='ArrowUp')return clampHeight(value-step,min,max);
  if(key==='ArrowDown')return clampHeight(value+step,min,max);
  return null;
}
export function readStoredHeight(storage:Pick<Storage,'getItem'>|undefined,key:string,initial:number,min:number,max:number){
  try{const raw=storage?.getItem(key);if(raw!==null&&raw!==undefined&&raw.trim()!==''&&Number.isFinite(Number(raw)))return clampHeight(Number(raw),min,max);}catch{}
  return clampHeight(initial,min,max);
}
export function saveStoredHeight(storage:Pick<Storage,'setItem'>|undefined,key:string,value:number,min:number,max:number){try{storage?.setItem(key,String(clampHeight(value,min,max)));}catch{}}
