-- WhatsApp integration base for CRM DIAMANTE
-- - outbound notifications (assistencia/cobranca)
-- - inbound lead capture via webhook (ads/whatsapp)

-- Assistencia tecnica tickets
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  unidade text not null,
  cliente text not null,
  contato text not null,
  tipo text not null check (tipo in ('hidraulica', 'eletrica', 'acabamento', 'estrutura', 'outros')),
  status text not null check (status in ('aberto', 'em_andamento', 'concluido')),
  prazo date not null,
  descricao text not null,
  responsavel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tickets enable row level security;
drop policy if exists "Tickets read" on public.tickets;
create policy "Tickets read"
  on public.tickets for select
  using (auth.uid() is not null);
drop policy if exists "Tickets manage" on public.tickets;
create policy "Tickets manage"
  on public.tickets for all
  using (public.is_manager(auth.uid()));
drop trigger if exists update_tickets_updated_at on public.tickets;
create trigger update_tickets_updated_at
before update on public.tickets
for each row execute function public.update_updated_at_column();

-- WhatsApp message log
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('inbound', 'outbound')),
  channel text not null check (channel in ('assistencia', 'cobranca', 'lead', 'outro')),
  status text not null check (status in ('pending', 'sent', 'failed', 'received')),
  phone text not null,
  target_name text,
  message text not null default '',
  provider text not null default 'meta_cloud',
  provider_message_id text,
  external_ref_type text,
  external_ref_id uuid,
  payload jsonb not null default '{}'::jsonb,
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_messages_created_at
  on public.whatsapp_messages (created_at desc);
create index if not exists idx_whatsapp_messages_phone
  on public.whatsapp_messages (phone);
create index if not exists idx_whatsapp_messages_external_ref
  on public.whatsapp_messages (external_ref_type, external_ref_id);

alter table public.whatsapp_messages enable row level security;
drop policy if exists "WhatsApp read" on public.whatsapp_messages;
create policy "WhatsApp read"
  on public.whatsapp_messages for select
  using (auth.uid() is not null);
drop policy if exists "WhatsApp insert own" on public.whatsapp_messages;
create policy "WhatsApp insert own"
  on public.whatsapp_messages for insert
  with check (auth.uid() = created_by or created_by is null);
drop policy if exists "WhatsApp manage managers" on public.whatsapp_messages;
create policy "WhatsApp manage managers"
  on public.whatsapp_messages for all
  using (public.is_manager(auth.uid()));
