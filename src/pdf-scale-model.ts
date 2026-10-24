export type PdfFitMode='width'|'page'|'custom';
export type PdfScale={mode:PdfFitMode;zoom:number};
type StorageLike=Pick<Storage,'getItem'|'setItem'>;
export function boundedPdfZoom(value:number){return Math.min(4,Math.max(.01,Number.isFinite(value)?value:1));}
export function fittedPdfZoom(mode:PdfFitMode,zoom:number,viewport:{width:number;height:number},page:{width:number;height:number},paddingY=40):number{
 if(mode==='custom')return boundedPdfZoom(zoom);
 if(mode==='width')return 1;
 if(viewport.width<=0||viewport.height<=0||page.width<=0||page.height<=0)return 1;
 return boundedPdfZoom(Math.min(1,Math.max(1,viewport.height-paddingY)/(viewport.width*page.height/page.width)));
}
export function readPdfScale(storage:StorageLike|undefined,key:string,initialZoom=1):PdfScale{
 const fallback:PdfScale={mode:initialZoom===1?'width':'custom',zoom:boundedPdfZoom(initialZoom)};
 try{const raw=storage?.getItem('master.pdf-scale.v1:'+key);if(!raw)return fallback;const value=JSON.parse(raw);if(!['width','page','custom'].includes(value?.mode)||!Number.isFinite(value.zoom)||value.zoom<.01||value.zoom>4)return fallback;return {mode:value.mode,zoom:value.zoom};}catch{return fallback;}
}
export function savePdfScale(storage:StorageLike|undefined,key:string,value:PdfScale){try{storage?.setItem('master.pdf-scale.v1:'+key,JSON.stringify(value));}catch{}}
