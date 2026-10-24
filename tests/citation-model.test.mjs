import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {bibliographyPage,citationDatasetMatches,citationReaderReady,citationEvidenceForSelection,citationPurpose,citationSelectionHighlights,citationTargets,defaultCitationDocumentMode,evidenceLocatorLabel,referenceCitationUses,referenceLabel,referencePdf,referencesForCitation,resolveCitationSelection,sourcePageLabel,verifiedReferenceUrl} from '../src/citation-model.ts';
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
  assert.equal(verifiedReferenceUrl({verifiedSource:true,sourceUrl:'https://user:password@example.edu/'}),undefined);
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

const evidenceThesisHash='a'.repeat(64),evidenceSourceHash='b'.repeat(64);
const evidenceSource={id:'s-evidence',referenceId:'r',pages:20,sha256:evidenceSourceHash,pageSizes:[{page:7,width:500,height:700}]};
const evidenceCitation={id:'cite-one',sentenceId:'sentence-one',referenceIds:['r']};
const evidenceRecord={sentenceId:'sentence-one',referenceId:'r',sourceId:'s-evidence',sourceSha256:evidenceSourceHash,status:'verified',locators:[{page:7,printed:'5',summary:'첫 문장의 근거',rects:[[10,20,110,40]]}]};
const evidenceFixture=entries=>({meta:{thesisSha256:evidenceThesisHash,reviewedAt:'2026-10-24'},entries});

test('evidence is specific to the sentence/reference pair and exact thesis/source fingerprints',()=>{
  const data=evidenceFixture([evidenceRecord,{...evidenceRecord,sentenceId:'sentence-two',locators:[{page:11,summary:'두 번째 문장의 근거'}]}]);
  assert.equal(citationEvidenceForSelection(evidenceCitation,'r',evidenceSource,data,evidenceThesisHash).locators[0].page,7);
  assert.equal(citationEvidenceForSelection({...evidenceCitation,id:'cite-two',sentenceId:'sentence-two'},'r',evidenceSource,data,evidenceThesisHash).locators[0].page,11,'changing the sentence in the same book changes its starting page');
  for(const source of [{...evidenceSource,id:'another-file'},{...evidenceSource,sha256:'c'.repeat(64)},{...evidenceSource,sha256:undefined}])assert.deepEqual(citationEvidenceForSelection(evidenceCitation,'r',source,data,evidenceThesisHash).locators,[]);
  assert.deepEqual(citationEvidenceForSelection(evidenceCitation,'r',evidenceSource,data,'c'.repeat(64)).locators,[]);
  assert.deepEqual(citationEvidenceForSelection(evidenceCitation,'other-ref',evidenceSource,data,evidenceThesisHash).locators,[]);
  assert.deepEqual(citationEvidenceForSelection({...evidenceCitation,sentenceId:'not-reviewed'},'r',evidenceSource,data,evidenceThesisHash).locators,[]);
});

test('out-of-range evidence pages and invalid highlight geometry cannot be applied to the source PDF',()=>{
  const data=evidenceFixture([{...evidenceRecord,locators:[{page:0,summary:'invalid'},{page:21,summary:'invalid'},{page:7,printed:'5',summary:'확인한 문단',rects:[[10,20,110,40],[10,20,110,40],[-1,20,110,40],[10,20,900,40],[10,20,110,900],[5,5,1,1]]}]}]);
  const before=JSON.stringify(data),result=citationEvidenceForSelection(evidenceCitation,'r',evidenceSource,data,evidenceThesisHash);
  assert.equal(result.status,'partial');assert.deepEqual(result.locators.map(locator=>locator.page),[7]);
  assert.deepEqual(result.locators[0].rects,[[10,20,110,40]]);assert.equal(JSON.stringify(data),before);
  assert.equal(evidenceLocatorLabel(result.locators[0]),'본문 p. 5 · PDF 7쪽');assert.equal(evidenceLocatorLabel({page:11}),'PDF 11쪽');
});

