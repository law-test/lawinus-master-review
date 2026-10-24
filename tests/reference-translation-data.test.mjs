import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'));
const translations=read('reference-translations.json');
const citations=read('citation-data.json');
const evidence=read('citation-evidence.json');
const sources=read('reference-sources.json');

test('bilingual titles cover the 31 foreign-language originals without altering bibliography identity',()=>{
  const foreign=citations.references.filter(reference=>/[A-Za-z]/.test(reference.title)&&!/[가-힣]/.test(reference.title));
  assert.equal(foreign.length,31);
  assert.equal(translations.titles.length,31);
  assert.equal(new Set(translations.titles.map(item=>item.referenceId)).size,31);
  assert.deepEqual(translations.titles.map(item=>item.referenceId).sort(),foreign.map(item=>item.id).sort());
  for(const item of translations.titles){
    const reference=citations.references.find(reference=>reference.id===item.referenceId);
    assert.equal(item.original,reference.title,item.referenceId);
    assert.match(item.korean,/[가-힣]/,item.referenceId);
  }
  assert.equal(translations.meta.label,'열람용 번역');
  assert.equal(translations.meta.thesisSha256,citations.meta.pdfSha256);
  assert.equal(translations.meta.thesisSha256,evidence.meta.thesisSha256);
});

test('every translated excerpt is pinned to its current source hash and verified page',()=>{
  assert.equal(translations.excerpts.length,11);
  assert.equal(new Set(translations.excerpts.map(item=>item.id)).size,11);
  for(const item of translations.excerpts){
    const source=sources.find(source=>source.id===item.sourceId);
    assert.ok(source,item.id);
    assert.equal(source.referenceId,item.referenceId,item.id);
    assert.equal(source.sha256,item.sourceSha256,item.id);
    assert.match(item.sourceSha256,/^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(item.page)&&item.page>=1&&item.page<=source.pages,item.id);
    assert.ok(item.original.trim().length>0,item.id);
    assert.match(item.korean,/[가-힣]/,item.id);
    assert.ok(item.sentenceIds.length>0,item.id);
    assert.equal(new Set(item.sentenceIds).size,item.sentenceIds.length,item.id);
    for(const sentenceId of item.sentenceIds){
      const match=evidence.entries.find(entry=>entry.sentenceId===sentenceId&&entry.referenceId===item.referenceId&&entry.sourceId===item.sourceId&&entry.sourceSha256===item.sourceSha256);
      assert.ok(match,`${item.id}: ${sentenceId}`);
      assert.ok(match.locators.some(locator=>locator.page===item.page&&locator.printed===item.printed),`${item.id}: ${sentenceId} page`);
      assert.ok(citations.citations.some(citation=>citation.sentenceId===sentenceId&&citation.referenceIds.includes(item.referenceId)),`${item.id}: ${sentenceId} citation`);
    }
  }
});
