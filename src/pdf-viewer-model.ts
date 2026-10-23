export type PdfRect = [number,number,number,number];
export type PdfTarget = {page:number;rect:PdfRect;noteId:string;number:number;kind:string};
type NoteGeometry = {id:string;number:number;clickTargets?:{page:number;rect:number[];kind?:string}[];noteHighlights?:{page:number;rect:number[];kind?:string}[]};
export type PageSize = {width:number;height:number};
export function validRect(value:unknown): value is PdfRect {
  return Array.isArray(value)&&value.length===4&&value.every(Number.isFinite)&&value[2]>value[0]&&value[3]>value[1];
}
// Keep every evidence-backed line separate. A union rectangle would make blank
// space or a neighboring footnote clickable and lose continuation-page geometry.
export function footnoteTargets(notes:NoteGeometry[]):PdfTarget[]{
  const result:PdfTarget[]=[];const seen=new Set<string>();
  for(const note of notes)for(const target of [...(note.clickTargets||[]),...(note.noteHighlights||[])]){
    if(!Number.isInteger(target.page)||target.page<1||!validRect(target.rect))continue;
    const key=[note.id,target.page,...target.rect].join('|');if(seen.has(key))continue;seen.add(key);
    result.push({page:target.page,rect:[...target.rect],noteId:note.id,number:note.number,kind:target.kind||'footnote-text'});
  }
  return result;
}
export function targetAt(targets:PdfTarget[],x:number,y:number):PdfTarget|undefined{
  // Prefer the smallest exact region if a marker and its own first line overlap.
  return targets.filter(t=>x>=t.rect[0]&&x<=t.rect[2]&&y>=t.rect[1]&&y<=t.rect[3])
    .sort((a,b)=>(a.rect[2]-a.rect[0])*(a.rect[3]-a.rect[1])-(b.rect[2]-b.rect[0])*(b.rect[3]-b.rect[1]))[0];
}
export function normalizedPoint(clientX:number,clientY:number,box:{left:number;top:number;width:number;height:number}){
  return {x:Math.max(0,Math.min(1,(clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(clientY-box.top)/box.height))};
}
export function pageLayout(count:number,width:number,zoom:number,sizes:Record<number,PageSize>,fallback:PageSize={width:515,height:728},gap=24){
  const heights:number[]=[],offsets=[0];const fitted=Math.max(160,width)*zoom;
  for(let p=1;p<=Math.max(1,count);p++){const size=sizes[p]||fallback;const h=fitted*size.height/size.width;heights.push(h);offsets.push(offsets[p-1]+h+gap);}
  return {heights,offsets,width:fitted,totalHeight:offsets.at(-1)!-gap,gap};
}
export function pageIndexAt(offsets:number[],position:number){
  let low=0,high=offsets.length-2;
  while(low<high){const mid=Math.ceil((low+high)/2);if(offsets[mid]<=position)low=mid;else high=mid-1;}
  return Math.max(0,Math.min(offsets.length-2,low));
}
export function visiblePageRange(offsets:number[],scrollTop:number,viewportHeight:number,overscan=1){
  const start=Math.max(0,pageIndexAt(offsets,Math.max(0,scrollTop))-overscan);
  const end=Math.min(offsets.length-2,pageIndexAt(offsets,Math.max(0,scrollTop)+Math.max(1,viewportHeight))+overscan);
  return Array.from({length:end-start+1},(_,i)=>start+i+1);
}
export function reflowScrollPosition(previous:ReturnType<typeof pageLayout>,next:ReturnType<typeof pageLayout>,position:number){
  const oldTop=Math.max(0,position),index=pageIndexAt(previous.offsets,oldTop),fraction=(oldTop-previous.offsets[index])/previous.heights[index];
  const target=Math.min(index,next.heights.length-1);
  return next.offsets[target]+Math.max(0,Math.min(1,fraction))*next.heights[target];
}
export function movedPointer(start:{x:number;y:number}|null,x:number,y:number){return !!start&&Math.hypot(x-start.x,y-start.y)>5;}
export function measurableViewport(width:number,height:number,paddingX=0):{width:number;height:number}|null{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
  return {width:Math.max(160,width-(Number.isFinite(paddingX)?paddingX:0)),height};
}

// Pointer-up is not guaranteed when the browser loses focus or leaves the page.
// Keep a hand drag from resuming unexpectedly when the reader returns.
export function watchDocumentInterruption(cancel:()=>void,win:EventTarget,doc:EventTarget&{hidden:boolean}){
  const visibility=()=>{if(doc.hidden)cancel();};
  win.addEventListener('blur',cancel);win.addEventListener('pagehide',cancel);doc.addEventListener('visibilitychange',visibility);
  return()=>{win.removeEventListener('blur',cancel);win.removeEventListener('pagehide',cancel);doc.removeEventListener('visibilitychange',visibility);};
}
