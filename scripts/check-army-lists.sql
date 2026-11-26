-- Run the complete file through an administrative connection; fixtures roll back.
-- This checks SQL authorization, not Storage HTTP byte/MIME/delete behavior.
-- Hosted Storage forbids direct SQL deletes, even inside rolled-back tests.
begin;
set local statement_timeout='30s';
set local plpgsql.check_asserts=on;
do $$
declare p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid();
begin
  perform set_config('test.list_owner',p1::text,true);
  perform set_config('test.list_other',p2::text,true);
  perform set_config('test.list_id',gen_random_uuid()::text,true);
  insert into auth.users(id) values(p1),(p2);
end;
$$;
set local role authenticated;
do $$
declare aid uuid; object_name text;
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.list_owner'),true);
  insert into public.armies(name,faction) values('Attachment verification fixture','Test') returning id into aid;
  perform set_config('test.list_army',aid::text,true);
  object_name:=auth.uid()::text || '/' || aid::text || '/' || current_setting('test.list_id') || '.json';
  perform set_config('test.list_path',object_name,true);
  insert into storage.objects(bucket_id,name) values('army-lists',object_name);
  insert into public.army_lists(id,army_id,object_path,file_name,file_extension,file_size)
    values(current_setting('test.list_id')::uuid,aid,object_name,'roster.json','json',2);
  begin
    update public.army_lists set label='Not allowed';
    raise exception 'Attachment update was permitted';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',current_setting('test.list_other'),true);
  delete from public.army_lists where id=current_setting('test.list_id')::uuid;
  assert found=false, 'Another user deleted the attachment';
  begin
    insert into storage.objects(bucket_id,name) values('army-lists',auth.uid()::text || '/' || aid::text || '/' || gen_random_uuid()::text || '.json');
    raise exception 'Another user uploaded to this army';
  exception when insufficient_privilege then null;
  end;
end;
$$;
set local role anon;
do $$
begin
  perform set_config('request.jwt.claim.sub','',true);
  assert exists(select 1 from public.army_lists where id=current_setting('test.list_id')::uuid), 'Public attachment metadata hidden';
  assert exists(select 1 from storage.objects where bucket_id='army-lists' and name=current_setting('test.list_path')), 'Public attached object hidden';
  begin
    delete from public.army_lists where id=current_setting('test.list_id')::uuid;
    raise exception 'Anonymous attachment delete permitted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
insert into public.global_admins(player_id) values(current_setting('test.list_other')::uuid);
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.list_other'),true);
  delete from public.army_lists where id=current_setting('test.list_id')::uuid;
  assert found, 'Global administrator cannot remove attachment';
end;
$$;
reset role;
rollback;
select 'PASS: attachment owner upload, public reads, non-owner isolation, immutable metadata, anonymous delete denial, and global metadata moderation; fixtures rolled back. Storage HTTP/delete behavior is not verified.' as result;
