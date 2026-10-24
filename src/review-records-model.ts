import type {CitationEntry} from './citation-model';
export type ReviewAssessment={sentenceId:string;referenceId:string;issue:string;evidence:string;resolution:string};
export type RevisionRecord={id:string;page:number;printedPage?:string;before:string;proposedText:string;issues:string[];sentenceIds:string[];referenceIds:string[];assessments:ReviewAssessment[];status:'proposed'};
export type ReadingBaseline={referenceId:string;sourceSha256?:string;scope:string;finding:string;complete:boolean};
export type ReviewRecords={meta:{thesisSha256:string;reviewedAt:string;label:string};revisions:RevisionRecord[];assessments:ReviewAssessment[];readingBaseline:ReadingBaseline[]};
export type ReadingScopeKind='book'|'article'|'chapter'|'web'|'law';
export type TextReadingCoverage={format:'html';declaredScope:'full-text';expectedUnitIds:string[];units:{id:string;label:string;sha256:string;complete:boolean}[];editionNote:string};
export type ReadingUpdate={scopeKind?:ReadingScopeKind;scopeLabel?:string;citedUnitComplete?:boolean;citedUnitRanges?:[number,number][];textCoverage?:TextReadingCoverage;previousVerified?:{record:string;reviewedAt?:string};sourceUrl?:string;referenceId:string;sourceSha256:string;readRanges:[number,number][];totalPages:number;wholeBookRead:boolean;findings:{pdfPages:number[];printedPages?:string;issue:string;rationale:string;proposedText?:string;action:'retain'|'revise'|'verify'}[]};
export type ReadingUpdates={meta:{thesisSha256:string;reviewedAt?:string};entries:ReadingUpdate[]};
export function sameReviewThesis(a:unknown,b:unknown):boolean{return typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/i.test(a)&&a.toLowerCase()===b.toLowerCase();}
export function revisionsForSelection(selection:CitationEntry,referenceId:string|undefined,records:ReviewRecords,thesisSha256:string):RevisionRecord[]{
 if(!sameReviewThesis(records.meta.thesisSha256,thesisSha256))return [];
 const sentenceId=selection.sentenceId||(selection.selectionKind==='sentence'?selection.id:undefined);
 return records.revisions.filter(record=>selection.selectionKind==='bibliography'?!!referenceId&&record.referenceIds.includes(referenceId):!!sentenceId&&record.sentenceIds.includes(sentenceId)&&(!referenceId||record.referenceIds.includes(referenceId)));
}
export function validRevisions(records:ReviewRecords,thesisSha256:string,pageCount:number):RevisionRecord[]{
 return sameReviewThesis(records.meta.thesisSha256,thesisSha256)?records.revisions.filter(r=>Number.isInteger(r.page)&&r.page>=1&&r.page<=pageCount&&r.before.trim()&&r.proposedText.trim()):[];
}
export function coveredPageCount(ranges:[number,number][],totalPages:number):number{
 if(!Number.isInteger(totalPages)||totalPages<1)return 0;
 const valid=ranges.filter(([start,end])=>Number.isInteger(start)&&Number.isInteger(end)&&start>=1&&end>=start&&end<=totalPages).sort((a,b)=>a[0]-b[0]);
 let count=0,last=0;for(const [start,end] of valid){if(end>last){count+=end-Math.max(last,start-1);last=end;}}return count;
}
function safeReadingUrl(value:unknown):boolean{
 if(typeof value!=='string')return false;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
}
function completeTextCoverage(update:ReadingUpdate):boolean{
 const coverage=update.textCoverage;
 if(!coverage||coverage.format!=='html'||coverage.declaredScope!=='full-text'||!safeReadingUrl(update.sourceUrl)||!/^[a-f0-9]{64}$/i.test(update.sourceSha256)||typeof coverage.editionNote!=='string'||!coverage.editionNote.trim())return false;
 const {expectedUnitIds,units}=coverage;
 if(!Array.isArray(expectedUnitIds)||!Array.isArray(units)||!expectedUnitIds.length||units.length!==expectedUnitIds.length)return false;
 if(!expectedUnitIds.every(id=>typeof id==='string'&&id.trim()===id&&id.length>0)||new Set(expectedUnitIds).size!==expectedUnitIds.length)return false;
 const seen=new Set<string>();
 return units.every(unit=>{
  if(!unit||typeof unit.id!=='string'||!expectedUnitIds.includes(unit.id)||seen.has(unit.id)||typeof unit.label!=='string'||!unit.label.trim()||typeof unit.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(unit.sha256)||unit.complete!==true)return false;
  seen.add(unit.id);return true;
 });
}
export function readingStatus(referenceId:string,records:ReviewRecords,updates:ReadingUpdates,thesisSha256:string){
 if(!sameReviewThesis(records.meta.thesisSha256,thesisSha256))return {label:'확인 기록 없음',scope:'현재 논문 기준본과 연결된 독해 기록이 없습니다.',complete:false,citedUnitComplete:false,newWholeBookRead:false,bodyTextComplete:false};
 const baseline=records.readingBaseline.find(item=>item.referenceId===referenceId);
 const update=sameReviewThesis(updates.meta.thesisSha256,thesisSha256)?updates.entries.find(item=>item.referenceId===referenceId&&(/^[a-f0-9]{64}$/i.test(item.sourceSha256)||(safeReadingUrl(item.sourceUrl)&&(['web','law'].includes(item.scopeKind||'')||item.citedUnitComplete===false)))):undefined;
 if(update){
  const kind=update.scopeKind||'book',readPages=coveredPageCount(update.readRanges,update.totalPages);
  const fullPdf=Number.isInteger(update.totalPages)&&update.totalPages>0&&readPages===update.totalPages;
  const units=update.citedUnitRanges;
  const declaredUnitCovered=!!units?.length&&units.every(([a,b])=>Number.isInteger(a)&&Number.isInteger(b)&&a>=1&&b>=a&&b<=update.totalPages)&&coveredPageCount([...update.readRanges,...units],update.totalPages)===readPages;
  const onlineUnit=(kind==='web'||kind==='law')&&safeReadingUrl(update.sourceUrl)&&update.totalPages===0&&update.readRanges.length===0;
  const fullText=['book','article','chapter'].includes(kind)&&completeTextCoverage(update);
  const wholeBookPdf=kind==='book'&&update.wholeBookRead===true&&fullPdf;
  const bodyTextComplete=fullText;
  const citedUnitComplete=kind==='book'?wholeBookPdf||(bodyTextComplete&&update.citedUnitComplete===true):update.citedUnitComplete===true&&(fullPdf||declaredUnitCovered||onlineUnit||fullText);
  const previousVerified=!!update.previousVerified?.record?.trim();
  const noun=kind==='book'&&update.textCoverage&&!wholeBookPdf?'본문 전 장 독해':{book:'전권 독해',article:'논문 전문 독해',chapter:'인용 장 독해',web:'웹 자료',law:'인용 조문'}[kind];
  const complete=citedUnitComplete&&!previousVerified,newWholeBookRead=wholeBookPdf&&complete;
  const ranges=update.readRanges.filter(([a,b])=>Number.isInteger(a)&&Number.isInteger(b)&&a>=1&&b>=a&&b<=update.totalPages);
  const pageScope=update.totalPages>0?`독해한 원문 PDF ${ranges.map(([a,b])=>a===b?a:`${a}–${b}`).join(', ')||'확인 범위 없음'}쪽 · ${readPages} / ${update.totalPages}쪽`:fullText?undefined:'쪽수 없는 온라인 자료';
  const textScope=fullText?`온라인 원문 확인 · ${update.textCoverage!.editionNote}`:undefined;
  const label=kind==='book'&&bodyTextComplete&&!citedUnitComplete?`${previousVerified?'이전 본문 전 장 독해 확인 기록 승계':'본문 전 장 독해 확인'} · 판본 대조 미완료`:previousVerified?(citedUnitComplete?`이전 ${noun} 확인 기록 승계`:`이전 ${noun} 범위 승계`):`${noun} ${citedUnitComplete?'확인':'미완료'}`;
  return {label,scope:[update.scopeLabel,textScope,pageScope].filter(Boolean).join(' · '),complete,citedUnitComplete,newWholeBookRead,bodyTextComplete,previousVerified,update,finding:baseline?.finding};
 }
 return {label:baseline?'이전 독해 기록 · 추가 확인 중':'확인 기록 없음',scope:baseline?.scope||'등록된 독해 범위가 없습니다.',complete:false,citedUnitComplete:false,newWholeBookRead:false,bodyTextComplete:false,finding:baseline?.finding};
}
