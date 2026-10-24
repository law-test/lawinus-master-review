import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync(new URL('../src/full-reference-translation-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {fullTranslationCatalogEntry,fullTranslationDocument,fullTranslationPageAt}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const source={id:'s-book',sha256:'a'.repeat(64),pages:2};
const entry={referenceId:'ref-1',sourceId:source.id,sourceSha256:source.sha256,pageCount:2,asset:`translations/${source.sha256}/pages.json`,translatedPages:[2,1],status:'machine-translated'};
const document={sourceId:source.id,sourceSha256:source.sha256,pageCount:2,translationType:'machine',pages:[{page:2,sourceText:'page two',translationText:'둘째 쪽',status:'translated'},{page:1,sourceText:'page one',translationText:'첫째 쪽',status:'translated'}]};
test('page translations bind to the exact source, count and local asset path',()=>{
 assert.deepEqual(fullTranslationCatalogEntry({schemaVersion:1,entries:[entry]},source).translatedPages,[1,2]);
 assert.equal(fullTranslationCatalogEntry({schemaVersion:1,entries:[{...entry,asset:'https://other.test/pages.json'}]},source),undefined);
 assert.equal(fullTranslationCatalogEntry({schemaVersion:1,entries:[entry]},{...source,sha256:'b'.repeat(64)}),undefined);
 assert.equal(fullTranslationDocument({...document,pageCount:3},source),undefined);
 assert.equal(fullTranslationDocument({...document,sourceSha256:'b'.repeat(64)},source),undefined);
});
test('the same PDF page yields its own translation without shifting over blank or unresolved pages',()=>{
 const result=fullTranslationDocument(document,source);
 assert.equal(fullTranslationPageAt(result,1).translationText,'첫째 쪽');assert.equal(fullTranslationPageAt(result,2).translationText,'둘째 쪽');
 const unresolved=fullTranslationDocument({...document,pages:[{page:1,sourceText:'',translationText:'',status:'ocr-unresolved'},{page:2,sourceText:'',translationText:'',status:'blank'}]},source);
 assert.equal(fullTranslationPageAt(unresolved,1).status,'ocr-unresolved');assert.equal(fullTranslationPageAt(unresolved,2).status,'blank');
 assert.equal(fullTranslationPageAt(result,3),undefined);
 assert.equal(fullTranslationDocument({...document,pages:[document.pages[0],document.pages[0]]},source),undefined);
 assert.equal(fullTranslationDocument({...document,pages:[{...document.pages[0],translationText:''}]},source),undefined);
});
