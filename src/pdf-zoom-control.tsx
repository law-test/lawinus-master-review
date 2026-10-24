import React from 'react';
import {boundedPdfZoom,type PdfFitMode} from './pdf-scale-model';
import './pdf-zoom-control.css';
export default function PdfZoomControl({label,zoom,fitMode,onZoomChange,onFitModeChange}:{label:string;zoom:number;fitMode:PdfFitMode;onZoomChange:(zoom:number)=>void;onFitModeChange:(mode:PdfFitMode)=>void}){
 return <div className="pdf-zoom-control" role="group" aria-label={label+' 배율'}><button aria-label={label+' 축소'} onClick={()=>{onFitModeChange('custom');onZoomChange(boundedPdfZoom(zoom-.15));}}>−</button><select aria-label={label+' 맞춤 방식'} value={fitMode} onChange={event=>onFitModeChange(event.target.value as PdfFitMode)}><option value="width">폭 맞춤</option><option value="page">쪽 맞춤</option><option value="custom">직접 배율</option></select><span aria-label={label+' 현재 배율'}>{Math.round(zoom*100)}%</span><button aria-label={label+' 확대'} onClick={()=>{onFitModeChange('custom');onZoomChange(boundedPdfZoom(zoom+.15));}}>＋</button></div>;
}

export function TextZoomControl({zoom,onZoomChange}:{zoom:number;onZoomChange:(zoom:number)=>void}){
 return <div className="pdf-zoom-control text-zoom-control" role="group" aria-label="본문 글자 배율"><button aria-label="본문 글자 축소" disabled={zoom<=.7} onClick={()=>onZoomChange(Math.max(.7,zoom-.15))}>−</button><button aria-label="본문 글자 기본 배율로 되돌리기" title="본문 글자 기본 배율로 되돌리기" onClick={()=>onZoomChange(1)}>{Math.round(zoom*100)}%</button><button aria-label="본문 글자 확대" disabled={zoom>=2} onClick={()=>onZoomChange(Math.min(2,zoom+.15))}>＋</button></div>;
}
