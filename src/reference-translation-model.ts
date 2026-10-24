export type ReferenceTranslationData={meta:{thesisSha256:string;preparedAt:string;label:string};titles:{referenceId:string;original:string;korean:string}[];excerpts:ReferenceTranslationExcerpt[]};
export type ReferenceTranslationExcerpt={id:string;referenceId:string;sourceId:string;sourceSha256:string;page:number;printed?:string;sentenceIds:string[];original:string;korean:string};
export type ReferenceReadingMode='original'|'translation'|'parallel';
export function referenceReadingMode(value:unknown):ReferenceReadingMode{return value==='original'||value==='translation'?value:'parallel';}
export function translatedReferenceTitle(data:ReferenceTranslationData,thesisSha256:string,reference?:{id:string;title:string}):string|undefined{
  if(!reference||data.meta.thesisSha256!==thesisSha256)return;
  return data.titles.find(item=>item.referenceId===reference.id&&item.original===reference.title)?.korean;
}
export function translatedEvidence(data:ReferenceTranslationData,selection:{thesisSha256:string;referenceId?:string;source?:{id:string;sha256?:string};page:number;evidencePages:number[];sentenceId?:string;bibliography?:boolean}):ReferenceTranslationExcerpt[]{
  if(data.meta.thesisSha256!==selection.thesisSha256||!selection.source?.sha256||!selection.evidencePages.includes(selection.page))return [];
  return data.excerpts.filter(item=>item.referenceId===selection.referenceId&&item.sourceId===selection.source!.id&&item.sourceSha256===selection.source!.sha256&&item.page===selection.page&&(selection.bibliography||!!selection.sentenceId&&item.sentenceIds.includes(selection.sentenceId)));
}
