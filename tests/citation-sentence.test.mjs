import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const data=JSON.parse(readFileSync(new URL('../src/citation-data.json',import.meta.url),'utf8'));
const citations=new Map(data.citations.map(citation=>[citation.id,citation]));
const sentences=new Map(data.citations.map(citation=>[citation.sentenceId,citation]));
const compact=text=>text.replace(/\s+/g,'');
const contains=(outer,inner)=>outer[0]<=inner[0]+0.02&&outer[1]<=inner[1]+0.02&&outer[2]>=inner[2]-0.02&&outer[3]>=inner[3]-0.02;

test('every attached-thesis author-year occurrence belongs to one complete source sentence',()=>{
  assert.equal(data.meta.pdfSha256,'92b73e8ad50829cd5df52b7b4e40addd8994499be051b663c0286a804938cd2d');
  assert.equal(citations.size,141);
  assert.equal(sentences.size,134);
  for(const citation of citations.values()){
    assert.ok(citation.sentenceId);
    assert.ok(compact(citation.sentenceText).includes(compact(citation.text)),citation.id);
    assert.ok(citation.sentenceText.length>citation.text.length,citation.id);
    assert.ok(citation.relatedCitationIds.includes(citation.id),citation.id);
    const currentRegion=citation.sentenceRegions.find(region=>region.page===citation.page);
    assert.deepEqual(citation.sentenceRects,currentRegion.rects);
    for(const rect of citation.rects)assert.ok(currentRegion.rects.some(outer=>contains(outer,rect)),citation.id);
  }
});

test('citations in one sentence share geometry and an ordered union of their references',()=>{
  for(const sentence of sentences.values()){
    const related=sentence.relatedCitationIds.map(id=>citations.get(id));
    assert.ok(related.every(Boolean));
    assert.deepEqual(sentence.sentenceReferenceIds,[...new Set(related.flatMap(citation=>citation.referenceIds))]);
    for(const citation of related){
      assert.equal(citation.sentenceId,sentence.sentenceId);
      assert.equal(citation.sentenceText,sentence.sentenceText);
      assert.deepEqual(citation.sentenceRegions,sentence.sentenceRegions);
      assert.deepEqual(citation.relatedCitationIds,sentence.relatedCitationIds);
    }
  }
  const fourTheories=citations.get('cite-086');
  assert.deepEqual(fourTheories.relatedCitationIds,['cite-086','cite-087','cite-088','cite-089']);
  assert.deepEqual(fourTheories.sentenceReferenceIds,['ref-044','ref-055','ref-059','ref-052','ref-053']);
});

test('sentence areas cover individual text lines and cannot intercept adjacent sentences or page margins',()=>{
  const rectangles=[];
  for(const sentence of sentences.values()){
    for(const region of sentence.sentenceRegions){
      assert.ok(Number.isInteger(region.page)&&region.page>=4&&region.page<=36);
      for(const rect of region.rects){
        assert.equal(rect.length,4);
        assert.ok(rect.every(Number.isFinite));
        assert.ok(rect[0]>=48&&rect[2]<=450.1&&rect[1]>=76&&rect[3]<640);
        assert.ok(rect[2]>rect[0]&&rect[3]>rect[1]&&rect[3]-rect[1]<13);
        rectangles.push({sentence:sentence.sentenceId,page:region.page,rect});
      }
    }
  }
  for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){
    const a=rectangles[i],b=rectangles[j];
    if(a.page!==b.page||a.sentence===b.sentence)continue;
    const overlapWidth=Math.min(a.rect[2],b.rect[2])-Math.max(a.rect[0],b.rect[0]);
    const overlapHeight=Math.min(a.rect[3],b.rect[3])-Math.max(a.rect[1],b.rect[1]);
    assert.ok(overlapWidth<=0.02||overlapHeight<=0.02,`${a.sentence} overlaps ${b.sentence}`);
  }
});

test('page-spanning sentences retain both pages without swallowing a neighboring sentence',()=>{
  const spanning=[...sentences.values()].filter(sentence=>sentence.sentenceRegions.length>1);
  assert.deepEqual(spanning.map(sentence=>sentence.sentenceRegions.map(region=>region.page)),[[5,6],[6,7],[11,12]]);
  assert.match(citations.get('cite-019').sentenceText,/연구는 본 연구자가 검토한 범위에서 확인하지 못하였다\.$/);
  assert.match(citations.get('cite-025').sentenceText,/이러한 미래의 자기 모습이/);
  assert.match(citations.get('cite-039').sentenceText,/음악 평생교육 경험이 있는 만 65세/);
});

test('decimal points, undated references, quoted questions, and neighboring prose do not split a sentence incorrectly',()=>{
  assert.equal(citations.get('cite-002').sentenceText,'인구 고령화는 사회의 발전 과정에서 나타나는 현상이다(한정란, 2025).');
  assert.match(citations.get('cite-009').sentenceText,/참여율은 15\.4%로, 비교한 비형식교육 다섯 영역 가운데 가장 높다\.$/);
  assert.match(citations.get('cite-028').sentenceText,/뜻한다\(국립국어원, n\.d\.\)\.$/);
  assert.match(citations.get('cite-140').sentenceText,/^질문의 순서보다 참여자의 설명을 우선하며, “그때 어떤 일이 있었나요\?”, “그렇게 생각한 계기는 무엇인가요\?”와 같이/);
  assert.match(citations.get('cite-140').sentenceText,/보충질문을 사용한다\(Seidman, 2022\)\.$/);
});
