create table public.army_lists (
  id uuid primary key default gen_random_uuid(),
  army_id uuid not null references public.armies(id) on delete restrict,
  uploaded_by uuid not null default auth.uid() references public.profiles(id),
  object_path text not null unique,
  file_name text not null check (length(file_name) between 1 and 180 and file_name !~ E'[/\\[:cntrl:]]'),
  file_extension text not null check (file_extension in ('json','ros','rosz','txt','pdf')),
  file_size integer not null check (file_size between 1 and 8388608),
  label text not null default '' check (length(label) <= 120),
  uploaded_at timestamptz not null default now(),
  check (object_path = uploaded_by::text || '/' || army_id::text || '/' || id::text || '.' || file_extension),
  check (lower(right(file_name, length(file_extension) + 1)) = '.' || file_extension)
);
create index army_lists_army_idx on public.army_lists(army_id, uploaded_at desc);
create index army_lists_uploader_idx on public.army_lists(uploaded_by);
alter table public.army_lists enable row level security;
revoke all on public.army_lists from public, anon, authenticated;
grant select on public.army_lists to anon, authenticated;
grant insert, delete on public.army_lists to authenticated;

-- Army profiles are public; attaching a file makes its download public too.
create policy army_lists_read on public.army_lists for select using (true);
create policy army_lists_upload on public.army_lists for insert to authenticated with check (
  uploaded_by = (select auth.uid())
  and exists(select 1 from public.armies a where a.id = army_id and a.owner_id = (select auth.uid()))
  and exists(select 1 from storage.objects o where o.bucket_id = 'army-lists' and o.name = object_path)
);
create policy army_lists_remove on public.army_lists for delete to authenticated using (
  uploaded_by = (select auth.uid()) or private.is_global_admin()
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values (
  'army-lists', 'army-lists', false, 8388608,
  array['application/json','application/xml','application/zip','text/plain','application/pdf']
);
create policy army_list_object_read on storage.objects for select using (
  bucket_id = 'army-lists' and (
    split_part(name,'/',1) = (select auth.uid())::text
    or private.is_global_admin()
    or exists(select 1 from public.army_lists l where l.object_path = storage.objects.name)
  )
);
create policy army_list_object_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'army-lists'
  and split_part(name,'/',1) = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(json|ros|rosz|txt|pdf)$'
  and exists(select 1 from public.armies a where a.id::text = split_part(storage.objects.name,'/',2) and a.owner_id = (select auth.uid()))
);
create policy army_list_object_remove on storage.objects for delete to authenticated using (
  bucket_id = 'army-lists' and (split_part(name,'/',1) = (select auth.uid())::text or private.is_global_admin())
);
