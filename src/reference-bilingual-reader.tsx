import React,{useRef} from 'react';
import HeightResizer,{useStoredHeight} from './height-resizer';
import type {ReferenceReadingMode,ReferenceTranslationExcerpt} from './reference-translation-model';

export default function ReferenceBilingualReader({children,enabled,mode,excerpts,page,translatedPages,onPage}:{children:React.ReactNode;enabled:boolean;mode:ReferenceReadingMode;excerpts:ReferenceTranslationExcerpt[];page?:number;translatedPages:number[];onPage:(page:number)=>void}){
  const container=useRef<HTMLDivElement>(null);
  const [topHeight,setTopHeight,resetHeight]=useStoredHeight('master-reference-bilingual-height',62,25,80);
  if(!enabled)return <>{children}</>;
  return <div ref={container} className={'foreign-document-stack mode-'+mode}>
    <div className="foreign-original" style={{display:mode==='translation'?'none':undefined,flex:mode==='parallel'?`0 0 ${topHeight}%`:'1 1 0'}} aria-label="외국어 자료 원문">{children}</div>
    {mode==='parallel'&&<HeightResizer label="원문과 번역 높이 조절" value={topHeight} min={25} max={80} onChange={setTopHeight} unit="%" step={3} unitsPerPixel={()=>100/(container.current?.getBoundingClientRect().height||1)} onReset={resetHeight}/>}
    {mode!=='original'&&<section className="foreign-translation" aria-label="한국어 번역 읽기" key={page}>
      <div className="foreign-translation-heading"><b>한국어 번역</b><span>확인한 근거 구절{page?` · PDF ${page}쪽`:''}</span></div>
      {excerpts.length?<><p className="translation-scope">아래 구절의 열람용 번역입니다. 이 쪽 전체를 번역한 것은 아닙니다.</p>{excerpts.map(excerpt=><article key={excerpt.id}>{excerpt.printed&&<small>인쇄 {excerpt.printed}쪽</small>}{mode==='parallel'&&<blockquote lang="en">{excerpt.original}</blockquote>}<p lang="ko">{excerpt.korean}</p></article>)}</>:<p className="translation-empty">이 쪽에는 아직 확인된 번역이 없습니다. 원문을 보거나 번역이 있는 근거 쪽을 선택해 주세요.</p>}
      {translatedPages.length>0&&<div className="translation-page-links"><span>번역이 있는 근거 쪽</span>{translatedPages.map(target=><button key={target} className={page===target?'selected':''} onClick={()=>onPage(target)} aria-pressed={page===target}>PDF {target}쪽</button>)}</div>}
    </section>}
  </div>;
}
