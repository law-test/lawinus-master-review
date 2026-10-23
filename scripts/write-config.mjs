import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export function publicConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw Error('논문용 SUPABASE_URL이 필요합니다.');
  if (!key) throw Error('공개용 SUPABASE_PUBLISHABLE_KEY가 필요합니다.');
  if (key.startsWith('sb_secret_')) throw Error('관리자 키는 공개 설정에 넣을 수 없습니다.');
  if (!key.startsWith('sb_publishable_')) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch {}
    if (payload?.role !== 'anon') throw Error('Supabase publishable 또는 anon 키만 허용합니다.');
  }
  return { supabaseUrl:url, supabasePublishableKey:key, storageBucket:'master-review-documents', datasetId:'master-20261024-attached' };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const settings = publicConfig();
  await mkdir('public', {recursive:true});
  await writeFile('public/config.json', JSON.stringify(settings, null, 2)+'\n');
  console.log('공개 연결 설정을 작성했습니다. 키 값은 출력하지 않습니다.');
}

