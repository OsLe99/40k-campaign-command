-- Personal presentation only. Existing owner-only profile RLS remains authoritative.
alter table public.profiles add column theme text not null default 'imperium'
  constraint profiles_theme_check check (theme in (
    'imperium','chaos','orks','necrons','tau','aeldari','tyranids','drukhari','votann','genestealer-cults'
  ));
grant update(theme) on public.profiles to authenticated;
comment on column public.profiles.theme is 'Personal UI preference only; never controls campaigns, armies, battles, or another user''s appearance.';
