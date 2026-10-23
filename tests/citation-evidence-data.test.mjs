import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {citationEvidenceForSelection,referencePdf,resolveCitationSelection} from '../src/citation-model.ts';

const read=name=>JSON.parse(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'));
const data=read('citation-data.json'),evidence=read('citation-evidence.json'),sources=read('reference-sources.json'),history=read('reference-source-history.json');
const pair=(s,r)=>s+'|'+r;
test('every real sentence-reference pair has one explicitly reviewed evidence record',()=>{
  const expected=new Set(data.citations.flatMap(c=>c.referenceIds.map(r=>pair(c.sentenceId,r))));
  const actual=evidence.entries.map(e=>pair(e.sentenceId,e.referenceId));
  assert.equal(actual.length,new Set(actual).size,'duplicate evidence pair');
  assert.deepEqual(new Set(actual),expected);
  assert.equal(evidence.meta.thesisSha256,data.meta.pdfSha256);
});
test('published evidence opens a page in the exact current source and keeps rectangle bounds',()=>{
  for(const entry of evidence.entries){
    assert.ok(['verified','partial','web','unverified'].includes(entry.status));
    if(!entry.locators.length){assert.ok(entry.note?.trim(),pair(entry.sentenceId,entry.referenceId));continue;}
    assert.ok(['verified','partial'].includes(entry.status));
    const source=sources.find(s=>s.referenceId===entry.referenceId);
    assert.ok(source);assert.equal(entry.sourceId,source.id);assert.equal(entry.sourceSha256,source.sha256);
    for(const loc of entry.locators){
      assert.ok(Number.isInteger(loc.page)&&loc.page>=1&&loc.page<=source.pages);
      assert.ok(loc.summary?.trim());
      const size=source.pageSizes.find(p=>p.page===loc.page);assert.ok(size);
      for(const r of loc.rects||[]){assert.equal(r.length,4);assert.ok(r.every(Number.isFinite));assert.ok(r[0]>=0&&r[1]>=0&&r[0]<r[2]&&r[1]<r[3]&&r[2]<=size.width&&r[3]<=size.height,`${entry.referenceId} ${loc.page} ${r}`);}
    }
    const selected=resolveCitationSelection(entry.sentenceId,data.citations);
    const result=citationEvidenceForSelection(selected,entry.referenceId,source,evidence,data.meta.pdfSha256);
    assert.equal(result.locators[0]?.page,entry.locators[0].page);
    if(entry.status==='partial')assert.ok(entry.note?.trim());
  }
});
test('two sentences using the same paper start at distinct directly relevant pages',()=>{
  const source=sources.find(s=>s.referenceId==='ref-061');
  const resolve=id=>citationEvidenceForSelection(resolveCitationSelection(id,data.citations),'ref-061',source,evidence,data.meta.pdfSha256);
  assert.equal(resolve('sentence-108').locators[0].page,4);
  assert.equal(resolve('sentence-109').locators[0].page,5);
});
test('expanded excerpts retain prior source metadata for saved page memos',()=>{
  assert.equal(history.length,4);
  for(const old of history){
    const current=sources.find(s=>s.referenceId===old.referenceId);assert.ok(current);assert.notEqual(current.id,old.id);assert.ok(current.pages>old.pages);
    const ref=data.references.find(r=>r.id===old.referenceId);
    assert.equal(referencePdf(ref,[...sources,...history]).source.id,current.id);
  }
  const source=sources.find(s=>s.referenceId==='ref-072');
  const match=citationEvidenceForSelection(resolveCitationSelection('sentence-128',data.citations),'ref-072',source,evidence,data.meta.pdfSha256);
  assert.equal(match.locators[0].page,31);assert.equal(match.locators[0].printed,'191');
  assert.equal(source.pageMap.find(m=>m.page===31).originalPage,192);
});
