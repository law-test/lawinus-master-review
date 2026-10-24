import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync(new URL('../src/pdf-scale-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {fittedPdfZoom,readPdfScale,savePdfScale}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('whole-page fitting respects both available width and vertical space, including wide presentations',()=>{
 const page={width:600,height:900},view={width:600,height:340};
 assert.equal(fittedPdfZoom('width',2,view,page),1);
 assert.equal(fittedPdfZoom('page',2,view,page),1/3);
 assert.equal(fittedPdfZoom('page',2,{width:600,height:940},page),1);
 assert.equal(fittedPdfZoom('page',1,{width:600,height:340},{width:1200,height:600}),1);
 assert.equal(fittedPdfZoom('custom',1.7,view,page),1.7);
 const narrowed=fittedPdfZoom('page',1,{width:300,height:340},page);
 assert.equal(narrowed,2/3);assert.equal(300*narrowed*page.height/page.width,300);
});
test('fit mode and custom scale are independently restored per document and invalid storage is ignored',()=>{
 const values=new Map();const store={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 savePdfScale(store,'thesis',{mode:'page',zoom:.35});savePdfScale(store,'source',{mode:'width',zoom:1});
 assert.deepEqual(readPdfScale(store,'thesis'),{mode:'page',zoom:.35});assert.deepEqual(readPdfScale(store,'source'),{mode:'width',zoom:1});
 values.set('master.pdf-scale.v1:bad','{"mode":"page","zoom":null}');assert.deepEqual(readPdfScale(store,'bad'),{mode:'width',zoom:1});
 assert.deepEqual(readPdfScale({getItem:()=>{throw Error();}},'none',1.5),{mode:'custom',zoom:1.5});
});
