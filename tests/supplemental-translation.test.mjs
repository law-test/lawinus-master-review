import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync(new URL('../src/supplemental-translation-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {supplementalTranslations}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const digest='c'.repeat(64),entry={referenceId:'ref-053',sourceId:'supplement-'+digest.slice(0,20),sourceSha256:digest,pageCount:11,asset:`translations/${digest}/pages.json`,originalAsset:`translations/${digest}/original.pdf`,label:'Jarvis chapter 1',kind:'pdf-partial-supplement',sourceType:'pdf'};
test('additional PDF translations require matching local original and translation assets',()=>{
 const catalog={schemaVersion:1,supplements:[entry]};
 assert.equal(supplementalTranslations(catalog,'ref-053').length,1);
 assert.equal(supplementalTranslations(catalog,'ref-054').length,0);
 for(const change of [{originalAsset:'https://other.test/book.pdf'},{asset:'../other.json'},{sourceId:'wrong'},{pageCount:0},{sourceSha256:'wrong'}])assert.equal(supplementalTranslations({...catalog,supplements:[{...entry,...change}]},'ref-053').length,0);
});
test('HTML chapters and printed-page transcripts need no invented PDF asset',()=>{
 const html={...entry,sourceType:'html',kind:'html-chapters',originalAsset:undefined,pageCount:15};
 assert.equal(supplementalTranslations({schemaVersion:1,supplements:[html]},'ref-053')[0].kind,'html-chapters');
});
