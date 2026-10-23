import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {coveredPageCount,readingStatus,revisionsForSelection,validRevisions} from '../src/review-records-model.ts';
const read=name=>JSON.parse(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'));
const records=read('review-records.json'),citations=read('citation-data.json'),updates=read('reading-updates.json'),sha=citations.meta.pdfSha256;
test('approved revisions retain 32 paragraphs, 49 individual checks, and 77 separate reading records',()=>{
 assert.equal(validRevisions(records,sha,44).length,32);assert.equal(records.assessments.length,49);assert.equal(records.readingBaseline.length,77);
 assert.ok(!records.revisions.some(item=>item.id==='B109'));
 assert.ok(records.revisions.every(item=>item.status==='proposed'));
 assert.ok(!JSON.stringify(records).includes('C:\\'),'published review data must not expose local file paths');
});
test('a correction is attached to its exact sentence and reference, never simply to the same page',()=>{
 const citation=citations.citations.find(c=>c.sentenceId==='sentence-001');
 assert.equal(revisionsForSelection(citation,'ref-035',records,sha)[0]?.id,'B003');
 assert.equal(revisionsForSelection({...citation,sentenceId:'unknown'},'ref-035',records,sha).length,0);
 assert.equal(revisionsForSelection(citation,'ref-077',records,sha).length,0);
 assert.equal(revisionsForSelection(citation,'ref-035',records,'0'.repeat(64)).length,0);
 assert.equal(validRevisions(records,'0'.repeat(64),44).length,0);
});
test('all revision mappings reference real sentences and bibliography entries',()=>{
 const sentenceIds=new Set(citations.citations.map(c=>c.sentenceId)),referenceIds=new Set(citations.references.map(r=>r.id));
 for(const revision of records.revisions){for(const id of revision.sentenceIds)assert.ok(sentenceIds.has(id));for(const id of revision.referenceIds)assert.ok(referenceIds.has(id));}
});
test('overlapping reading ranges cannot inflate whole-book coverage and invalid pages are rejected',()=>{
 assert.equal(coveredPageCount([[1,4],[2,5],[8,10]],10),8);
 assert.equal(coveredPageCount([[1,4],[5,10],[1,10]],10),10);
 assert.equal(coveredPageCount([[0,10],[1,11],[7,6]],10),0);
});
test('whole-book completion requires an explicit assertion and complete valid page coverage',()=>{
 const entry={referenceId:'ref-001',sourceSha256:'a'.repeat(64),totalPages:10,readRanges:[[1,10]],wholeBookRead:false,findings:[]};
 const data={meta:{thesisSha256:sha},entries:[entry]};
 assert.equal(readingStatus('ref-001',records,data,sha).complete,false);
 entry.wholeBookRead=true;assert.equal(readingStatus('ref-001',records,data,sha).complete,true);
 entry.readRanges=[[1,5],[7,10]];assert.equal(readingStatus('ref-001',records,data,sha).complete,false);
 entry.readRanges=[[1,10]];entry.sourceSha256='invalid';assert.equal(readingStatus('ref-001',records,data,sha).complete,false);
});
test('previous completion labels and a different thesis cannot become new whole-book completion',()=>{
 const baseline={...records,readingBaseline:[{referenceId:'ref-001',complete:true,scope:'기존 전문독해',finding:'이전 확인'}]};
 assert.equal(readingStatus('ref-001',baseline,{meta:{thesisSha256:sha},entries:[]},sha).complete,false);
 assert.equal(readingStatus('ref-001',records,updates,'0'.repeat(64)).complete,false);
});

test('chapter coverage is checked against its declared unit and never described as a whole book',()=>{
 const entry={referenceId:'ref-001',sourceSha256:'a'.repeat(64),scopeKind:'chapter',scopeLabel:'편저의 인용 장',totalPages:548,readRanges:[[432,441]],citedUnitRanges:[[432,441]],citedUnitComplete:true,wholeBookRead:true,findings:[]};
 const data={meta:{thesisSha256:sha},entries:[entry]};
 let status=readingStatus('ref-001',records,data,sha);
 assert.equal(status.complete,true);assert.equal(status.newWholeBookRead,false);assert.equal(status.label,'인용 장 독해 확인');assert.match(status.scope,/독해한 원문 PDF 432–441/);
 entry.readRanges=[[431,440]];status=readingStatus('ref-001',records,data,sha);assert.equal(status.complete,false);
 entry.readRanges=[[432,441]];delete entry.citedUnitRanges;assert.equal(readingStatus('ref-001',records,data,sha).complete,false);
});
test('article and online units use their own scope and HTTPS identity',()=>{
 const entry={referenceId:'ref-001',sourceSha256:'a'.repeat(64),scopeKind:'article',totalPages:10,readRanges:[[1,10]],citedUnitComplete:true,wholeBookRead:false,findings:[]};
 const data={meta:{thesisSha256:sha},entries:[entry]};
 assert.equal(readingStatus('ref-001',records,data,sha).label,'논문 전문 독해 확인');
 Object.assign(entry,{scopeKind:'law',sourceSha256:'',sourceUrl:'https://example.org/law',totalPages:0,readRanges:[]});
 assert.equal(readingStatus('ref-001',records,data,sha).label,'인용 조문 확인');
 assert.equal(readingStatus('ref-001',records,data,sha).newWholeBookRead,false);
 entry.scopeKind='web';assert.equal(readingStatus('ref-001',records,data,sha).complete,true);
 entry.sourceUrl='https://user:secret@example.org/law';assert.equal(readingStatus('ref-001',records,data,sha).complete,false);
 entry.sourceUrl='javascript:alert(1)';assert.equal(readingStatus('ref-001',records,data,sha).complete,false);
});
test('verified prior reading has explicit provenance but is not reported as new whole-book reading',()=>{
 const entry={referenceId:'ref-001',sourceSha256:'a'.repeat(64),scopeKind:'book',totalPages:10,readRanges:[[1,10]],wholeBookRead:true,findings:[],previousVerified:{record:'P486 독립 검수 기록'}};
 const status=readingStatus('ref-001',records,{meta:{thesisSha256:sha},entries:[entry]},sha);
 assert.equal(status.citedUnitComplete,true);assert.equal(status.complete,false);assert.equal(status.newWholeBookRead,false);assert.equal(status.previousVerified,true);assert.match(status.label,/이전.*승계/);
});

test('published audit distinguishes 42 new units, 30 inherited units and five unavailable works',()=>{
 assert.equal(updates.entries.length,77);
 const statuses=updates.entries.map(e=>({id:e.referenceId,...readingStatus(e.referenceId,records,updates,sha)}));
 assert.equal(statuses.filter(s=>s.complete).length,42);
 assert.equal(statuses.filter(s=>s.previousVerified&&s.citedUnitComplete).length,30);
 assert.deepEqual(statuses.filter(s=>!s.citedUnitComplete).map(s=>s.id),['ref-039','ref-045','ref-053','ref-054','ref-055']);
 assert.ok(!/[CD]:[\\/]/.test(JSON.stringify(updates)),'reading records must not expose local paths');
 for(const id of ['ref-002','ref-013','ref-049','ref-059','ref-060','ref-063','ref-073','ref-074','ref-075','ref-076','ref-077'])assert.equal(statuses.find(s=>s.id===id).newWholeBookRead,false);
});

test('an unavailable article may identify its official URL without claiming a full read',()=>{
 const entry={referenceId:'ref-054',sourceSha256:'',sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/30412233/',scopeKind:'article',totalPages:0,readRanges:[],wholeBookRead:false,citedUnitComplete:false,findings:[]};
 const result=readingStatus('ref-054',records,{meta:{thesisSha256:sha},entries:[entry]},sha);
 assert.equal(result.label,'논문 전문 독해 미완료');assert.equal(result.complete,false);
});
