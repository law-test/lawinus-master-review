import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {bibliographyPage,citationDatasetMatches,citationTargets,referenceLabel,referencePdf,referencesForCitation,verifiedReferenceUrl} from '../src/citation-model.ts';
import {movedPointer,normalizedPoint,targetAt,targetLabel} from '../src/pdf-viewer-model.ts';

const data=JSON.parse(readFileSync(new URL('../src/citation-data.json',import.meta.url),'utf8'));
test('links require the same complete thesis hash and page count, not a same-looking filename',()=>{
  assert.equal(citationDatasetMatches(data.meta,data.meta.pdfSha256.toUpperCase(),44),true);
  assert.equal(citationDatasetMatches(data.meta,'0'.repeat(64),44),false);
  assert.equal(citationDatasetMatches(data.meta,data.meta.pdfSha256,43),false);
  assert.equal(citationDatasetMatches(data.meta,undefined,44),false);
  assert.deepEqual(citationTargets(data.citations,false,44),[]);
});
test('author-year targets keep separate line geometry and never invent a footnote number',()=>{
  const citation={id:'example',page:4,text:'(한정란, 2025; 김영화, 2010)',rects:[[50,100,280,112],[50,122,180,134],[50,122,180,134],[9,9,4,4]],referenceIds:['han','kim'],matchStatus:'matched'};
  const targets=citationTargets([citation],true,44);
  assert.equal(targets.length,2);assert.equal(targetAt(targets,150,128)?.noteId,'example');
  assert.equal(targetAt(targets,200,128),undefined);assert.equal(targetAt(targets,150,118),undefined);
  assert.equal(targets[0].number,undefined);assert.match(targetLabel(targets[0]),/한정란, 2025/);assert.doesNotMatch(targetLabel(targets[0]),/각주|undefined/);
});
test('citation hit testing remains in PDF points through zoom, scrolling, and column resizing',()=>{
  const citation={id:'citation',page:4,text:'(한정란, 2025)',rects:[[100,200,170,212]],referenceIds:[],matchStatus:'matched'};
  const target=citationTargets([citation],true,44);
  for(const scale of [.7,1,1.45,2]){
    const box={left:35,top:-280,width:500*scale,height:700*scale};
    const point=normalizedPoint(box.left+135*scale,box.top+206*scale,box);
    assert.equal(targetAt(target,point.x*500,point.y*700)?.noteId,'citation');
  }
  assert.equal(movedPointer({x:100,y:100},103,102),false);
  assert.equal(movedPointer({x:100,y:100},100,125),true,'dragging must not activate a citation');
});
test('multi-reference selection retains citation order, removes duplicates, and omits unconfirmed IDs',()=>{
  const refs=[{id:'a',authors:['가'],year:'2024'},{id:'b',authors:['나'],year:'2025'}];
  const result=referencesForCitation({referenceIds:['b','a','b','missing']},refs);
  assert.deepEqual(result.map(ref=>ref.id),['b','a']);assert.equal(referenceLabel(result[0]),'나(2025)');
});
test('reference buttons use short author-year labels without changing the full bibliography entry',()=>{
  for(const [id,label] of [['ref-054','Johnson 외(2020)'],['ref-058','Markus & Nurius(1986)'],['ref-001','교육부·한국교육개발원(2024)']]){
    const reference=data.references.find(item=>item.id===id),original=JSON.stringify(reference);
    assert.equal(referenceLabel(reference),label);assert.equal(JSON.stringify(reference),original);
  }
});
test('only an exact reference catalog match opens a PDF; missing or invalid sources use the bibliography',()=>{
  const ref={id:'ref-034',bibliographyPage:39};
  const catalog=[{referenceId:'ref-034',id:'s-han',pages:560,targetPage:465,coverage:'전문'}];
  assert.equal(referencePdf(ref,catalog).source.id,'s-han');assert.equal(referencePdf(ref,catalog).page,465);
  assert.equal(referencePdf({id:'ref-035'},catalog),undefined);
  assert.equal(referencePdf(ref,[{...catalog[0],pages:0}]),undefined);
  assert.equal(referencePdf(ref,[{...catalog[0],targetPage:700}]).page,560);
  assert.equal(bibliographyPage(ref,44,37),39);assert.equal(bibliographyPage(undefined,44,37),37);
  assert.equal(bibliographyPage({bibliographyPage:900},44,37),37);
});
test('unverified, malformed, or executable external URLs do not become source links',()=>{
  assert.equal(verifiedReferenceUrl({sourceUrl:'https://example.edu/'}),undefined);
  assert.equal(verifiedReferenceUrl({verifiedSource:true,sourceUrl:'javascript:alert(1)'}),undefined);
  assert.equal(verifiedReferenceUrl({verifiedSource:true,sourceUrl:'http://example.edu/'}),undefined);
  assert.equal(verifiedReferenceUrl({verifiedSource:true,sourceUrl:'https://example.edu/source'}),'https://example.edu/source');
});
test('the attached thesis has the requested Han citation and at least one multi-reference citation',()=>{
  const han=data.citations.find(citation=>citation.text.includes('한정란')&&citation.text.includes('2025'));
  assert.ok(han);const refs=referencesForCitation(han,data.references);assert.ok(refs.some(ref=>ref.authors.includes('한정란')&&ref.year==='2025'));
  assert.ok(data.citations.some(citation=>referencesForCitation(citation,data.references).length>1));
});
