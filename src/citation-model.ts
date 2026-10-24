import {validRect,type PdfTarget} from './pdf-viewer-model.ts';

export type CitationReference={id:string;authors:string[];authorText?:string;year:string;title:string;fullEntry:string;bibliographyPage:number;printedPage:string;bibliographyRects?:number[][];sourceId?:string;sourcePage?:number;sourceUrl?:string;sourceLabel?:string;sourceKind?:'pdf'|'web';verifiedSource?:boolean};
export type CitationRegion={page:number;rects:number[][]};
export type CitationEntry={id:string;page:number;text:string;rects:number[][];referenceIds:string[];matchStatus:string;relation?:string;sentenceId?:string;sentenceText?:string;sentenceRects?:number[][];sentenceRegions?:CitationRegion[];sentenceReferenceIds?:string[];relatedCitationIds?:string[];selectionKind?:'citation'|'sentence'|'bibliography';selectionRegions?:CitationRegion[];secondaryReferenceIds?:string[];selectedCitationTexts?:string[]};
export type CitationData={meta:{pdfSha256:string;pageCount:number};references:CitationReference[];citations:CitationEntry[]};
export type CitationPurpose={summary:string;referencePurposes?:Record<string,string>};
export type CitationPurposes=Record<string,CitationPurpose>;
export type ReferenceCitationUse={id:string;sentenceText:string;pages:number[];purpose?:string};
export type CitationSource={id:string;referenceId?:string;title?:string;kind?:string;pages?:number;targetPage?:number;defaultPage?:number;coverage?:'전문'|'발췌본'|'full'|'excerpt'|'chapter-in-book'|'accepted-manuscript'|'prepublication'|'chapter'|'partial';coverageLabel?:string;sha256?:string;pageSizes?:{page:number;width:number;height:number}[];pageMap?:{page:number;originalPage:number}[];locators?:{page:number;printed?:string}[]};
export type CitationDocumentMode='source'|'web'|'bibliography';
export type CitationEvidenceLocator={page:number;printed?:string;summary:string;rects?:number[][]};
export type CitationEvidenceEntry={sentenceId:string;referenceId:string;sourceId?:string;sourceSha256?:string;sourceUrl?:string;sourceLabel?:string;status:'verified'|'partial'|'unverified'|'web';locators:CitationEvidenceLocator[];note?:string};
export type CitationEvidenceData={meta:{thesisSha256:string;reviewedAt:string};entries:CitationEvidenceEntry[]};
export type ResolvedEvidenceLocator={page:number;printed?:string;summaries:string[];rects:number[][];sentenceIds:string[]};
export type EvidenceWebSource={url:string;label:string};
export type CitationEvidenceSelection={status:'verified'|'partial'|'unverified'|'web';locators:ResolvedEvidenceLocator[];notes:string[];webSources:EvidenceWebSource[];reason?:'no-entry'|'thesis-mismatch'|'source-mismatch'|'invalid-locators'};

export function citationDatasetMatches(meta:CitationData['meta'],pdfSha256:unknown,pageCount:unknown):boolean{
  return typeof pdfSha256==='string'&&/^[a-f0-9]{64}$/i.test(meta.pdfSha256)&&meta.pdfSha256.toLowerCase()===pdfSha256.toLowerCase()&&meta.pageCount===pageCount;
}

export function citationReaderReady(mode:'pdf'|'text',datasetMatches:boolean,pdfIntegrity:string,bodyDatasetMatches:boolean):boolean{
  // The HTML body has its own source fingerprint. It must not depend on a PDF
  // component being mounted first, while PDF geometry still requires byte verification.
  return datasetMatches&&(mode==='text'?bodyDatasetMatches:pdfIntegrity==='verified');
}

function sentenceRegions(citation:CitationEntry):CitationRegion[]{
  return citation.sentenceRegions?.length?citation.sentenceRegions:citation.sentenceRects?.length?[{page:citation.page,rects:citation.sentenceRects}]:[];
}

