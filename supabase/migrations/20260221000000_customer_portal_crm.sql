create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cpf text unique not null,
  full_name text not null,
  phone_e164 text not null,
  phone_last6 text not null,
  client_external_id text,
  created_at timestamptz not null default now(),
  constraint profiles_cpf_digits check (cpf ~ '^\d{11}$'),
  constraint profiles_phone_last6_digits check (phone_last6 ~ '^\d{6}$')
);

create table if not exists public.agents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  contract_number text primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  development_id text not null,
  development_name text not null,
  unit_id text not null,
  unit_label text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_agent(p_uid uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.agents a
    where a.user_id = p_uid
      and a.is_active = true
  );
$$;

create or replace function public.user_owns_contract(
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

create or replace function public.contract_from_object_path(p_path text)
returns text
language sql
immutable
as $$
  select nullif(split_part(coalesce(p_path, ''), '/', 1), '');
$$;

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  category text not null,
  title text not null,
  body text not null,
  image_url text,
  published_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  type text not null,
  title text not null,
  storage_path text not null,
  published_at timestamptz not null default now()
);

create table if not exists public.read_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  read_at timestamptz not null default now(),
  constraint read_tracking_unique unique (user_id, contract_number, item_type, item_id)
);

create table if not exists public.financial_bills (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  status text not null,
  amount_cents int not null,
  due_date date not null,
  competence text,
  barcode_line text,
  bill_pdf_path text,
  created_at timestamptz not null default now(),
  constraint financial_bills_amount_positive check (amount_cents >= 0)
);

create table if not exists public.financial_statement (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  entry_date date not null,
  description text not null,
  entry_type text not null,
  amount_cents int not null,
  status text not null,
  created_at timestamptz not null default now(),
  constraint financial_statement_amount_nonzero check (amount_cents <> 0)
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  request_type text not null,
  payload jsonb not null,
  status text not null,
  created_by_user uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requests_type_check check (request_type in ('anticipation', 'renegotiation')),
  constraint requests_status_check check (status in ('open', 'in_review', 'approved', 'rejected', 'completed'))
);

create table if not exists public.construction_progress (
  contract_number text primary key references public.contracts(contract_number) on delete cascade,
  progress_percent numeric(5,2) not null default 0,
  stages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint construction_progress_percent_check check (progress_percent >= 0 and progress_percent <= 100)
);

create table if not exists public.photo_galleries (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  month_ref date not null,
  publication_at timestamptz not null,
  title text not null,
  description text,
  constraint photo_galleries_unique_month unique (contract_number, month_ref)
);

create table if not exists public.photo_gallery_items (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.photo_galleries(id) on delete cascade,
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  storage_path text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  created_by_user uuid not null references auth.users(id),
  subject text not null,
  category text not null,
  message text not null,
  status text not null default 'open',
  protocol text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_status_check check (status in ('open', 'in_progress', 'waiting_client', 'closed'))
);

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  size_bytes int not null,
  created_at timestamptz not null default now(),
  constraint ticket_attachments_size_positive check (size_bytes >= 0)
);

create table if not exists public.faq (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  answer text not null,
  sort_order int not null default 0
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'new',
  priority text not null default 'normal',
  assigned_agent_id uuid references auth.users(id),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint conversations_contract_unique unique (contract_number),
  constraint conversations_status_check check (status in ('new', 'open', 'pending', 'closed')),
  constraint conversations_priority_check check (priority in ('low', 'normal', 'high', 'urgent'))
);

create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  size_bytes int not null,
  created_at timestamptz not null default now(),
  constraint chat_attachments_size_positive check (size_bytes >= 0)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contract_number text not null references public.contracts(contract_number) on delete cascade,
  sender_type text not null,
  sender_user_id uuid references auth.users(id),
  message_type text not null,
  body_text text,
  attachment_id uuid references public.chat_attachments(id),
  created_at timestamptz not null default now(),
  read_at_client timestamptz,
  read_at_agent timestamptz,
  constraint messages_sender_type_check check (sender_type in ('client', 'agent', 'system')),
  constraint messages_type_check check (message_type in ('text', 'attachment', 'note', 'system'))
);

