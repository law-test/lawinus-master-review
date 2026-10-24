import {useEffect,useState} from 'react';
import {fullTranslationCatalogEntry,fullTranslationDocument,type FullTranslationSource,type FullTranslationDocument,type FullTranslationCatalogEntry} from './full-reference-translation-model';
type TranslationState={status:'idle'|'loading'|'unavailable'|'ready'|'error';document?:FullTranslationDocument;entry?:FullTranslationCatalogEntry};
const documents=new Map<string,FullTranslationDocument>();
let catalogPromise:Promise<unknown>|undefined;
export function loadTranslationCatalog(){return catalogPromise??=(fetch(new URL('translations/catalog.json',document.baseURI),{cache:'no-cache'}).then(response=>response.ok?response.json():undefined).catch(()=>{catalogPromise=undefined;return undefined;}));}
export function useFullReferenceTranslation(source:FullTranslationSource|undefined,enabled:boolean):TranslationState{
  const [state,setState]=useState<TranslationState>({status:'idle'});
  useEffect(()=>{
    if(!enabled||!source?.sha256||!source.pages){setState({status:'idle'});return;}
    let active=true;const controller=new AbortController();setState({status:'loading'});
    void(async()=>{try{
      const entry=fullTranslationCatalogEntry(await loadTranslationCatalog(),source);
      if(!active)return;if(!entry){setState({status:'unavailable'});return;}
      const key=source.sha256+':'+(entry.version||'');let data=documents.get(key);
      if(!data){const url=new URL(entry.asset,document.baseURI);if(entry.version)url.searchParams.set('v',entry.version);const response=await fetch(url,{signal:controller.signal,cache:'no-cache'});if(!response.ok)throw Error('Translation unavailable');data=fullTranslationDocument(await response.json(),source);if(!data)throw Error('Translation source mismatch');documents.set(key,data);}
      if(active)setState({status:'ready',document:data,entry});
    }catch{if(active)setState({status:'error'});}})();
    return()=>{active=false;controller.abort();};
  },[enabled,source?.id,source?.sha256,source?.pages]);
  return state.document&&state.document.sourceSha256!==source?.sha256?{status:'loading'}:state;
}
