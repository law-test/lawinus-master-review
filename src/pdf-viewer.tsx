import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {assetUrl} from './review-api';
import {measurableViewport,movedPointer,normalizedPoint,pageIndexAt,pageLayout,reflowScrollPosition,targetAt,visiblePageRange,watchDocumentInterruption,type PageSize,type PdfTarget} from './pdf-viewer-model';
import './pdf-viewer.css';
type Obj=Record<string,any>;
type Pin={id:string;page:number|null;x:number|null;y:number|null;text:string;status:string;[key:string]:any};
const NO_PAGE_SIZES:{page:number;width:number;height:number}[]=[];
let pdfLibrary:Promise<any>|undefined;
const localAsset=(path:string)=>new URL(path,document.baseURI).href;
function pdfModule(){return pdfLibrary??=import(/* @vite-ignore */ localAsset('./vendor/pdfjs/pdf.mjs')).then(m=>{m.GlobalWorkerOptions.workerSrc=localAsset('./vendor/pdfjs/pdf.worker.mjs');return m;});}
type Props={id:string;page:number;total:number;zoom?:number;pageSizes?:{page:number;width:number;height:number}[];highlights?:Obj[];targets?:PdfTarget[];pins?:Pin[];onPageChange:(page:number)=>void;onTarget?:(id:string)=>void;onPin?:(pin:any)=>void;onPlace?:(x:number,y:number,page:number)=>void;placing?:boolean;label?:string};

