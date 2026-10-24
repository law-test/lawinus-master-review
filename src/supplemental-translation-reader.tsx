import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import PdfPane from './pdf-viewer';
import PdfZoomControl from './pdf-zoom-control';
import {usePdfScale} from './pdf-scale';
import HeightResizer,{useStoredHeight} from './height-resizer';
import {loadTranslationCatalog} from './full-reference-translation';
import {fullTranslationDocument,type FullTranslationDocument} from './full-reference-translation-model';
import {supplementalTranslations,type SupplementalTranslation} from './supplemental-translation-model';
import type {ReferenceReadingMode} from './reference-translation-model';
import './supplemental-translation-reader.css';

export default function SupplementalTranslationButton({referenceId,title}:{referenceId:string;title:string}){
 const [entries,setEntries]=useState<SupplementalTranslation[]>([]),[open,setOpen]=useState(false);
 const opener=useRef<HTMLButtonElement>(null);
 useEffect(()=>{let active=true;setEntries([]);setOpen(false);void loadTranslationCatalog().then(value=>{if(active)setEntries(supplementalTranslations(value,referenceId));});return()=>{active=false;};},[referenceId]);
 if(!entries.length)return null;
 return <><button ref={opener} className="supplemental-translation-open" onClick={()=>setOpen(true)}>추가 확보 원문·전체 번역 ({entries.length})</button>{open&&createPortal(<SupplementalReader entries={entries} title={title} onClose={()=>{setOpen(false);requestAnimationFrame(()=>opener.current?.focus());}}/>,document.body)}</>;
}

