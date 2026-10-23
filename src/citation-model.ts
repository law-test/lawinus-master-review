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

export function citationDatasetMatches(meta:CitationData['meta'],pdfSha256:unknown,pageCount:unknown):boolean{
  return typeof pdfSha256==='string'&&/^[a-f0-9]{64}$/i.test(meta.pdfSha256)&&meta.pdfSha256.toLowerCase()===pdfSha256.toLowerCase()&&meta.pageCount===pageCount;
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
  try{const url=new URL(reference.sourceUrl);return url.protocol==='https:'?url.href:undefined;}catch{return;}
}

export function defaultCitationDocumentMode(reference:CitationReference|undefined,sources:CitationSource[]):CitationDocumentMode{
  return referencePdf(reference,sources)?'source':verifiedReferenceUrl(reference)?'web':'bibliography';
}

export function sourcePageLabel(source:CitationSource|undefined,page:number):string{
  const mapping=source?.pageMap?.find(item=>item.page===page&&Number.isInteger(item.originalPage)&&item.originalPage>0);
  return mapping?`발췌 ${page}쪽 · 원본 PDF ${mapping.originalPage}쪽`:`PDF ${page}쪽`;
}

export function bibliographyPage(reference:CitationReference|undefined,pageCount:number,firstPage:number):number{
  const wanted=reference?.bibliographyPage??firstPage;
  return Number.isInteger(wanted)&&wanted>=1&&wanted<=pageCount?wanted:Math.max(1,Math.min(pageCount,firstPage));
}
