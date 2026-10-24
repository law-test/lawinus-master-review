import React,{useCallback,useEffect,useRef,useState} from 'react';
import {clampHeight,draggedHeight,keyboardHeight,readStoredHeight,saveStoredHeight} from './height-resize-model';
import './height-resizer.css';

type Props={label:string;className?:string;value:number;min:number;max:number;step?:number;unit?:string;onChange:(value:number)=>void;unitsPerPixel?:()=>number;onReset?:()=>void};
type Drag={pointerId:number;startY:number;startValue:number;scale:number;element:HTMLDivElement;cursor:string;userSelect:string};
export function useStoredHeight(key:string,initial:number,min:number,max:number):[number,(value:number)=>void,()=>void]{
  const [stored,setStored]=useState(()=>({key,value:readStoredHeight(typeof localStorage==='undefined'?undefined:localStorage,key,initial,min,max)}));
  const value=stored.key===key?clampHeight(stored.value,min,max):readStoredHeight(typeof localStorage==='undefined'?undefined:localStorage,key,initial,min,max);
  useEffect(()=>{if(stored.key!==key)setStored({key,value});},[key,value,stored.key]);
  const change=(next:number)=>{const height=clampHeight(next,min,max);setStored({key,value:height});saveStoredHeight(typeof localStorage==='undefined'?undefined:localStorage,key,height,min,max);};
  return [value,change,()=>change(initial)];
}
export default function HeightResizer({label,className='',value,min,max,step=8,unit='px',onChange,unitsPerPixel=()=>1,onReset}:Props){
  const drag=useRef<Drag|null>(null),[active,setActive]=useState(false);
  const finish=useCallback(()=>{const current=drag.current;if(!current)return;drag.current=null;document.body.style.cursor=current.cursor;document.body.style.userSelect=current.userSelect;if(current.element.hasPointerCapture(current.pointerId))current.element.releasePointerCapture(current.pointerId);setActive(false);},[]);
  useEffect(()=>{window.addEventListener('blur',finish);return()=>{window.removeEventListener('blur',finish);finish();};},[finish]);
  return <div className={'height-resizer '+className+(active?' resizing':'')} role="separator" aria-label={label} aria-orientation="horizontal" aria-valuemin={min} aria-valuemax={Math.max(min,max)} aria-valuenow={Math.round(clampHeight(value,min,max))} aria-valuetext={`${Math.round(clampHeight(value,min,max))}${unit}`} tabIndex={0} title={'위아래로 드래그하여 높이 조절 · ↑/↓'+(onReset?' · 두 번 누르면 기본 높이':'')}
    onPointerDown={event=>{if(event.button!==0||!event.isPrimary)return;event.preventDefault();finish();event.currentTarget.focus({preventScroll:true});drag.current={pointerId:event.pointerId,startY:event.clientY,startValue:value,scale:unitsPerPixel(),element:event.currentTarget,cursor:document.body.style.cursor,userSelect:document.body.style.userSelect};event.currentTarget.setPointerCapture(event.pointerId);document.body.style.cursor='row-resize';document.body.style.userSelect='none';setActive(true);}}
    onPointerMove={event=>{const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;event.preventDefault();onChange(draggedHeight(current.startValue,current.startY,event.clientY,current.scale,min,max));}}
    onPointerUp={event=>{if(drag.current?.pointerId===event.pointerId)finish();}}
    onPointerCancel={event=>{if(drag.current?.pointerId===event.pointerId)finish();}}
    onLostPointerCapture={finish}
    onDoubleClick={()=>{finish();onReset?.();}}
    onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&onReset){event.preventDefault();onReset();return;}const next=keyboardHeight(event.key,value,min,max,step);if(next!==null){event.preventDefault();onChange(next);}}}
  ><span/></div>;
}