function SupplementalReader({entries,title,onClose}:{entries:SupplementalTranslation[];title:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),split=useRef<HTMLDivElement>(null);
 const [selected,setSelected]=useState(entries[0].sourceId),[page,setPage]=useState(1),[navigation,setNavigation]=useState(0),[mode,setMode]=useState<ReferenceReadingMode>('parallel');
 const entry=entries.find(item=>item.sourceId===selected)||entries[0];
 const [loaded,setLoaded]=useState<FullTranslationDocument>(),[error,setError]=useState(false);
 const [top,setTop,resetTop]=useStoredHeight('master-supplement-bilingual-height',50,0,100);
 const {zoom,setZoom,fitMode,setFitMode,resolveZoom}=usePdfScale('supplement:'+entry.sourceSha256);
 const data=loaded?.sourceId===entry.sourceId?loaded:undefined,current=data?.pages.find(item=>item.page===page),pdf=entry.sourceType==='pdf';
 function navigate(value:number){setPage(Math.max(1,Math.min(entry.pageCount,Math.round(value)||1)));setNavigation(n=>n+1);}
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
 useEffect(()=>{let active=true;const controller=new AbortController();setLoaded(undefined);setError(false);setPage(1);setNavigation(n=>n+1);void(async()=>{try{const url=new URL(entry.asset,document.baseURI);if(entry.version)url.searchParams.set('v',entry.version);const response=await fetch(url,{signal:controller.signal,cache:'no-cache'});if(!response.ok)throw Error();const parsed=fullTranslationDocument(await response.json(),{id:entry.sourceId,sha256:entry.sourceSha256,pages:entry.pageCount});if(!parsed)throw Error();if(active)setLoaded(parsed);}catch{if(active)setError(true);}})();return()=>{active=false;controller.abort();};},[entry.sourceId,entry.version]);
 const sourceText=<section className="supplement-text" lang="en" aria-label="추가 확보 원문 텍스트" key={'source-'+page}><h3>{current?.unitLabel||entry.label}</h3><div>{current?.sourceText||'원문을 불러오고 있습니다.'}</div></section>;
 return <dialog ref={dialog} className="supplement-reader" aria-labelledby="supplement-reader-title" onCancel={event=>{event.preventDefault();onClose();}}>
  <header><div><strong id="supplement-reader-title">추가 확보 원문·전체 번역</strong><p>{title}</p></div><button onClick={onClose} aria-label="추가 원문·번역 닫기">닫기 ×</button></header>
  <div className="supplement-controls"><label>자료 <select aria-label="추가 확보 자료 선택" value={entry.sourceId} onChange={event=>setSelected(event.target.value)}>{entries.map(item=><option key={item.sourceId} value={item.sourceId}>{item.label}</option>)}</select></label>
   <div className="supplement-modes" role="group" aria-label="추가 문헌 표시 모드">{([['original','원문'],['translation','번역'],['parallel','병기']] as const).map(([id,label])=><button key={id} aria-pressed={mode===id} onClick={()=>setMode(id)}>{label}</button>)}</div>
   <div className="supplement-pager"><button aria-label="추가 자료 이전 구간" disabled={page<=1} onClick={()=>navigate(page-1)}>‹</button>{pdf?<label>PDF <input aria-label="추가 자료 PDF 쪽수" type="number" min={1} max={entry.pageCount} key={page} defaultValue={page} onBlur={event=>navigate(Number(event.target.value))} onKeyDown={event=>{if(event.key==='Enter')navigate(Number(event.currentTarget.value));}}/> / {entry.pageCount}</label>:<select aria-label="추가 자료 장·구간" value={page} onChange={event=>navigate(Number(event.target.value))}>{Array.from({length:entry.pageCount},(_,i)=><option value={i+1} key={i+1}>{data?.pages[i]?.unitLabel||`구간 ${i+1}`}</option>)}</select>}<button aria-label="추가 자료 다음 구간" disabled={page>=entry.pageCount} onClick={()=>navigate(page+1)}>›</button></div>
   {pdf&&mode!=='translation'&&<PdfZoomControl label="추가 원문" zoom={zoom} fitMode={fitMode} onZoomChange={setZoom} onFitModeChange={setFitMode}/>}
  </div>
  <p className="supplement-scope">{entry.coverageNote||'확보한 원문 범위의 기계번역입니다.'} {pdf?'원문 PDF와 같은 쪽끼리 표시합니다.':'이 자료는 PDF가 아니므로 원문의 장·구간에 맞춰 표시합니다.'} 번역은 원문과 대조해 주세요.</p>
  {error?<p role="alert" className="supplement-error">번역을 불러오지 못했습니다. 창을 닫고 다시 열어 주세요.</p>:<div ref={split} className={'supplement-split mode-'+mode}>
   <div className="supplement-original" style={{display:mode==='translation'||mode==='parallel'&&top===0?'none':undefined,flex:mode==='parallel'?`0 0 calc((100% - var(--supplement-divider-size,8px)) * ${top/100})`:'1 1 0'}}>
    {pdf?<PdfPane id={entry.sourceId} documentUrl={new URL(entry.originalAsset!,document.baseURI).href} page={page} total={entry.pageCount} pageSizes={entry.pageSizes} zoom={zoom} fitMode={fitMode} onFitModeChange={setFitMode} onZoomChange={setZoom} onResolvedZoom={resolveZoom} onPageChange={setPage} persistenceKey={'supplement:'+entry.sourceSha256} navigationToken={navigation} onNavigationHandled={token=>setNavigation(n=>n===token?0:n)} expectedSha256={entry.sourceSha256} label={entry.label}/>:sourceText}
   </div>
   {mode==='parallel'&&<HeightResizer label="추가 원문과 번역 높이 조절" value={top} min={0} max={100} unit="%" step={3} onChange={setTop} onReset={resetTop} unitsPerPixel={()=>100/Math.max(1,(split.current?.clientHeight||1)-(window.innerWidth<1200?10:8))}/>}
   {mode!=='original'&&<section className="supplement-text supplement-korean" lang="ko" aria-label="추가 확보 문헌 전체 번역" key={'translation-'+page} style={{display:mode==='parallel'&&top===100?'none':undefined}}><h3>한국어 번역 · {pdf?`PDF ${page}쪽`:current?.unitLabel||`구간 ${page}`}</h3>{!data?<p role="status">전체 번역을 불러오고 있습니다.</p>:current?.status==='translated'?<div>{current.translationText}</div>:<p>{current?.scopeNote||'이 지면에는 번역할 본문이 없습니다. 원문을 확인해 주세요.'}</p>}</section>}
  </div>}
  <footer>열람용 기계번역 · NLLB-200 (Meta) · <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">CC BY-NC 4.0</a></footer>
 </dialog>;
}
