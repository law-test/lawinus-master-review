import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {manuscriptParagraphs,manuscriptMeta,paragraphTargets,citationTextParts,effectiveManuscriptEdits} from '../src/master-manuscript-model.ts';
const records=JSON.parse(readFileSync(new URL('../src/review-records.json',import.meta.url),'utf8'));
const citations=JSON.parse(readFileSync(new URL('../src/citation-data.json',import.meta.url),'utf8'));
test('body catalog preserves approved text, all 44 PDF pages, and every 32 proposal anchor',()=>{
 assert.equal(manuscriptMeta.thesisSha256,citations.meta.pdfSha256);
 assert.equal(manuscriptParagraphs.filter(p=>/^B/.test(p.id)).length,139);
 assert.deepEqual([...new Set(manuscriptParagraphs.map(p=>p.page))],Array.from({length:44},(_,i)=>i+1));
 assert.equal(new Set(manuscriptParagraphs.map(p=>p.id)).size,manuscriptParagraphs.length);
 for(const r of records.revisions)assert.equal(manuscriptParagraphs.find(p=>p.id===r.id)?.text,r.before,r.id);
});
test('paragraph PDF click targets require matching original and remain within document geometry',()=>{
 assert.deepEqual(paragraphTargets(false),[]);const targets=paragraphTargets(true);assert.ok(targets.length>1000);
 for(const target of targets){assert.ok(manuscriptParagraphs.some(p=>p.id===target.noteId));assert.ok(target.page>=1&&target.page<=44);const [x,y,x1,y1]=target.rect;assert.ok(x>=0&&y>=0&&x1>x&&y1>y);}
});
test('body inline citation sentences preserve entire text and link only known citations',()=>{
 const ids=new Set(citations.citations.flatMap(c=>[c.id,c.sentenceId]));let count=0;
 for(const p of manuscriptParagraphs){const parts=citationTextParts(p);assert.equal(parts.map(p=>p.text).join(''),p.text);for(const part of parts)if(part.citationId){assert.ok(ids.has(part.citationId));count++;}}
 assert.ok(count>100);const p=manuscriptParagraphs.find(p=>p.id==='B003');assert.ok(citationTextParts(p).some(x=>x.citationId==='sentence-001'&&x.text.includes('20%')));
});
test('edited text never silently inherits the original source context and restored originals remove overrides',()=>{
 const p=manuscriptParagraphs.find(p=>p.id==='B003');const changed=p.text+' 변경';assert.deepEqual(citationTextParts(p,changed),[{text:changed}]);
 assert.deepEqual(effectiveManuscriptEdits({B003:{text:p.text},bogus:{text:'unknown'}}),{});
 assert.deepEqual(effectiveManuscriptEdits({B003:{text:changed}}),{B003:{text:changed}});
});
