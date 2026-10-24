import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

// Independent execution of the actual migration in an isolated PostgreSQL WASM database.
// It validates SQL/ACL semantics, not hosted Auth or concurrent connections.
test('Master shared editing preserves private notes and paper while enforcing catalog/CAS/append-only boundaries',async t=>{
 const db=new PGlite(),dataset='master-20261024-attached';
 const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',missing='10000000-0000-4000-8000-000000000099';
 const call=async(name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;
 const actor=async(role,id=null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,...(id?{sub:id}:{})})]);await db.exec(`set role ${role}`);};
 const reject=async(promise,code)=>assert.rejects(promise,error=>{assert.equal(error.code,code);return true;});
 const save=(id,revision,text,reason='',restore=null,ds=dataset,kind='paragraph')=>call('master_review_shared_save',[ds,kind,id,revision,text,reason,restore]);
 const original=JSON.parse(await readFile(new URL('../src/master-manuscript-data.json',import.meta.url),'utf8'));
 const target=original.paragraphs.find(p=>p.id==='B001'),other=original.paragraphs.find(p=>p.id==='B002');
 assert.ok(target&&other);
 const migration=await readFile(new URL('../supabase/migrations/20261024020723_master_shared_editing.sql',import.meta.url),'utf8');
 let oldPrivate;
 const snapshot=async()=>(await db.query(`select jsonb_build_object(
  'existingFunctions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'def',pg_get_functiondef(p.oid),'acl',p.proacl::text) order by n.nspname,p.proname)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and (p.proname like 'paper_review_%' or (p.proname like 'master_review_%' and p.proname not like 'master_review_shared_%'))) or (n.nspname='master_review_private' and p.proname in ('validate_input','public_note','list_notes','create_note','update_note','delete_note'))),
  'paperData',(select jsonb_agg(to_jsonb(n) order by id) from public.paper_review_notes n),
  'notes',(select jsonb_agg(to_jsonb(n) order by id) from master_review_private.notes n),
  'notesAcl',(select relacl::text from pg_class where oid='master_review_private.notes'::regclass),
  'buckets',(select jsonb_agg(to_jsonb(b) order by id) from storage.buckets b)
 ) as result`)).rows[0].result;
 try{
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
   create schema auth;create table auth.users(id uuid primary key,aud text,role text,email text,is_anonymous boolean);
   create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
   grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
   create schema storage;create table storage.buckets(id text primary key,name text not null,public boolean not null default false);
   insert into auth.users(id,is_anonymous) values('${a}',true),('${b}',true);`);
  await db.exec(await readFile(new URL('./fixtures/paper-baseline.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/002_master_review.sql',import.meta.url),'utf8'));
  await db.query(`insert into public.paper_review_notes(id,dataset_id,owner_id,display_name,text,visibility) values('20000000-0000-4000-8000-000000000001','human-1021-1559',$1,'fixture','PAPER SENTINEL','shared')`,[a]);
  await actor('authenticated',a);oldPrivate=(await call('master_review_create_note',[dataset,{text:'PRIVATE SENTINEL',anchorType:'thesis',page:4}])).note.id;
  await actor('postgres');const before=await snapshot();
  await t.test('migration changes only its own objects and is idempotent',async()=>{
   await db.exec(migration);assert.deepEqual(await snapshot(),before);await db.exec(migration);assert.deepEqual(await snapshot(),before);
   const tables=(await db.query(`select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='master_review_private' and c.relname in ('edit_catalog','edit_heads','edit_revisions')`)).rows;
   assert.equal(tables.length,3);assert.ok(tables.every(row=>row.relrowsecurity));
   const wrappers=(await db.query(`select prosecdef,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'master_review_shared_%'`)).rows;
   assert.equal(wrappers.length,5);assert.ok(wrappers.every(row=>!row.prosecdef&&row.proconfig.includes('search_path=""')));
   await db.exec(await readFile(new URL('../supabase/master-shared-catalog.sql',import.meta.url),'utf8'));
   const seeded=(await db.query('select target_id,original_text,original_sha256 from master_review_private.edit_catalog order by target_id')).rows;
   assert.equal(seeded.length,original.paragraphs.length);
   for(const row of seeded){const source=original.paragraphs.find(p=>p.id===row.target_id);assert.equal(row.original_text,source.text);assert.equal(row.original_sha256,createHash('sha256').update(source.text).digest('hex'));}
  });
  await t.test('unauthenticated anon cannot save even with a forged subject, or access tables/admin helpers',async()=>{
   for(const id of [null,a]){await actor('anon',id);await reject(save(target.id,0,'forged write'),'42501');}
   for(const role of ['anon','authenticated']){
    await actor(role,role==='authenticated'?a:null);
    for(const name of ['edit_catalog','edit_heads','edit_revisions','notes'])await reject(db.query(`select * from master_review_private.${name}`),'42501');
    await reject(db.query('select master_review_private.seed_shared_catalog($1,$2)',[dataset,[]]),'42501');
    await reject(db.exec('create table master_review_private.attack(x integer)'),'42501');
   }
   await actor('authenticated');await reject(save(target.id,0,'no user'),'PT401');
   await actor('authenticated',missing);await reject(save(target.id,0,'deleted user'),'PT401');
  });
  await t.test('only catalogued master targets are writable; paper identities and unknown kinds are rejected',async()=>{
   await actor('authenticated',a);
   await reject(save(target.id,0,'cross-site','','', 'human-1021-1559'),'22P02');
   await reject(save(target.id,0,'cross-site','',null,'human-1021-1559'),'PT404');
   for(const id of ['B999','P0281','fn-001','X999999'])await reject(save(id,0,'unknown'),'PT404');
   await reject(save(target.id,0,'wrong kind','',null,dataset,'footnote'),'PT404');
   assert.equal((await call('master_review_shared_list',[dataset])).overrides.length,0);
  });
  await t.test('CAS rejects stale writes and supports collaborative edits without exposing actor UUIDs',async()=>{
   await actor('authenticated',a);const first=(await save(target.id,0,'First revision')).edit;assert.equal(first.revision,1);assert.equal(first.parentRevision,0);
   assert.equal(first.textSha256,createHash('sha256').update('First revision').digest('hex'));
   assert.equal('actor_id' in first||'actorId' in first,false);
   await actor('authenticated',b);await reject(save(target.id,0,'stale'),'PT409');
   const second=(await save(target.id,1,'Second revision')).edit;assert.equal(second.revision,2);assert.equal(second.displayName,'방문자 000002');
   await actor('anon');const list=await call('master_review_shared_list',[dataset]);assert.equal(list.overrides[0].text,'Second revision');
   assert.ok(!JSON.stringify(list).includes('PRIVATE SENTINEL'));assert.ok(!JSON.stringify(list).includes(a));
  });
  await t.test('restore appends a revision and cannot mutate original text or earlier history',async()=>{
   await actor('authenticated',a);
   const restored=(await save(target.id,2,null,'restore',0)).edit;assert.equal(restored.revision,3);assert.equal(restored.text,target.text);assert.equal(restored.action,'restore');
   await reject(save(target.id,2,null,'stale restore',1),'PT409');await reject(save(other.id,0,null,'foreign history',2),'PT404');
   await actor('postgres');
   await reject(db.query('update master_review_private.edit_catalog set original_text=$1 where target_id=$2',['mutated',target.id]),'PT403');
   await reject(db.query('delete from master_review_private.edit_revisions where target_id=$1',[target.id]),'PT403');
   assert.deepEqual(await snapshot(),before);
  });
  await t.test('history/export pagination is bounded and a captured export excludes later writes',async()=>{
   await actor('anon');const page1=await call('master_review_shared_history',[dataset,'paragraph',target.id,null,2]);
   assert.deepEqual(page1.revisions.map(x=>x.revision),[3,2]);assert.equal(page1.hasMore,true);
   const page2=await call('master_review_shared_history',[dataset,'paragraph',target.id,page1.nextBeforeRevision,2]);assert.deepEqual(page2.revisions.map(x=>x.revision),[1]);assert.equal(page2.hasMore,false);
   const start=await call('master_review_shared_export',[dataset,0,null,2]);assert.equal(start.totalCount,3);assert.equal(start.revisions.length,2);assert.equal(start.hasMore,true);
   await actor('authenticated',a);await save(other.id,0,'Later independent revision');
   await actor('anon');const tail=await call('master_review_shared_export',[dataset,start.nextAfterId,start.snapshotId,2]);assert.equal(tail.totalCount,3);assert.equal(tail.revisions.length,1);assert.equal(tail.hasMore,false);
   assert.equal(tail.revisions[0].targetId,target.id);
   await reject(call('master_review_shared_history',[dataset,'paragraph',target.id,null,101]),'PT400');
   await reject(call('master_review_shared_export',[dataset,0,null,201]),'PT400');
   await reject(call('master_review_shared_catalog',[dataset,-1,500]),'PT400');
   await reject(call('master_review_shared_list',['human-1021-1559']),'PT404');
  });
  await t.test('input constraints and actor rate limits fail without advancing the current revision',async()=>{
   await actor('authenticated',a);
   for(const args of [[3,'x'.repeat(100001),'',null],[3,'ok','r'.repeat(2001),null],[null,'ok','',null],[3,null,'',null],[3,'ok','',0],[3,null,'',-1]])await reject(save(target.id,...args),'PT400');
   const history=await call('master_review_shared_history',[dataset,'paragraph',target.id,null,50]);assert.equal(history.currentRevision,3);
   await actor('postgres');await db.query(`insert into master_review_private.edit_revisions(dataset_id,kind,target_id,revision,parent_revision,text,text_sha256,reason,action,actor_id,display_name) select $1,'paragraph',$2,n,n-1,'rate fixture',repeat('a',64),'','edit',$3,'fixture' from generate_series(4,63) n`,[dataset,target.id,a]);
   await actor('authenticated',a);await reject(save(other.id,1,'rate excess'),'PT429');
  });
  await t.test('existing note ownership remains enforced after new editing grants',async()=>{
   await actor('authenticated',b);assert.equal((await call('master_review_list_notes',[dataset,null,false])).notes.length,0);
   await reject(call('master_review_update_note',[dataset,oldPrivate,{revision:1,text:'foreign'}]),'PT404');
   await actor('authenticated',a);assert.equal((await call('master_review_list_notes',[dataset,null,false])).notes[0].text,'PRIVATE SENTINEL');
   await actor('postgres');assert.deepEqual(await snapshot(),before);
  });
 }finally{await db.close();}
});

