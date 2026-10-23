import React,{useEffect,useMemo,useState} from 'react';
import PdfPane from './pdf-viewer';
import {assetUrl} from './review-api';
import {bibliographyPage,referenceLabel,referencePdf,referencesForCitation,verifiedReferenceUrl,type CitationEntry,type CitationReference,type CitationSource} from './citation-model';
import './citation-panel.css';

type Props={citation:CitationEntry;references:CitationReference[];sources:CitationSource[];thesisPageCount:number;thesisPages:{page:number;width:number;height:number}[];onBack:()=>void;onThesis:(page:number)=>void;onMemo:(citation:CitationEntry)=>void};

export default function CitationPanel({citation,references,sources,thesisPageCount,thesisPages,onBack,onThesis,onMemo}:Props){
  const matched=useMemo(()=>referencesForCitation(citation,references),[citation,references]);
  const [selectedId,setSelectedId]=useState(matched[0]?.id||''),[mode,setMode]=useState<'source'|'bibliography'>('source');
  const [page,setPage]=useState(1),[zoom,setZoom]=useState(1);
  const selected=matched.find(reference=>reference.id===selectedId)||matched[0];
  const linked=referencePdf(selected,sources),externalUrl=verifiedReferenceUrl(selected);
  const firstBibliographyPage=Math.min(...references.map(reference=>reference.bibliographyPage).filter(p=>Number.isInteger(p)&&p>0),thesisPageCount);
  const bibPage=bibliographyPage(selected,thesisPageCount,firstBibliographyPage);
  const showingSource=!!linked&&mode==='source',documentId=showingSource?linked!.source.id:'thesis';
  const total=showingSource?linked!.source.pages!:thesisPageCount;
  useEffect(()=>{setSelectedId(matched[0]?.id||'');setMode('source');},[citation.id]);
  useEffect(()=>{setPage(showingSource?linked!.page:bibPage);setZoom(1);},[citation.id,selected?.id,documentId,mode,bibPage,linked?.page]);
  function changeReference(id:string){setSelectedId(id);setMode('source');}
  const heading=showingSource?'연결된 원문':'논문에 수록된 참고문헌';
  return <div className="citation-panel" data-citation-id={citation.id}>
    <div className="citation-actions"><button onClick={onBack}>‹ 발표자료로 돌아가기</button><button onClick={()=>onMemo(citation)}>＋ 인용 검토메모</button></div>
    <div className="citation-summary">
      <div className="section-eyebrow"><b>선택한 본문 인용</b><button onClick={()=>onThesis(citation.page)}>논문 PDF {citation.page}쪽 ↗</button></div>
      <blockquote className="selected-citation-text">{citation.text}</blockquote>
      {citation.relation==='secondary'&&<p className="citation-secondary-note"><b>재인용</b> 아래 문헌은 본문에서 밝힌 재인용 출처입니다. 원저와 재인용 출처의 구분은 위 인용 표기를 따릅니다.</p>}
      {matched.length>1&&<div className="citation-reference-choices" aria-label="이 인용의 문헌 선택">{matched.map(reference=><button key={reference.id} className={selected?.id===reference.id?'selected':''} aria-pressed={selected?.id===reference.id} onClick={()=>changeReference(reference.id)}>{referenceLabel(reference)}</button>)}</div>}
      {selected?<div className="citation-reference-entry"><h2>{selected.title}</h2><p>{selected.fullEntry}</p></div>:<p className="citation-unmatched">이 인용에 대응하는 참고문헌을 확정하지 못했습니다. 논문의 참고문헌 목록을 보여드립니다.</p>}
      {selected&&citation.matchStatus!=='matched'&&citation.matchStatus!=='exact'&&<p className="citation-match-note">논문에 적힌 인용과 참고문헌 표기를 함께 확인해 주세요.</p>}
      <div className="citation-availability">
        {linked?<><span>{linked.source.coverageLabel||`${linked.source.coverage||'원문'} 파일 연결`}</span><button className={mode==='source'?'selected':''} aria-pressed={mode==='source'} onClick={()=>setMode('source')}>원문 보기</button><button className={mode==='bibliography'?'selected':''} aria-pressed={mode==='bibliography'} onClick={()=>setMode('bibliography')}>논문의 참고문헌 보기</button></>:<span>연결된 원문 PDF가 없어 논문의 참고문헌 수록면을 표시합니다.</span>}
        {externalUrl&&<a href={externalUrl} target="_blank" rel="noopener noreferrer">{selected?.sourceLabel||'확인된 자료 페이지'} ↗</a>}
      </div>
    </div>
    <div className="citation-document-label"><span>{heading}</span><a href={assetUrl(documentId)} target="_blank" rel="noreferrer">새 창에서 열기 ↗</a></div>
    <div className="pane-toolbar citation-toolbar"><div className="pager"><button aria-label="인용자료 이전 쪽" disabled={page<=1} onClick={()=>setPage(page-1)}>‹</button><input type="number" aria-label="인용자료 PDF 쪽수" min={1} max={total} key={page} defaultValue={page} onBlur={e=>setPage(Math.max(1,Math.min(total,Number(e.currentTarget.value)||1)))} onKeyDown={e=>{if(e.key==='Enter')setPage(Math.max(1,Math.min(total,Number(e.currentTarget.value)||1)));}}/><span>/ {total}</span><button aria-label="인용자료 다음 쪽" disabled={page>=total} onClick={()=>setPage(page+1)}>›</button></div><div className="toolbar-spacer"/><button aria-label="인용자료 축소" onClick={()=>setZoom(Math.max(.7,zoom-.15))}>−</button><button title="인용자료 너비에 맞추기" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="인용자료 확대" onClick={()=>setZoom(Math.min(2,zoom+.15))}>＋</button></div>
    <PdfPane id={documentId} page={page} total={total} zoom={zoom} pageSizes={showingSource?linked!.source.pageSizes:thesisPages} highlights={showingSource?[]:(selected?.bibliographyRects||[]).map(rect=>({page:bibPage,rect}))} onPageChange={setPage} label={heading}/>
    <div className="page-footnotes"><span>{heading}</span><span>PDF {page}쪽{!showingSource&&page===bibPage&&selected?.printedPage?` · 인쇄 ${selected.printedPage}쪽`:''}</span></div>
  </div>;
}