create table if not exists public.macros (
  id uuid primary key default gen_random_uuid(),
  created_by_agent uuid not null references auth.users(id),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.login_attempts (
  cpf text primary key,
  attempts int not null default 0,
  last_failed_at timestamptz,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint login_attempts_cpf_digits check (cpf ~ '^\d{11}$')
);

create index if not exists idx_contracts_user_id on public.contracts(user_id);
create index if not exists idx_news_contract_published_at on public.news(contract_number, published_at desc);
create index if not exists idx_documents_contract_published_at on public.documents(contract_number, published_at desc);
create index if not exists idx_financial_bills_contract_due_date on public.financial_bills(contract_number, due_date);
create index if not exists idx_messages_conversation_created_at on public.messages(conversation_id, created_at desc);
create index if not exists idx_conversations_last_message_at on public.conversations(last_message_at desc);

create trigger trg_requests_updated_at
before update on public.requests
for each row execute function public.set_updated_at();

create trigger trg_tickets_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

create trigger trg_login_attempts_updated_at
before update on public.login_attempts
for each row execute function public.set_updated_at();

create or replace function public.default_ticket_protocol()
returns trigger
language plpgsql
as $$
begin
  if new.protocol is null or btrim(new.protocol) = '' then
    new.protocol := 'TCK-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 8);
  end if;
  return new;
end;
$$;

create trigger trg_ticket_protocol
before insert on public.tickets
for each row execute function public.default_ticket_protocol();

-- Realtime tables
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.tickets;

-- FAQ is public-read and has no RLS requirement
grant select on table public.faq to anon, authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.contracts enable row level security;
alter table public.news enable row level security;
alter table public.documents enable row level security;
alter table public.read_tracking enable row level security;
alter table public.financial_bills enable row level security;
alter table public.financial_statement enable row level security;
alter table public.requests enable row level security;
alter table public.construction_progress enable row level security;
alter table public.photo_galleries enable row level security;
alter table public.photo_gallery_items enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.chat_attachments enable row level security;
alter table public.macros enable row level security;
alter table public.login_attempts enable row level security;

-- profiles
create policy "profiles_select_own_or_agent"
on public.profiles
for select
using (auth.uid() = user_id or public.is_agent(auth.uid()));

create policy "profiles_insert_self_or_agent"
on public.profiles
for insert
with check (auth.uid() = user_id or public.is_agent(auth.uid()));

create policy "profiles_update_self_or_agent"
on public.profiles
for update
using (auth.uid() = user_id or public.is_agent(auth.uid()))
with check (auth.uid() = user_id or public.is_agent(auth.uid()));

-- agents
create policy "agents_select_agents_only"
on public.agents
for select
using (public.is_agent(auth.uid()));

create policy "agents_write_agents_only"
on public.agents
for all
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

-- contracts
create policy "contracts_select_owner_or_agent"
on public.contracts
for select
using (user_id = auth.uid() or public.is_agent(auth.uid()));

create policy "contracts_write_agent"
on public.contracts
for all
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

-- generic agent-write policy helper applied table-by-table
create policy "news_select_owner_or_agent"
on public.news
for select
using (public.user_owns_contract(contract_number, auth.uid()) or public.is_agent(auth.uid()));

create policy "news_write_agent"
on public.news
for all
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

create policy "documents_select_owner_or_agent"
on public.documents
for select
using (public.user_owns_contract(contract_number, auth.uid()) or public.is_agent(auth.uid()));

create policy "documents_write_agent"
on public.documents
for all
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

create policy "read_tracking_select_own_or_agent"
on public.read_tracking
for select
using (user_id = auth.uid() or public.is_agent(auth.uid()));

create policy "read_tracking_insert_own"
on public.read_tracking
for insert
with check (
  user_id = auth.uid()
  and public.user_owns_contract(contract_number, auth.uid())
);

create policy "read_tracking_update_own_or_agent"
on public.read_tracking
for update
using (user_id = auth.uid() or public.is_agent(auth.uid()))
with check (user_id = auth.uid() or public.is_agent(auth.uid()));

create policy "financial_bills_select_owner_or_agent"
on public.financial_bills
for select
using (public.user_owns_contract(contract_number, auth.uid()) or public.is_agent(auth.uid()));

create policy "financial_bills_write_agent"
on public.financial_bills
for all
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

create policy "financial_statement_select_owner_or_agent"
on public.financial_statement
for select
using (public.user_owns_contract(contract_number, auth.uid()) or public.is_agent(auth.uid()));

create policy "financial_statement_write_agent"
on public.financial_statement
for all
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

create policy "requests_select_owner_or_agent"
on public.requests
for select
using (public.user_owns_contract(contract_number, auth.uid()) or public.is_agent(auth.uid()));

create policy "requests_insert_client_or_agent"
on public.requests
for insert
with check (
  (
    created_by_user = auth.uid()
    and public.user_owns_contract(contract_number, auth.uid())
    and request_type in ('anticipation', 'renegotiation')
  )
  or public.is_agent(auth.uid())
);

create policy "requests_update_agent"
on public.requests
for update
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

create policy "construction_progress_select_owner_or_agent"
on public.construction_progress
for select
using (public.user_owns_contract(contract_number, auth.uid()) or public.is_agent(auth.uid()));

create policy "construction_progress_write_agent"
on public.construction_progress
for all
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

create policy "photo_galleries_select_owner_if_published_or_agent"
on public.photo_galleries
for select
using (
  public.is_agent(auth.uid())
  or (
    public.user_owns_contract(contract_number, auth.uid())
    and publication_at <= now()
  )
);

create policy "photo_galleries_write_agent"
on public.photo_galleries
for all
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

create policy "photo_gallery_items_select_owner_if_gallery_published_or_agent"
on public.photo_gallery_items
for select
using (
  public.is_agent(auth.uid())
  or (
    public.user_owns_contract(contract_number, auth.uid())
    and exists (
      select 1
      from public.photo_galleries g
      where g.id = photo_gallery_items.gallery_id
        and g.publication_at <= now()
    )
  )
);

create policy "photo_gallery_items_write_agent"
on public.photo_gallery_items
for all
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

create policy "tickets_select_owner_or_agent"
on public.tickets
for select
using (public.user_owns_contract(contract_number, auth.uid()) or public.is_agent(auth.uid()));

create policy "tickets_insert_client_or_agent"
on public.tickets
for insert
with check (
  (
    created_by_user = auth.uid()
    and public.user_owns_contract(contract_number, auth.uid())
  )
  or public.is_agent(auth.uid())
);

create policy "tickets_update_agent"
on public.tickets
for update
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

create policy "ticket_attachments_select_owner_or_agent"
on public.ticket_attachments
for select
using (
  public.is_agent(auth.uid())
  or exists (
    select 1
    from public.tickets t
    where t.id = ticket_attachments.ticket_id
      and public.user_owns_contract(t.contract_number, auth.uid())
  )
);

create policy "ticket_attachments_insert_client_or_agent"
on public.ticket_attachments
for insert
with check (
  public.is_agent(auth.uid())
  or exists (
    select 1
    from public.tickets t
    where t.id = ticket_attachments.ticket_id
      and t.created_by_user = auth.uid()
      and public.user_owns_contract(t.contract_number, auth.uid())
  )
);

create policy "ticket_attachments_update_agent"
on public.ticket_attachments
for update
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

create policy "conversations_select_owner_or_agent"
on public.conversations
for select
using (user_id = auth.uid() or public.is_agent(auth.uid()));

create policy "conversations_insert_client_or_agent"
on public.conversations
for insert
with check (
  (
    user_id = auth.uid()
    and public.user_owns_contract(contract_number, auth.uid())
  )
  or public.is_agent(auth.uid())
);

create policy "conversations_update_owner_or_agent"
on public.conversations
for update
using (user_id = auth.uid() or public.is_agent(auth.uid()))
with check (user_id = auth.uid() or public.is_agent(auth.uid()));

create policy "messages_select_owner_or_agent"
on public.messages
for select
using (
  public.is_agent(auth.uid())
  or (
    message_type <> 'note'
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
);

create policy "messages_insert_client"
on public.messages
for insert
with check (
  sender_type = 'client'
  and sender_user_id = auth.uid()
  and message_type in ('text', 'attachment')
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
      and c.contract_number = messages.contract_number
  )
);

create policy "messages_insert_agent"
on public.messages
for insert
with check (
  public.is_agent(auth.uid())
  and sender_type in ('agent', 'system')
  and (
    (sender_type = 'agent' and sender_user_id = auth.uid())
    or sender_type = 'system'
  )
  and message_type in ('text', 'attachment', 'note', 'system')
);

create policy "messages_update_owner_or_agent"
on public.messages
for update
using (
  public.is_agent(auth.uid())
  or exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
)
with check (
  public.is_agent(auth.uid())
  or exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create policy "chat_attachments_select_owner_or_agent"
on public.chat_attachments
for select
using (
  public.is_agent(auth.uid())
  or exists (
    select 1
    from public.conversations c
    where c.id = chat_attachments.conversation_id
      and c.user_id = auth.uid()
  )
);

create policy "chat_attachments_insert_client_or_agent"
on public.chat_attachments
for insert
with check (
  public.is_agent(auth.uid())
  or exists (
    select 1
    from public.conversations c
    where c.id = chat_attachments.conversation_id
      and c.user_id = auth.uid()
      and c.contract_number = chat_attachments.contract_number
  )
);

create policy "macros_select_agents"
on public.macros
for select
using (public.is_agent(auth.uid()));

create policy "macros_insert_agents"
on public.macros
for insert
with check (public.is_agent(auth.uid()) and created_by_agent = auth.uid());

create policy "macros_update_agents"
on public.macros
for update
using (public.is_agent(auth.uid()))
with check (public.is_agent(auth.uid()));

-- login attempts: no client access; service role bypasses RLS

-- Storage buckets
insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('bills', 'bills', false),
  ('gallery', 'gallery', false),
  ('tickets', 'tickets', false),
  ('chat', 'chat', false)
on conflict (id) do nothing;

-- Agents can manage files in all private buckets
create policy "storage_agent_select"
on storage.objects
for select
using (
  bucket_id in ('documents', 'bills', 'gallery', 'tickets', 'chat')
  and public.is_agent(auth.uid())
);

create policy "storage_agent_insert"
on storage.objects
for insert
with check (
  bucket_id in ('documents', 'bills', 'gallery', 'tickets', 'chat')
  and public.is_agent(auth.uid())
);

create policy "storage_agent_update"
on storage.objects
for update
using (
  bucket_id in ('documents', 'bills', 'gallery', 'tickets', 'chat')
  and public.is_agent(auth.uid())
)
with check (
  bucket_id in ('documents', 'bills', 'gallery', 'tickets', 'chat')
  and public.is_agent(auth.uid())
);

create policy "storage_agent_delete"
on storage.objects
for delete
using (
  bucket_id in ('documents', 'bills', 'gallery', 'tickets', 'chat')
  and public.is_agent(auth.uid())
);

-- Clients may upload only on own contract paths for tickets/chat
create policy "storage_client_insert_tickets"
on storage.objects
for insert
with check (
  bucket_id = 'tickets'
  and auth.role() = 'authenticated'
  and public.user_owns_contract(public.contract_from_object_path(name), auth.uid())
);

create policy "storage_client_insert_chat"
on storage.objects
for insert
with check (
  bucket_id = 'chat'
  and auth.role() = 'authenticated'
  and public.user_owns_contract(public.contract_from_object_path(name), auth.uid())
);

-- Search helper
create or replace function public.global_search_contract(
  p_q text,
  p_contract_number text
)
returns jsonb
language plpgsql
stable
as $$
declare
  q text := '%' || lower(coalesce(trim(p_q), '')) || '%';
  news_data jsonb;
  documents_data jsonb;
  faq_data jsonb;
  tickets_data jsonb;
  bills_data jsonb;
  messages_data jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into news_data
  from (
    select id, title, category, published_at
    from public.news
    where contract_number = p_contract_number
      and (lower(title) like q or lower(body) like q)
    order by published_at desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into documents_data
  from (
    select id, title, type, published_at
    from public.documents
    where contract_number = p_contract_number
      and lower(title) like q
    order by published_at desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into faq_data
  from (
    select id, category, question
    from public.faq
    where lower(question) like q or lower(answer) like q
    order by sort_order asc
    limit 10
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into tickets_data
  from (
    select id, protocol, subject, status, created_at
    from public.tickets
    where contract_number = p_contract_number
      and (lower(subject) like q or lower(message) like q or lower(protocol) like q)
    order by created_at desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into bills_data
  from (
    select id, status, due_date, amount_cents
    from public.financial_bills
    where contract_number = p_contract_number
      and (
        lower(coalesce(competence, '')) like q
        or lower(coalesce(barcode_line, '')) like q
      )
    order by due_date desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into messages_data
  from (
    select m.id, m.created_at, m.body_text, m.message_type
    from public.messages m
    where m.contract_number = p_contract_number
      and lower(coalesce(m.body_text, '')) like q
    order by m.created_at desc
    limit 10
  ) t;

  return jsonb_build_object(
    'news', news_data,
    'documents', documents_data,
    'faq', faq_data,
    'tickets', tickets_data,
    'bills', bills_data,
    'messages', messages_data
  );
end;
$$;
