import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Runs the REAL migration/functions/roles in a local PostgreSQL WASM instance.
// auth.uid and storage.buckets are minimal Supabase boundary fixtures. This does
// not verify a live Supabase Auth flow, REST deployment, or hosted Storage policies.
test('Master PostgreSQL integration: namespace isolation, private wrappers, ownership and unchanged paper schema', async t => {
  const db = new PGlite();
  const actorA='10000000-0000-4000-8000-000000000001';
  const actorB='10000000-0000-4000-8000-000000000002';
  const dataset='master-20261024-attached';
  let privateId,sharedId;
  const call=async(name,args)=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;
  async function actor(role,id=null){
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,...(id?{sub:id}:{})})]);
    await db.exec(`set role ${role}`);
  }
  const mustFail=async(promise,code)=>{await assert.rejects(promise,e=>{assert.equal(e.code,code);return true;});};
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,aud text,role text,email text,is_anonymous boolean);
      create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    `);
    await db.exec(`grant usage on schema auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      create schema storage;
      create table storage.buckets(id text primary key,name text not null,public boolean not null default false);
      insert into auth.users(id) values('${actorA}'),('${actorB}');`);
    const migration=await readFile(new URL('./fixtures/paper-baseline.sql',import.meta.url),'utf8');
    // Install the existing paper implementation only in this isolated fixture.
    // Capture its rows, HWP constraint, RPC definitions and ACLs before adding master.
    await db.exec(await readFile(new URL('../supabase/001_paper_review.sql',import.meta.url),'utf8'));
    await db.query(`insert into public.paper_review_notes(id,dataset_id,owner_id,display_name,text,visibility)
      values('20000000-0000-4000-8000-000000000001','human-1021-1559',$1,'fixture','paper preserved','shared')`,[actorA]);
    const paperSnapshot=async()=> (await db.query(`select jsonb_build_object(
      'dataset',(select to_jsonb(d) from public.paper_review_datasets d where id='human-1021-1559'),
      'notes',(select jsonb_agg(to_jsonb(n) order by id) from public.paper_review_notes n),
      'hwpNotNull',(select attnotnull from pg_attribute where attrelid='public.paper_review_datasets'::regclass and attname='source_hwp_sha256'),
      'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) order by p.proname) from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname like 'paper_review_%'),
      'buckets',(select jsonb_agg(to_jsonb(b) order by id) from storage.buckets b)
      ) as result`)).rows[0].result;
    const beforePaper=await paperSnapshot();
    await t.test('master-only migration preserves existing paper data/constraints/RPCs and creates private tables',async()=>{
      await db.exec(migration);
      const row=(await db.query('select * from master_review_private.datasets')).rows[0];
      assert.equal(row.id,dataset);assert.equal(row.page_count,44);assert.equal(row.footnote_count,0);
      assert.equal(row.thesis_sha256,'92b73e8ad50829cd5df52b7b4e40addd8994499be051b663c0286a804938cd2d');
      assert.equal('source_hwp_sha256' in row,false);
      const wrappers=(await db.query(`select proname,prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'master_review_%'`)).rows;
      assert.equal(wrappers.length,4);assert.ok(wrappers.every(x=>x.prosecdef===false));
      const tables=(await db.query(`select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='master_review_private' and c.relkind='r'`)).rows;
      assert.equal(tables.length,2);assert.ok(tables.every(x=>x.relrowsecurity));
      assert.deepEqual(await paperSnapshot(),beforePaper);
      await db.exec(migration);
      assert.deepEqual(await paperSnapshot(),beforePaper);
    });
    await t.test('anon can list shared notes but cannot read raw table or call create RPC',async()=>{
      await actor('anon');
      assert.deepEqual((await call('master_review_list_notes',[dataset,null,false])).notes,[]);
      await mustFail(db.query('select * from master_review_private.notes'),'42501');
      await mustFail(call('master_review_create_note',[dataset,{text:'anon attack'}]),'42501');
    });
    await t.test('A creates a default-private note and an explicitly shared note',async()=>{
      await actor('authenticated',actorA);
      const privateNote=(await call('master_review_create_note',[dataset,{text:'A private',anchorType:'thesis',page:18}])).note;
      privateId=privateNote.id;
      assert.equal(privateNote.visibility,'private');assert.equal(privateNote.editable,true);assert.equal(privateNote.revision,1);
      assert.equal(privateNote.datasetId,dataset);assert.equal(privateNote.page,18);
      assert.equal('owner_id' in privateNote || 'ownerId' in privateNote || 'userId' in privateNote,false);
      sharedId=(await call('master_review_create_note',[dataset,{text:'A shared',visibility:'shared'}])).note.id;
      await mustFail(db.query('select * from master_review_private.notes'),'42501');
      assert.equal((await call('master_review_list_notes',[dataset,null,false])).notes.length,2);
    });
    await t.test('B sees only A shared note, cannot edit/delete either A note',async()=>{
      await actor('authenticated',actorB);
      const notes=(await call('master_review_list_notes',[dataset,null,false])).notes;
      assert.equal(notes.length,1);assert.equal(notes[0].id,sharedId);assert.equal(notes[0].editable,false);
      for(const id of [privateId,sharedId]){
        await mustFail(call('master_review_update_note',[dataset,id,{revision:1,text:'B attack'}]),'PT404');
        await mustFail(call('master_review_delete_note',[dataset,id,{revision:1}]),'PT404');
      }
      await mustFail(call('master_review_update_note',['other-dataset',sharedId,{revision:1,text:'B attack'}]),'PT404');
    });
    await t.test('A revision update is atomic, stale update/delete are rejected',async()=>{
      await actor('authenticated',actorA);
      const changed=(await call('master_review_update_note',[dataset,privateId,{revision:1,text:'A changed',status:'resolved'}])).note;
      assert.equal(changed.revision,2);assert.equal(changed.text,'A changed');assert.equal(changed.status,'resolved');
      await mustFail(call('master_review_update_note',[dataset,privateId,{revision:1,text:'stale'}]),'PT409');
      await mustFail(call('master_review_delete_note',[dataset,privateId,{revision:1}]),'PT409');
      const notes=(await call('master_review_list_notes',[dataset,'resolved',false])).notes;
      assert.equal(notes.length,1);assert.equal(notes[0].id,privateId);
    });
    await t.test('server rejects invalid input, foreign dataset anchors, owner injection and missing identity',async()=>{
      await actor('authenticated',actorA);
      const invalid=[{}, {text:''},{text:'  \n\t'}, {text:'x'.repeat(10001)}, {text:'ok',quote:'x'.repeat(4001)},
        {text:'ok',noteId:'fn-001'},{text:'ok',noteId:'fn-000'},{text:'ok',anchorType:'thesis',page:45},
        {text:'ok',page:1.5},{text:'ok',x:1.1,y:0.1},{text:'ok',x:0.2},{text:'ok',visibility:'public'},
        {text:'ok',status:'done'},{text:'ok',anchorType:'source'},{text:'ok',anchorType:'footnote'},
        {text:'ok',sourceId:'../private'},{text:'ok',owner_id:actorB},{text:'ok',text2:'unknown'},
        {text:null},{text:'ok',quote:null},{text:'ok',x:'0.1',y:0.2}];
      for(const input of invalid)await mustFail(call('master_review_create_note',[dataset,input]),'PT400');
      await mustFail(call('master_review_create_note',['other-dataset',{text:'bad dataset'}]),'PT404');
      await mustFail(call('master_review_update_note',[dataset,privateId,{revision:2}]),'PT400');
      await mustFail(call('master_review_update_note',[dataset,privateId,{revision:2.5,text:'bad rev'}]),'PT400');
      await actor('authenticated');
      await mustFail(call('master_review_create_note',[dataset,{text:'missing identity'}]),'PT401');
    });
    await t.test('anon list/export never reveal A private note; owner can delete with latest revision',async()=>{
      await actor('anon');
      for(const exported of [false,true]){
        const notes=(await call('master_review_list_notes',[dataset,null,exported])).notes;
        assert.equal(notes.length,1);assert.equal(notes[0].id,sharedId);assert.equal(notes[0].editable,false);
      }
      await actor('authenticated',actorA);
      assert.equal((await call('master_review_delete_note',[dataset,privateId,{revision:2}])).deleted,privateId);
      await mustFail(call('master_review_delete_note',[dataset,privateId,{revision:2}]),'PT404');
    });
    await t.test('master cannot target paper, wrappers expose no privilege escalation, helpers/raw tables stay private',async()=>{
      await actor('authenticated',actorA);
      await mustFail(call('master_review_create_note',['human-1021-1559',{text:'cross-app attack'}]),'PT404');
      await mustFail(call('master_review_update_note',[dataset,'20000000-0000-4000-8000-000000000001',{revision:1,text:'cross-app attack'}]),'PT404');
      await mustFail(call('paper_review_list_notes',[dataset,null,false]),'PT404');
      for(const role of ['anon','authenticated']){
        await actor(role,role==='authenticated'?actorA:null);
        await mustFail(db.query('select * from master_review_private.datasets'),'42501');
        await mustFail(db.query(`select master_review_private.validate_input('{}',true)`),'42501');
        await mustFail(db.query('select master_review_private.public_note(null::master_review_private.notes)'),'42501');
        await mustFail(db.query('create table master_review_private.attack(id integer)'),'42501');
      }
      await actor('postgres');
      assert.deepEqual(await paperSnapshot(),beforePaper);
    });
    await t.test('5,000-row list cap reports truncation and 20,000-row export refuses overflow',async()=>{
      await actor('postgres');
      await db.query(`insert into master_review_private.notes(dataset_id,owner_id,display_name,text,visibility)
        select $1,$2,'fixture','cap fixture','shared' from generate_series(1,20000)`,[dataset,actorA]);
      await actor('anon');
      const list=await call('master_review_list_notes',[dataset,null,false]);
      assert.equal(list.notes.length,5000);assert.equal(list.truncated,true);
      await mustFail(call('master_review_list_notes',[dataset,null,true]),'PT413');
    });
    await actor('postgres');
    assert.deepEqual(await paperSnapshot(),beforePaper);
  } finally { await db.close(); }
});