// Author-year regions retain their own IDs. Sentence regions have a shared ID
// and keep each printed line separate, including when a sentence crosses a page.
export function citationTargets(citations:CitationEntry[],enabled:boolean,pageCount:number):PdfTarget[]{
  if(!enabled)return [];
  const seen=new Set<string>(),result:PdfTarget[]=[];
  function add(id:string,page:number,rect:number[],kind:string,label:string){
    if(!Number.isInteger(page)||page<1||page>pageCount||!validRect(rect))return;
    const key=[id,page,...rect].join('|');if(seen.has(key))return;seen.add(key);
    result.push({page,rect:[...rect],noteId:id,kind,label});
  }
  for(const citation of citations){
    if(!citation.id||!citation.text||!Number.isInteger(citation.page)||citation.page<1||citation.page>pageCount)continue;
    for(const rect of citation.rects)add(citation.id,citation.page,rect,'author-year',`본문 인용 ${citation.text} 참고문헌 열기`);
    if(citation.sentenceId&&citation.sentenceText){
      for(const region of sentenceRegions(citation))for(const rect of region.rects){
        add(citation.sentenceId,region.page,rect,'citation-sentence',`인용 문장 ${citation.sentenceText} 관련 문헌 열기`);
      }
    }
  }
  return result;
}

export function resolveCitationSelection(id:string,citations:CitationEntry[]):CitationEntry|undefined{
  const direct=citations.find(citation=>citation.id===id);if(direct)return direct;
  const related=citations.filter(citation=>citation.sentenceId===id&&citation.sentenceText);
  if(!related.length)return;
  const first=related[0],regions=new Map<number,number[][]>(),seen=new Set<string>();
  for(const citation of related)for(const region of sentenceRegions(citation)){
    if(!Number.isInteger(region.page)||region.page<1)continue;
    for(const rect of region.rects){if(!validRect(rect))continue;const key=[region.page,...rect].join('|');if(seen.has(key))continue;seen.add(key);regions.set(region.page,[...(regions.get(region.page)||[]),[...rect]]);}
  }
  const selectionRegions=[...regions].sort(([a],[b])=>a-b).map(([page,rects])=>({page,rects}));
  if(!selectionRegions.length)return;
  const page=selectionRegions[0].page;
  const referenceIds=[...new Set(related.flatMap(citation=>citation.sentenceReferenceIds?.length?citation.sentenceReferenceIds:citation.referenceIds))];
  const secondaryReferenceIds=[...new Set(related.filter(citation=>citation.relation==='secondary').flatMap(citation=>citation.referenceIds))];
  return {...first,id,page,text:first.sentenceText!,rects:selectionRegions[0].rects,referenceIds,selectionKind:'sentence',selectionRegions,secondaryReferenceIds,selectedCitationTexts:related.map(citation=>citation.text),relatedCitationIds:related.map(citation=>citation.id),relation:secondaryReferenceIds.length?(related.every(citation=>citation.relation==='secondary')?'secondary':'secondary-mixed'):'direct',matchStatus:related.every(citation=>citation.matchStatus==='matched'||citation.matchStatus==='exact')?'matched':'partial'};
}

export function citationSelectionHighlights(selection:CitationEntry|undefined):{page:number;rect:number[]}[]{
  if(!selection)return [];
  const regions=selection.selectionKind==='sentence'&&selection.selectionRegions?.length?selection.selectionRegions:[{page:selection.page,rects:selection.rects}];
  return regions.flatMap(region=>region.rects.filter(validRect).map(rect=>({page:region.page,rect:[...rect]})));
}

// These descriptions are editorial data prepared from this thesis, not a
// runtime inference or a claim that the linked source confirms the wording.
export function citationPurpose(citation:CitationEntry,referenceId:string|undefined,purposes:CitationPurposes):string|undefined{
  if(citation.selectionKind==='bibliography')return;
  const id=citation.sentenceId||(citation.selectionKind==='sentence'?citation.id:undefined);
  const entry=id?purposes[id]:undefined;
  const specific=referenceId?entry?.referencePurposes?.[referenceId]?.trim():undefined;
  return specific||entry?.summary?.trim()||undefined;
}

