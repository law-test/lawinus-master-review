import test from 'node:test';
import assert from 'node:assert/strict';
import {publicConfig} from '../scripts/write-config.mjs';
const url='https://exampleproject.supabase.co';
test('관리자 키를 배포 설정으로 사용하지 않는다',()=>{
  assert.throws(()=>publicConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'}));
  const jwt='x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.y';
  assert.throws(()=>publicConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:jwt}));
});
test('빈 설정이나 임의 목적지를 배포하지 않는다',()=>{
  assert.throws(()=>publicConfig({}));
  assert.throws(()=>publicConfig({SUPABASE_URL:'https://other.example',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}));
});
test('공개 설정은 논문 데이터셋과 독립 Storage를 지정한다',()=>{
  const c=publicConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'});
  assert.equal(c.storageBucket,'master-review-documents');assert.equal(c.datasetId,'master-20261024-attached');
});
