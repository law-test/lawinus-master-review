export type FullTranslationSource={id:string;sha256?:string;pages?:number};
export type FullTranslationCatalogEntry={referenceId:string;sourceId:string;sourceSha256:string;pageCount:number;coverage?:string;coverageNote?:string;asset:string;translatedPages:number[];status:string;engine?:string;sourceLabel?:string;version?:string};
export type FullTranslationPage={page:number;printed?:string;unitId?:string;unitLabel?:string;sourceText:string;translationText:string;status:'translated'|'blank'|'ocr-unresolved';scopeNote?:string;qualityFlags?:string[];sourceTextSha256?:string};
export type FullTranslationDocument={sourceId:string;sourceSha256:string;pageCount:number;translationType:'machine';engine?:string;pages:FullTranslationPage[]};
export function fullTranslationCatalogEntry(value:unknown,source:FullTranslationSource):FullTranslationCatalogEntry|undefined{
  if(!source.sha256||!source.pages||!value||typeof value!=='object')return;
  const catalog=value as {schemaVersion?:unknown;entries?:unknown};
  if(catalog.schemaVersion!==1||!Array.isArray(catalog.entries))return;
  const candidate=catalog.entries.find(item=>item?.sourceId===source.id&&item?.sourceSha256===source.sha256&&item?.pageCount===source.pages);
  if(!candidate||typeof candidate.referenceId!=='string'||candidate.asset!==`translations/${source.sha256}/pages.json`||!Array.isArray(candidate.translatedPages))return;
  return {...candidate,translatedPages:[...new Set<number>(candidate.translatedPages.filter((page:unknown)=>Number.isInteger(page)&&Number(page)>=1&&Number(page)<=source.pages!))].sort((a,b)=>a-b)};
}
export function fullTranslationDocument(value:unknown,source:FullTranslationSource):FullTranslationDocument|undefined{
  if(!source.sha256||!source.pages||!value||typeof value!=='object')return;
  const document=value as FullTranslationDocument;
  if(document.sourceId!==source.id||document.sourceSha256!==source.sha256||document.pageCount!==source.pages||document.translationType!=='machine'||!Array.isArray(document.pages)||document.pages.length!==source.pages)return;
  const ids=new Set<number>();
  for(const page of document.pages){
    if(!Number.isInteger(page.page)||page.page<1||page.page>source.pages||ids.has(page.page)||typeof page.sourceText!=='string'||typeof page.translationText!=='string'||!['translated','blank','ocr-unresolved'].includes(page.status))return;
    if(page.status==='translated'&&!page.translationText.trim())return;
    ids.add(page.page);
  }
  return {...document,pages:[...document.pages].sort((a,b)=>a.page-b.page)};
}
export function fullTranslationPageAt(document:FullTranslationDocument|undefined,page:number|undefined):FullTranslationPage|undefined{return document?.pages.find(item=>item.page===page);}
