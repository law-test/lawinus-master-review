import React,{useEffect,useMemo,useState} from 'react';
import PdfPane from './pdf-viewer';
import {assetUrl} from './review-api';
import {bibliographyPage,citationPurpose,defaultCitationDocumentMode,referenceCitationUses,referenceLabel,referencePdf,referencesForCitation,sourcePageLabel,verifiedReferenceUrl,type CitationData,type CitationDocumentMode,type CitationEntry,type CitationPurposes,type CitationReference,type CitationSource} from './citation-model';
import citationDataJson from './citation-data.json';
import citationPurposesJson from './citation-purposes.json';
import './citation-panel.css';

const citationData=citationDataJson as CitationData,citationPurposes=citationPurposesJson as CitationPurposes;
type Props={citation:CitationEntry;references:CitationReference[];sources:CitationSource[];thesisPageCount:number;thesisPages:{page:number;width:number;height:number}[];onBack:()=>void;onThesis:(page:number)=>void;onCitationNavigate?:(id:string,page:number)=>void;onMemo:(citation:CitationEntry)=>void;sourceMemos?:any[];onSourceMemo?:(sourceId:string,page:number,position?:{x:number;y:number})=>void;onSourceMemoSelect?:(memo:any)=>void};

export default function CitationPanel({citation,references,sources,thesisPageCount,thesisPages,onBack,onThesis,onCitationNavigate,onMemo,sourceMemos=[],onSourceMemo,onSourceMemoSelect}:Props){
  const matched=useMemo(()=>referencesForCitation(citation,references),[citation,references]);
  const [selectedId,setSelectedId]=useState(matched[0]?.id||''),[mode,setMode]=useState<CitationDocumentMode>(()=>defaultCitationDocumentMode(matched[0],sources));
  const [page,setPage]=useState(1),[zoom,setZoom]=useState(1),[placingSource,setPlacingSource]=useState(false);
  const selected=matched.find(reference=>reference.id===selectedId)||matched[0];
  const linked=referencePdf(selected,sources),externalUrl=verifiedReferenceUrl(selected);
  const firstBibliographyPage=Math.min(...references.map(reference=>reference.bibliographyPage).filter(p=>Number.isInteger(p)&&p>0),thesisPageCount);
  const bibPage=bibliographyPage(selected,thesisPageCount,firstBibliographyPage);
  const showingSource=!!linked&&mode==='source',documentId=showingSource?linked!.source.id:'thesis';
  const showingWeb=!!externalUrl&&mode==='web';
  const total=showingSource?linked!.source.pages!:thesisPageCount;
  useEffect(()=>{setSelectedId(matched[0]?.id||'');setMode(defaultCitationDocumentMode(matched[0],sources));},[citation.id]);
  useEffect(()=>{setPage(showingSource?linked!.page:bibPage);setZoom(1);},[citation.id,selected?.id,documentId,mode,bibPage,linked?.page]);
  useEffect(()=>setPlacingSource(false),[citation.id,documentId]);
  function changeReference(id:string){setSelectedId(id);setMode(defaultCitationDocumentMode(matched.find(reference=>reference.id===id),sources));}
  const heading=showingWeb?'연결된 자료 페이지':showingSource?'연결된 원문':'논문에 수록된 참고문헌';
  const isBibliography=citation.selectionKind==='bibliography';
  const citationText=citation.selectionKind==='sentence'&&citation.selectedCitationTexts?.length?citation.selectedCitationTexts.join(' · '):citation.text;
  const contextText=!isBibliography?(citation.sentenceText||(citation.selectionKind==='sentence'?citation.text:undefined)):undefined;
  const purpose=citationPurpose(citation,selected?.id,citationPurposes);
  const referenceUses=useMemo(()=>isBibliography&&selected?referenceCitationUses(selected.id,citationData.citations,citationPurposes):[],[isBibliography,selected?.id]);
  function showCitation(id:string,page:number){if(onCitationNavigate)onCitationNavigate(id,page);else onThesis(page);}
  return <div className="citation-panel" data-citation-id={citation.id}>
    <div className="citation-actions"><button onClick={onBack}>‹ 발표자료로 돌아가기</button><button onClick={()=>onMemo(citation)}>＋ 인용 검토메모</button></div>
    <div className="citation-summary">
      <div className="section-eyebrow"><b>{isBibliography?'참고문헌':citation.selectionKind==='sentence'?'선택한 인용 문장':'선택한 본문 인용'}</b><button onClick={()=>onThesis(citation.page)}>논문 PDF {citation.page}쪽 ↗</button></div>
      {!isBibliography&&<blockquote className="selected-citation-text">{citationText}</blockquote>}
      {contextText&&<details className="citation-context" key={citation.id} open><summary>인용한 본문 문장</summary><blockquote>{contextText}</blockquote></details>}
      {purpose&&<details className="citation-purpose" key={'purpose-'+citation.id} open><summary>인용 취지</summary><p className="citation-purpose-basis">논문 본문을 바탕으로 정리한 인용 취지</p><p className="citation-purpose-text">{purpose}</p></details>}
      {citation.relation==='secondary'&&<p className="citation-secondary-note"><b>재인용</b> 아래 문헌은 본문에서 밝힌 재인용 출처입니다. 원저와 재인용 출처의 구분은 위 인용 표기를 따릅니다.</p>}
      {citation.relation==='secondary-mixed'&&<p className="citation-secondary-note"><b>재인용 포함</b> 이 문장에는 재인용 표기가 포함되어 있습니다. 해당 문헌 버튼에 재인용 출처를 표시했습니다.</p>}
      {matched.length>1&&<div className="citation-reference-choices" aria-label="이 인용의 문헌 선택">{matched.map(reference=><button key={reference.id} className={selected?.id===reference.id?'selected':''} aria-pressed={selected?.id===reference.id} onClick={()=>changeReference(reference.id)}>{referenceLabel(reference)}{citation.secondaryReferenceIds?.includes(reference.id)&&<small>재인용 출처</small>}</button>)}</div>}
      {selected?<div className="citation-reference-entry"><h2>{selected.title}</h2><p>{selected.fullEntry}</p></div>:<p className="citation-unmatched">이 인용에 대응하는 참고문헌을 확정하지 못했습니다. 논문의 참고문헌 목록을 보여드립니다.</p>}
      {isBibliography&&selected&&<details className="citation-purpose citation-reference-uses" key={'uses-'+selected.id} open><summary>본문에서의 인용 취지{referenceUses.length?` · ${referenceUses.length}곳`:''}</summary>{referenceUses.length?<><p className="citation-purpose-basis">논문 본문을 바탕으로 정리한 인용 취지</p><ol>{referenceUses.map(use=><li key={use.id}><div className="citation-use-pages">{use.pages.map(page=><button key={page} onClick={()=>showCitation(use.id,page)}>본문 PDF {page}쪽 ↗</button>)}</div>{use.purpose&&<p className="citation-purpose-text">{use.purpose}</p>}<details className="citation-use-context"><summary>인용한 본문 문장</summary><blockquote>{use.sentenceText}</blockquote></details></li>)}</ol></>:<p className="citation-purpose-empty">참고문헌에는 수록되어 있으나, 현재 연결된 본문 인용이 없습니다.</p>}</details>}
      {selected&&citation.matchStatus!=='matched'&&citation.matchStatus!=='exact'&&<p className="citation-match-note">논문에 적힌 인용과 참고문헌 표기를 함께 확인해 주세요.</p>}
      <div className="citation-availability">
        {linked&&<><span>{linked.source.coverageLabel||`${linked.source.coverage||'원문'} 파일 연결`}</span><button className={showingSource?'selected':''} aria-pressed={showingSource} onClick={()=>setMode('source')}>원문 보기</button></>}
        {externalUrl&&<button className={showingWeb?'selected':''} aria-pressed={showingWeb} onClick={()=>setMode('web')}>원문 페이지</button>}
        {(linked||externalUrl)?<button className={mode==='bibliography'?'selected':''} aria-pressed={mode==='bibliography'} onClick={()=>setMode('bibliography')}>논문의 참고문헌 보기</button>:<span>연결된 원문 PDF가 없어 논문의 참고문헌 수록면을 표시합니다.</span>}
        {externalUrl&&<a href={externalUrl} target="_blank" rel="noopener noreferrer">{selected?.sourceLabel||'확인된 자료 페이지'} ↗</a>}
      </div>
    </div>
    <div className="citation-document-label"><span>{heading}</span><a href={showingWeb?externalUrl:assetUrl(documentId)} target="_blank" rel="noopener noreferrer">새 창에서 열기 ↗</a></div>
    {!showingWeb&&<div className="pane-toolbar citation-toolbar"><div className="pager"><button aria-label="인용자료 이전 쪽" disabled={page<=1} onClick={()=>setPage(page-1)}>‹</button><input type="number" aria-label="인용자료 PDF 쪽수" min={1} max={total} key={page} defaultValue={page} onBlur={e=>setPage(Math.max(1,Math.min(total,Number(e.currentTarget.value)||1)))} onKeyDown={e=>{if(e.key==='Enter')setPage(Math.max(1,Math.min(total,Number(e.currentTarget.value)||1)));}}/><span>/ {total}</span><button aria-label="인용자료 다음 쪽" disabled={page>=total} onClick={()=>setPage(page+1)}>›</button></div><div className="toolbar-spacer"/><button aria-label="인용자료 축소" onClick={()=>setZoom(Math.max(.7,zoom-.15))}>−</button><button title="인용자료 너비에 맞추기" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="인용자료 확대" onClick={()=>setZoom(Math.min(2,zoom+.15))}>＋</button>{showingSource&&onSourceMemo&&<><button className="citation-source-memo-button" onClick={()=>{setPlacingSource(false);onSourceMemo(documentId,page);}} title="현재 원전 쪽에 검토메모 작성">＋ 원전 메모</button><button className={'citation-source-memo-button'+(placingSource?' selected':'')} aria-pressed={placingSource} onClick={()=>setPlacingSource(!placingSource)} title="원전의 지점을 선택해 검토메모 작성">{placingSource?'위치 선택 취소':'위치 표시'}</button></>}</div>}
    {showingSource&&placingSource&&<div className="citation-place-hint" role="status">메모할 원전의 위치를 눌러 주세요.</div>}
    {showingWeb?<div className="citation-web-viewer"><p className="citation-web-hint">외부 사이트에서 이 창의 표시를 제한하면 ‘새 창에서 열기’를 이용해 주세요.</p><iframe key={externalUrl} src={externalUrl} title={`${selected?.title||'참고문헌'} 자료 페이지`} sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer"/></div>:<PdfPane id={documentId} page={page} total={total} zoom={zoom} pageSizes={showingSource?linked!.source.pageSizes:thesisPages} highlights={showingSource?[]:(selected?.bibliographyRects||[]).map(rect=>({page:bibPage,rect}))} pins={showingSource?sourceMemos.filter(memo=>memo.sourceId===documentId):[]} placing={showingSource&&placingSource} onPlace={(x,y,placedPage)=>{setPlacingSource(false);onSourceMemo?.(documentId,placedPage,{x,y});}} onPin={onSourceMemoSelect} onPageChange={setPage} label={heading}/>}
    <div className="page-footnotes"><span>{heading}</span><span>{showingWeb?selected?.sourceLabel||'외부 자료 페이지':showingSource?sourcePageLabel(linked!.source,page):`PDF ${page}쪽${page===bibPage&&selected?.printedPage?` · 인쇄 ${selected.printedPage}쪽`:''}`}</span></div>
  </div>;
}
