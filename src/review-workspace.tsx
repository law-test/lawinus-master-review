import React, {useEffect,useMemo,useRef,useState} from 'react';
import './review.css';
import {api,assetUrl,initializeReviewSession,exportNotes} from './review-api';
import PdfPane,{type PdfIntegrityStatus} from './pdf-viewer';
import PaneResizer from './pane-resizer';
import {clampPaneSize} from './pane-size';
import ThesisContents from './thesis-contents';
import ProfileSections from './profile-sections';
import EducationWordmark from './education-wordmark';
import CitationPanel from './citation-panel';
import {citationDatasetMatches,citationTargets,resolveCitationSelection,citationSelectionHighlights,referencePdf,verifiedReferenceUrl,type CitationData,type CitationSource,type CitationEntry,type CitationReference} from './citation-model';
import rawCitationData from './citation-data.json';
import referenceSources from './reference-sources.json';
import referenceSourceHistory from './reference-source-history.json';
import './review-mobile.css';
import './master-theme.css';

type Obj = Record<string,any>;
type Tab = 'source'|'citations'|'memos'|'library'|'profile';
const citationData=rawCitationData as CitationData;
const INITIAL_THESIS_PAGE=4;
const INITIAL_CITATION_ID=citationData.citations.find(citation=>citation.page===INITIAL_THESIS_PAGE)?.id||'';
type Memo = {id:string;anchorType:string;page:number|null;noteId:string|null;sourceId:string|null;x:number|null;y:number|null;text:string;quote:string;visibility:string;status:string;revision:number;displayName:string;createdAt:string;editable:boolean};
const TITLE='노인학습자의 문화예술교육 참여경험에 관한 사례연구';
const SUBTITLE='시니어 발레단의 가능한 자기 인식을 중심으로';
const menus:[Tab,string,string][]=[['citations','↔','원전 대조'],['source','▣','발표자료'],['memos','▧','검토 메모'],['library','≡','자료 목록'],['profile','○','연구 안내']];
const documents=[
  {id:'thesis',title:'석사논문 중간발표 원고',format:'PDF',pages:44,description:TITLE,filename:'신현하_석사논문_중간발표.pdf'},
  {id:'s-presentation',title:'중간발표 자료',format:'PDF',pages:14,description:'논문과 나란히 보며 검토할 수 있는 발표자료',filename:'신현하_석사논문_발표자료.pdf'},
  {id:'s-presentation-pptx',title:'중간발표 슬라이드',format:'PPTX',pages:14,description:'제공된 PowerPoint 원본 파일',filename:'신현하_석사논문_발표자료.pptx'},
];
function Pager({page,total,onChange,label='PDF 쪽수'}:{page:number;total:number;onChange:(n:number)=>void;label?:string}){
  function go(value:string){onChange(Math.min(total,Math.max(1,Number(value)||1)));}
  return <div className="pager"><button aria-label="이전 쪽" disabled={page<=1} onClick={()=>onChange(page-1)}>‹</button><input aria-label={label} type="number" min={1} max={total} key={page} defaultValue={page} onKeyDown={e=>{if(e.key==='Enter')go(e.currentTarget.value);}} onBlur={e=>go(e.currentTarget.value)}/><span>/ {total}</span><button aria-label="다음 쪽" disabled={page>=total} onClick={()=>onChange(page+1)}>›</button></div>;
}
function memoLocation(m:Obj){
  const label=m.anchorType==='source'?(m.sourceId==='s-presentation'?'발표자료':'참고자료'):m.anchorType==='general'?'전체 의견':'논문';
  return label+(m.page?` · PDF ${m.page}쪽`:'');
}

