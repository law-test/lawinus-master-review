import {validRect,type PdfTarget} from './pdf-viewer-model.ts';

export type CitationReference={id:string;authors:string[];authorText?:string;year:string;title:string;fullEntry:string;bibliographyPage:number;printedPage:string;bibliographyRects?:number[][];sourceId?:string;sourcePage?:number;sourceUrl?:string;sourceLabel?:string;sourceKind?:'pdf'|'web';verifiedSource?:boolean};
export type CitationEntry={id:string;page:number;text:string;rects:number[][];referenceIds:string[];matchStatus:string;relation?:string};
export type CitationData={meta:{pdfSha256:string;pageCount:number};references:CitationReference[];citations:CitationEntry[]};
export type CitationSource={id:string;referenceId?:string;title?:string;kind?:string;pages?:number;targetPage?:number;defaultPage?:number;coverage?:'전문'|'발췌본'|'full'|'excerpt'|'chapter-in-book'|'accepted-manuscript'|'prepublication'|'chapter'|'partial';coverageLabel?:string;sha256?:string;pageSizes?:{page:number;width:number;height:number}[];locators?:{page:number;printed?:string}[]};

export function citationDatasetMatches(meta:CitationData['meta'],pdfSha256:unknown,pageCount:unknown):boolean{
  return typeof pdfSha256==='string'&&/^[a-f0-9]{64}$/i.test(meta.pdfSha256)&&meta.pdfSha256.toLowerCase()===pdfSha256.toLowerCase()&&meta.pageCount===pageCount;
}

// The rectangles stay separate so line breaks and neighboring body text are never linked.
export function citationTargets(citations:CitationEntry[],enabled:boolean,pageCount:number):PdfTarget[]{
  if(!enabled)return [];
  const seen=new Set<string>(),result:PdfTarget[]=[];
  for(const citation of citations){
    if(!citation.id||!citation.text||!Number.isInteger(citation.page)||citation.page<1||citation.page>pageCount)continue;
    for(const rect of citation.rects){
      if(!validRect(rect))continue;
      const key=[citation.id,citation.page,...rect].join('|');if(seen.has(key))continue;seen.add(key);
      result.push({page:citation.page,rect:[...rect],noteId:citation.id,kind:'author-year',label:`본문 인용 ${citation.text} 참고문헌 열기`});
    }
  }
  return result;
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

export function bibliographyPage(reference:CitationReference|undefined,pageCount:number,firstPage:number):number{
  const wanted=reference?.bibliographyPage??firstPage;
  return Number.isInteger(wanted)&&wanted>=1&&wanted<=pageCount?wanted:Math.max(1,Math.min(pageCount,firstPage));
}
