import raw from './master-manuscript-data.json' with {type:'json'};
import citationRaw from './citation-data.json' with {type:'json'};
import type {PdfTarget,PdfRect} from './pdf-viewer-model';
export type ManuscriptParagraph={id:string;text:string;page:number;printed:string|null;kind:string;heading:boolean;order:number;rects:{page:number;rect:number[]}[];citationIds:string[]};
export const manuscriptParagraphs=raw.paragraphs as ManuscriptParagraph[];
export const manuscriptMeta=raw.meta;
export function paragraphTargets(verified:boolean):PdfTarget[]{
 if(!verified)return [];
 return manuscriptParagraphs.flatMap(p=>p.rects.map(r=>({noteId:p.id,page:r.page,rect:r.rect as PdfRect,kind:'paragraph',label:'문단 수정안 열기'})));
}
export function effectiveManuscriptEdits<T extends {text:string}>(heads:Record<string,T>):Record<string,T>{
 const originals=new Map(manuscriptParagraphs.map(p=>[p.id,p.text]));
 return Object.fromEntries(Object.entries(heads).filter(([id,edit])=>originals.has(id)&&edit.text!==originals.get(id)));
}
function normalizedWithOffsets(text:string){
 let normalized='';const offsets:number[]=[];
 for(let i=0;i<text.length;i++){if(/\s/.test(text[i]))continue;normalized+=text[i].replace(/[–−]/g,'-');offsets.push(i);}
 return {normalized,offsets};
}
export function citationTextParts(paragraph:ManuscriptParagraph,text=paragraph.text):{text:string;citationId?:string}[]{
 // A changed manuscript needs a fresh contextual review; original citation anchors remain in the PDF.
 if(text!==paragraph.text)return [{text}];
 const source=normalizedWithOffsets(text),ranges:{start:number;end:number;id:string}[]=[];
 for(const id of paragraph.citationIds){
  const citation=citationRaw.citations.find(c=>c.id===id);if(!citation)continue;
  const candidates=[citation.sentenceText,citation.text].filter((s):s is string=>typeof s==='string'&&!!s);
  for(const candidate of candidates){const query=normalizedWithOffsets(candidate).normalized,start=source.normalized.indexOf(query);if(start<0)continue;
   const a=source.offsets[start],b=source.offsets[start+query.length-1]+1;
   if(!ranges.some(r=>r.start<b&&r.end>a))ranges.push({start:a,end:b,id:citation.sentenceId||citation.id});break;
  }
 }
 ranges.sort((a,b)=>a.start-b.start);const parts:{text:string;citationId?:string}[]=[];let at=0;
 for(const r of ranges){if(r.start>at)parts.push({text:text.slice(at,r.start)});parts.push({text:text.slice(r.start,r.end),citationId:r.id});at=r.end;}
 if(at<text.length)parts.push({text:text.slice(at)});return parts;
}
