import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { validateReviewConfig, csvCell, renderNotesExport } from '../src/review-api.ts';

const config = { supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabasePublishableKey: 'sb_publishable_fixture', storageBucket: 'paper-review-documents', datasetId: 'human-1021-1559' };
const note = { id:'12345678-1234-1234-1234-123456789012',datasetId:'human-1021-1559',anchorType:'footnote',page:183,noteId:'fn-192',sourceId:'s-source',x:null,y:null,text:'법리 재검토',quote:'인용 구절',visibility:'private',status:'open',revision:1,displayName:'방문자 000001',createdAt:'2026-10-23T00:00:00Z',updatedAt:'2026-10-23T00:00:00Z',editable:true };
test('config accepts only an HTTPS Supabase project and public key',()=>{
  assert.deepEqual(validateReviewConfig(config),config);
  assert.equal(validateReviewConfig({...config,supabaseUrl:config.supabaseUrl+'/'}).supabaseUrl,config.supabaseUrl);
  for (const url of ['http://example.com','https://example.com','https://abc.supabase.co.evil.test']) assert.throws(()=>validateReviewConfig({...config,supabaseUrl:url}));
  for (const key of ['sb_secret_fixture','placeholder','']) assert.throws(()=>validateReviewConfig({...config,supabasePublishableKey:key}));
  for (const datasetId of ['../other','human/other','']) assert.throws(()=>validateReviewConfig({...config,datasetId}));
});
test('legacy anon JWT is allowed but legacy service_role JWT is refused',()=>{
  const key = role => `e30.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
  assert.equal(validateReviewConfig({...config,supabasePublishableKey:key('anon')}).supabasePublishableKey,key('anon'));
  assert.throws(()=>validateReviewConfig({...config,supabasePublishableKey:key('service_role')}));
});
test('CSV protects formula-looking values, quotes and Korean line breaks',()=>{
  for(const value of ['=1+2','+1','-2','@SUM(1)','  =CMD()','\ttext','\ntext','\u0001+1']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('정상 "문장"'),'"정상 ""문장"""');
  assert.equal(csvCell(null),'""');
});
test('exports retain baseline, note, PDF page, source and selected passage',()=>{
  const md=renderNotesExport([note],'md',config.datasetId);
  assert.match(md.text,/PDF 183쪽/);assert.match(md.text,/본문 인용 fn-192/);assert.match(md.text,/human-1021-1559/);assert.match(md.text,/s-source/);assert.match(md.text,/> 인용 구절/);
  const csv=renderNotesExport([note],'csv',config.datasetId);assert.ok(csv.text.startsWith('\ufeff'));assert.match(csv.text,/"183"/);
  const json=JSON.parse(renderNotesExport([note],'json',config.datasetId).text);assert.equal(json.datasetId,config.datasetId);assert.equal(json.notes[0].id,note.id);assert.equal(json.notes[0].visibility,'private');
});
test('exports refuse more than 20,000 rows instead of silently truncating',()=>{
  assert.throws(()=>renderNotesExport(Array(20001).fill(note),'json',config.datasetId),/20,000/);
  assert.throws(()=>renderNotesExport([note],'html',config.datasetId),/지원하지/);
});