export function referenceCitationUses(referenceId:string,citations:CitationEntry[],purposes:CitationPurposes):ReferenceCitationUse[]{
  const uses=new Map<string,ReferenceCitationUse>();
  for(const citation of citations){
    if(!citation.referenceIds.includes(referenceId))continue;
    const id=citation.sentenceId||citation.id;
    const pages=[...new Set((sentenceRegions(citation).length?sentenceRegions(citation).map(region=>region.page):[citation.page]).filter(page=>Number.isInteger(page)&&page>0))].sort((a,b)=>a-b);
    const existing=uses.get(id);
    if(existing){existing.pages=[...new Set([...existing.pages,...pages])].sort((a,b)=>a-b);continue;}
    uses.set(id,{id,sentenceText:citation.sentenceText||citation.text,pages,purpose:citationPurpose(citation,referenceId,purposes)});
  }
  return [...uses.values()].sort((a,b)=>(a.pages[0]||0)-(b.pages[0]||0));
}

export function referencesForCitation(citation:CitationEntry,references:CitationReference[]):CitationReference[]{
  const byId=new Map(references.map(reference=>[reference.id,reference]));
  return [...new Set(citation.referenceIds)].flatMap(id=>{const reference=byId.get(id);return reference?[reference]:[];});
}

export function referenceLabel(reference:CitationReference):string{
  const authors=reference.authors.map(author=>author.split(',')[0].trim()).filter(Boolean);
  const separator=authors.every(author=>/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(author)&&!/[가-힣]/.test(author))?' & ':'·';
  const label=authors.length>2?`${authors[0]} 외`:authors.join(separator)||reference.authorText||reference.title;
  return `${label}(${reference.year})`;
}

export function referencePdf(reference:CitationReference|undefined,sources:CitationSource[]):{source:CitationSource;page:number}|undefined{
  if(!reference)return;
  const source=sources.find(item=>(reference.sourceId?item.id===reference.sourceId:item.referenceId===reference.id)&&(item.kind==='pdf'||(!item.kind&&!!item.referenceId)));
  if(!source||!Number.isInteger(source.pages)||source.pages!<1)return;
  const requested=reference.sourcePage??source.targetPage??source.defaultPage??source.locators?.[0]?.page??1;
  return {source,page:Math.max(1,Math.min(source.pages!,Number.isInteger(requested)?requested:1))};
}

export function verifiedReferenceUrl(reference:CitationReference|undefined):string|undefined{
  if(!reference?.verifiedSource||!reference.sourceUrl)return;
  return safeHttpsUrl(reference.sourceUrl);
}

function safeHttpsUrl(value:unknown):string|undefined{
  if(typeof value!=='string')return;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:undefined;}catch{return;}
}

export function defaultCitationDocumentMode(reference:CitationReference|undefined,sources:CitationSource[],webSources:EvidenceWebSource[]=[]):CitationDocumentMode{
  return referencePdf(reference,sources)?'source':webSources.some(source=>safeHttpsUrl(source.url))||verifiedReferenceUrl(reference)?'web':'bibliography';
}

export function sourcePageLabel(source:CitationSource|undefined,page:number):string{
  const mapping=source?.pageMap?.find(item=>item.page===page&&Number.isInteger(item.originalPage)&&item.originalPage>0);
  return mapping?`발췌 ${page}쪽 · 원본 PDF ${mapping.originalPage}쪽`:`PDF ${page}쪽`;
}

