import React,{useEffect,useRef,useState} from 'react';
import {manuscriptParagraphs,citationTextParts,type ManuscriptParagraph} from './master-manuscript-model';
import type {SharedEdit} from './master-shared-edits';
import {REVIEW_RECOMMENDATIONS_ENABLED} from './presentation-mode';
import rawRecords from './review-records.json';
import {useBodyReadingPosition} from './master-body-reading-hook';
import './master-manuscript.css';
export {manuscriptParagraphs,paragraphTargets,effectiveManuscriptEdits,manuscriptMeta} from './master-manuscript-model';
type Props={page:number;zoom:number;selected?:string;overrides?:Record<string,SharedEdit>;onPageChange:(page:number)=>void;onParagraph:(id:string)=>void;onCitation:(id:string,page:number)=>void;persistenceKey?:string;navigationToken?:number;onNavigationHandled?:(token:number)=>void};
export default function MasterManuscript({page,zoom,selected='',overrides={},onPageChange,onParagraph,onCitation,persistenceKey,navigationToken,onNavigationHandled}:Props){
 const host=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;top:number;moved:boolean}|null>(null),suppressClick=useRef(false);
 const reportPage=useBodyReadingPosition(host,page,zoom,persistenceKey,onPageChange,navigationToken,onNavigationHandled,overrides);
 const [hand,setHand]=useState(true);const groups=new Map<number,ManuscriptParagraph[]>();
 for(const p of manuscriptParagraphs){const group=groups.get(p.page)||[];group.push(p);groups.set(p.page,group);}
 useEffect(()=>{const cancel=()=>{drag.current=null;suppressClick.current=false;};window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',cancel);return()=>{window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',cancel);};},[]);
 return <div className="web-manuscript-reader"><div className="manuscript-tools"><span>본문</span><button className={hand?'selected':''} aria-pressed={hand} onClick={()=>setHand(true)}>✋ 이동</button><button className={!hand?'selected':''} aria-pressed={!hand} onClick={()=>setHand(false)}>글자 선택</button></div>
  <div className={'web-manuscript'+(hand?' hand-mode':'')} ref={host} aria-label="논문 본문 연속 읽기" onScroll={reportPage} style={{'--manuscript-zoom':zoom} as React.CSSProperties}
   onPointerDown={e=>{suppressClick.current=false;if(!hand||e.pointerType==='touch'||e.button!==0||(e.target as HTMLElement).closest('button'))return;drag.current={x:e.clientX,y:e.clientY,top:e.currentTarget.scrollTop,moved:false};}}
   onPointerMove={e=>{const d=drag.current;if(!d)return;if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>5){d.moved=true;e.currentTarget.setPointerCapture(e.pointerId);}if(d.moved){e.currentTarget.scrollTop=d.top-(e.clientY-d.y);e.preventDefault();}}}
   onPointerUp={e=>{suppressClick.current=!!drag.current?.moved;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
   onPointerCancel={()=>{suppressClick.current=!!drag.current?.moved;drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
   onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}}>
   {Array.from(groups).map(([n,items])=><section className="manuscript-page" key={n} data-manuscript-page={n}><div className="manuscript-page-label">PDF {n}쪽{items[0].printed?` · 본문 ${items[0].printed}쪽`:''}</div>
    {items.map(p=>{const proposal=REVIEW_RECOMMENDATIONS_ENABLED&&rawRecords.revisions.find(r=>r.id===p.id),text=overrides[p.id]?.text??p.text,changed=text!==p.text;return <div key={p.id} data-paragraph={p.id} className={'manuscript-paragraph'+(p.heading?' manuscript-heading':'')+(REVIEW_RECOMMENDATIONS_ENABLED&&selected===p.id?' active':'')+(REVIEW_RECOMMENDATIONS_ENABLED&&changed?' amended':'')+(proposal?' has-proposal':'')} role={REVIEW_RECOMMENDATIONS_ENABLED?"button":undefined} tabIndex={REVIEW_RECOMMENDATIONS_ENABLED?0:undefined} title={REVIEW_RECOMMENDATIONS_ENABLED?"클릭하면 수정안":undefined} aria-label={REVIEW_RECOMMENDATIONS_ENABLED?'문단 수정안 열기: '+text.slice(0,55):undefined} onClick={()=>{if(!REVIEW_RECOMMENDATIONS_ENABLED)return;if(window.getSelection()?.isCollapsed===false)return;onParagraph(p.id);}} onKeyDown={e=>{if(REVIEW_RECOMMENDATIONS_ENABLED&&e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onParagraph(p.id);}}}>
     {proposal&&<span className="master-proposal-label"><button onClick={e=>{e.stopPropagation();onParagraph(p.id);}}>수정제안 있음</button></span>}
     {text.trim()?citationTextParts(p,text).map((part,i)=>part.citationId?<button className="manuscript-citation-sentence" title="인용 취지와 원전 열기" key={i} onClick={e=>{e.stopPropagation();onCitation(part.citationId!,p.page);}}>{part.text}</button>:<React.Fragment key={i}>{part.text}</React.Fragment>):<span className="manuscript-deleted-label">현재 본문에서 삭제된 문단</span>}
     {REVIEW_RECOMMENDATIONS_ENABLED&&changed&&<span className="master-edited-label">공통 수정 반영 · 원본 인용 연결은 PDF에서 확인</span>}
    </div>;})}
   </section>)}
  </div>
 </div>;
}
