import assert from 'node:assert/strict';
import {test} from 'node:test';
import {capturePdfReadingPosition,readPdfReadingPosition,restorePdfReadingPosition,writePdfReadingPosition,createPdfRuntimeCache,pageLayout,pdfCanvasSize,pendingPdfReflow,targetAt,targetLabel,targetHint} from '../src/pdf-viewer-model.ts';
import {requestedPdfPage,steppedPdfZoom} from '../src/pdf-quick-tools-model.ts';
import {pageProposalMarkers,placeProposalMarkers} from '../src/proposal-indicators.ts';

const store=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};

test('master reading position survives menu resize without sharing a different document or edition',()=>{
 const storage=store(),sizes={4:{width:595,height:842},5:{width:595,height:842}};
 const original=pageLayout(44,570,1.25,sizes),top=original.offsets[3]+original.heights[3]*.6+18;
 const captured=capturePdfReadingPosition('master:thesis:sha-a',original,top,40,4,1.25,sizes);
 assert.ok(captured);assert.equal(writePdfReadingPosition(storage,captured),true);
 const read=readPdfReadingPosition(storage,'master:thesis:sha-a',44);assert.ok(read);
 const same=restorePdfReadingPosition(read,original);assert.equal(same.top,top);assert.equal(same.left,40);
 const resized=pageLayout(44,900,1,sizes),restored=restorePdfReadingPosition(read,resized);
 assert.ok(Math.abs((restored.top-18-resized.offsets[3])/resized.heights[3]-.6)<1e-9);
 assert.equal(restored.page,4);
 assert.equal(readPdfReadingPosition(storage,'master:presentation:sha-a',14),null);
 assert.equal(readPdfReadingPosition(storage,'master:thesis:sha-b',44),null);
 assert.equal(readPdfReadingPosition(storage,'master:thesis:sha-a',45),null);
 assert.equal(restorePdfReadingPosition(read,resized,true),null,'an explicit citation/TOC jump takes precedence over a saved reading position');
});

test('malformed saved positions and storage errors cannot stop a PDF from opening',()=>{
 const storage=store();storage.setItem('lawinus.pdf-reading.v1:master:bad','{broken');
 assert.equal(readPdfReadingPosition(storage,'master:bad',44),null);
 assert.equal(readPdfReadingPosition({getItem(){throw new Error('denied');}},'master:bad',44),null);
 assert.equal(writePdfReadingPosition({setItem(){throw new Error('quota');}},{key:'master:bad'}),false);
 assert.equal(capturePdfReadingPosition('bad key',pageLayout(44,500,1,{}),0,0,4,1,{}),null);
});

test('a failed PDF runtime load can retry and does not invalidate an already loaded document runtime',async()=>{
 const calls=[];const cache=createPdfRuntimeCache(async attempt=>{calls.push(attempt);if(attempt===0)throw new Error('worker blocked');return {generation:attempt};});
 await assert.rejects(cache.get(),/worker blocked/);
 const first=await cache.get();assert.equal(first.generation,1);assert.equal(await cache.get(),first);
 cache.retry();const second=await cache.get();assert.equal(second.generation,2);assert.equal(first.generation,1);
 assert.deepEqual(calls,[0,1,2]);
});

test('large zoom stays within raster memory limits while preserving CSS PDF geometry',()=>{
 const mobile=pdfCanvasSize(2400,3400,3,true),desktop=pdfCanvasSize(2400,3400,3,false);
 assert.ok(mobile.width*mobile.height<=2_000_000);assert.ok(desktop.width*desktop.height<=4_000_000);
 assert.ok(mobile.width<=4096&&mobile.height<=4096);assert.ok(desktop.scale>mobile.scale);
 assert.equal(pdfCanvasSize(600,850,1,false).scale,1);
 const layout=pageLayout(44,600,1,{});assert.equal(pendingPdfReflow(layout,layout,600,600),false);
 assert.equal(pendingPdfReflow(layout,layout,600,700),true,'a resize must not record a transient clamped scroll position');
});

test('author-year and whole-sentence reference links still win over overlapping paragraph revision targets',()=>{
 const paragraph={page:4,noteId:'B001',kind:'paragraph',rect:[40,80,550,200]};
 const sentence={page:4,noteId:'citation-sentence',kind:'citation-sentence',rect:[45,90,500,110]};
 const author={page:4,noteId:'citation-author',kind:'author-year',rect:[380,90,490,110]};
 assert.equal(targetAt([paragraph,sentence,author],400,100).noteId,'citation-author');
 assert.equal(targetAt([paragraph,sentence,author],100,100).noteId,'citation-sentence');
 assert.equal(targetAt([paragraph,sentence,author],100,140).noteId,'B001');
 assert.equal(targetLabel(sentence),'본문 인용 참고문헌 열기');assert.equal(targetHint(sentence),'문장 관련 문헌 보기');
 assert.equal(targetHint(paragraph),'클릭하면 수정안');
});

test('collapsed-menu controls reject empty pages, clamp jumps and bound zoom',()=>{
 assert.equal(requestedPdfPage('',44),null);assert.equal(requestedPdfPage('abc',44),null);
 assert.equal(requestedPdfPage('100',44),44);assert.equal(requestedPdfPage('-3',44),1);assert.equal(requestedPdfPage('4.7',44),4);
 assert.equal(steppedPdfZoom(.7,-1),.7);assert.equal(steppedPdfZoom(2,1),2);assert.equal(steppedPdfZoom(1,1),1.15);
});

test('multi-line revision targets create one margin marker and nearby markers do not cover each other',()=>{
 const indicator={priority:'반드시 수정',tone:'required',shortLabel:'필수',proposalIds:['B001'],primaryProposalId:'B001'};
 const targets=[{page:4,noteId:'B001',kind:'paragraph',rect:[40,100,500,115]},{page:4,noteId:'B001',kind:'paragraph',rect:[40,120,450,135]},{page:4,noteId:'B002',kind:'paragraph',rect:[40,130,450,145]}];
 const markers=pageProposalMarkers(targets,{B001:indicator,B002:{...indicator,proposalIds:['B002'],primaryProposalId:'B002'}});
 assert.equal(markers.length,2);
 const placed=placeProposalMarkers(markers,400,800,24);assert.ok(placed[1].top>=placed[0].top+26);
 assert.deepEqual(placed.map(x=>x.target.rect),[targets[0].rect,targets[2].rect],'only labels move, never evidence-backed rectangles');
});
