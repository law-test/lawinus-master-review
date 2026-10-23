import {createClient} from '@supabase/supabase-js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const planPath=process.argv[2];
if(!planPath) throw Error('로컬 upload-plan.private.json 경로가 필요합니다.');
const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||!key) throw Error('논문용 SUPABASE_URL과 비공개 관리용 키를 환경변수로 설정하세요.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket=client.storage.from('master-review-documents');
const plan=JSON.parse(await readFile(planPath,'utf8'));
if(plan.datasetId!=='master-20261024-attached') throw Error('기준 원고를 확인하세요.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const results=[];
for(const item of plan.items){
  if(!/^master-20261024-attached\/(?:human\.pdf|manifest\.json|profile\.json|assets\/s-[a-zA-Z0-9_-]+)$/.test(item.storageKey)) throw Error('허용되지 않은 저장 경로');
  const bytes=await readFile(item.path);
  if(bytes.length!==item.size||hash(bytes)!==item.sha256) throw Error('로컬 자료 변경: '+item.id);
  const uploaded=await bucket.upload(item.storageKey,bytes,{contentType:item.mime,upsert:false,cacheControl:'3600'});
  if(uploaded.error&&!['400','409'].includes(String(uploaded.error.statusCode))) throw Error('자료 업로드 실패: '+item.id+' / '+uploaded.error.message);
  const remote=await bucket.download(item.storageKey);
  if(remote.error||!remote.data) throw Error('업로드 후 원문 확인 실패: '+item.id);
  const verified=Buffer.from(await remote.data.arrayBuffer());
  if(hash(verified)!==item.sha256) throw Error('원격 자료가 다릅니다. 기존 자료는 덮어쓰지 않았습니다: '+item.id);
  results.push({id:item.id,size:verified.length,sha256:item.sha256,status:uploaded.error?'existing-verified':'uploaded-verified'});
  console.log(`${results.length}/${plan.items.length} ${item.id} 검증 완료`);
}
await writeFile(new URL('../work/upload-results.json',import.meta.url),JSON.stringify({datasetId:plan.datasetId,completedAt:new Date().toISOString(),items:results},null,2));
console.log('모든 파일을 원격 해시까지 대조했습니다. 기존 사이트 메모 이전은 별도입니다.');