export default function ReviewWorkspace(){
  const [reviewer,setReviewer]=useState({name:'방문자',mode:'guest' as 'guest'|'account'});
  const [sessionReady,setSessionReady]=useState(false),[sessionConnecting,setSessionConnecting]=useState(false);
  const [data,setData]=useState<Obj|null>(null),[error,setError]=useState(''),[loadError,setLoadError]=useState('');
  const [memos,setMemos]=useState<Memo[]>([]),[memoError,setMemoError]=useState('');
  const [page,setPage]=useState(INITIAL_THESIS_PAGE),[zoom,setZoom]=useState(1),[sourcePage,setSourcePage]=useState(1),[sourceZoom,setSourceZoom]=useState(1);
  const [sourceId,setSourceId]=useState('s-presentation'),[tab,setTab]=useState<Tab>('citations');
  const [activeCitationId,setActiveCitationId]=useState(INITIAL_CITATION_ID),[integrityStatus,setIntegrityStatus]=useState<PdfIntegrityStatus>('checking');
  const [bibliographySelection,setBibliographySelection]=useState<CitationEntry|null>(null);
  const [split,setSplit]=useState(53),[sidebarWidth,setSidebarWidth]=useState(208),[outline,setOutline]=useState(true);
  const [sidebarOpen,setSidebarOpen]=useState(()=>window.innerWidth>1150),[mobilePane,setMobilePane]=useState<'thesis'|'reference'>('thesis');
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all');
  const [libraryView,setLibraryView]=useState<'references'|'citations'>('references');
  const [placing,setPlacing]=useState<false|'thesis'|'source'>(false),[composer,setComposer]=useState<Obj|null>(null);
  const [composerError,setComposerError]=useState(''),[saving,setSaving]=useState(false),[exporting,setExporting]=useState(false),[downloading,setDownloading]=useState('');
  const splitRef=useRef<HTMLDivElement>(null);
  const citationSources=useMemo(()=>[...(referenceSources as CitationSource[]),...(referenceSourceHistory as CitationSource[]),...(data?.sources||[])],[data]);
  const source:Obj|undefined=citationSources.find(s=>s.id===sourceId);
  const sourceReference=citationData.references.find(reference=>reference.id===source?.referenceId||reference.sourceId===sourceId);
  const presentation=sourceId==='s-presentation',sourceTotal=source?.pages||(presentation?14:1),sourceTitle=presentation?'중간발표 자료':source?.title||'참고자료';
  const originalSourcePage=source?.pageMap?.find((mapping:{page:number;originalPage:number})=>mapping.page===sourcePage)?.originalPage;
  const activeMenu=tab==='source'&&!presentation?'citations':tab;
  const datasetMatches=citationDatasetMatches(citationData.meta,data?.meta.pdfSha256,data?.meta.pageCount);
  const citationReady=datasetMatches&&integrityStatus==='verified';
  const targets=useMemo(()=>citationTargets(citationData.citations,citationReady,citationData.meta.pageCount),[citationReady]);
  const activeCitation=bibliographySelection||resolveCitationSelection(activeCitationId,citationData.citations);
  const activeCitationHighlights=citationReady&&tab==='citations'&&activeCitation?citationSelectionHighlights(activeCitation):[];
  const citationsOnPage=citationData.citations.filter(citation=>citation.page===page);

  const refreshMemos=()=>api('/api/notes').then(d=>{setMemos(d.notes);setMemoError(d.truncated?'메모가 5,000개를 넘어 일부만 표시됩니다. 전체 내보내기를 이용해 주세요.':'');}).catch(e=>setMemoError('메모를 불러오지 못했습니다. 문서는 계속 열람할 수 있습니다. '+e.message));
  async function connectSession(){
    setSessionReady(false);setSessionConnecting(true);setMemoError('');
    try{const d=await initializeReviewSession();setReviewer({name:d.user?.displayName||'방문자',mode:d.user?.mode==='account'?'account':'guest'});setSessionReady(true);await refreshMemos();}
    catch{await refreshMemos();setMemoError('개인 메모 연결을 준비하지 못했습니다. 문서와 공유 메모는 계속 열람할 수 있습니다. 다시 연결한 뒤 저장해 주세요.');}
    finally{setSessionConnecting(false);}
  }
  async function downloadNotes(format:'md'|'csv'|'json'){
    setExporting(true);try{await exportNotes(format);}catch(e:any){setError(e?.message||'메모를 내보내지 못했습니다. 다시 시도해 주세요.');}finally{setExporting(false);}
  }
  async function downloadDocument(id:string){
    const doc=documents.find(d=>d.id===id)||citationSources.filter(s=>s.id===id).map(s=>({filename:(s.title||id).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,120)+'.pdf'}))[0];if(!doc||downloading)return;setDownloading(id);
    try{const response=await fetch(assetUrl(id));if(!response.ok)throw new Error();const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=doc.filename;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch{setError('파일을 다운로드하지 못했습니다. 자료목록의 원문 열기를 이용하거나 잠시 후 다시 시도해 주세요.');}finally{setDownloading('');}
  }
  useEffect(()=>{
    api('/api/manifest').then(setData).catch(e=>setLoadError(e?.message||'발표 자료를 불러오지 못했습니다.'));void connectSession();
    try{const saved=Number(localStorage.getItem('master-split'));if(saved>=30&&saved<=72)setSplit(saved);const width=localStorage.getItem('master-sidebar-width');if(width!==null)setSidebarWidth(clampPaneSize(Number(width),176,440));}catch{}
  },[]);
  useEffect(()=>{try{localStorage.setItem('master-split',String(split));}catch{}},[split]);
  useEffect(()=>{try{localStorage.setItem('master-sidebar-width',String(sidebarWidth));}catch{}},[sidebarWidth]);
  useEffect(()=>{
    const narrow=window.matchMedia('(max-width: 1150px)');
    const closeWhenNarrowing=(event:MediaQueryListEvent)=>{if(event.matches)setSidebarOpen(false);};
    narrow.addEventListener('change',closeWhenNarrowing);
    return()=>narrow.removeEventListener('change',closeWhenNarrowing);
  },[]);
  useEffect(()=>{const viewport=window.visualViewport;const update=()=>{document.documentElement.style.setProperty('--visible-height',(viewport?.height||window.innerHeight)+'px');document.documentElement.style.setProperty('--visible-top',(viewport?.offsetTop||0)+'px');};update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};},[]);
  useEffect(()=>{
    if(!composer)return;const old=document.activeElement as HTMLElement;
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(!saving)setComposer(null);return;}if(e.key!=='Tab')return;const items=Array.from(document.querySelectorAll<HTMLElement>('.memo-modal button:not(:disabled),.memo-modal textarea:not(:disabled),.memo-modal input:not(:disabled),.memo-modal a'));const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};
    document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);old?.focus();};
  },[!!composer,saving]);
  function goToThesis(targetPage:number){setPage(targetPage);setMobilePane('thesis');setPlacing(false);if(window.innerWidth<=1150)setSidebarOpen(false);}
  function openTab(next:Tab){setTab(next);setMobilePane('reference');setQuery('');setPlacing(false);if(next==='source'){if(sourceId!=='s-presentation'){setSourcePage(1);setSourceZoom(1);}setSourceId('s-presentation');}if(next==='citations'&&!activeCitation)setActiveCitationId(citationsOnPage[0]?.id||INITIAL_CITATION_ID);if(window.innerWidth<=1150)setSidebarOpen(false);}
  function openCitation(id:string){if(!citationReady||!resolveCitationSelection(id,citationData.citations))return;setBibliographySelection(null);setActiveCitationId(id);setTab('citations');setMobilePane('reference');setPlacing(false);if(window.innerWidth<=1150)setSidebarOpen(false);}
  function openReference(reference:CitationReference){setBibliographySelection({id:'reference-'+reference.id,page:reference.bibliographyPage,text:reference.fullEntry,rects:reference.bibliographyRects||[],referenceIds:[reference.id],matchStatus:'matched',selectionKind:'bibliography'});setActiveCitationId('');setTab('citations');setMobilePane('reference');setPlacing(false);if(window.innerWidth<=1150)setSidebarOpen(false);}
  function newMemo(anchorType:string,extra:Obj={}){setComposerError('');setComposer({anchorType,page:anchorType==='general'?null:anchorType==='source'?sourcePage:page,noteId:null,sourceId:anchorType==='source'?sourceId:null,text:'',quote:window.getSelection()?.toString().slice(0,4000)||'',visibility:'private',status:'open',...extra});setPlacing(false);}
  async function saveMemo(){
    if(saving||!composer?.text?.trim())return;if(!sessionReady){setComposerError('메모 저장 전에 이용 정보를 연결해 주세요.');return;}setSaving(true);setComposerError('');
    try{const {id,revision,anchorType,page,noteId,sourceId,x,y,quote,text,visibility,status}=composer;await api(id?'/api/notes/'+id:'/api/notes',{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(id?{revision,text,quote,visibility,status}:{anchorType,page,noteId,sourceId,x,y,quote,text,visibility,status})});setComposer(null);await refreshMemos();}
    catch(e:any){setComposerError(e?.message||'메모를 저장하지 못했습니다. 입력 내용은 유지됩니다.');}finally{setSaving(false);}
  }
  async function removeMemo(m:Obj){if(saving||!window.confirm('이 메모를 삭제할까요?'))return;setSaving(true);setComposerError('');try{await api('/api/notes/'+m.id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:m.revision})});setComposer(null);await refreshMemos();}catch(e:any){setComposerError(e?.message||'메모를 삭제하지 못했습니다.');}finally{setSaving(false);}}
  function selectMemo(m:Memo){setComposerError('');setPlacing(false);if(m.anchorType==='source'&&m.sourceId){const targetSource=citationSources.find(s=>s.id===m.sourceId);setTab('source');setSourceId(m.sourceId);setSourcePage(Math.min(targetSource?.pages||10000,Math.max(1,m.page||1)));setSourceZoom(1);setMobilePane('reference');}else if(m.page){setPage(m.page);setMobilePane('thesis');}setComposer({...m});}
  const filteredMemos=memos.filter(m=>(filter==='all'||m.status===filter)&&(!query||[m.text,m.quote,m.displayName].join(' ').toLowerCase().includes(query.toLowerCase())));
  const filteredDocuments=documents.filter(d=>!query||[d.title,d.format,d.description].join(' ').toLowerCase().includes(query.toLowerCase()));
  const filteredReferences=citationData.references.filter(reference=>!query||reference.fullEntry.toLowerCase().includes(query.toLowerCase()));
  const filteredCitations=citationData.citations.filter(citation=>!query||[citation.text,citation.sentenceText,`PDF ${citation.page} 인쇄 ${citation.page-3}`, ...citationData.references.filter(reference=>citation.referenceIds.includes(reference.id)).map(reference=>reference.fullEntry)].join(' ').toLowerCase().includes(query.trim().toLowerCase()));

  return <div className={'review-app mobile-show-'+mobilePane}>
    <header className="app-header"><button className="sidebar-toggle" aria-label={sidebarOpen?'탐색 메뉴 닫기':'탐색 메뉴 열기'} aria-expanded={sidebarOpen} aria-controls="workspace-navigation" onClick={()=>setSidebarOpen(!sidebarOpen)}>☰</button><EducationWordmark/><div className="brand"><b>신현하</b><span>평생교육전공</span></div><div className="header-title"><span>석사논문 중간발표</span><h1>{TITLE}</h1><p>{SUBTITLE}</p></div><span className="access-badge">논문·발표 검토</span></header>
    <div className="basis-bar"><span><b>석사논문 중간발표</b><time dateTime="2026-10-24">2026. 10. 24.</time><i/>신현하 · 고려대학교 교육대학원 · 평생교육전공</span><span className="basis-context">논문 44쪽 <i/> 발표자료 14쪽</span></div>
    {error&&<div className="app-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="오류 안내 닫기">×</button></div>}
    {!data?<div className="loading-screen"><EducationWordmark/><h2>{loadError?'발표 자료를 불러오지 못했습니다.':'발표 자료를 준비하고 있습니다.'}</h2>{loadError&&<><p>{loadError}</p><button onClick={()=>location.reload()}>다시 불러오기</button></>}</div>:<div className={'review-body'+(sidebarOpen?' sidebar-open':' sidebar-collapsed')} style={{'--sidebar-width':sidebarWidth+'px'} as React.CSSProperties}>
      {sidebarOpen&&<button className="sidebar-backdrop" aria-label="탐색 메뉴 닫기" onClick={()=>setSidebarOpen(false)}/>}
      <aside className="workspace-sidebar" id="workspace-navigation" aria-label="논문 탐색"><div className="sidebar-heading"><b>석사논문 검토실</b><button aria-label="탐색 메뉴 접기" onClick={()=>setSidebarOpen(false)}>‹</button></div><nav className="sidebar-menu" aria-label="검토 메뉴">{menus.map(([id,icon,label])=><button key={id} className={activeMenu===id?'active':''} aria-current={activeMenu===id?'page':undefined} onClick={()=>openTab(id)}><span aria-hidden="true">{icon}</span>{label}{id==='memos'&&<small>{memos.length}</small>}</button>)}</nav><button className="sidebar-outline-toggle" aria-expanded={outline} onClick={()=>setOutline(!outline)}>논문 목차 <span aria-hidden="true">{outline?'−':'＋'}</span></button>{outline&&<ThesisContents page={page} pdfSha256={data.meta.pdfSha256} onNavigate={goToThesis}/>}</aside>
      {sidebarOpen&&<PaneResizer className="sidebar-divider" label="목차 화면 너비 조절" value={sidebarWidth} min={176} max={440} step={16} unit="픽셀" onChange={setSidebarWidth}/>}
      <div className="split-workspace" ref={splitRef} style={{'--split':split+'%'} as React.CSSProperties}>
        <section className="thesis-pane" aria-label="논문 원고"><div className="pane-toolbar"><button className={sidebarOpen&&outline?'selected':''} onClick={()=>{setSidebarOpen(true);setOutline(true);}} title="논문 목차 열기">☰ <span>목차</span></button><Pager page={page} total={data.meta.pageCount} onChange={setPage} label="논문 PDF 쪽수"/><div className="toolbar-spacer"/><button onClick={()=>setZoom(Math.max(.7,zoom-.15))} aria-label="논문 축소">−</button><button onClick={()=>setZoom(1)} title="논문 너비에 맞추기">{Math.round(zoom*100)}%</button><button onClick={()=>setZoom(Math.min(2,zoom+.15))} aria-label="논문 확대">＋</button><button className={placing==='thesis'?'selected':'memo-tool'} onClick={()=>setPlacing(placing==='thesis'?false:'thesis')}>▧ 메모</button></div>
          {placing==='thesis'&&<div className="placement-hint">논문에서 메모를 붙일 위치를 눌러 주세요.<button onClick={()=>setPlacing(false)}>취소</button></div>}
          <PdfPane id="thesis" page={page} total={data.meta.pageCount} pageSizes={data.pages} onPageChange={setPage} zoom={zoom} targets={targets} highlights={activeCitationHighlights} onTarget={openCitation} expectedSha256={citationData.meta.pdfSha256} onIntegrityStatus={setIntegrityStatus} pins={memos.filter(m=>m.anchorType==='thesis')} onPin={selectMemo} placing={placing==='thesis'} onPlace={(x,y,placedPage)=>newMemo('thesis',{x,y,page:placedPage})} label="석사논문 중간발표 원고"/>
          {!citationReady&&<div className="citation-integrity-note" role="status">{!datasetMatches||integrityStatus==='mismatch'?'현재 논문이 인용 연결 기준본과 달라 인용 링크를 표시하지 않습니다.':integrityStatus==='unavailable'?'논문 기준본을 확인하지 못해 인용 링크를 표시하지 않습니다.':'인용 연결을 위해 논문 기준본을 확인하고 있습니다.'}</div>}
          <div className="page-footnotes citation-page-links" aria-label="이 쪽의 본문 인용"><span>{citationReady?'이 쪽의 인용':'논문 원고'}</span>{citationReady&&citationsOnPage.map(citation=><button key={citation.id} className={tab==='citations'&&activeCitationId===citation.id?'selected':''} title={citation.text} onClick={()=>openCitation(citation.id)}>{citation.text}</button>)}{citationReady&&!citationsOnPage.length&&<span>연결된 본문 인용 없음</span>}<div className="toolbar-spacer"/><span className="document-page-label">PDF {page}쪽{page>=4&&page<=44?` · 인쇄 ${page-3}쪽`:''}</span><a href={assetUrl('thesis')} target="_blank" rel="noreferrer" aria-label="논문 PDF 새 창에서 열기">원문 열기 ↗</a></div>
        </section>
        <PaneResizer className="split-divider" label="논문과 참고자료 화면 너비 조절" value={split} min={30} max={72} onChange={setSplit} unitsPerPixel={()=>100/(splitRef.current?.getBoundingClientRect().width||1)}/>
        <section className="reference-pane" aria-label="원전·발표자료와 검토 도구"><div className="reference-heading"><span>{tab==='source'?(presentation?'발표자료':'원전 대조'):tab==='citations'?'원전 대조':menus.find(m=>m[0]===tab)?.[2]}</span><button className="panel-navigation" onClick={()=>setSidebarOpen(true)} aria-label="다른 검토 메뉴 열기">☰</button></div>
          {tab==='citations'&&activeCitation&&(citationReady?<CitationPanel key={activeCitation.id} citation={activeCitation} references={citationData.references} sources={citationSources} thesisPageCount={data.meta.pageCount} thesisPages={data.pages} onBack={()=>openTab('source')} onThesis={goToThesis} onMemo={citation=>newMemo('thesis',{page:citation.page,quote:citation.text})} onCitationNavigate={(id,targetPage)=>{openCitation(id);goToThesis(targetPage);}} sourceMemos={memos} onSourceMemo={(id,targetPage,position)=>newMemo('source',{sourceId:id,page:targetPage,...position})} onSourceMemoSelect={selectMemo}/>:<div className="empty-state" role="status">{integrityStatus==='checking'?'인용 원문을 준비하고 있습니다.':'현재 논문과 인용 연결 기준본이 일치하는지 확인할 수 없습니다.'}<button onClick={()=>openTab('source')}>발표자료 보기</button></div>)}
          {tab==='source'&&<div className="source-panel presentation-panel">
            <div className="presentation-caption"><div><span className="section-eyebrow">{presentation?'PRESENTATION · 2026.10.24':'REFERENCE'}</span><h2>{sourceTitle}</h2></div><button onClick={()=>void downloadDocument(presentation?'s-presentation-pptx':sourceId)} disabled={!!downloading} className="download-link">{downloading?'다운로드 중…':presentation?'PPTX ↓':'PDF ↓'}</button></div>
            {!presentation&&<div className="reference-memo-context"><button onClick={()=>sourceReference?openReference(sourceReference):openTab('citations')}>{sourceReference?'이 원전의 참고문헌 보기':'원전 대조로 돌아가기'}</button><span>{source?.coverageLabel||'참고문헌 원전'}</span></div>}
            <div className="pane-toolbar source-toolbar"><Pager page={sourcePage} total={sourceTotal} onChange={setSourcePage} label={presentation?'발표자료 PDF 쪽수':'원전 PDF 쪽수'}/><div className="toolbar-spacer"/><button aria-label={presentation?'발표자료 축소':'원전 축소'} onClick={()=>setSourceZoom(Math.max(.7,sourceZoom-.15))}>−</button><button title={presentation?'발표자료 너비에 맞추기':'원전 너비에 맞추기'} onClick={()=>setSourceZoom(1)}>{Math.round(sourceZoom*100)}%</button><button aria-label={presentation?'발표자료 확대':'원전 확대'} onClick={()=>setSourceZoom(Math.min(2,sourceZoom+.15))}>＋</button><button className={placing==='source'?'selected':'memo-tool'} onClick={()=>setPlacing(placing==='source'?false:'source')}>▧ {presentation?'메모':'원전 메모'}</button></div>
            {placing==='source'&&<div className="placement-hint">{presentation?'발표자료':'원전'}에서 메모를 붙일 위치를 눌러 주세요.<button onClick={()=>setPlacing(false)}>취소</button></div>}
            <PdfPane id={sourceId} page={sourcePage} total={sourceTotal} pageSizes={source?.pageSizes} zoom={sourceZoom} onPageChange={setSourcePage} pins={memos.filter(m=>m.anchorType==='source'&&m.sourceId===sourceId)} onPin={selectMemo} placing={placing==='source'} onPlace={(x,y,placedPage)=>newMemo('source',{x,y,page:placedPage})} label={sourceTitle}/>
            <div className="page-footnotes"><span>{presentation?'발표자료':'참고자료'}</span><span className="document-page-label">{originalSourcePage?`발췌 ${sourcePage}쪽 · 원본 PDF ${originalSourcePage}쪽`:`PDF ${sourcePage}쪽`}</span><div className="toolbar-spacer"/><a href={assetUrl(sourceId)} target="_blank" rel="noreferrer" aria-label={presentation?'발표자료 PDF 새 창에서 열기':'원전 PDF 새 창에서 열기'}>원문 열기 ↗</a></div>
          </div>}
          {tab==='library'&&<div className="scroll-panel library-panel">
            <div className="panel-heading"><span className="section-eyebrow">RESEARCH MATERIALS</span><h2>자료 목록</h2><p>논문·발표자료, 참고문헌 {citationData.references.length}개와 본문 인용 {citationData.citations.length}곳을 찾아봅니다.</p></div>
            <div className="library-view-tabs" aria-label="자료 목록 종류"><button className={libraryView==='references'?'selected':''} aria-pressed={libraryView==='references'} onClick={()=>setLibraryView('references')}>문서·참고문헌</button><button className={libraryView==='citations'?'selected':''} aria-pressed={libraryView==='citations'} onClick={()=>setLibraryView('citations')}>본문 인용 위치</button></div>
            <input type="search" className="search-input" aria-label="자료 검색" placeholder={libraryView==='citations'?'인용 구절·본문 문장·저자·자료명 검색':'자료명·저자·연도 또는 파일 형식 검색'} value={query} onChange={e=>setQuery(e.target.value)}/>
            {libraryView==='references'?<>
              <div className="document-library">{filteredDocuments.map(doc=><article className="document-card" key={doc.id}><div className="document-card-top"><span className="file-format">{doc.format}</span><span>{doc.pages}쪽</span></div><h3>{doc.title}</h3><p>{doc.description}</p><div className="document-card-actions">{doc.format==='PDF'&&<button onClick={()=>{if(doc.id==='thesis')goToThesis(INITIAL_THESIS_PAGE);else{setSourcePage(1);openTab('source');}}}>화면에서 보기</button>}<a href={assetUrl(doc.id)} target="_blank" rel="noreferrer">원문 열기 ↗</a><button disabled={!!downloading} onClick={()=>void downloadDocument(doc.id)}>{downloading===doc.id?'다운로드 중…':'다운로드 ↓'}</button></div></article>)}</div>
              <section className="reference-library" aria-label="참고문헌 자료 목록"><h3>참고문헌 <small>{filteredReferences.length} / {citationData.references.length}</small></h3><div className="document-library">{filteredReferences.map(reference=>{const linkedPdf=referencePdf(reference,citationSources),linkedWeb=verifiedReferenceUrl(reference);return <article className="document-card" key={reference.id}><div className="document-card-top"><span className="file-format">{linkedPdf?'PDF':linkedWeb?'WEB':'참고문헌'}</span>{linkedPdf&&<span>{linkedPdf.source.coverageLabel||`PDF ${linkedPdf.source.pages}쪽`}</span>}</div><h3>{reference.title}</h3><p>{reference.fullEntry}</p><div className="document-card-actions"><button onClick={()=>openReference(reference)}>원전 대조</button><button onClick={()=>goToThesis(reference.bibliographyPage)}>논문 참고문헌 보기</button></div></article>;})}</div></section>
              {!filteredDocuments.length&&!filteredReferences.length&&<p className="empty-state">검색한 자료가 없습니다.</p>}
            </>:<section className="citation-library" aria-label="본문 인용 위치 목록"><h3>본문 인용 <small>{filteredCitations.length} / {citationData.citations.length}</small></h3>{filteredCitations.map(citation=><button className="library-row" key={citation.id} disabled={!citationReady} onClick={()=>{openCitation(citation.id);goToThesis(citation.page);}} title={citation.sentenceText||citation.text}><span className="index-number">{citation.page-3}쪽</span><span><b>{citation.text}</b><span className="citation-library-context">{citation.sentenceText||citation.text}</span><small>논문 PDF {citation.page}쪽 · 연결 문헌 {citation.referenceIds.length}개{citation.relation==='secondary'?' · 재인용':''}</small></span><span aria-hidden="true">↗</span></button>)}{!filteredCitations.length&&<p className="empty-state">검색한 본문 인용이 없습니다.</p>}</section>}
          </div>}
          {tab==='memos'&&<div className="scroll-panel"><div className="panel-heading"><span className="section-eyebrow">REVIEW NOTES</span><h2>검토 메모</h2><p>논문·원전·발표자료의 쪽에 의견을 남기고 검토 상태를 관리합니다.</p></div><div className="memo-identity-note"><b>{reviewer.name}</b><p>개인 메모는 이 브라우저의 이용 정보에 연결됩니다. 브라우저 데이터를 지우기 전에 내보내기로 보관해 주세요.</p></div>{memoError&&<div className="memo-error" role="status">{memoError}<button onClick={connectSession} disabled={sessionConnecting}>{sessionConnecting?'연결 중…':'다시 연결'}</button></div>}<div className="memo-actions"><button className="primary" onClick={()=>newMemo('general')}>＋ 새 메모</button><button disabled={exporting} onClick={()=>void downloadNotes('md')}>Markdown ↓</button><button disabled={exporting} onClick={()=>void downloadNotes('csv')}>CSV ↓</button><button disabled={exporting} onClick={()=>void downloadNotes('json')}>JSON ↓</button><button onClick={connectSession} disabled={sessionConnecting} aria-label="메모 다시 연결">↻</button></div><input type="search" className="search-input" aria-label="메모 검색" placeholder="메모 내용·선택 구절·작성자 검색" value={query} onChange={e=>setQuery(e.target.value)}/><div className="filter-buttons" aria-label="메모 상태 필터">{[['all','전체'],['open','미해결'],['resolved','해결']].map(([id,label])=><button key={id} className={filter===id?'selected':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>{filteredMemos.map(m=><button key={m.id} className={'memo-card '+m.status} onClick={()=>selectMemo(m)}><div className="section-eyebrow"><span>{memoLocation(m)}</span><span>{m.visibility==='private'?'나만 보기':'링크 방문자 공유'}</span></div>{m.quote&&<blockquote>{m.quote}</blockquote>}<p>{m.text}</p><small>{m.displayName} · {m.status==='resolved'?'해결':'미해결'}{m.editable?' · 수정 가능':''}</small></button>)}{!filteredMemos.length&&<div className="empty-state"><span>▧</span><h3>{query||filter!=='all'?'조건에 맞는 메모가 없습니다.':'첫 검토 의견을 남겨 주세요.'}</h3><p>문서의 ‘메모’ 버튼으로 특정 쪽에 의견을 붙일 수 있습니다.</p></div>}</div>}
          {tab==='profile'&&<div className="scroll-panel profile-panel"><span className="section-eyebrow">RESEARCH OVERVIEW</span><div className="research-author"><div className="author-initial" aria-hidden="true">신</div><div><h2>신현하</h2><p>고려대학교 교육대학원 · 평생교육전공</p></div></div><ProfileSections/></div>}
        </section>
      </div>
    </div>}
    {data&&<nav className="mobile-navigation" aria-label="문서 전환"><button onClick={()=>{setSidebarOpen(true);setOutline(true);}} aria-expanded={sidebarOpen}><span aria-hidden="true">☰</span>목차</button><button className={mobilePane==='thesis'?'active':''} aria-current={mobilePane==='thesis'?'page':undefined} onClick={()=>{setMobilePane('thesis');setPlacing(false);}}><span aria-hidden="true">▤</span>논문</button><button className={mobilePane==='reference'&&activeMenu==='citations'?'active':''} aria-current={mobilePane==='reference'&&activeMenu==='citations'?'page':undefined} onClick={()=>openTab('citations')}><span aria-hidden="true">↔</span>원전</button><button className={mobilePane==='reference'&&tab==='source'&&presentation?'active':''} aria-current={mobilePane==='reference'&&tab==='source'&&presentation?'page':undefined} onClick={()=>openTab('source')}><span aria-hidden="true">▣</span>발표자료</button><button className={mobilePane==='reference'&&tab==='memos'?'active':''} aria-current={mobilePane==='reference'&&tab==='memos'?'page':undefined} onClick={()=>openTab('memos')}><span aria-hidden="true">▧</span>메모</button></nav>}
    {composer&&<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!saving)setComposer(null);}}><section className="memo-modal" role="dialog" aria-modal="true" aria-labelledby="memo-title"><div className="modal-heading"><h2 id="memo-title">{composer.id?'검토메모':'메모 붙이기'}</h2><button disabled={saving} onClick={()=>setComposer(null)} aria-label="닫기">×</button></div><p className="small-note">{memoLocation(composer)}</p>{composer.quote&&<blockquote>{composer.quote}</blockquote>}{!sessionReady&&<div className="memo-error" role="status">{sessionConnecting?'메모 저장을 준비하고 있습니다.':'메모 저장 전에 이용 정보를 연결해 주세요.'}{!sessionConnecting&&<button onClick={connectSession}>다시 연결</button>}</div>}{composerError&&<div className="memo-error" role="alert">{composerError}</div>}<textarea disabled={saving} aria-label="검토메모 내용" autoFocus maxLength={10000} rows={8} placeholder="수정 제안, 확인할 근거, 발표에 대한 의견을 적어 주세요." value={composer.text} readOnly={composer.id&&!composer.editable} onChange={e=>setComposer({...composer,text:e.target.value})}/><div className="memo-options"><label><input type="checkbox" checked={composer.visibility==='shared'} disabled={saving||(composer.id&&!composer.editable)} onChange={e=>setComposer({...composer,visibility:e.target.checked?'shared':'private'})}/> 링크 방문자에게 공유</label><label><input type="checkbox" checked={composer.status==='resolved'} disabled={saving||(composer.id&&!composer.editable)} onChange={e=>setComposer({...composer,status:e.target.checked?'resolved':'open'})}/> 해결됨</label></div><p className="small-note">공유 메모는 링크를 연 누구나 볼 수 있습니다. 개인 메모는 이 브라우저에 연결됩니다. 사이트 저장 데이터를 삭제하면 다시 접근할 수 없습니다.</p><div className="modal-actions">{composer.id&&composer.editable&&<button disabled={saving} className="danger" onClick={()=>void removeMemo(composer)}>삭제</button>}<div className="toolbar-spacer"/><button disabled={saving} onClick={()=>setComposer(null)}>닫기</button>{(!composer.id||composer.editable)&&<button className="primary" disabled={!sessionReady||saving||!composer.text.trim()} onClick={()=>void saveMemo()}>{!sessionReady?(sessionConnecting?'준비 중…':'연결 필요'):saving?'저장 중…':'메모 저장'}</button>}</div></section></div>}
  </div>;
}
