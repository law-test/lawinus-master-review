import {useEffect,useState} from 'react';
import {boundedPdfZoom,readPdfScale,savePdfScale,type PdfFitMode,type PdfScale} from './pdf-scale-model';
const storage=()=>{try{return localStorage;}catch{return undefined;}};
export function usePdfScale(key:string,initialZoom=1){
 const [state,setState]=useState(()=>({key,value:readPdfScale(storage(),key,initialZoom)}));
 const value=state.key===key?state.value:readPdfScale(storage(),key,initialZoom);
 useEffect(()=>{if(state.key!==key)setState({key,value});},[key,state.key]);
 const change=(next:PdfScale)=>{setState({key,value:next});savePdfScale(storage(),key,next);};
 return {zoom:value.zoom,fitMode:value.mode,setZoom:(zoom:number)=>change({mode:'custom',zoom:boundedPdfZoom(zoom)}),setFitMode:(mode:PdfFitMode)=>change({mode,zoom:mode==='width'?1:value.zoom}),resolveZoom:(zoom:number)=>{if(value.mode!=='custom'&&Math.abs(value.zoom-zoom)>.00001)change({...value,zoom});}};
}
