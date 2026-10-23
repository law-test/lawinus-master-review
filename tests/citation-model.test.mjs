import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {bibliographyPage,citationDatasetMatches,citationPurpose,citationSelectionHighlights,citationTargets,defaultCitationDocumentMode,referenceCitationUses,referenceLabel,referencePdf,referencesForCitation,resolveCitationSelection,sourcePageLabel,verifiedReferenceUrl} from '../src/citation-model.ts';
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
test('a sentence click collects all its references while a direct author-year click stays specific',()=>{
  const common={page:4,matchStatus:'matched',sentenceId:'sentence-example',sentenceText:'앞선 연구(가, 2024)와 다른 연구(나, 2025)를 함께 살핀다.',sentenceRegions:[{page:4,rects:[[40,90,450,104],[40,115,190,129]]}],sentenceReferenceIds:['ref-a','ref-b'],relatedCitationIds:['cite-a','cite-b']};
  const first={...common,id:'cite-a',text:'(가, 2024)',rects:[[100,90,150,104]],referenceIds:['ref-a']};
  const second={...common,id:'cite-b',text:'(나, 2025)',rects:[[230,90,280,104]],referenceIds:['ref-b']};
  const citations=[first,second],targets=citationTargets(citations,true,44);
  assert.equal(targets.filter(target=>target.kind==='citation-sentence').length,2,'shared sentence lines must not be duplicated');
  assert.equal(targetAt(targets,60,96)?.noteId,'sentence-example');
  assert.equal(targetAt(targets,120,96)?.noteId,'cite-a');
  assert.equal(targetAt(targets,250,96)?.noteId,'cite-b');
  assert.equal(targetAt(targets,250,120),undefined,'blank remainder of the last line remains inert');
  assert.equal(targetAt(targets,120,109),undefined,'line gaps remain inert');
  assert.equal(resolveCitationSelection('cite-a',citations),first,'direct citation selection keeps original text and references');
  const selected=resolveCitationSelection('sentence-example',citations);
  assert.equal(selected.selectionKind,'sentence');assert.equal(selected.text,common.sentenceText);assert.deepEqual(selected.referenceIds,['ref-a','ref-b']);
  assert.equal(resolveCitationSelection('missing',citations),undefined);
});
test('cross-page sentence targets and persistent highlights preserve each page independently',()=>{
  const citation={id:'cross',page:5,text:'(나, 2025)',rects:[[200,50,260,63]],referenceIds:['ref-b'],matchStatus:'matched',sentenceId:'cross-sentence',sentenceText:'이 문장은 다음 쪽까지 이어진다(나, 2025).',sentenceRegions:[{page:4,rects:[[80,650,400,663]]},{page:5,rects:[[40,50,280,63]]}],sentenceReferenceIds:['ref-b']};
  const targets=citationTargets([citation],true,44);
  assert.equal(targetAt(targets.filter(target=>target.page===4),150,656)?.noteId,'cross-sentence');
  assert.equal(targetAt(targets.filter(target=>target.page===5),100,56)?.noteId,'cross-sentence');
  assert.equal(targetAt(targets.filter(target=>target.page===5),220,56)?.noteId,'cross');
  const selection=resolveCitationSelection('cross-sentence',[citation]);
  assert.deepEqual(citationSelectionHighlights(selection),[{page:4,rect:[80,650,400,663]},{page:5,rect:[40,50,280,63]}]);
  assert.deepEqual(citationSelectionHighlights(citation),[{page:5,rect:[200,50,260,63]}]);
});
test('direct citations win overlaps even when a sentence segment has a smaller area',()=>{
  const sentence={page:1,rect:[110,50,135,61],noteId:'sentence',kind:'citation-sentence'};
  const direct={page:1,rect:[100,49,140,63],noteId:'citation',kind:'author-year'};
  assert.equal(targetAt([sentence,direct],120,55)?.noteId,'citation');
  assert.equal(targetAt([direct,sentence],120,55)?.noteId,'citation');
});

test('static citation purposes follow the selected reference and fall back only to that sentence summary',()=>{
  const purposes={'sentence-one':{summary:' 문장 전체의 취지 ',referencePurposes:{a:' 문헌 가의 취지 ',b:' '}}};
  const direct={id:'cite-one',sentenceId:'sentence-one'};
  assert.equal(citationPurpose(direct,'a',purposes),'문헌 가의 취지');
  assert.equal(citationPurpose(direct,'b',purposes),'문장 전체의 취지');
  assert.equal(citationPurpose({id:'sentence-one',selectionKind:'sentence'},'a',purposes),'문헌 가의 취지');
  assert.equal(citationPurpose({id:'other',sentenceId:'missing'},'a',purposes),undefined);
  assert.equal(citationPurpose({...direct,selectionKind:'bibliography'},'a',purposes),undefined);
});

test('reference uses deduplicate a shared sentence, retain cross-page links, and avoid unrelated purposes',()=>{
  const citations=[
    {id:'cite-two',page:8,text:'나',referenceIds:['b'],sentenceId:'sentence-two',sentenceText:'나의 문장'},
    {id:'cite-one-a',page:5,text:'가',referenceIds:['a'],sentenceId:'sentence-one',sentenceText:'가와 나의 문장',sentenceRegions:[{page:4,rects:[]},{page:5,rects:[]}]},
    {id:'cite-one-b',page:5,text:'가와 나',referenceIds:['a','b'],sentenceId:'sentence-one',sentenceText:'가와 나의 문장',sentenceRegions:[{page:4,rects:[]},{page:5,rects:[]}]},
  ];
  const purposes={'sentence-one':{summary:'함께 쓰인 이유',referencePurposes:{a:'가를 쓴 이유'}},'sentence-two':{summary:'나를 쓴 이유'}};
  const uses=referenceCitationUses('a',citations,purposes);
  assert.deepEqual(uses,[{id:'sentence-one',sentenceText:'가와 나의 문장',pages:[4,5],purpose:'가를 쓴 이유'}]);
  assert.deepEqual(referenceCitationUses('b',citations,purposes).map(use=>use.id),['sentence-one','sentence-two']);
  assert.deepEqual(referenceCitationUses('uncited',citations,purposes),[],'a bibliography-only entry must not receive an invented purpose');
});

test('a verified HTTPS page is the default only when no registered PDF is available',()=>{
  const reference={id:'reference',sourceUrl:'https://example.edu/source',verifiedSource:true};
  assert.equal(defaultCitationDocumentMode(reference,[]),'web');
  assert.equal(defaultCitationDocumentMode(reference,[{id:'s-reference',referenceId:'reference',pages:10}]),'source');
  assert.equal(defaultCitationDocumentMode({...reference,verifiedSource:false},[]),'bibliography');
  assert.equal(defaultCitationDocumentMode({...reference,sourceUrl:'javascript:alert(1)'},[]),'bibliography');
  assert.equal(defaultCitationDocumentMode(undefined,[]),'bibliography');
});

test('excerpt page labels use exact verified page-map rows without inventing citation pages or offsets',()=>{
  const source={pageMap:[{page:1,originalPage:405},{page:2,originalPage:411},{page:3,originalPage:0}]};
  assert.equal(sourcePageLabel(source,1),'발췌 1쪽 · 원본 PDF 405쪽');
  assert.equal(sourcePageLabel(source,2),'발췌 2쪽 · 원본 PDF 411쪽');
  assert.equal(sourcePageLabel(source,3),'PDF 3쪽');
  assert.equal(sourcePageLabel(source,4),'PDF 4쪽');
  assert.equal(sourcePageLabel(undefined,1),'PDF 1쪽');
});