test('bibliography selection merges confirmed page locations without losing distinct summaries or partial notes',()=>{
  const data=evidenceFixture([{...evidenceRecord,locators:[{page:11,summary:'둘째 쪽'},{page:7,printed:'5',summary:'첫째 요약',rects:[[10,20,110,40]]}]},{...evidenceRecord,sentenceId:'sentence-two',status:'partial',note:'이 문장 중 정의 부분만 확인했습니다.',locators:[{page:7,printed:'5',summary:'별도의 요약',rects:[[10,20,110,40],[10,60,110,80]]}]}]);
  const direct=citationEvidenceForSelection(evidenceCitation,'r',evidenceSource,data,evidenceThesisHash);assert.equal(direct.locators[0].page,11,'a sentence keeps the reviewed locator order');
  const result=citationEvidenceForSelection({...evidenceCitation,selectionKind:'bibliography'},'r',evidenceSource,data,evidenceThesisHash);
  assert.deepEqual(result.locators.map(locator=>locator.page),[7,11]);assert.equal(result.status,'partial');
  assert.deepEqual(result.locators[0].summaries,['첫째 요약','별도의 요약']);assert.deepEqual(result.locators[0].rects,[[10,20,110,40],[10,60,110,80]]);
  assert.deepEqual(result.locators[0].sentenceIds,['sentence-one','sentence-two']);assert.deepEqual(result.notes,['이 문장 중 정의 부분만 확인했습니다.']);
});

test('unverified and web entries never become PDF page chips, even if locator-like data exists',()=>{
  for(const status of ['unverified','web']){
    const data=evidenceFixture([{...evidenceRecord,status,note:'공식 자료 페이지에서 확인해 주세요.'}]);
    const result=citationEvidenceForSelection(evidenceCitation,'r',evidenceSource,data,evidenceThesisHash);
    assert.deepEqual(result.locators,[]);assert.deepEqual(result.notes,['공식 자료 페이지에서 확인해 주세요.']);
  }
  assert.equal(citationEvidenceForSelection(evidenceCitation,'r',undefined,evidenceFixture([{...evidenceRecord,status:'web'}]),evidenceThesisHash).status,'web');
});

test('web evidence URLs require a matching thesis, sentence and selected reference',()=>{
  const record={sentenceId:'sentence-one',referenceId:'r',status:'web',locators:[],sourceUrl:'https://example.edu/evidence',sourceLabel:' 공식 초록 '};
  const fixture=evidenceFixture([record,{...record,sentenceId:'sentence-two',sourceUrl:'https://example.edu/other'}]);
  const resolve=(citation=evidenceCitation,ref='r',hash=evidenceThesisHash)=>citationEvidenceForSelection(citation,ref,undefined,fixture,hash);
  assert.deepEqual(resolve().webSources,[{url:record.sourceUrl,label:'공식 초록'}]);
  assert.deepEqual(resolve(evidenceCitation,'r','c'.repeat(64)).webSources,[]);
  assert.deepEqual(resolve(evidenceCitation,'other').webSources,[]);
  assert.deepEqual(resolve({...evidenceCitation,sentenceId:'missing'}).webSources,[]);
  assert.deepEqual(resolve({...evidenceCitation,referenceIds:['different']}).webSources,[]);
});

test('unverified, credential-bearing and unsafe evidence URLs cannot reach the embedded browser',()=>{
  const record={sentenceId:'sentence-one',referenceId:'r',status:'web',locators:[],sourceLabel:'검토 자료'};
  for(const sourceUrl of ['javascript:alert(1)','data:text/html,test','http://example.edu/','not a URL','https://user@example.edu/','https://:secret@example.edu/','https://user:secret@example.edu/']){
    const result=citationEvidenceForSelection(evidenceCitation,'r',undefined,evidenceFixture([{...record,sourceUrl}]),evidenceThesisHash);
    assert.deepEqual(result.webSources,[],sourceUrl);
  }
  const result=citationEvidenceForSelection(evidenceCitation,'r',undefined,evidenceFixture([{...record,status:'unverified',sourceUrl:'https://example.edu/unconfirmed'}]),evidenceThesisHash);
  assert.deepEqual(result.webSources,[]);
});

test('partial evidence confirmed on a web page retains its limitation without requiring a PDF',()=>{
  const record={sentenceId:'sentence-one',referenceId:'r',status:'partial',locators:[],sourceUrl:'https://example.edu/abstract',sourceLabel:'공식 초록',note:'양적 결과만 확인했으며 연구자의 비교 해석까지 검증한 것은 아니다.'};
  const result=citationEvidenceForSelection(evidenceCitation,'r',undefined,evidenceFixture([record]),evidenceThesisHash);
  assert.equal(result.status,'partial');assert.equal(result.reason,undefined);assert.deepEqual(result.locators,[]);
  assert.deepEqual(result.notes,[record.note]);assert.deepEqual(result.webSources,[{url:record.sourceUrl,label:record.sourceLabel}]);
  assert.equal(defaultCitationDocumentMode({id:'r'},[],result.webSources),'web','an evidence-only URL must open inside the panel');
  assert.equal(defaultCitationDocumentMode({id:'r'},[evidenceSource],result.webSources),'source','registered PDFs retain priority');
});

