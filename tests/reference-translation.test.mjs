import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync(new URL('../src/reference-translation-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {translatedEvidence,translatedReferenceTitle}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const data={meta:{thesisSha256:'thesis'},titles:[{referenceId:'r',original:'Possible Selves',korean:'가능한 자기'}],excerpts:[{id:'e',referenceId:'r',sourceId:'s',sourceSha256:'hash',page:2,sentenceIds:['sentence-1'],original:'text',korean:'번역'}]};
const selection={thesisSha256:'thesis',referenceId:'r',source:{id:'s',sha256:'hash'},page:2,evidencePages:[2],sentenceId:'sentence-1'};
test('translation remains bound to the exact manuscript, reference title, source and citation page',()=>{
 assert.equal(translatedReferenceTitle(data,'thesis',{id:'r',title:'Possible Selves'}),'가능한 자기');
 assert.equal(translatedReferenceTitle(data,'other',{id:'r',title:'Possible Selves'}),undefined);
 assert.equal(translatedReferenceTitle(data,'thesis',{id:'r',title:'A different book'}),undefined);
 assert.equal(translatedEvidence(data,selection).length,1);
 for(const change of [{thesisSha256:'other'},{source:{id:'s',sha256:'other'}},{source:{id:'s'}},{referenceId:'other'},{page:3},{evidencePages:[]},{sentenceId:'other'}])assert.deepEqual(translatedEvidence(data,{...selection,...change}),[]);
 assert.equal(translatedEvidence(data,{...selection,sentenceId:undefined,bibliography:true}).length,1);
});
