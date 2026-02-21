alter table public.profiles
  add column if not exists email_contact text,
  add column if not exists address_line text;

create or replace function public.owns_contract(
  p_contract_number text,
  p_uid uuid default auth.uid()
)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.contracts c
    where c.contract_number = p_contract_number
      and c.user_id = p_uid
  );
$$;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_notifications boolean not null default true,
  whatsapp_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "user_settings_select_owner_or_agent"
on public.user_settings
for select
using (user_id = auth.uid() or public.is_agent(auth.uid()));

create policy "user_settings_insert_owner_or_agent"
on public.user_settings
for insert
with check (user_id = auth.uid() or public.is_agent(auth.uid()));

create policy "user_settings_update_owner_or_agent"
on public.user_settings
for update
using (user_id = auth.uid() or public.is_agent(auth.uid()))
with check (user_id = auth.uid() or public.is_agent(auth.uid()));