function PdfPage({doc,page,width,height,highlights,targets,pins,onTarget,onPin,onPlace,placing,onSize}:{doc:any;page:number;width:number;height:number;highlights:Obj[];targets:PdfTarget[];pins:Pin[];onTarget?:Props['onTarget'];onPin?:Props['onPin'];onPlace?:Props['onPlace'];placing:boolean;onSize:(page:number,size:PageSize)=>void}){
  const sheet=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),textLayer=useRef<HTMLDivElement>(null);
  const gesture=useRef<{x:number;y:number}|null>(null);
  const [dims,setDims]=useState<PageSize>({width:515,height:728}),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [hover,setHover]=useState<PdfTarget|null>(null),[focused,setFocused]=useState<string|null>(null);
  useEffect(()=>{let stopped=false,render:any,layer:any;setLoading(true);setError('');
    (async()=>{try{const pg=await doc.getPage(page);if(stopped)return;const base=pg.getViewport({scale:1});const size={width:base.width,height:base.height};setDims(size);onSize(page,size);const scale=width/base.width,vp=pg.getViewport({scale}),dpr=Math.min(window.devicePixelRatio||1,2);const cv=canvas.current!,tl=textLayer.current!;cv.width=Math.round(vp.width*dpr);cv.height=Math.round(vp.height*dpr);cv.style.width=vp.width+'px';cv.style.height=vp.height+'px';tl.replaceChildren();tl.style.setProperty('--scale-factor',String(scale));tl.style.setProperty('--total-scale-factor',String(scale));tl.style.width=vp.width+'px';tl.style.height=vp.height+'px';render=pg.render({canvas:cv,canvasContext:cv.getContext('2d'),viewport:vp,transform:dpr!==1?[dpr,0,0,dpr,0,0]:undefined});await render.promise;if(stopped)return;const m=await pdfModule();layer=new m.TextLayer({textContentSource:await pg.getTextContent(),container:tl,viewport:vp});await layer.render();if(!stopped)setLoading(false);}catch(e:any){if(!stopped&&e?.name!=='RenderingCancelledException')setError('이 쪽을 불러오지 못했습니다.');}})();
    return()=>{stopped=true;render?.cancel();layer?.cancel();};
  },[doc,page,width,onSize]);
  const rectStyle=(r:number[])=>({left:r[0]/dims.width*100+'%',top:r[1]/dims.height*100+'%',width:(r[2]-r[0])/dims.width*100+'%',height:(r[3]-r[1])/dims.height*100+'%'});
  function targetFromEvent(e:React.PointerEvent|React.MouseEvent){const box=sheet.current!.getBoundingClientRect(),p=normalizedPoint(e.clientX,e.clientY,box);return targetAt(targets,p.x*dims.width,p.y*dims.height);}
  const selectedNote=focused||hover?.noteId;
  const keyboardTargets=useMemo(()=>{const rows=new Map<string,PdfTarget>();for(const t of targets){const old=rows.get(t.noteId);if(!old||old.kind==='body-marker'&&t.kind!=='body-marker')rows.set(t.noteId,t);}return [...rows.values()];},[targets]);
  return <div className={'pdf-sheet continuous-pdf-page'+(hover&&!placing?' has-citation-hover':'')} ref={sheet} data-pdf-page={page} style={{width,height}}
    title={!placing&&hover?'클릭하면 이동':undefined}
    onPointerDown={e=>{gesture.current={x:e.clientX,y:e.clientY};}}
    onPointerMove={e=>{if(!placing&&e.pointerType==='mouse'){const next=targetFromEvent(e);setHover(old=>old?.noteId===next?.noteId&&old?.rect===next?.rect?old:next||null);}}}
    onPointerLeave={()=>setHover(null)} onClick={e=>{
      if((e.target as HTMLElement).closest('button,a'))return;
      if(movedPointer(gesture.current,e.clientX,e.clientY)||e.shiftKey)return;
      if(placing){const point=normalizedPoint(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect());onPlace?.(point.x,point.y,page);return;}
      const selection=window.getSelection();if(selection&&!selection.isCollapsed&&(sheet.current?.contains(selection.anchorNode)||sheet.current?.contains(selection.focusNode)))return;
      const target=targetFromEvent(e);if(target)onTarget?.(target.noteId);
    }}>
    <canvas ref={canvas}/><div className="textLayer" ref={textLayer}/>
    {(loading||error)&&<div className="pdf-page-state" role="status">{error||`PDF ${page}쪽 불러오는 중…`}</div>}
    <div className="pdf-overlays">{highlights.map((h,i)=><span key={i} className="pdf-highlight" style={rectStyle(h.rect)}/>)}
      {!placing&&targets.filter(t=>t.noteId===selectedNote).map((t,i)=><span key={'link'+i} className="citation-hover-region" style={rectStyle(t.rect)}/>)}
    </div>
    {!placing&&keyboardTargets.map(t=><a key={t.noteId} className="citation-keyboard-link" style={rectStyle(t.rect)} href={'#'+t.noteId} aria-label={`각주 ${t.number} 원전과 검토 내용 열기`} title="클릭하면 이동" onFocus={()=>setFocused(t.noteId)} onBlur={()=>setFocused(null)} onClick={e=>{e.preventDefault();onTarget?.(t.noteId);}} onKeyDown={e=>{if(e.key===' '){e.preventDefault();onTarget?.(t.noteId);}}}/>)}
    {!placing&&hover&&<span className="citation-hover-tooltip" role="tooltip" style={{left:Math.min(hover.rect[0]/dims.width*100,70)+'%',top:hover.rect[3]/dims.height*100+'%'}}>클릭하면 이동</span>}
    {!placing&&pins.filter(p=>p.x!=null&&p.y!=null).map((p,i)=><button key={p.id} className={'memo-pin '+(p.status==='resolved'?'resolved':'')} style={{left:p.x!*100+'%',top:p.y!*100+'%'}} title={p.text} aria-label={'메모: '+p.text.slice(0,50)} onClick={e=>{e.stopPropagation();onPin?.(p);}}>{i+1}</button>)}
  </div>;
}

