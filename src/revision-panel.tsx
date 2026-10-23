import React,{useState} from 'react';
import {citationPurpose,type CitationData,type CitationPurposes} from './citation-model';
import {readingStatus,validRevisions,type ReadingUpdates,type ReviewRecords,type RevisionRecord} from './review-records-model';
import rawRecords from './review-records.json';
import rawUpdates from './reading-updates.json';
import rawCitations from './citation-data.json';
import rawPurposes from './citation-purposes.json';
import './review-parity.css';
export const reviewRecords=rawRecords as ReviewRecords,readingUpdates=rawUpdates as ReadingUpdates;
const citations=rawCitations as CitationData,purposes=rawPurposes as CitationPurposes;
export function ReadingStatus({referenceId}:{referenceId:string}){
 const status=readingStatus(referenceId,reviewRecords,readingUpdates,citations.meta.pdfSha256);
 return <details className="reading-status"><summary><span className={status.complete?'reading-complete':'reading-pending'}>{status.label}</span></summary><p>{status.scope}</p>{!status.update&&<p className="review-disclaimer">이전 검토의 독해 범위입니다. 새 기록에서 자료의 종류와 확인 범위를 구분합니다.</p>}{status.update?.previousVerified&&<p className="review-disclaimer">이전 확인 기록을 승계했습니다. 이번에 새로 전권을 읽었다는 뜻은 아닙니다.</p>}{status.update&&status.update.totalPages>0&&<p className="review-disclaimer">아래 쪽수는 독해한 원문 기준이며, 화면의 발췌 PDF 쪽수와 다를 수 있습니다.</p>}{status.finding&&<p>{status.finding}</p>}{status.update?.findings.map((finding,index)=><div className="reading-finding" key={index}><b>{finding.action==='retain'?'유지':finding.action==='revise'?'수정 검토':'추가 확인'}{finding.pdfPages.length?` · 독해한 원문 PDF ${finding.pdfPages.join(', ')}쪽`:''}{finding.printedPages?` · 인쇄 ${finding.printedPages}쪽`:''}</b><p>{finding.issue}</p><p>{finding.rationale}</p>{finding.proposedText&&<blockquote>{finding.proposedText}</blockquote>}</div>)}</details>;
}
export function RevisionDetail({record,onThesis,onCitation,onMemo}:{record:RevisionRecord;onThesis:(page:number)=>void;onCitation?:(id:string,page:number)=>void;onMemo?:(record:RevisionRecord)=>void}){
 const [copyStatus,setCopyStatus]=useState('');
 const related=citations.citations.filter(c=>record.sentenceIds.includes(c.sentenceId||''));
 const seen=new Set<string>();const intents=related.flatMap(c=>{const text=citationPurpose(c,undefined,purposes);if(!text||seen.has(text))return [];seen.add(text);return [text];});
 async function copy(){try{await navigator.clipboard.writeText(record.proposedText);setCopyStatus('수정문을 복사했습니다.');}catch{setCopyStatus('복사하지 못했습니다. 아래 수정문을 선택해 복사해 주세요.');}}
 return <article className="revision-detail" data-revision-id={record.id}>
  <div className="revision-location"><button onClick={()=>onThesis(record.page)}>논문 PDF {record.page}쪽{record.printedPage?` · 본문 ${record.printedPage}쪽`:''} ↗</button><span>문단 수정 제안</span></div>
  <h3>원문 위치</h3><blockquote>{record.before}</blockquote>
  <h3>문제</h3>{record.issues.map(issue=><p key={issue}>{issue}</p>)}
  {!!intents.length&&<><h3>인용 취지</h3>{intents.map(intent=><p key={intent}>{intent}</p>)}</>}
  <h3>근거</h3>{record.assessments.length?record.assessments.map((assessment,index)=><details key={index} className="revision-assessment"><summary>{citations.references.find(ref=>ref.id===assessment.referenceId)?.title||'인용 대조 기록'}</summary><p>{assessment.issue}</p><p>{assessment.evidence}</p><p>{assessment.resolution}</p></details>):<p>문체와 논증 연결을 검토한 제안입니다. 원전 근거 쪽의 확인 여부는 관련 문헌 화면에서 별도로 확인합니다.</p>}
  {onCitation&&related.length>0&&<div className="revision-citation-links">{[...new Map(related.map(c=>[c.id,c])).values()].map(c=><button key={c.id} onClick={()=>onCitation(c.id,c.page)}>{c.text} · 원전 대조 ↗</button>)}</div>}
  <h3>수정문</h3><blockquote className="proposed-text">{record.proposedText}</blockquote>
  <h3>확인 상태</h3><p className="review-disclaimer">기존 수정 검토본의 제안입니다. 사이트의 원본 PDF에는 적용하지 않았습니다. 문헌 전권 독해 완료를 의미하지 않습니다.</p>
  <div className="revision-actions"><button onClick={()=>void copy()}>수정문 복사</button>{onMemo&&<button onClick={()=>onMemo(record)}>검토 메모 남기기</button>}</div>{copyStatus&&<p role="status">{copyStatus}</p>}
 </article>;
}
export default function RevisionPanel({page,initialPageOnly=false,onThesis,onCitation,onMemo}:{page:number;initialPageOnly?:boolean;onThesis:(page:number)=>void;onCitation:(id:string,page:number)=>void;onMemo:(record:RevisionRecord)=>void}){
 const [query,setQuery]=useState(''),[pageOnly,setPageOnly]=useState(initialPageOnly);
 const records=validRevisions(reviewRecords,citations.meta.pdfSha256,citations.meta.pageCount);
 const filtered=records.filter(r=>(!pageOnly||r.page===page)&&(!query||[r.before,r.proposedText,...r.issues].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())));
 return <div className="scroll-panel revisions-panel"><div className="panel-heading"><h2>본문 수정안</h2><p>원문 위치부터 문제·인용 취지·근거·수정문·확인 상태 순으로 검토합니다.</p></div><p className="review-disclaimer">원본 PDF는 그대로 두고 수정 제안 {records.length}건을 보여드립니다.</p><input type="search" className="search-input" aria-label="수정안 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="원문·수정문·문제 검색"/><div className="filter-buttons"><button className={!pageOnly?'selected':''} aria-pressed={!pageOnly} onClick={()=>setPageOnly(false)}>전체 {records.length}건</button><button className={pageOnly?'selected':''} aria-pressed={pageOnly} onClick={()=>setPageOnly(true)}>현재 PDF {page}쪽</button></div><p className="revision-result-count" role="status">{filtered.length}건</p>{filtered.map(record=><details key={record.id} className="revision-list-item"><summary><b>PDF {record.page}쪽 · 문단 수정 제안</b><span>{record.before}</span></summary><RevisionDetail record={record} onThesis={onThesis} onCitation={onCitation} onMemo={onMemo}/></details>)}{!filtered.length&&<p className="empty-state">이 조건에 연결된 수정안이 없습니다.</p>}</div>;
}
