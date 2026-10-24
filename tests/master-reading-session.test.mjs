import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const view=ts.transpileModule(readFileSync(new URL('../src/reading-view.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const viewUrl='data:text/javascript;base64,'+Buffer.from(view).toString('base64');
const code=ts.transpileModule(readFileSync(new URL('../src/master-reading-session.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replaceAll("'./reading-view'",JSON.stringify(viewUrl));
const {readWorkspaceSession,saveWorkspaceSession}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const catalog={thesisSha256:'a'.repeat(64),pageCount:44,citationIds:['cite-001','sentence-001'],referenceIds:['ref-001'],sourcePages:{'s-presentation':14,'s-book':50},paragraphIds:['B003']};
test('return to the same master document and view after reload',()=>{
 let value;const storage={getItem:()=>value,setItem:(_,v)=>{value=v;}};
 const initial=readWorkspaceSession(storage,catalog);assert.equal(initial.page,4);
 const state={...initial,page:8,zoom:1.3,sourceId:'s-book',sourcePage:22,citationId:'sentence-001',paragraphId:'B003',manuscriptMode:'text',readingView:{focus:true,header:true,tools:false,footnotes:true,focusSurfaces:{metadata:true}}};
 saveWorkspaceSession(storage,state);assert.deepEqual(readWorkspaceSession(storage,catalog),state);
});
test('reject another manuscript and invalid stored anchors and page ranges',()=>{
 const initial=readWorkspaceSession(undefined,catalog);
 assert.deepEqual(readWorkspaceSession({getItem:()=>JSON.stringify({...initial,thesisSha256:'b'.repeat(64),page:22})},catalog),initial);
 const invalid={...initial,page:999,zoom:100,sourceId:'paper-private-source',sourcePage:200,citationId:'fn-001',paragraphId:'P777',referenceId:'ref-999'};
 const restored=readWorkspaceSession({getItem:()=>JSON.stringify(invalid)},catalog,false);
 assert.equal(restored.page,4);assert.equal(restored.zoom,1);assert.equal(restored.sourceId,'s-presentation');assert.equal(restored.sourcePage,1);assert.equal(restored.citationId,'cite-001');assert.equal(restored.paragraphId,'');assert.equal(restored.referenceId,'');assert.equal(restored.sidebarOpen,false);
});
test('unavailable browser storage leaves reading usable',()=>{assert.equal(readWorkspaceSession({getItem:()=>{throw Error();}},catalog).page,4);assert.doesNotThrow(()=>saveWorkspaceSession({setItem:()=>{throw Error();}},readWorkspaceSession(undefined,catalog)));});