export default function PdfPane({id,page,total,zoom=1,pageSizes=NO_PAGE_SIZES,highlights=[],targets=[],pins=[],onPageChange,onTarget,onPin,onPlace,placing=false,label='PDF 문서'}:Props){
  const host=useRef<HTMLDivElement>(null),frame=useRef(0),reported=useRef(page),onPageRef=useRef(onPageChange);
  onPageRef.current=onPageChange;
  const [loaded,setLoaded]=useState<{id:string;doc:any}|null>(null),[error,setError]=useState('');
  const [viewport,setViewport]=useState({width:550,height:700,top:0}),[measured,setMeasured]=useState<{id:string;values:Record<number,PageSize>}>({id,values:{}}),[hand,setHand]=useState(true),[dragging,setDragging]=useState(false);
  const hidden=useRef(false),resumeScroll=useRef(false),savedScroll=useRef({top:0,left:0});
  const [appearance,setAppearance]=useState(0);
  const drag=useRef<{pointerId:number;x:number;y:number;top:number;left:number;moved:boolean}|null>(null),suppressClickUntil=useRef(0);
  const cancelDrag=useCallback(()=>{const current=drag.current;if(!current)return;drag.current=null;if(current.moved)suppressClickUntil.current=performance.now()+400;setDragging(false);if(host.current?.hasPointerCapture(current.pointerId))host.current.releasePointerCapture(current.pointerId);},[]);
  useEffect(()=>watchDocumentInterruption(cancelDrag,window,document),[cancelDrag]);
  const doc=loaded?.id===id?loaded.doc:null;
  useEffect(()=>{let stopped=false,task:any;setError('');setLoaded(null);setMeasured({id,values:{}});
    (async()=>{try{const m=await pdfModule();if(stopped)return;task=m.getDocument({url:assetUrl(id),cMapUrl:localAsset('./vendor/pdfjs/cmaps/'),cMapPacked:true,standardFontDataUrl:localAsset('./vendor/pdfjs/standard_fonts/'),wasmUrl:localAsset('./vendor/pdfjs/wasm/')});const document=await task.promise;if(!stopped)setLoaded({id,doc:document});}catch{if(!stopped)setError('PDF를 불러오지 못했습니다. 원문을 새 창에서 열어 주세요.');}})();
    return()=>{stopped=true;void task?.destroy();};
  },[id]);
  const sizes=useMemo(()=>({...Object.fromEntries(pageSizes.map(s=>[s.page,{width:s.width,height:s.height}])),...(measured.id===id?measured.values:{})}),[pageSizes,measured,id]);
  const layout=useMemo(()=>pageLayout(doc?.numPages||total,viewport.width,zoom,sizes),[doc,total,viewport.width,zoom,sizes]);
  const previousLayout=useRef<{id:string;layout:typeof layout}|null>(null);
  const layoutRef=useRef(layout);layoutRef.current=layout;
  const viewportSize=(el:HTMLElement)=>{const style=getComputedStyle(el);return measurableViewport(el.clientWidth,el.clientHeight,parseFloat(style.paddingLeft)+parseFloat(style.paddingRight));};
  const updateViewport=useCallback(()=>{const el=host.current;if(!el||hidden.current||resumeScroll.current)return;const size=viewportSize(el);if(!size)return;savedScroll.current={top:el.scrollTop,left:el.scrollLeft};setViewport({...size,top:el.scrollTop});
    const index=pageIndexAt(layoutRef.current.offsets,Math.max(0,el.scrollTop-18)+Math.min(el.clientHeight*.2,150));const current=index+1;
    if(current!==reported.current){reported.current=current;onPageRef.current(current);}
  },[]);
  useEffect(()=>{const el=host.current!;const observer=new ResizeObserver(()=>{const size=viewportSize(el);if(!size){hidden.current=true;cancelDrag();cancelAnimationFrame(frame.current);return;}if(hidden.current){hidden.current=false;resumeScroll.current=true;setAppearance(value=>value+1);}setViewport(v=>v.width===size.width&&v.height===size.height?v:{...v,...size});});observer.observe(el);return()=>{observer.disconnect();cancelAnimationFrame(frame.current);};},[cancelDrag]);
  useLayoutEffect(()=>{const el=host.current;if(!el)return;if(!viewportSize(el)){hidden.current=true;return;}if(hidden.current){hidden.current=false;resumeScroll.current=true;}const previous=previousLayout.current,returning=resumeScroll.current,readingTop=returning?savedScroll.current.top:el.scrollTop;let top:number|undefined;
    if(!previous||previous.id!==id||page!==reported.current){const index=Math.min(layout.heights.length-1,Math.max(0,page-1));top=layout.offsets[index];reported.current=index+1;}
    else if(previous.layout!==layout){top=reflowScrollPosition(previous.layout,layout,readingTop-18);}
    else if(returning){top=readingTop-18;}
    previousLayout.current={id,layout};resumeScroll.current=false;if(top!==undefined){el.scrollTop=top+18;if(returning)el.scrollLeft=savedScroll.current.left;savedScroll.current={top:el.scrollTop,left:el.scrollLeft};setViewport(v=>({...v,top:el.scrollTop}));cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(updateViewport);}
  },[page,id,layout,appearance,updateViewport]);
  const onSize=useCallback((p:number,size:PageSize)=>setMeasured(previous=>{const values=previous.id===id?previous.values:{};const old=values[p];return old&&Math.abs(old.width-size.width)<.01&&Math.abs(old.height-size.height)<.01?previous:{id,values:{...values,[p]:size}};}),[id]);
  const visible=visiblePageRange(layout.offsets,Math.max(0,viewport.top-18),viewport.height,1);
  function finishDrag(e:React.PointerEvent){if(drag.current?.pointerId===e.pointerId)cancelDrag();}
  return <div className="pdf-reader" aria-label={label}>
    <div className="pdf-reading-tools"><span>연속 보기</span><div><button className={hand?'selected':''} aria-pressed={hand} onClick={()=>setHand(true)} title="문서를 잡고 위아래로 이동">✋ 이동</button><button className={!hand?'selected':''} aria-pressed={!hand} onClick={()=>setHand(false)} title="글자를 드래그하여 선택·복사">Ⅰ 글자 선택</button></div><span className="pdf-reading-page">{page} / {doc?.numPages||total}</span></div>
    <div className={'pdf-stage continuous-pdf'+(hand?' hand-mode':' selection-mode')+(dragging?' is-dragging':'')+(placing?' placing':'')} ref={host} tabIndex={0} aria-label={`${label} 연속 스크롤`}
      onScroll={e=>{if(hidden.current||resumeScroll.current||!viewportSize(e.currentTarget))return;savedScroll.current={top:e.currentTarget.scrollTop,left:e.currentTarget.scrollLeft};cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(updateViewport);}}
      onPointerDown={e=>{if(!hand||placing||e.pointerType!=='mouse'||e.button!==0||(e.target as HTMLElement).closest('button,a,input,textarea'))return;e.preventDefault();drag.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,top:e.currentTarget.scrollTop,left:e.currentTarget.scrollLeft,moved:false};}}
      onPointerMove={e=>{const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;if(!d.moved&&movedPointer(d,e.clientX,e.clientY)){d.moved=true;e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);}if(d.moved){e.currentTarget.scrollTop=d.top-(e.clientY-d.y);e.currentTarget.scrollLeft=d.left-(e.clientX-d.x);}}}
      onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
      onClickCapture={e=>{if(e.detail>0&&performance.now()<suppressClickUntil.current){e.preventDefault();e.stopPropagation();}}}>
      {error&&<div className="pdf-error" role="alert">{error} <a href={assetUrl(id)} target="_blank" rel="noreferrer">원문 열기 ↗</a></div>}
      {!doc&&!error&&<div className="pdf-status" role="status">문서를 불러오는 중…</div>}
      <div className="pdf-continuous-pages" style={{width:layout.width,height:layout.totalHeight}}>
        {visible.map(p=><div key={id+'-'+p} className="pdf-page-slot" style={{top:layout.offsets[p-1],width:layout.width,height:layout.heights[p-1]}} data-slot-page={p}>
          {doc?<PdfPage doc={doc} page={p} width={layout.width} height={layout.heights[p-1]} highlights={highlights.filter(h=>h.page===p)} targets={targets.filter(t=>t.page===p)} pins={pins.filter(n=>n.page===p)} onTarget={onTarget} onPin={onPin} onPlace={onPlace} placing={placing} onSize={onSize}/>:<div className="pdf-page-placeholder">PDF {p}쪽</div>}
          <span className="pdf-page-number" aria-hidden="true">{p}</span>
        </div>)}
      </div>
    </div>
  </div>;
}