export function citationEvidenceForSelection(citation:CitationEntry,referenceId:string|undefined,source:CitationSource|undefined,evidence:CitationEvidenceData,thesisSha256:string):CitationEvidenceSelection{
  const empty=(reason:CitationEvidenceSelection['reason'],notes:string[]=[],webSources:EvidenceWebSource[]=[]):CitationEvidenceSelection=>({status:'unverified',locators:[],notes,webSources,reason});
  const sameHash=(a:unknown,b:unknown)=>typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/i.test(a)&&a.toLowerCase()===b.toLowerCase();
  if(!sameHash(evidence.meta.thesisSha256,thesisSha256))return empty('thesis-mismatch');
  const sentenceId=citation.sentenceId||(citation.selectionKind==='sentence'?citation.id:undefined);
  if(!referenceId||!citation.referenceIds.includes(referenceId))return empty('no-entry');
  const entries=evidence.entries.filter(entry=>entry.referenceId===referenceId&&(citation.selectionKind==='bibliography'||entry.sentenceId===sentenceId));
  if(!entries.length)return empty('no-entry');
  const notes=[...new Set(entries.map(entry=>entry.note?.trim()).filter((note):note is string=>!!note))];
  const webSources:EvidenceWebSource[]=[];
  for(const entry of entries){
    const url=entry.status!=='unverified'?safeHttpsUrl(entry.sourceUrl):undefined;
    if(url&&!webSources.some(source=>source.url===url))webSources.push({url,label:entry.sourceLabel?.trim()||'확인한 근거 페이지'});
  }
  if(!source||!Number.isInteger(source.pages)||source.pages!<1){
    const webOnly=entries.every(entry=>entry.status==='web'||(entry.status==='partial'&&!entry.locators.length&&!!safeHttpsUrl(entry.sourceUrl)));
    return webOnly?{status:entries.some(entry=>entry.status==='partial')?'partial':'web',locators:[],notes,webSources}:empty('source-mismatch',notes,webSources);
  }
  const confirmed=entries.filter(entry=>(entry.status==='verified'||entry.status==='partial')&&entry.sourceId===source.id&&sameHash(entry.sourceSha256,source.sha256));
  if(!confirmed.length)return empty(entries.some(entry=>entry.status==='verified'||entry.status==='partial')?'source-mismatch':'no-entry',notes,webSources);
  const pages=new Map<number,{value:ResolvedEvidenceLocator;printed:Set<string>;rects:Set<string>}>();
  let invalidLocators=false;
  for(const entry of confirmed)for(const locator of entry.locators){
    if(!Number.isInteger(locator.page)||locator.page<1||locator.page>source.pages!){invalidLocators=true;continue;}
    let record=pages.get(locator.page);
    if(!record){record={value:{page:locator.page,summaries:[],rects:[],sentenceIds:[]},printed:new Set(),rects:new Set()};pages.set(locator.page,record);}
    const summary=locator.summary.trim();if(summary&&!record.value.summaries.includes(summary))record.value.summaries.push(summary);
    if(locator.printed?.trim())record.printed.add(locator.printed.trim());
    if(!record.value.sentenceIds.includes(entry.sentenceId))record.value.sentenceIds.push(entry.sentenceId);
    const size=source.pageSizes?.find(size=>size.page===locator.page);
    for(const rect of locator.rects||[]){
      if(!validRect(rect)||rect[0]<0||rect[1]<0||(size&&(rect[2]>size.width||rect[3]>size.height)))continue;
      const key=rect.join('|');if(record.rects.has(key))continue;record.rects.add(key);record.value.rects.push([...rect]);
    }
  }
  if(!pages.size)return empty('invalid-locators',notes,webSources);
  const locators=[...pages.values()].map(record=>({...record.value,printed:record.printed.size===1?[...record.printed][0]:undefined}));
  if(citation.selectionKind==='bibliography')locators.sort((a,b)=>a.page-b.page);
  return {status:invalidLocators||confirmed.length!==entries.length||confirmed.some(entry=>entry.status==='partial')?'partial':'verified',locators,notes,webSources};
}

export function evidenceLocatorLabel(locator:Pick<ResolvedEvidenceLocator,'page'|'printed'>):string{
  return locator.printed?`본문 p. ${locator.printed} · PDF ${locator.page}쪽`:`PDF ${locator.page}쪽`;
}

export function bibliographyPage(reference:CitationReference|undefined,pageCount:number,firstPage:number):number{
  const wanted=reference?.bibliographyPage??firstPage;
  return Number.isInteger(wanted)&&wanted>=1&&wanted<=pageCount?wanted:Math.max(1,Math.min(pageCount,firstPage));
}
