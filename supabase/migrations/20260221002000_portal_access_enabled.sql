alter table public.profiles
  add column if not exists portal_access_enabled boolean not null default true;

update public.profiles
set portal_access_enabled = true
where portal_access_enabled is null;
