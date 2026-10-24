import {DEFAULT_READING_VIEW,type ReadingView,type ReadingPane} from './reading-view';
export const MASTER_SESSION_KEY='lawinus-master-reading-session-v1';
export type WorkspaceSession={schema:1;thesisSha256:string;page:number;zoom:number;sourceId:string;sourcePage:number;sourceZoom:number;citationId:string;referenceId:string;documentView:'citations'|'source';tab:'source'|'citations'|'revisions'|'memos'|'library'|'profile';mobilePane:ReadingPane;readingView:ReadingView;sidebarOpen:boolean;metadataOpen:boolean;manuscriptMode:'pdf'|'text';paragraphId:string};
type Catalog={thesisSha256:string;pageCount:number;citationIds:string[];referenceIds:string[];sourcePages:Record<string,number>;paragraphIds:string[]};
const bounded=(value:unknown,fallback:number,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max?value:fallback;
export function defaultWorkspaceSession(catalog:Catalog,wide=true):WorkspaceSession{return {schema:1,thesisSha256:catalog.thesisSha256,page:4,zoom:1,sourceId:'s-presentation',sourcePage:1,sourceZoom:1,citationId:catalog.citationIds[0]||'',referenceId:'',documentView:'citations',tab:'citations',mobilePane:'thesis',readingView:{...DEFAULT_READING_VIEW},sidebarOpen:wide,metadataOpen:true,manuscriptMode:'pdf',paragraphId:''};}
export function readWorkspaceSession(storage:Pick<Storage,'getItem'>|undefined,catalog:Catalog,wide=true):WorkspaceSession{
 const fallback=defaultWorkspaceSession(catalog,wide);
 try{
  const saved=storage?.getItem(MASTER_SESSION_KEY);if(!saved)return fallback;const value=JSON.parse(saved);
  if(!value||value.schema!==1||value.thesisSha256!==catalog.thesisSha256)return fallback;
  const sourceId=Object.hasOwn(catalog.sourcePages,value.sourceId)?value.sourceId:fallback.sourceId;
  const view=value.readingView;const readingView:ReadingView=view&&['focus','header','tools','footnotes'].every(key=>typeof view[key]==='boolean')?{focus:view.focus,header:view.header,tools:view.tools,footnotes:view.footnotes}:fallback.readingView;
  if(readingView.focus&&view.focusSurfaces)readingView.focusSurfaces=Object.fromEntries(['header','tools','footnotes','sidebar','metadata'].filter(key=>typeof view.focusSurfaces[key]==='boolean').map(key=>[key,view.focusSurfaces[key]]));
  return {...fallback,page:Math.floor(bounded(value.page,4,1,catalog.pageCount)),zoom:bounded(value.zoom,1,.7,2),sourceId,sourcePage:Math.floor(bounded(value.sourcePage,1,1,catalog.sourcePages[sourceId])),sourceZoom:bounded(value.sourceZoom,1,.7,2),citationId:catalog.citationIds.includes(value.citationId)?value.citationId:fallback.citationId,referenceId:catalog.referenceIds.includes(value.referenceId)?value.referenceId:'',documentView:value.documentView==='source'?'source':'citations',tab:['source','citations','revisions','memos','library','profile'].includes(value.tab)?value.tab:fallback.tab,mobilePane:['contents','thesis','source','metadata'].includes(value.mobilePane)?value.mobilePane:'thesis',readingView,sidebarOpen:wide&&typeof value.sidebarOpen==='boolean'?value.sidebarOpen:wide,metadataOpen:typeof value.metadataOpen==='boolean'?value.metadataOpen:true,manuscriptMode:value.manuscriptMode==='text'?'text':'pdf',paragraphId:catalog.paragraphIds.includes(value.paragraphId)?value.paragraphId:''};
 }catch{return fallback;}
}
export function saveWorkspaceSession(storage:Pick<Storage,'setItem'>|undefined,state:WorkspaceSession){try{storage?.setItem(MASTER_SESSION_KEY,JSON.stringify(state));}catch{/* Reading remains available when storage is disabled. */}}
