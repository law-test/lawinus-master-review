import React,{useRef} from 'react';
import HeightResizer,{useStoredHeight} from './height-resizer';
import type {ReferenceReadingMode,ReferenceTranslationExcerpt} from './reference-translation-model';
import {useFullReferenceTranslation} from './full-reference-translation';
import {fullTranslationPageAt,type FullTranslationSource} from './full-reference-translation-model';

export default function ReferenceBilingualReader({children,enabled,mode,excerpts,page,translatedPages,onPage,source}:{children:React.ReactNode;enabled:boolean;mode:ReferenceReadingMode;excerpts:ReferenceTranslationExcerpt[];page?:number;translatedPages:number[];onPage:(page:number)=>void;source?:FullTranslationSource}){
  const container=useRef<HTMLDivElement>(null);
  const [topHeight,setTopHeight,resetHeight]=useStoredHeight('master-reference-bilingual-height',62,0,100);
  const fullTranslation=useFullReferenceTranslation(source,enabled&&mode!=='original');
  const translatedPage=fullTranslationPageAt(fullTranslation.document,page);
  const fullPageCount=fullTranslation.document?.pages.filter(item=>item.status==='translated'||item.status==='blank').length||0;
  if(!enabled)return <>{children}</>;
  return <div ref={container} className={'foreign-document-stack mode-'+mode}>
    <div className="foreign-original" style={{display:mode==='translation'||mode==='parallel'&&topHeight===0?'none':undefined,flex:mode==='parallel'?`0 0 calc((100% - var(--height-divider-size,8px)) * ${topHeight/100})`:'1 1 0'}} aria-label="외국어 자료 원문">{children}</div>
    {mode==='parallel'&&<HeightResizer label="원문과 번역 높이 조절" value={topHeight} min={0} max={100} onChange={setTopHeight} unit="%" step={3} unitsPerPixel={()=>100/Math.max(1,(container.current?.getBoundingClientRect().height||1)-8)} onReset={resetHeight}/>}
    {mode!=='original'&&<section className="foreign-translation" style={{display:mode==='parallel'&&topHeight===100?'none':undefined}} aria-label="한국어 번역 읽기" key={page}>
      <div className="foreign-translation-heading"><b>한국어 번역</b><span>{fullTranslation.status==='ready'?'원문과 같은 쪽':'확인한 근거 구절'}{page?` · PDF ${page}쪽`:''}</span></div>
      {page&&source?.pages&&<div className="translation-page-navigation" aria-label="원문과 번역 쪽 이동"><button disabled={page<=1} onClick={()=>onPage(page-1)} aria-label="원문과 번역 이전 쪽">‹ 이전</button><label>PDF <input type="number" aria-label="원문과 번역 PDF 쪽수" key={page} min={1} max={source.pages} defaultValue={page} onKeyDown={event=>{if(event.key==='Enter'){const value=Number(event.currentTarget.value);onPage(Math.max(1,Math.min(source.pages!,Number.isFinite(value)?Math.round(value):1)));}}} onBlur={event=>{const value=Number(event.currentTarget.value);onPage(Math.max(1,Math.min(source.pages!,Number.isFinite(value)?Math.round(value):1)));}}/> / {source.pages}</label><button disabled={page>=source.pages} onClick={()=>onPage(page+1)} aria-label="원문과 번역 다음 쪽">다음 ›</button></div>}
      {fullTranslation.status==='loading'?<p className="translation-scope" role="status">이 문헌의 쪽별 번역을 불러오고 있습니다.</p>:fullTranslation.status==='ready'?<>
        <p className="translation-scope">쪽별 기계번역 · 원문 대조 필요 <span className="translation-coverage">{fullPageCount} / {source?.pages}쪽</span><br/><small>NLLB-200 (Meta) · <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">CC BY-NC 4.0</a></small></p>
        {fullTranslation.entry?.coverageNote&&<p className="translation-scope">{fullTranslation.entry.coverageNote}</p>}
        {translatedPage?.printed&&<small>인쇄 {translatedPage.printed}쪽</small>}
        {translatedPage?.status==='translated'?<div className="full-translation-page-text" lang="ko">{translatedPage.translationText}</div>:translatedPage?.status==='blank'?<p className="translation-empty">이 쪽에는 번역할 본문이 없습니다. 원문 지면을 확인해 주세요.</p>:<p className="translation-empty" role="status">{translatedPage?.scopeNote||'이 쪽은 원문 문자 인식 또는 번역 확인이 아직 끝나지 않았습니다. 원문 PDF에서 확인해 주세요.'}</p>}
        {translatedPage?.sourceText&&<details className="translation-source-text"><summary>이 쪽의 추출 원문</summary><div lang="en">{translatedPage.sourceText}</div></details>}
      </>:<>
        {fullTranslation.status==='error'&&<p className="translation-empty" role="status">이 문헌의 쪽별 번역을 불러오지 못했습니다. 새로고침하거나 원문을 확인해 주세요.</p>}
        {excerpts.length?<><p className="translation-scope">아래 구절의 열람용 번역입니다. 이 쪽 전체를 번역한 것은 아닙니다.</p>{excerpts.map(excerpt=><article key={excerpt.id}>{excerpt.printed&&<small>인쇄 {excerpt.printed}쪽</small>}{mode==='parallel'&&<blockquote lang="en">{excerpt.original}</blockquote>}<p lang="ko">{excerpt.korean}</p></article>)}</>:<p className="translation-empty">{source?'이 쪽에는 아직 확인된 번역이 없습니다. 원문을 보거나 번역이 있는 근거 쪽을 선택해 주세요.':'웹 자료의 전문 번역은 위의 추가 확보 원문·전체 번역 버튼에서 볼 수 있습니다. 버튼이 없는 자료는 확보된 전문 번역이 없습니다.'}</p>}
        {translatedPages.length>0&&<div className="translation-page-links"><span>번역이 있는 근거 쪽</span>{translatedPages.map(target=><button key={target} className={page===target?'selected':''} onClick={()=>onPage(target)} aria-pressed={page===target}>PDF {target}쪽</button>)}</div>}
      </>}
    </section>}
  </div>;
}
