import {useLayoutEffect,useRef,type RefObject} from 'react';
import {bodyAnchorTop,bodyReadingKey,parseBodyReadingPosition,type BodyReadingPosition} from './master-body-reading-position';

export function useBodyReadingPosition(host:RefObject<HTMLDivElement|null>,page:number,zoom:number,key:string|undefined,onPageChange:(page:number)=>void,navigationToken=0,onNavigationHandled?:(token:number)=>void,contentVersion?:unknown){
  const current=useRef({page,zoom,onPageChange,navigationToken,onNavigationHandled});current.current={page,zoom,onPageChange,navigationToken,onNavigationHandled};
  const snapshot=useRef<BodyReadingPosition|null>(null),ready=useRef(false),lastReported=useRef<number|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const visible=(root:HTMLElement)=>root.clientWidth>0&&root.clientHeight>0;
  const blocks=(root:HTMLElement)=>Array.from(root.querySelectorAll<HTMLElement>('[data-manuscript-page]'));
  function write(){if(timer.current!==null){clearTimeout(timer.current);timer.current=null;}if(key&&ready.current&&snapshot.current)try{localStorage.setItem(bodyReadingKey(key),JSON.stringify(snapshot.current));}catch{}}
  function capture(report=true){const root=host.current;if(!root||!ready.current||!visible(root))return;
    const top=root.getBoundingClientRect().top,all=blocks(root),anchor=all.find(e=>e.getBoundingClientRect().bottom>top)||all.at(-1),shown=all.find(e=>e.getBoundingClientRect().bottom>top+70)||all.at(-1);if(!anchor||!shown)return;
    const box=anchor.getBoundingClientRect(),n=Number(shown.dataset.manuscriptPage);
    snapshot.current={page:Number(anchor.dataset.manuscriptPage),reportedPage:n,fraction:Math.max(0,Math.min(1,(top-box.top)/Math.max(1,box.height))),leftRatio:root.scrollLeft/Math.max(1,root.scrollWidth),zoom:current.current.zoom};
    lastReported.current=n;if(report&&n!==current.current.page)current.current.onPageChange(n);
  }
  function restore(){const root=host.current,p=snapshot.current;if(!root||!p||!visible(root))return false;const block=blocks(root).find(e=>Number(e.dataset.manuscriptPage)===p.page);if(!block)return false;const box=block.getBoundingClientRect();root.scrollTop=bodyAnchorTop(box.top-root.getBoundingClientRect().top+root.scrollTop,box.height,p.fraction);root.scrollLeft=p.leftRatio*root.scrollWidth;lastReported.current=p.reportedPage;ready.current=true;return true;}
  function jump(){const root=host.current;if(!root||!visible(root))return;const all=blocks(root),target=all.find(e=>Number(e.dataset.manuscriptPage)>=current.current.page)||all.at(-1);if(target)root.scrollTop+=target.getBoundingClientRect().top-root.getBoundingClientRect().top;ready.current=true;capture(false);}
  useLayoutEffect(()=>{
    ready.current=false;snapshot.current=null;lastReported.current=null;
    if(key)try{snapshot.current=parseBodyReadingPosition(localStorage.getItem(bodyReadingKey(key)));}catch{}
    if(snapshot.current?.reportedPage!==current.current.page||navigationToken)snapshot.current=null;
    if(snapshot.current)lastReported.current=snapshot.current.reportedPage;
    if(!restore())jump();
    const root=host.current;if(!root)return;
    const observer=new ResizeObserver(()=>{if(!visible(root))return;if(!restore())jump();if(current.current.navigationToken)current.current.onNavigationHandled?.(current.current.navigationToken);});observer.observe(root);
    const flush=()=>{capture();write();};const hide=()=>{if(document.hidden)flush();};window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hide);
    return()=>{write();observer.disconnect();window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hide);};
  },[key]);
  useLayoutEffect(()=>{if(navigationToken||lastReported.current!==page){snapshot.current=null;jump();if(host.current&&visible(host.current)&&navigationToken)onNavigationHandled?.(navigationToken);}},[page,navigationToken]);
  useLayoutEffect(()=>{if(ready.current&&snapshot.current)restore();},[zoom,contentVersion]);
  return ()=>{capture();if(timer.current===null)timer.current=setTimeout(write,100);};
}

