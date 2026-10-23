-- Read-only verification of independent master schema and unchanged paper objects.
select jsonb_build_object(
  'master_dataset', (select to_jsonb(d) from master_review_private.datasets d where id='master-20261024-attached'),
  'paper_hwp_still_not_null', (select attnotnull from pg_attribute where attrelid='public.paper_review_datasets'::regclass and attname='source_hwp_sha256'),
  'paper_dataset_unchanged', (select md5(to_jsonb(d)::text)='f4166eebab55ae5ea555826876b6c1c3' from public.paper_review_datasets d where id='human-1021-1559'),
  'paper_storage_unchanged', (select count(*)=224 and md5(string_agg(id::text||':'||name||':'||updated_at::text,',' order by name))='40ab96478e0bc7aee76ea3e44fff97f5' from storage.objects where bucket_id='paper-review-documents'),
  'master_bucket', (select jsonb_build_object('id',id,'name',name,'public',public) from storage.buckets where id='master-review-documents'),
  'master_objects', (select coalesce(jsonb_agg(jsonb_build_object('name',name,'metadata',metadata) order by name),'[]'::jsonb) from storage.objects where bucket_id='master-review-documents'),
  'master_notes_count', (select count(*) from master_review_private.notes),
  'paper_notes_count', (select count(*) from public.paper_review_notes),
  'storage_policy_count', (select count(*) from pg_policies where schemaname='storage'),
  'master_rls', (select jsonb_agg(jsonb_build_object('table',c.relname,'enabled',c.relrowsecurity) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='master_review_private' and c.relkind='r'),
  'public_wrappers', (select jsonb_agg(jsonb_build_object('name',p.proname,'securityDefiner',p.prosecdef,'acl',p.proacl::text) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'master_review_%'),
  'browser_direct_note_access', (has_table_privilege('anon','master_review_private.notes','SELECT') or has_table_privilege('authenticated','master_review_private.notes','SELECT') or has_table_privilege('anon','master_review_private.notes','INSERT') or has_table_privilege('authenticated','master_review_private.notes','INSERT')),
  'browser_schema_create', (has_schema_privilege('anon','master_review_private','CREATE') or has_schema_privilege('authenticated','master_review_private','CREATE')),
  'browser_helper_execute', (has_function_privilege('anon','master_review_private.validate_input(jsonb,boolean)','EXECUTE') or has_function_privilege('authenticated','master_review_private.validate_input(jsonb,boolean)','EXECUTE') or has_function_privilege('anon','master_review_private.public_note(master_review_private.notes)','EXECUTE') or has_function_privilege('authenticated','master_review_private.public_note(master_review_private.notes)','EXECUTE')),
  'anon_note_write_rpc_grant', has_function_privilege('anon','public.master_review_create_note(text,jsonb)','EXECUTE'),
  'master_notes_public_result', public.master_review_list_notes('master-20261024-attached',null,false)
) as master_verification;