test('bibliography web evidence combines reviewed sentences and deduplicates only the same URL',()=>{
  const record={sentenceId:'sentence-one',referenceId:'r',status:'web',locators:[],sourceUrl:'https://example.edu/abstract',sourceLabel:'공식 초록'};
  const fixture=evidenceFixture([record,{...record,sentenceId:'sentence-two',status:'partial',note:'초록 일부만 확인'},{...record,sentenceId:'sentence-three',sourceUrl:'https://example.edu/methods',sourceLabel:'연구 방법'},{...record,referenceId:'other',sourceUrl:'https://other.edu/'}]);
  const result=citationEvidenceForSelection({...evidenceCitation,selectionKind:'bibliography'},'r',undefined,fixture,evidenceThesisHash);
  assert.equal(result.status,'partial');assert.deepEqual(result.webSources,[{url:record.sourceUrl,label:record.sourceLabel},{url:'https://example.edu/methods',label:'연구 방법'}]);
  assert.deepEqual(result.locators,[]);assert.deepEqual(result.notes,['초록 일부만 확인']);
});

test('adding a reviewed web link does not alter verified PDF evidence or its starting page',()=>{
  const result=citationEvidenceForSelection(evidenceCitation,'r',evidenceSource,evidenceFixture([{...evidenceRecord,sourceUrl:'https://example.edu/source'}]),evidenceThesisHash);
  assert.equal(result.status,'verified');assert.equal(result.locators[0].page,7);assert.deepEqual(result.locators[0].rects,[[10,20,110,40]]);
  assert.deepEqual(result.webSources,[{url:'https://example.edu/source',label:'확인한 근거 페이지'}]);
});

test('reviewed Korean evidence and publisher full text expose their confirmed locations',()=>{
  const evidence=JSON.parse(readFileSync(new URL('../src/citation-evidence.json',import.meta.url),'utf8'));
  const sources=JSON.parse(readFileSync(new URL('../src/reference-sources.json',import.meta.url),'utf8'));
  for(const [sentenceId,referenceId,host,status] of [['sentence-025','ref-002','www.korean.go.kr','web'],['sentence-058','ref-011','www.kci.go.kr','web'],['sentence-062','ref-013','arte365.kr','web'],['sentence-012','ref-054','oup.silverchair-cdn.com','partial']]){
    const citation=resolveCitationSelection(sentenceId,data.citations),reference=data.references.find(reference=>reference.id===referenceId);
    const result=citationEvidenceForSelection(citation,referenceId,referencePdf(reference,sources)?.source,evidence,data.meta.pdfSha256);
    assert.equal(result.status,status);assert.equal(new URL(result.webSources[0].url).hostname,host);assert.deepEqual(result.locators,[]);
  }
});


test('a restored text reader opens its citations before the PDF mounts, without weakening source matching',()=>{
 const body=JSON.parse(readFileSync(new URL('../src/master-manuscript-data.json',import.meta.url),'utf8'));
 const loadedMatches=citationDatasetMatches(data.meta,data.meta.pdfSha256,data.meta.pageCount);
 const bodyMatches=citationDatasetMatches(data.meta,body.meta.thesisSha256,body.meta.pageCount);
 assert.equal(citationReaderReady('text',loadedMatches,'checking',bodyMatches),true);
 assert.equal(citationReaderReady('text',loadedMatches,'unavailable',bodyMatches),true);
 const paragraph=body.paragraphs.find(p=>p.text.includes('Jarvis(2009)는 학습의 정의에 의미를 명시적으로 포함하여'));
 assert.ok(paragraph?.citationIds.length);
 assert.ok(paragraph.citationIds.some(id=>resolveCitationSelection(id,data.citations)?.referenceIds.includes('ref-053')));
 assert.equal(citationReaderReady('text',false,'verified',true),false);
 assert.equal(citationReaderReady('text',true,'verified',citationDatasetMatches(data.meta,'0'.repeat(64),body.meta.pageCount)),false);
 assert.equal(citationReaderReady('text',true,'verified',citationDatasetMatches(data.meta,body.meta.thesisSha256,43)),false);
 for(const status of ['checking','unavailable','mismatch'])assert.equal(citationReaderReady('pdf',true,status,true),false);
 assert.equal(citationReaderReady('pdf',true,'verified',false),true);
});
