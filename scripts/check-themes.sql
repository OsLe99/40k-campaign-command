-- Administrative verification with isolated fixtures; always run the whole file.
begin;
set local statement_timeout='30s';
set local plpgsql.check_asserts=on;
do $$
declare p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid();
begin
  perform set_config('test.theme_owner',p1::text,true);
  perform set_config('test.theme_other',p2::text,true);
  insert into auth.users(id) values(p1),(p2);
  assert (select count(*)=2 from public.profiles where id in(p1,p2) and theme='imperium'), 'New account theme is not Imperium';
  assert not exists(select 1 from information_schema.columns where table_schema='public' and table_name in('campaigns','armies','battles') and column_name='theme'), 'Game records must not carry themes';
end;
$$;
set local role authenticated;
do $$
declare tid text; affected integer;
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.theme_owner'),true);
  foreach tid in array array['imperium','chaos','orks','necrons','tau','aeldari','tyranids','drukhari','votann','genestealer-cults'] loop
    update public.profiles set theme=tid where id=auth.uid();
    assert exists(select 1 from public.profiles where id=auth.uid() and theme=tid), 'Own theme did not persist';
  end loop;
  update public.profiles set theme='chaos' where id=current_setting('test.theme_other')::uuid;
  get diagnostics affected=row_count;
  assert affected=0, 'Owner changed another user preference';
  begin
    update public.profiles set theme='invalid-theme' where id=auth.uid();
    raise exception 'Invalid theme accepted';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set theme=null where id=auth.uid();
    raise exception 'Null theme accepted';
  exception when not_null_violation then null;
  end;
end;
$$;
reset role;
insert into public.global_admins(player_id) values(current_setting('test.theme_owner')::uuid);
set local role authenticated;
do $$
declare affected integer;
begin
  update public.profiles set theme='orks' where id=current_setting('test.theme_other')::uuid;
  get diagnostics affected=row_count;
  assert affected=0, 'Global admin changed another user preference';
  assert exists(select 1 from public.profiles where id=current_setting('test.theme_other')::uuid and theme='imperium'), 'Another user theme changed';
end;
$$;
set local role anon;
do $$
begin
  begin
    update public.profiles set theme='chaos' where id=current_setting('test.theme_owner')::uuid;
    raise exception 'Anonymous theme write accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
select 'PASS: all ten theme values, Imperium defaults, invalid/null rejection, owner isolation, administrator isolation, and anonymous write denial; fixtures rolled back.' as result;
